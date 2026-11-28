// Local relational simulation, not native Forge/KVS/Zabbix integration acceptance.
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { monitoringFixture } from '../support/monitoring';
import { MonitoringService } from '../../src/application/monitoring/service';
import { InventoryService } from '../../src/application/inventory/service';
import { ZabbixAdapter } from '../../src/infrastructure/monitoring/zabbix-adapter';

describe('automated Border Control with real repository queries in adapted SQLite', () => {
  it('persists before dispatch, suppresses duplicates, detects changed identity content and retains unknown mappings visibly', async () => {
    const f = await monitoringFixture();
    f.deps.queue.push.mockImplementationOnce(async (ctx, id) => {
      expect(await f.repository.inbox(ctx, id)).not.toBeNull();
      f.jobs.push({ ctx, id });
    });
    expect(await f.service.receive(f.request(), 'internal-test')).toBe(
      'accepted',
    );
    expect(await f.service.receive(f.request(), 'internal-test')).toBe(
      'accepted',
    );
    expect(f.jobs).toHaveLength(1);
    expect(
      await f.service.receive(
        f.request({ ...f.event, title: 'Changed' }),
        'internal-test',
      ),
    ).toBe('conflict');
    await f.process();
    const list = await f.service.overview({ tenantId: f.tenantId });
    expect(list.receipts).toHaveLength(1);
    expect(list.receipts[0]).toMatchObject({
      status: 'manual_triage',
      reason: 'UNKNOWN_MAPPING',
      occurredAt: f.event.occurredAt,
      receivedAt: f.event.occurredAt,
      attempts: 1,
    });
    expect(JSON.stringify(list)).not.toContain(f.token);
    expect(JSON.stringify(list)).not.toContain('secret_ref');
    expect(
      f.h.sqlite.prepare('SELECT COUNT(*) AS n FROM monitoring_inbox').get(),
    ).toMatchObject({ n: 1 });
  });
  it('maps known resources, preserves independent recovery/update identity and never writes inventory or closes a JSM incident', async () => {
    const f = await monitoringFixture();
    const topology = await f.topology();
    for (const payload of [
      f.event,
      { ...f.event, externalEventId: '101', kind: 'recovery' },
      { ...f.event, externalEventId: '102', kind: 'update' },
    ])
      expect(await f.service.receive(f.request(payload), 'id')).toBe(
        'accepted',
      );
    await f.process();
    const list = await f.service.overview({ tenantId: f.tenantId });
    expect(list.receipts).toHaveLength(3);
    for (const row of list.receipts)
      expect(row).toMatchObject({
        status: 'ready',
        reason: null,
        problemEventId: '100',
        uplinkId: topology.uplinkId,
        siteId: topology.siteId,
      });
    expect(
      f.h.sqlite
        .prepare('SELECT version FROM uplinks WHERE id = ?')
        .get(topology.uplinkId),
    ).toMatchObject({ version: 1 });
  });
  it('does not acknowledge non-durable insertion or successful dispatch when push fails; retries recover the durable gap', async () => {
    const f = await monitoringFixture();
    f.h.failNext('INSERT INTO monitoring_inbox');
    expect(await f.service.receive(f.request(), 'id')).toBe('unavailable');
    expect(f.jobs).toHaveLength(0);
    f.deps.queue.push.mockRejectedValueOnce(new Error('unlogged-secret'));
    expect(await f.service.receive(f.request(), 'id')).toBe('unavailable');
    const first = (await f.service.overview({ tenantId: f.tenantId }))
      .receipts[0]!;
    expect(first.status).toBe('received');
    expect(await f.service.receive(f.request(), 'id')).toBe('unavailable');
    f.setNow('2026-11-26T00:01:01.000Z');
    expect(
      await f.service.retry({ tenantId: f.tenantId, inboxId: first.id }),
    ).toEqual({ dispatched: true });
    await f.process();
    expect(
      (await f.service.overview({ tenantId: f.tenantId })).receipts[0],
    ).toMatchObject({
      id: first.id,
      status: 'manual_triage',
      receivedAt: f.event.occurredAt,
    });
  });
  it('handles queue success followed by persistence failure, worker duplicates, bounded retries and expired worker leases', async () => {
    const f = await monitoringFixture();
    f.h.failNext('SET status = ?, reason = NULL');
    expect(await f.service.receive(f.request(), 'id')).toBe('unavailable');
    expect(f.jobs).toHaveLength(1);
    const id = f.jobs[0]!.id;
    const token = f.deps.id();
    expect(
      await f.repository.claim(
        f.ctx,
        id,
        token,
        f.deps.now(),
        '2026-11-26T00:01:00.000Z',
      ),
    ).toBe(true);
    await f.service.process(f.ctx, id);
    expect((await f.repository.inbox(f.ctx, id))!.attempts).toBe(1);
    f.setNow('2026-11-26T00:01:01.000Z');
    await f.process();
    await f.service.process(f.ctx, id);
    expect((await f.repository.inbox(f.ctx, id))!.attempts).toBe(2);
    expect(
      await f.repository.finish(
        f.ctx,
        id,
        token,
        'ready',
        null,
        null,
        null,
        f.deps.now(),
      ),
    ).toBe(false);
  });
  it('bounds processing errors and exposes retry exhaustion rather than dropping the receipt', async () => {
    const f = await monitoringFixture();
    await f.service.receive(f.request(), 'id');
    const id = f.jobs[0]!.id;
    vi.spyOn(f.repository, 'resolve').mockRejectedValue(
      new Error('never log this'),
    );
    for (let i = 0; i < 5; i++)
      await expect(f.service.process(f.ctx, id)).rejects.toThrow('UNAVAILABLE');
    expect(await f.repository.inbox(f.ctx, id)).toMatchObject({
      status: 'manual_triage',
      reason: 'RETRY_EXHAUSTED',
      attempts: 5,
    });
    await expect(
      f.service.retry({ tenantId: f.tenantId, inboxId: id }),
    ).rejects.toThrow('CONFLICT');
    await f.service.process(f.ctx, id);
    expect((await f.repository.inbox(f.ctx, id))!.attempts).toBe(5);
  });
  it('handles an exhausted crash/dispatch ledger and preserves the global attempt limits', async () => {
    const f = await monitoringFixture();
    await f.service.receive(f.request(), 'id');
    const id = f.jobs[0]!.id;
    await f.h.db.write(
      'UPDATE monitoring_inbox SET attempts = 5, status = ?, lease_until = NULL WHERE id = ?',
      ['processing', id],
    );
    expect(await f.repository.reserveDispatch(f.ctx, id, f.deps.now())).toBe(
      false,
    );
    expect(await f.repository.inbox(f.ctx, id)).toMatchObject({
      status: 'manual_triage',
      reason: 'RETRY_EXHAUSTED',
    });
  });
  it('enforces a durable per-source minute budget and separates independent event kinds', async () => {
    const f = await monitoringFixture();
    await f.h.db.write(
      'UPDATE monitoring_sources SET rate_bucket = ?, rate_count = 59 WHERE id = ?',
      ['2026-11-26T00:00', f.configured.sourceId],
    );
    expect(await f.service.receive(f.request(), 'id')).toBe('accepted');
    expect(await f.service.receive(f.request(), 'id')).toBe('rate_limited');
    f.setNow('2026-11-26T00:01:00.000Z');
    expect(await f.service.receive(f.request(), 'id')).toBe('accepted');
  });
  it('binds source/credential/tenant/install, rotates with bounded grace and revokes immediately despite secret cleanup failure', async () => {
    const f = await monitoringFixture();
    const rotatedToken = 'b'.repeat(43);
    const rotated = await f.service.configure({
      tenantId: f.tenantId,
      sourceId: f.configured.sourceId,
      expected: 1,
      overlapSeconds: 60,
      secret: rotatedToken,
    });
    expect(rotated.version).toBe(2);
    expect(await f.service.receive(f.request(), 'id')).toBe('accepted');
    expect(
      await f.service.receive(
        f.request(
          { ...f.event, externalEventId: '103', problemEventId: '103' },
          {
            authorization: ['Bearer ' + rotatedToken],
            'x-light-house-key-id': [rotated.keyId],
          },
        ),
        'id',
      ),
    ).toBe('accepted');
    await expect(
      f.service.configure({
        tenantId: f.tenantId,
        sourceId: rotated.sourceId,
        expected: 2,
        overlapSeconds: 60,
        secret: 'c'.repeat(43),
      }),
    ).rejects.toThrow('CONFLICT');
    f.setNow('2026-11-26T00:01:00.000Z');
    expect(await f.service.receive(f.request(), 'id')).toBe('unauthorised');
    const third = await f.service.configure({
      tenantId: f.tenantId,
      sourceId: rotated.sourceId,
      expected: 2,
      overlapSeconds: 0,
      secret: 'c'.repeat(43),
    });
    expect(third.version).toBe(3);
    f.deps.secrets.remove.mockRejectedValueOnce(new Error('storage error'));
    await expect(
      f.service.revoke({
        tenantId: f.tenantId,
        sourceId: third.sourceId,
        expected: 3,
      }),
    ).rejects.toThrow();
    expect(
      await f.service.receive(
        f.request(f.event, {
          authorization: ['Bearer ' + 'c'.repeat(43)],
          'x-light-house-key-id': [third.keyId],
        }),
        'id',
      ),
    ).toBe('unauthorised');
    await f.service.revoke({
      tenantId: f.tenantId,
      sourceId: third.sourceId,
      expected: 4,
    });
    expect(f.secrets.size).toBe(0);
  });
  it('denies source/secret metadata mismatches and does not trust caller tenant/install claims', async () => {
    const f = await monitoringFixture();
    const secretRef = [...f.secrets.keys()][0]!;
    const stored = f.secrets.get(secretRef)!;
    f.secrets.set(secretRef, { ...stored, tenantId: f.deps.id() });
    expect(await f.service.receive(f.request(), 'id')).toBe('unauthorised');
    f.secrets.set(secretRef, stored);
    expect(
      await f.service.receive(
        f.request({ ...f.event, tenantId: f.deps.id() }),
        'id',
      ),
    ).toBe('invalid');
    const foreignRuntime = new MonitoringService(
      f.deps,
      'other-installation',
      new ZabbixAdapter(),
    );
    expect(await foreignRuntime.receive(f.request(), 'id')).toBe(
      'unauthorised',
    );
    f.secrets.clear();
    expect(await f.service.receive(f.request(), 'id')).toBe('unauthorised');
  });
  it('rejects cross-tenant source and resource configuration and filters all receipt reads/work', async () => {
    const f = await monitoringFixture();
    const top = await f.topology();
    const other = (
      await f.h.service.bootstrap({
        name: 'Beacon Transit',
        slug: 'beacon-transit',
      })
    ).tenantId;
    await expect(
      f.service.configure({
        tenantId: other,
        sourceId: f.configured.sourceId,
        expected: 1,
        secret: f.token,
        overlapSeconds: 0,
      }),
    ).rejects.toThrow('NOT_FOUND');
    const otherSource = await f.service.configure({
      tenantId: other,
      name: 'Other synthetic source',
      secret: 'b'.repeat(43),
    });
    await expect(
      f.service.map({
        tenantId: other,
        sourceId: otherSource.sourceId,
        externalResourceId: 'trigger:1',
        uplinkId: top.uplinkId,
      }),
    ).rejects.toThrow('INVALID');
    await f.service.receive(f.request(), 'id');
    const id = f.jobs[0]!.id;
    const otherCtx = await f.h.service.context(other);
    await f.service.process(otherCtx, id);
    expect(await f.repository.inbox(otherCtx, id)).toBeNull();
    expect(
      (await f.service.overview({ tenantId: other })).receipts,
    ).toHaveLength(0);
    await expect(
      f.service.retry({ tenantId: other, inboxId: id }),
    ).rejects.toThrow('NOT_FOUND');
    expect(
      await f.repository.inbox(
        { ...f.ctx, installationId: 'foreign-installation' },
        id,
      ),
    ).toBeNull();
  });
  it('checks actual stored roles/expiry before each administrative operation and supports reader-only views', async () => {
    const f = await monitoringFixture();
    await f.h.service.grant({
      tenantId: f.tenantId,
      accountId: 'viewer-example',
      role: 'viewer',
      expiresAt: null,
      expected: null,
      status: 'active',
    });
    const viewer = new InventoryService(f.h.deps, {
      ...f.h.session,
      accountId: 'viewer-example',
    });
    const viewerService = new MonitoringService(
      {
        ...f.deps,
        authorise: (tenant, permission) => viewer.context(tenant, permission),
      },
      f.h.session.installationId,
      new ZabbixAdapter(),
    );
    expect(
      (await viewerService.overview({ tenantId: f.tenantId })).sources,
    ).toHaveLength(1);
    await expect(
      viewerService.configure({
        tenantId: f.tenantId,
        name: 'Denied',
        secret: f.token,
      }),
    ).rejects.toThrow('DENIED');
    await expect(
      viewerService.revoke({
        tenantId: f.tenantId,
        sourceId: f.configured.sourceId,
        expected: 1,
      }),
    ).rejects.toThrow('DENIED');
    await expect(
      viewerService.map({
        tenantId: f.tenantId,
        sourceId: f.configured.sourceId,
      }),
    ).rejects.toThrow('DENIED');
    await expect(
      viewerService.retry({ tenantId: f.tenantId, inboxId: f.deps.id() }),
    ).rejects.toThrow('DENIED');
  });
  it('retains inactive-resource and disabled-source events for manual review', async () => {
    const f = await monitoringFixture();
    const topology = await f.topology();
    await f.service.receive(f.request(), 'id');
    await f.h.db.write('UPDATE sites SET status = ? WHERE id = ?', [
      'retired',
      topology.siteId,
    ]);
    await f.process();
    expect(
      (await f.service.overview({ tenantId: f.tenantId })).receipts[0],
    ).toMatchObject({ status: 'manual_triage', reason: 'INACTIVE_RESOURCE' });
    await f.service.receive(
      f.request({ ...f.event, externalEventId: '104', problemEventId: '104' }),
      'id',
    );
    await f.service.revoke({
      tenantId: f.tenantId,
      sourceId: f.configured.sourceId,
      expected: 1,
    });
    await f.process();
    expect(
      (await f.service.overview({ tenantId: f.tenantId })).receipts.some(
        (r) => r.reason === 'SOURCE_DISABLED',
      ),
    ).toBe(true);
  });
  it('requeues an unknown mapping after authorised mapping configuration and keeps the original receipt', async () => {
    const f = await monitoringFixture();
    await f.service.receive(f.request(), 'id');
    await f.process();
    const before = (await f.service.overview({ tenantId: f.tenantId }))
      .receipts[0]!;
    await f.topology();
    await f.service.retry({ tenantId: f.tenantId, inboxId: before.id });
    await f.process();
    expect(
      (await f.service.overview({ tenantId: f.tenantId })).receipts[0],
    ).toMatchObject({
      id: before.id,
      status: 'ready',
      receivedAt: before.receivedAt,
      attempts: 2,
    });
  });
  it('fails closed before monitoring schema readiness and rejects missing/config-conflict controls without secret side effects', async () => {
    const f = await monitoringFixture();
    const count = f.secrets.size;
    await expect(
      f.service.configure({ tenantId: f.tenantId, name: '', secret: f.token }),
    ).rejects.toThrow('INVALID');
    expect(f.secrets.size).toBe(count);
    await expect(
      f.service.configure({
        tenantId: f.tenantId,
        sourceId: f.configured.sourceId,
        expected: 0,
        secret: f.token,
        overlapSeconds: 0,
      }),
    ).rejects.toThrow();
    await expect(
      f.service.revoke({
        tenantId: f.tenantId,
        sourceId: f.deps.id(),
        expected: 1,
      }),
    ).rejects.toThrow('NOT_FOUND');
    await expect(
      f.service.revoke({
        tenantId: f.tenantId,
        sourceId: f.configured.sourceId,
        expected: 99,
      }),
    ).rejects.toThrow('CONFLICT');
    await expect(
      f.service.map({ tenantId: f.tenantId, sourceId: f.deps.id() }),
    ).rejects.toThrow('NOT_FOUND');
    await f.h.db.write('UPDATE monitoring_schema_state SET ready = 0', []);
    expect(await f.service.receive(f.request(), 'id')).toBe('unavailable');
    await expect(f.service.overview({ tenantId: f.tenantId })).rejects.toThrow(
      'NOT_READY',
    );
    await expect(f.service.configure({ tenantId: f.tenantId })).rejects.toThrow(
      'NOT_READY',
    );
  });
});

it('requeues a duplicate after a crashed worker lease expires and fences the old worker result', async () => {
  const h = await monitoringFixture();
  expect(await h.service.receive(h.request(), 'synthetic-correlation')).toBe(
    'accepted',
  );
  const job = h.jobs.shift()!;
  const token = randomUUID();
  expect(
    await h.deps.repository.claim(
      h.ctx,
      job.id,
      token,
      h.deps.now(),
      '2026-11-26T00:01:00.000Z',
    ),
  ).toBe(true);
  h.setNow('2026-11-26T00:01:01.000Z');
  expect(await h.service.receive(h.request(), 'synthetic-correlation')).toBe(
    'accepted',
  );
  expect(h.jobs).toHaveLength(1);
  await h.process();
  expect(
    await h.deps.repository.finish(
      h.ctx,
      job.id,
      token,
      'ready',
      null,
      null,
      null,
      h.deps.now(),
    ),
  ).toBe(false);
  expect(await h.deps.repository.inbox(h.ctx, job.id)).toMatchObject({
    status: 'manual_triage',
    reason: 'UNKNOWN_MAPPING',
    attempts: 2,
  });
});

// Synthetic SQL/secret/queue behavior, not hosted integration acceptance.
import { expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { monitoringFixture } from '../support/monitoring';
it('concurrent submissions create one durable receipt, count replays and retain safe authenticated outcomes', async () => {
  const f = await monitoringFixture();
  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      f.service.receive(f.request(), randomUUID()),
    ),
  );
  expect(results.every((r) => r === 'accepted' || r === 'unavailable')).toBe(
    true,
  );
  await f.process();
  expect(await f.service.receive(f.request(), randomUUID())).toBe('accepted');
  const overview = await f.service.overview({ tenantId: f.tenantId });
  expect(overview.receipts).toHaveLength(1);
  expect(overview.receipts[0]).toMatchObject({
    duplicates: 6,
    status: 'manual_triage',
  });
  expect(f.jobs).toHaveLength(0);
  expect(overview.observations).toHaveLength(7);
  expect(JSON.stringify(overview)).not.toContain(f.token);
  const before = overview.observations.length;
  expect(
    await f.service.receive(
      f.request({}, { authorization: ['Bearer ' + 'z'.repeat(43)] }),
      randomUUID(),
    ),
  ).toBe('unauthorised');
  expect(
    (await f.service.overview({ tenantId: f.tenantId })).observations,
  ).toHaveLength(before);
  expect(
    await f.service.receive(
      f.request({ ...f.event, kind: 'unsupported' }),
      randomUUID(),
    ),
  ).toBe('invalid');
  expect(
    (await f.service.overview({ tenantId: f.tenantId })).observations.some(
      (o) => o.result === 'invalid',
    ),
  ).toBe(true);
});
it('recovers a durable enqueue gap in a bounded admin sweep and cleans only inactive credentials after an intent-write failure', async () => {
  const f = await monitoringFixture();
  f.deps.queue.push.mockRejectedValueOnce(new Error('private'));
  expect(await f.service.receive(f.request(), randomUUID())).toBe(
    'unavailable',
  );
  f.setNow('2026-11-26T00:01:01.000Z');
  expect(await f.service.recover({ tenantId: f.tenantId })).toEqual({
    examined: 1,
    dispatched: 1,
  });
  await f.process();
  expect(await f.service.recover({ tenantId: f.tenantId })).toEqual({
    examined: 0,
    dispatched: 0,
  });
  f.h.failNext('INSERT INTO monitoring_sources');
  await expect(
    f.service.configure({
      tenantId: f.tenantId,
      name: 'Interrupted',
      secret: 'b'.repeat(43),
    }),
  ).rejects.toThrow();
  expect(f.secrets.size).toBe(2);
  expect(await f.service.cleanup({ tenantId: f.tenantId })).toEqual({
    cleaned: 0,
  });
  f.setNow('2026-11-26T01:01:02.000Z');
  expect(await f.service.cleanup({ tenantId: f.tenantId })).toEqual({
    cleaned: 1,
  });
  expect(f.secrets.size).toBe(1);
  expect(
    await f.service.receive(
      f.request({ ...f.event, occurredAt: f.deps.now() }),
      randomUUID(),
    ),
  ).toBe('conflict');
  f.deps.secrets.put.mockRejectedValueOnce(new Error('private KVS'));
  await expect(
    f.service.configure({
      tenantId: f.tenantId,
      name: 'KVS failed',
      secret: 'b'.repeat(43),
    }),
  ).rejects.toThrow();
  f.setNow('2026-11-26T02:01:03.000Z');
  expect(await f.service.cleanup({ tenantId: f.tenantId })).toEqual({
    cleaned: 1,
  });
});
it('preserves durable events when outcome persistence fails and scopes mapping reads to installation', async () => {
  const f = await monitoringFixture();
  await f.topology();
  f.h.failNext('INSERT INTO monitoring_observations');
  expect(await f.service.receive(f.request(), randomUUID())).toBe(
    'unavailable',
  );
  await f.process();
  expect(await f.service.receive(f.request(), randomUUID())).toBe('accepted');
  expect(
    (await f.service.overview({ tenantId: f.tenantId })).receipts,
  ).toHaveLength(1);
  expect(
    await f.repository.mappings(
      { ...f.ctx, installationId: 'foreign' },
      f.configured.sourceId,
    ),
  ).toEqual([]);
  expect(
    await f.repository.resolve(
      { ...f.ctx, installationId: 'foreign' },
      f.configured.sourceId,
      'trigger:1',
    ),
  ).toBeNull();
  vi.spyOn(f.repository, 'ready').mockResolvedValueOnce(false);
  await expect(f.service.recover({ tenantId: f.tenantId })).rejects.toThrow(
    'NOT_READY',
  );
});
it('paginates source and inbox projections without leaking another installation or payload titles', async () => {
  const f = await monitoringFixture();
  for (let i = 0; i < 51; i++)
    await f.repository.createSource(f.ctx, {
      id: randomUUID(),
      tenant_id: f.tenantId,
      installation_id: f.ctx.installationId,
      name: 'Synthetic ' + i,
      source_type: 'zabbix',
      status: 'disabled',
      version: 1,
      current_key_id: null,
      previous_key_id: null,
      previous_until: null,
    });
  for (let i = 0; i < 22; i++) {
    const id = String(100 + i);
    expect(
      await f.service.receive(
        f.request({ ...f.event, externalEventId: id, problemEventId: id }),
        randomUUID(),
      ),
    ).toBe('accepted');
  }
  const first = await f.service.overview({ tenantId: f.tenantId });
  const second = await f.service.overview({
    tenantId: f.tenantId,
    after: first.next,
    sourceAfter: first.sourceNext,
  });
  expect(first.sources).toHaveLength(50);
  expect(second.sources).toHaveLength(2);
  expect(first.receipts).toHaveLength(20);
  expect(second.receipts).toHaveLength(2);
  expect(
    new Set([...first.receipts, ...second.receipts].map((r) => r.id)).size,
  ).toBe(22);
  expect(second.next).toBeNull();
  expect(second.sourceNext).toBeNull();
  expect(JSON.stringify(first)).not.toContain(f.event.title);
});

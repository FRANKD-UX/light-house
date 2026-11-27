import { describe, expect, it, vi } from 'vitest';
import { ZabbixAdapter } from '../../src/infrastructure/monitoring/zabbix-adapter';
import { monitoringFixture } from '../support/monitoring';
import { createKvsSecretStore } from '../../src/infrastructure/monitoring/kvs-secrets';
import { monitoringCrypto } from '../../src/infrastructure/monitoring/crypto';
import type { TenantContext } from '../../src/application/ports/tenant-context';
const ctx: TenantContext = {
  installationId: 'synthetic-installation',
  tenantId: '11111111-1111-4111-8111-111111111111',
  actor: {
    kind: 'monitoring-source',
    sourceId: '22222222-2222-4222-8222-222222222222',
  },
};
const event = {
  schemaVersion: 1,
  externalEventId: '123',
  problemEventId: '123',
  externalResourceId: 'trigger:1',
  kind: 'problem',
  occurredAt: '2026-11-26T00:00:00.000Z',
  severity: '4',
  title: 'Synthetic test',
};
describe('monitoring input trust boundaries', () => {
  it.each([
    null,
    [],
    {},
    { ...event, schemaVersion: 2 },
    { ...event, sourceId: ctx.actor },
    { ...event, externalEventId: '-1' },
    { ...event, problemEventId: '0' },
    { ...event, problemEventId: '124' },
    { ...event, kind: 'closed' },
    { ...event, externalResourceId: "' OR 1=1" },
    { ...event, severity: '6' },
    { ...event, title: '\nsecret' },
    { ...event, occurredAt: 'not-utc' },
    { ...event, title: 'x'.repeat(201) },
  ])(
    'rejects malformed/authority-spoofed source payload %# without raw echo',
    (value) => {
      const result = new ZabbixAdapter().validateAndNormalise(
        value,
        ctx,
        'internal-id',
      );
      expect(result).toEqual({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid monitoring event.',
          retryable: false,
          correlationId: 'internal-id',
        },
      });
    },
  );
  it('normalises provider severity/resource/UTC semantics without assigning SLA priority or accepting caller tenant authority', () => {
    const adapter = new ZabbixAdapter();
    expect(adapter.sourceType).toBe('zabbix');
    expect(adapter.validateAndNormalise(event, ctx, 'id')).toEqual({
      ok: true,
      value: {
        externalEventId: '123',
        problemEventId: '123',
        resourceId: 'trigger:1',
        kind: 'problem',
        occurredAt: event.occurredAt,
        severity: '4',
        title: event.title,
      },
    });
  });
  it('uses only supported encrypted secret methods and fixed-size digest comparison', async () => {
    const client = {
      setSecret: vi.fn(async () => undefined),
      getSecret: vi.fn(async (): Promise<unknown> => ({ synthetic: true })),
      deleteSecret: vi.fn(async () => undefined),
    };
    const store = createKvsSecretStore(client);
    const binding = {
      installationId: ctx.installationId,
      tenantId: ctx.tenantId,
      sourceId: 'source',
      keyId: 'key',
      secret: 'synthetic-only',
    };
    await store.put('synthetic-ref', binding);
    expect(client.setSecret).toHaveBeenCalledWith('synthetic-ref', binding, {
      keyPolicy: 'FAIL_IF_EXISTS',
    });
    expect(await store.get('synthetic-ref')).toEqual({ synthetic: true });
    await store.remove('synthetic-ref');
    expect(client.deleteSecret).toHaveBeenCalledWith('synthetic-ref');
    expect(monitoringCrypto.equalSecret('same', 'same')).toBe(true);
    expect(monitoringCrypto.equalSecret('short', 'longer')).toBe(false);
    expect(monitoringCrypto.digest('x')).toMatch(/^[a-f0-9]{64}$/);
  });
  it('enforces method/UTF8 byte cap/auth headers, bounded replay/content schema before durable writes', async () => {
    const f = await monitoringFixture();
    const valid = f.request();
    const cases: [unknown, string][] = [
      [{ ...valid, method: 'GET' }, 'method'],
      [{ ...valid, userPath: '/extra' }, 'invalid'],
      [{ ...valid, queryParameters: { token: ['synthetic'] } }, 'invalid'],
      [{ ...valid, body: null }, 'invalid'],
      [{ ...valid, body: '界'.repeat(22_000) }, 'too_large'],
      [{ ...valid, headers: {} }, 'unauthorised'],
      [
        f.request(undefined, { authorization: ['Basic synthetic'] }),
        'unauthorised',
      ],
      [
        f.request(undefined, { authorization: ['Bearer ' + 'b'.repeat(43)] }),
        'unauthorised',
      ],
      [
        f.request(undefined, { authorization: ['Bearer short'] }),
        'unauthorised',
      ],
      [
        f.request(undefined, {
          authorization: ['Bearer ' + f.token, 'Bearer other'],
        }),
        'unauthorised',
      ],
      [
        f.request(undefined, { Authorization: ['Bearer ' + f.token] }),
        'unauthorised',
      ],
      [
        f.request(undefined, { 'x-light-house-key-id': [f.deps.id()] }),
        'unauthorised',
      ],
      [
        f.request(undefined, { 'x-light-house-sent-at': ['invalid'] }),
        'invalid',
      ],
      [
        f.request(undefined, {
          'x-light-house-sent-at': ['2026-11-25T23:54:59.000Z'],
        }),
        'invalid',
      ],
      [
        f.request(undefined, {
          'x-light-house-sent-at': ['2026-11-26T00:01:01.000Z'],
        }),
        'invalid',
      ],
      [f.request(undefined, { 'content-type': ['text/plain'] }), 'invalid'],
      [{ ...valid, body: '{' }, 'invalid'],
      [
        f.request({ ...f.event, occurredAt: '2026-11-18T00:00:00.000Z' }),
        'invalid',
      ],
      [
        f.request({ ...f.event, occurredAt: '2026-11-26T00:01:01.000Z' }),
        'invalid',
      ],
    ];
    for (const [request, output] of cases)
      expect(await f.service.receive(request, 'id')).toBe(output);
    expect(
      f.h.sqlite.prepare('SELECT COUNT(*) AS n FROM monitoring_inbox').get(),
    ).toMatchObject({ n: 0 });
    expect(f.jobs).toHaveLength(0);
  });
  it('fails closed on missing schema, foreign claims, stale source versions and SQL failures', async () => {
    const f = await monitoringFixture();
    await expect(
      f.service.configure({
        tenantId: f.tenantId,
        sourceId: f.configured.sourceId,
        expected: 99,
        overlapSeconds: 0,
        secret: f.token,
      }),
    ).rejects.toThrow('CONFLICT');
    expect(
      await f.repository.mappings(f.ctx, f.configured.sourceId),
    ).toHaveLength(0);
    expect(await f.repository.source(f.ctx, f.deps.id())).toBeNull();
    expect(await f.repository.ready('other-installation')).toBe(false);
    await f.service.process(f.ctx, f.deps.id());
    vi.spyOn(f.repository, 'lookupCredential').mockRejectedValueOnce(
      new Error('private'),
    );
    expect(await f.service.receive(f.request(), 'id')).toBe('unavailable');
    f.h.sqlite.exec('DROP TABLE monitoring_schema_state');
    expect(await f.repository.ready(f.ctx.installationId)).toBe(false);
  });
});
it('rejects a JSON array kind instead of coercing it into a supported event type', async () => {
  const f = await monitoringFixture();
  expect(
    await f.service.receive(
      f.request({ ...f.event, kind: ['problem'] }),
      'array-kind-test',
    ),
  ).toBe('invalid');
  expect(
    (await f.service.overview({ tenantId: f.tenantId })).receipts,
  ).toHaveLength(0);
});

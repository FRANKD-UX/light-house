import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  definitions,
  integer,
  InventoryError,
  kind,
  kinds,
  object,
  role,
  text,
  utc,
  uuid,
  validateFields,
} from '../../src/domain/inventory/model';
import { demoPolicy } from '../../src/application/inventory/fixtures';
describe('Sprint 1 domain validation', () => {
  it.each([null, [], 42, 'bad', undefined])('rejects non-object %j', (value) =>
    expect(() => object(value)).toThrow(InventoryError),
  );
  it('validates trust-boundary scalar types, limits, case and UTC', () => {
    expect(object({ key: 1 })).toEqual({ key: 1 });
    expect(text('External-A')).toBe('External-A');
    expect(uuid(randomUUID())).toHaveLength(36);
    expect(integer(1)).toBe(1);
    expect(kind('sites')).toBe('sites');
    expect(role('viewer')).toBe('viewer');
    expect(role('operator')).toBe('operator');
    expect(role('admin')).toBe('admin');
    expect(utc('2026-11-26T00:00:00.000Z')).toContain('Z');
    for (const value of ['', ' x', 'x ', 'x\n', 'x'.repeat(121), 1, null])
      expect(() => text(value)).toThrow('INVALID');
    for (const value of [0, -1, 1.2, Number.MAX_SAFE_INTEGER, Infinity, '1'])
      expect(() => integer(value)).toThrow('INVALID');
    for (const value of ['not-id', '12345678-1234-1234-8234-123456789abc'])
      expect(() => uuid(value)).toThrow('INVALID');
    for (const value of [
      '2026-02-30T00:00:00.000Z',
      '2026-11-26T00:00:00Z',
      '2026-11-26T00:00:00.000+02:00',
      '2026-99-99T99:99:99.999Z',
    ])
      expect(() => utc(value)).toThrow('INVALID');
    expect(() => role('owner')).toThrow();
    expect(() => kind('sites; DROP TABLE')).toThrow();
  });
  it('rejects undeclared fields, lifecycle, and invalid required values', () => {
    expect(() =>
      validateFields(
        'sites',
        { code: 'x', display_name: 'x', secret: 'bad' },
        'active',
      ),
    ).toThrow();
    expect(() => validateFields('sites', {}, 'active')).toThrow();
    expect(() =>
      validateFields('sites', { code: 'x', display_name: 'x' }, 'deleted'),
    ).toThrow();
    expect(
      validateFields(
        'sites',
        { code: 'X', display_name: 'Site' },
        'maintenance',
      ),
    ).toEqual({ code: 'X', display_name: 'Site' });
    expect(kinds).toHaveLength(11);
    expect(Object.keys(definitions)).toEqual([...kinds]);
  });
  it('validates uplinks, mapping and failover semantics', () => {
    const link = {
      site_id: randomUUID(),
      carrier_id: randomUUID(),
      code: 'A',
      role: 'primary',
      capacity_mbps: 1000,
    };
    expect(
      validateFields('uplinks', link, 'active').protected_uplink_id,
    ).toBeNull();
    expect(() =>
      validateFields('uplinks', { ...link, role: 'other' }, 'active'),
    ).toThrow();
    expect(() =>
      validateFields(
        'uplinks',
        { ...link, protected_uplink_id: randomUUID() },
        'active',
      ),
    ).toThrow();
    expect(
      validateFields(
        'assignees',
        { display_alias: 'Demo', mapping_method: 'manual' },
        'unmapped',
      ).atlassian_account_id,
    ).toBeNull();
    expect(() =>
      validateFields(
        'assignees',
        { display_alias: 'Demo', mapping_method: 'manual' },
        'active',
      ),
    ).toThrow();
    expect(
      validateFields(
        'assignees',
        {
          display_alias: 'Demo',
          mapping_method: 'manual',
          atlassian_account_id: 'CaseSensitive',
        },
        'active',
      ).atlassian_account_id,
    ).toBe('CaseSensitive');
    const dep = {
      service_id: randomUUID(),
      uplink_id: randomUUID(),
      dependency_mode: 'required',
    };
    expect(
      validateFields('service_dependencies', dep, 'active').failover_group,
    ).toBeNull();
    expect(() =>
      validateFields(
        'service_dependencies',
        { ...dep, failover_group: 'g' },
        'active',
      ),
    ).toThrow();
    expect(() =>
      validateFields(
        'service_dependencies',
        { ...dep, dependency_mode: 'failover' },
        'active',
      ),
    ).toThrow();
  });
  it('requires positive durations and warning elapsed offsets before deadline', () => {
    const policy = demoPolicy(randomUUID());
    expect(
      validateFields(
        'sla_policy_versions',
        { ...policy, p1_warning_seconds: 0 },
        'draft',
      ).p1_warning_seconds,
    ).toBe(0);
    expect(validateFields('sla_policy_versions', policy, 'published')).toEqual(
      policy,
    );
    for (const key of ['p1', 'p2', 'p3']) {
      expect(() =>
        validateFields(
          'sla_policy_versions',
          {
            ...policy,
            [`${key}_warning_seconds`]: policy[`${key}_duration_seconds`],
          },
          'draft',
        ),
      ).toThrow();
      expect(() =>
        validateFields(
          'sla_policy_versions',
          { ...policy, [`${key}_duration_seconds`]: 0 },
          'draft',
        ),
      ).toThrow();
    }
    expect(() =>
      validateFields(
        'sla_policy_versions',
        { ...policy, effective_until: policy.effective_from },
        'published',
      ),
    ).toThrow();
    expect(
      validateFields(
        'sla_policy_versions',
        { ...policy, effective_until: '2027-01-01T00:00:00.000Z' },
        'published',
      ).effective_until,
    ).toBeTruthy();
  });
});

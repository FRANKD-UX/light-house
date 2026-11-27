import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Synthetic CI placeholder. Hosted commands load only the private owner-approved target.
export let target: Readonly<{
  url: string;
  environment: 'DEVELOPMENT';
  deployedVersion: '3.3.0';
  tenantLabel: 'Lantern Fibre (admin)';
}> = Object.freeze({
  url: 'https://light-house.example.invalid/jira/apps/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222',
  environment: 'DEVELOPMENT',
  deployedVersion: '3.3.0',
  tenantLabel: 'Lantern Fibre (admin)',
});
export const workspace = fileURLToPath(new URL('../../', import.meta.url));
export const local = path.join(workspace, '.local');
export const stateFile = path.join(local, 'auth', 'state.json');
export const reportFile = path.join(local, 'reports', 'acceptance.json');
export function approvedTarget(value: unknown): typeof target {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('APPROVED_TARGET_REQUIRED');
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).some(
      (key) =>
        !['url', 'environment', 'deployedVersion', 'tenantLabel'].includes(key),
    ) ||
    typeof v.url !== 'string' ||
    v.environment !== 'DEVELOPMENT' ||
    v.deployedVersion !== '3.3.0' ||
    v.tenantLabel !== 'Lantern Fibre (admin)'
  )
    throw new Error('APPROVED_TARGET_REQUIRED');
  const u = new URL(v.url);
  if (
    u.protocol !== 'https:' ||
    !/^[a-z0-9-]+\.atlassian\.net$/.test(u.hostname) ||
    u.port ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !/^\/jira\/apps\/1ef4af03-f1ed-4498-a83e-1a8978cf5430\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      u.pathname,
    )
  )
    throw new Error('APPROVED_TARGET_REQUIRED');
  return Object.freeze({
    url: v.url,
    environment: 'DEVELOPMENT',
    deployedVersion: '3.3.0',
    tenantLabel: 'Lantern Fibre (admin)',
  });
}
export async function configureTarget(): Promise<void> {
  const { privateRead } = await import('./private-files.js');
  try {
    target = approvedTarget(
      JSON.parse(await privateRead(path.join(local, 'approved-target.json'))),
    );
  } catch {
    throw new Error('APPROVED_TARGET_REQUIRED');
  }
}
export const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const inventoryTypes = ['sites', 'carriers', 'sla_tiers'] as const;
export type InventoryType = (typeof inventoryTypes)[number];
export const readButtons = [
  'Run health check',
  'Load tenants and schema status',
  'Load inventory',
  'Next page',
] as const;
export type ReadButton = (typeof readButtons)[number];
export function assertReadButton(value: string): asserts value is ReadButton {
  if (!readButtons.some((button) => button === value))
    throw new Error('ACTION_DENIED');
}
export function assertTarget(url: string): void {
  const actual = new URL(url);
  const approved = new URL(target.url);
  if (
    actual.origin !== approved.origin ||
    actual.pathname !== approved.pathname ||
    actual.search ||
    actual.hash
  )
    throw new Error('TARGET_DENIED');
}
export function safeText(value: string): string {
  return value
    .slice(0, 512)
    .replace(/-----BEGIN[^]*?-----END[^]*?-----/g, '[REDACTED]')
    .replace(
      /\b(?:ATATT|gh[pousr]_|xox[baprs]-)[A-Za-z0-9_=.-]+/g,
      '[REDACTED]',
    )
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      '[REDACTED]',
    )
    .replace(
      /\b(?:Bearer\s+\S+|(?:password|cookie|token|secret|authorization)\s*[:=]\s*\S+)/gi,
      '[REDACTED]',
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED EMAIL]')
    .replace(/https?:\/\/\S+/gi, '[REDACTED URL]')
    .split('')
    .map((char) =>
      char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? ' ' : char,
    )
    .join('');
}
export const backendCodes = [
  'INVALID',
  'DENIED',
  'NOT_FOUND',
  'CONFLICT',
  'REPAIR_REQUIRED',
  'NOT_READY',
  'UNAVAILABLE',
];
export function visibleFailure(text: string): {
  backendCode: string | null;
  correlationId: string | null;
} {
  const code = /Backend code: ([A-Z_]+)\./.exec(text)?.[1];
  const id = /Correlation ID: ([a-f0-9-]+)\./i.exec(text)?.[1];
  return {
    backendCode: code && backendCodes.includes(code) ? code : null,
    correlationId: id && uuid.test(id) ? id : null,
  };
}

import { expect, type Browser, type Frame, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  findApp,
  freshClick,
  inventorySection,
  readHealth,
  readInventory,
} from './browser.js';
import {
  assertTarget,
  configureTarget,
  inventoryTypes,
  local,
  reportFile,
  stateFile,
  target,
  visibleFailure,
  type InventoryType,
} from './policy.js';
import { privateCheck, privateRead } from './private-files.js';
import { correlate, hostedLogs } from './logs.js';
import { summary, writeReport } from './report.js';
import type { Operation, Report } from './model.js';
import { authenticate, doctor, launchBrowser } from './auth.js';
import { DiagnosticError, diagnosticMessage } from './diagnostics.js';

process.umask(0o077);
const fixedErrors = [
  'AUTH_REQUIRED',
  'BROWSER_UNAVAILABLE',
  'AUTH_STORAGE_UNSAFE',
  'FRAME_UNAVAILABLE',
  'HEALTH_FAILED',
  'INVALID_CORRELATION',
  'INVENTORY_FAILED',
  'ROW_COUNT_MISMATCH',
  'INVALID_RECORD',
  'INVALID_FIELDS',
  'INVALID_TABLE',
  'TARGET_DENIED',
  'ACTION_DENIED',
  'PAGINATION_DUPLICATE',
  'PAGINATION_ORDER',
  'PAGINATION_BOUND',
  'SCHEMA_NOT_READY',
  'OPERATION_PENDING',
  'UNEXPECTED_NAVIGATION',
];
const classify = (error: unknown): string =>
  error instanceof DiagnosticError
    ? error.code
    : error instanceof Error && fixedErrors.includes(error.message)
      ? error.message
      : 'UI_ASSERTION_OR_TIMEOUT';
async function run(headed: boolean): Promise<void> {
  const report: Report = {
    schemaVersion: 1,
    target: 'Light House DEVELOPMENT',
    expectedDeployedVersion: '3.3.0',
    versionVerification:
      'Expected version from verified deployment record; Custom UI does not expose Forge deployment version.',
    startedAt: new Date().toISOString(),
    completedAt: '',
    outcome: 'blocked',
    operations: [],
    pageErrorCount: 0,
    logs: { status: 'not-requested', reason: null, matches: [] },
    limitations: [
      'Read-only synthetic inventory in the single approved installation. Keep the Forge tunnel stopped.',
      'No screenshots, traces, videos, DOM dumps, network payloads, console or arbitrary exception messages are collected.',
      'Only allowlisted displayed fields are recorded; sensitive patterns are redacted. Reports remain private, not automatically shareable.',
      'A unique UTC-window log candidate is not a displayed-UUID match; concurrent traffic, clock skew, truncation and log propagation can leave results unmatched.',
      'At most ten pages per kind; hitting the bound fails pagination acceptance. No counts are assumed.',
      'The LIMIT diagnosis requires hosted execution evidence; successful deployment/local fixtures alone do not confirm it.',
    ],
  };
  let browser: Browser | undefined;
  let frame: Frame | undefined;
  let page: Page | undefined;
  async function operation(
    name: Operation['operation'],
    work: (record: Operation) => Promise<void>,
    kind: InventoryType | null = null,
    pageNumber: number | null = null,
  ): Promise<boolean> {
    const start = performance.now();
    const record: Operation = {
      operation: name,
      inventoryType: kind,
      page: pageNumber,
      startedAt: new Date().toISOString(),
      completedAt: '',
      durationMs: 0,
      outcome: 'failure',
      visibleResult: '',
      displayedRowCount: null,
      records: [],
      recordsFresh: false,
      backendCode: null,
      correlationId: null,
      error: null,
    };
    report.operations.push(record);
    try {
      if (name !== 'navigation' && page) assertTarget(page.url());
      await work(record);
      record.outcome = 'success';
    } catch (error) {
      record.error = classify(error);
      if (
        record.error === 'AUTH_REQUIRED' ||
        record.error === 'BROWSER_UNAVAILABLE' ||
        error instanceof DiagnosticError
      )
        record.outcome = 'blocked';
    } finally {
      record.completedAt = new Date().toISOString();
      record.durationMs = Math.round(performance.now() - start);
    }
    return record.outcome === 'success';
  }
  try {
    const navigated = await operation('navigation', async (record) => {
      try {
        await privateCheck(stateFile);
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        )
          throw new Error('AUTH_REQUIRED', { cause: error });
        throw new Error('AUTH_STORAGE_UNSAFE', { cause: error });
      }
      browser = await launchBrowser(!headed);
      const context = await browser.newContext({
        storageState: stateFile,
        acceptDownloads: false,
      });
      page = await context.newPage();
      page.on('pageerror', () => {
        report.pageErrorCount++;
      });
      await page.goto(target.url, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      frame = await findApp(page);
      record.visibleResult =
        'Unique rendered Light House Custom UI located at the approved installation.';
    });
    if (navigated && frame) {
      const app = frame;
      await operation('health', (record) => readHealth(app, record));
      const overview = await operation('overview', async (record) => {
        const text = await freshClick(app, 'Load tenants and schema status');
        Object.assign(record, visibleFailure(text));
        record.visibleResult =
          text === 'Operation completed. Synthetic demonstration data only.'
            ? text
            : 'Overview failed; raw text omitted.';
        if (text !== 'Operation completed. Synthetic demonstration data only.')
          throw new Error('SCHEMA_NOT_READY');
        await expect(
          inventorySection(app).getByText('Schema: ready (v1)', {
            exact: true,
          }),
        ).toBeVisible();
      });
      if (overview) {
        const selected = await operation('tenant-selection', async (record) => {
          const section = inventorySection(app);
          await section
            .getByRole('combobox', { name: 'Authorised ISP', exact: true })
            .selectOption({ label: target.tenantLabel });
          await expect(
            section
              .getByRole('combobox', { name: 'Authorised ISP', exact: true })
              .locator('option:checked'),
          ).toHaveText(target.tenantLabel);
          // This control is rendered only for server-reported DEVELOPMENT/admin.
          // Observe its presence only; never click any mutation control.
          await expect(
            section.getByRole('button', { name: /^Seed next batch \(/ }),
          ).toHaveCount(1);
          record.visibleResult =
            'Approved synthetic ISP selected; server-reported DEVELOPMENT/admin controls present.';
        });
        if (selected)
          for (const kind of inventoryTypes) {
            const seen = new Set<string>();
            let last = '';
            for (let index = 1; index <= 10; index++) {
              const ok = await operation(
                'inventory',
                async (record) => {
                  await readInventory(app, kind, index > 1, record);
                  for (const row of record.records) {
                    if (seen.has(row.id))
                      throw new Error('PAGINATION_DUPLICATE');
                    if (row.id <= last) throw new Error('PAGINATION_ORDER');
                    seen.add(row.id);
                    last = row.id;
                  }
                  if (
                    index === 10 &&
                    (await inventorySection(app)
                      .getByRole('button', { name: 'Next page', exact: true })
                      .count())
                  )
                    throw new Error('PAGINATION_BOUND');
                },
                kind,
                index,
              );
              if (
                !ok ||
                !(await inventorySection(app)
                  .getByRole('button', { name: 'Next page', exact: true })
                  .count())
              )
                break;
            }
          }
      }
    }
  } catch {
    report.limitations.push(
      'Harness execution interrupted; no raw exception details retained.',
    );
  } finally {
    await browser?.close().catch(() => undefined);
    if (
      report.operations.some(
        (op) => op.operation === 'health' || op.operation === 'inventory',
      )
    ) {
      try {
        const events = await hostedLogs(report.startedAt);
        report.logs = {
          status: 'collected',
          reason: events.length
            ? null
            : 'No allowlisted hosted events returned; not evidence of success.',
          matches: correlate(report.operations, events),
        };
      } catch {
        report.logs = {
          status: 'unavailable',
          reason:
            'CLI access, credentials, timeout or network failure; use supported secure-login escalation, never export tokens.',
          matches: [],
        };
      }
    }
    const completeKinds = inventoryTypes.every((kind) =>
      report.operations.some(
        (op) => op.inventoryType === kind && op.outcome === 'success',
      ),
    );
    report.outcome = report.operations.some((op) => op.outcome === 'blocked')
      ? 'blocked'
      : report.operations.length >= 7 &&
          completeKinds &&
          report.operations.every((op) => op.outcome === 'success')
        ? 'passed'
        : 'failed';
    report.completedAt = new Date().toISOString();
    await writeReport(report);
    console.log(summary(report));
    if (report.operations.some((op) => op.error === 'AUTH_REQUIRED'))
      console.log(
        'Authentication missing/expired. Run npm run test:e2e:auth once, completing existing Atlassian MFA.',
      );
    for (const op of report.operations) {
      if (
        op.error?.startsWith('BROWSER_') ||
        op.error === 'DISPLAY_UNAVAILABLE'
      )
        console.log(
          'Run npm run test:e2e:doctor for local prerequisite diagnostics and remediation.',
        );
    }
    if (report.outcome !== 'passed') process.exitCode = 1;
  }
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'auth' || command === 'run') await configureTarget();
  if (command === 'auth' && !args.length) await authenticate();
  else if (command === 'doctor' && !args.length) {
    if (!(await doctor())) process.exitCode = 1;
  } else if (
    command === 'run' &&
    (args.length === 0 || (args.length === 1 && args[0] === '--headed'))
  )
    await run(args[0] === '--headed');
  else if (command === 'report' && !args.length) {
    await privateRead(reportFile); // Validate private permissions without printing evidence.
    const html = path.join(local, 'reports', 'acceptance.html');
    await fs.access(html);
    console.log(
      'Private acceptance reports: e2e/.local/reports/acceptance.json and acceptance.html. Open the HTML file locally; review redactions before any sharing.',
    );
  } else throw new Error('INVALID_COMMAND');
} catch (error) {
  console.error(diagnosticMessage(error));
  process.exitCode = 1;
}

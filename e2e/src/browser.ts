import { expect, type Frame, type Locator, type Page } from '@playwright/test';
import {
  assertReadButton,
  assertTarget,
  safeText,
  target,
  uuid,
  visibleFailure,
  type ReadButton,
  type InventoryType,
} from './policy.js';
import type { DisplayedRecord, Operation } from './model.js';

export async function findApp(page: Page, interactive = false): Promise<Frame> {
  let chosen: Frame | undefined;
  let authRequired = false;
  await expect
    .poll(
      async () => {
        const url = new URL(page.url());
        authRequired =
          url.hostname === 'id.atlassian.com' || /\/login\b/.test(url.pathname);
        if (authRequired && !interactive) return 'auth-required';
        if (
          url.origin !== new URL(target.url).origin ||
          url.pathname !== new URL(target.url).pathname
        )
          return 'waiting';
        const frames: Frame[] = [];
        for (const frame of page.frames()) {
          if (frame === page.mainFrame()) continue;
          if (
            (await frame
              .getByRole('heading', { name: 'Light House', exact: true })
              .count()) === 1 &&
            (await frame
              .getByRole('button', { name: 'Run health check', exact: true })
              .count()) === 1 &&
            (await frame
              .getByRole('heading', {
                name: 'Synthetic network inventory',
                exact: true,
              })
              .count()) === 1
          )
            frames.push(frame);
        }
        if (frames.length === 1) {
          chosen = frames[0];
          return 'app';
        }
        return frames.length > 1 ? 'ambiguous-frame' : 'waiting';
      },
      {
        timeout: interactive ? 600_000 : 60_000,
        message: 'Waiting for the unique Light House Custom UI',
      },
    )
    .toMatch(interactive ? /^app$/ : /^(app|auth-required)$/);
  if (authRequired && !interactive) throw new Error('AUTH_REQUIRED');
  assertTarget(page.url());
  if (!chosen) throw new Error('FRAME_UNAVAILABLE');
  await expect(
    chosen.getByRole('heading', { name: 'Light House', exact: true }),
  ).toBeVisible();
  return chosen;
}

export function inventorySection(frame: Frame): Locator {
  return frame.getByRole('region', {
    name: 'Synthetic network inventory',
    exact: true,
  });
}

// Observe loading -> completion in the rendered status, even when the round trip
// is too fast to observe through two separate Playwright polling calls.
export async function freshClick(
  frame: Frame,
  buttonName: ReadButton,
  health = false,
  timeout = 60_000,
): Promise<string> {
  assertReadButton(buttonName);
  const section = health
    ? frame.getByRole('region', { name: 'Engineering foundation', exact: true })
    : inventorySection(frame);
  const status = health
    ? section.getByRole('status', { name: 'Foundation health', exact: true })
    : section.getByRole('status');
  await expect(status).toHaveCount(1);
  await status.evaluate(
    (element, loading) => {
      const previous = (element as HTMLElement).dataset.lightHouseWatch;
      if (previous === 'pending') throw new Error('OPERATION_PENDING');
      const node = element as HTMLElement;
      node.dataset.lightHouseWatch = 'pending';
      let started = false;
      const observer = new MutationObserver(() => {
        const text = node.textContent?.trim() ?? '';
        if (text === loading) {
          started = true;
          node.dataset.lightHouseFresh = 'loading';
        } else if (started) {
          node.dataset.lightHouseFresh = 'complete';
          node.dataset.lightHouseWatch = 'complete';
          observer.disconnect();
        }
      });
      node.dataset.lightHouseFresh = 'waiting';
      observer.observe(node, {
        subtree: true,
        characterData: true,
        childList: true,
      });
    },
    health ? 'Checking runtime health…' : 'Loading inventory…',
  );
  const button = section.getByRole('button', { name: buttonName, exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(status).toHaveAttribute('data-light-house-fresh', 'complete', {
    timeout,
  });
  await expect(button).toBeEnabled();
  return (await status.textContent())?.trim() ?? '';
}

export async function captureRows(
  frame: Frame,
  kind: InventoryType,
): Promise<DisplayedRecord[]> {
  const section = inventorySection(frame);
  const tables = section.getByRole('table', {
    name: `${kind} — selected ISP only`,
    exact: true,
  });
  const count = await tables.count();
  if (!count) return [];
  if (count !== 1) throw new Error('INVALID_TABLE');
  const records: DisplayedRecord[] = [];
  for (const row of await tables.locator('tbody').getByRole('row').all()) {
    const cells = row.getByRole('cell');
    await expect(cells).toHaveCount(4);
    const rawFields: unknown = JSON.parse(
      await cells.nth(0).locator('pre').innerText(),
    );
    if (!rawFields || typeof rawFields !== 'object' || Array.isArray(rawFields))
      throw new Error('INVALID_FIELDS');
    const allowed =
      kind === 'sla_tiers' ? ['code', 'name'] : ['code', 'display_name'];
    const fields: Record<string, string> = {};
    for (const key of allowed) {
      const value: unknown = Reflect.get(rawFields, key);
      if (typeof value !== 'string') throw new Error('INVALID_FIELDS');
      fields[key] = safeText(value);
    }
    const text = await cells.nth(0).innerText();
    const id = text.trim().split(/\s/)[0] ?? '';
    const lifecycle = (await cells.nth(1).innerText()).trim();
    const versionText = (await cells.nth(2).innerText()).trim();
    if (
      !uuid.test(id) ||
      !['draft', 'active', 'maintenance', 'retired'].includes(lifecycle) ||
      !/^[1-9]\d*$/.test(versionText) ||
      !Number.isSafeInteger(Number(versionText))
    )
      throw new Error('INVALID_RECORD');
    records.push({ id, fields, lifecycle, version: Number(versionText) });
  }
  return records;
}

export async function readHealth(
  frame: Frame,
  record: Operation,
): Promise<void> {
  const text = await freshClick(frame, 'Run health check', true);
  record.visibleResult = safeText(text);
  if (
    text !==
    'Health check passed: backend available and response contract valid.'
  )
    throw new Error('HEALTH_FAILED');
  const section = frame.getByRole('region', {
    name: 'Engineering foundation',
    exact: true,
  });
  for (const [label, value] of [
    ['Forge Bridge invocation', 'Resolved'],
    ['Backend resolver availability', 'available'],
    ['Runtime response contract', 'Valid'],
    ['Integration readiness', 'not-configured'],
  ] as const)
    await expect(
      section
        .locator('dt')
        .filter({ hasText: label })
        .locator('xpath=following-sibling::dd[1]'),
    ).toHaveText(value);
  const id =
    (
      await section
        .locator('dt')
        .filter({ hasText: 'Correlation ID' })
        .locator('xpath=following-sibling::dd[1]')
        .innerText()
    ).split(' ')[0] ?? '';
  if (!uuid.test(id)) throw new Error('INVALID_CORRELATION');
  record.correlationId = id;
}
export async function readInventory(
  frame: Frame,
  kind: InventoryType,
  next: boolean,
  record: Operation,
): Promise<void> {
  const section = inventorySection(frame);
  if (!next) {
    // Change to another kind first, clearing any old rows/cursor before this load.
    const selector = section.getByRole('combobox', {
      name: 'Inventory type',
      exact: true,
    });
    await selector.selectOption(kind === 'sites' ? 'carriers' : 'sites');
    await selector.selectOption(kind);
    await expect(section.getByRole('table')).toHaveCount(0);
  }
  const text = await freshClick(frame, next ? 'Next page' : 'Load inventory');
  Object.assign(record, visibleFailure(text));
  record.visibleResult = safeText(text);
  const rows = await captureRows(frame, kind);
  const countText = await section
    .getByText(/^Showing \d+ records on this page\./)
    .innerText();
  const count = Number(/^Showing (\d+) records/.exec(countText)?.[1]);
  record.records = rows;
  record.displayedRowCount = Number.isSafeInteger(count) ? count : null;
  record.recordsFresh =
    text === 'Operation completed. Synthetic demonstration data only.';
  if (!record.recordsFresh) throw new Error('INVENTORY_FAILED');
  if (!Number.isSafeInteger(count) || count !== rows.length || count > 20)
    throw new Error('ROW_COUNT_MISMATCH');
  if (!count)
    await expect(
      section.getByText('No records loaded.', { exact: true }),
    ).toBeVisible();
}

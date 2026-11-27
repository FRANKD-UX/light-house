// Browser-backed harness tests with synthetic DOM only. Not hosted Forge acceptance.
import { launchBrowser } from '../src/launch.js';
import assert from 'node:assert/strict';
import {
  captureRows,
  freshClick,
  readHealth,
  readInventory,
} from '../src/browser.js';
import type { Operation } from '../src/model.js';
const browser = await launchBrowser(true).catch(() => undefined);
if (!browser) {
  console.error(
    'Local browser fixture blocked: browser unavailable. Configure the selected browser per e2e/README.md.',
  );
  process.exitCode = 1;
} else
  try {
    const page = await browser.newPage();
    await page.setContent(
      `<section aria-labelledby="inventory-title"><h2 id="inventory-title">Synthetic network inventory</h2><label>Inventory type<select><option>sites</option><option>carriers</option></select></label><button>Load inventory</button><p>Showing 0 records on this page.</p><p>No records loaded.</p><p role="status">Operation completed. Synthetic demonstration data only.</p></section>`,
    );
    const frame = page.mainFrame();
    const button = frame.getByRole('button', {
      name: 'Load inventory',
      exact: true,
    });
    await button.evaluate((el) => {
      el.addEventListener('click', () => {
        const status = document.querySelector('[role="status"]')!;
        status.textContent = 'Loading inventory…';
        requestAnimationFrame(() => {
          status.textContent =
            'Operation completed. Synthetic demonstration data only.';
        });
      });
    });
    assert.equal(
      await freshClick(frame, 'Load inventory', false, 2000),
      'Operation completed. Synthetic demonstration data only.',
    );
    const op: Operation = {
      operation: 'inventory',
      inventoryType: 'sites',
      page: 1,
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
    await readInventory(frame, 'sites', false, op);
    assert.equal(op.displayedRowCount, 0);
    assert.equal(op.recordsFresh, true);
    // Failure after an observed loading transition cannot be treated as empty success.
    await button.evaluate((el) => {
      const replacement = el.cloneNode(true);
      el.replaceWith(replacement);
      replacement.addEventListener('click', () => {
        const status = document.querySelector('[role="status"]')!;
        status.textContent = 'Loading inventory…';
        requestAnimationFrame(() => {
          status.textContent =
            'Inventory unavailable: backend could not complete the operation. Backend code: UNAVAILABLE. Correlation ID: 878d3b6f-6fec-4e2d-bb07-829509844583.';
        });
      });
    });
    await assert.rejects(
      () => readInventory(frame, 'sites', false, op),
      /INVENTORY_FAILED/,
    );
    assert.equal(op.recordsFresh, false);
    assert.equal(op.backendCode, 'UNAVAILABLE');
    // A stale prior completion without a new transition must time out.
    await button.evaluate((el) => el.replaceWith(el.cloneNode(true)));
    await assert.rejects(() => freshClick(frame, 'Load inventory', false, 250));
    await page.setContent(
      `<section aria-labelledby="inventory-title"><h2 id="inventory-title">Synthetic network inventory</h2><table><caption>sites — selected ISP only</caption><tbody><tr><td>878d3b6f-6fec-4e2d-bb07-829509844583<pre>{"code":"example","display_name":"Synthetic site","token":"private"}</pre></td><td>active</td><td>2</td><td></td></tr></tbody></table></section>`,
    );
    const rows = await captureRows(frame, 'sites');
    assert.equal(rows[0]!.version, 2);
    assert.equal(rows[0]!.lifecycle, 'active');
    assert.doesNotMatch(JSON.stringify(rows), /token|private/);
    await page.setContent(
      `<section aria-labelledby="inventory-title"><h2 id="inventory-title">Synthetic network inventory</h2><button>Next page</button><p>Showing 1 records on this page.</p><p role="status">Operation completed. Synthetic demonstration data only.</p><table><caption>sites — selected ISP only</caption><tbody><tr><td>878d3b6f-6fec-4e2d-bb07-829509844583<pre>{"code":"example","display_name":"Synthetic site"}</pre></td><td>active</td><td>2</td><td></td></tr></tbody></table></section>`,
    );
    await frame
      .getByRole('button', { name: 'Next page', exact: true })
      .evaluate((el) => {
        el.addEventListener('click', () => {
          const status = document.querySelector('[role="status"]')!;
          status.textContent = 'Loading inventory…';
          requestAnimationFrame(() => {
            document.querySelector('td')!.firstChild!.textContent =
              '978d3b6f-6fec-4e2d-bb07-829509844583';
            status.textContent =
              'Operation completed. Synthetic demonstration data only.';
          });
        });
      });
    await readInventory(frame, 'sites', true, op);
    assert.equal(op.records[0]!.id, '978d3b6f-6fec-4e2d-bb07-829509844583');
    assert.equal(op.recordsFresh, true);
    await page.setContent(
      `<section aria-labelledby="foundation"><h2 id="foundation">Engineering foundation</h2><button>Run health check</button><p role="status" aria-label="Foundation health">Health check not run.</p><dl><dt>Forge Bridge invocation</dt><dd>Resolved</dd><dt>Backend resolver availability</dt><dd>available</dd><dt>Runtime response contract</dt><dd>Valid</dd><dt>Integration readiness</dt><dd>not-configured</dd><dt>Correlation ID</dt><dd>878d3b6f-6fec-4e2d-bb07-829509844583 (valid UUIDv4)</dd></dl></section>`,
    );
    await frame
      .getByRole('button', { name: 'Run health check', exact: true })
      .evaluate((el) => {
        el.addEventListener('click', () => {
          const status = document.querySelector('[role="status"]')!;
          status.textContent = 'Checking runtime health…';
          requestAnimationFrame(() => {
            status.textContent =
              'Health check passed: backend available and response contract valid.';
          });
        });
      });
    await readHealth(frame, op);
    assert.equal(op.correlationId, '878d3b6f-6fec-4e2d-bb07-829509844583');
    console.log(
      'Local synthetic browser fixture: fresh completion, stale-result rejection, empty success, backend failure, record projection, next page and health capture passed. Not hosted acceptance.',
    );
  } finally {
    await browser.close();
  }

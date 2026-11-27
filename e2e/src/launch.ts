import { chromium } from '@playwright/test';
import { DiagnosticError, launchCode } from './diagnostics.js';

export type BrowserChannel = 'chrome' | 'chromium';

export function browserChannel(
  value: unknown = process.env.LIGHT_HOUSE_E2E_BROWSER_CHANNEL,
): BrowserChannel {
  if (value === undefined) return 'chrome';
  if (value === 'chrome' || value === 'chromium') return value;
  throw new DiagnosticError('BROWSER_CHANNEL_INVALID');
}

// No caller-supplied launch options: channel/mode cannot override sandbox protection.
export function launchConfiguration(
  headless: boolean,
  channel = browserChannel(),
) {
  return Object.freeze({
    channel,
    headless,
    chromiumSandbox: true as const,
    timeout: 30_000,
  });
}

export function checkBrowserUser(uid = process.getuid?.()): void {
  if (uid === 0) throw new DiagnosticError('BROWSER_ROOT_DENIED');
}

export async function launchBrowser(headless: boolean) {
  checkBrowserUser();
  const options = launchConfiguration(headless);
  try {
    // Playwright resolves the selected channel. executablePath() only locates bundled Chromium.
    return await chromium.launch(options);
  } catch (error) {
    throw new DiagnosticError(launchCode(error), error);
  }
}

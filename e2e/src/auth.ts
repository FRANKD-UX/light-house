import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { launchBrowser as launchSelectedBrowser } from './launch.js';
import { findApp } from './browser.js';
import { stateFile, target } from './policy.js';
import {
  privateCheck,
  privateDirectory,
  privateWrite,
} from './private-files.js';
import { DiagnosticError, stage, storageCode } from './diagnostics.js';

export async function sessionDirectory(): Promise<void> {
  try {
    await privateDirectory(path.dirname(stateFile));
  } catch (error) {
    throw new DiagnosticError(storageCode(error), error);
  }
}
export function checkDisplay(
  platform = process.platform,
  env = process.env,
): void {
  // Chromium-based browsers use X11/XWayland by default; WAYLAND_DISPLAY alone is insufficient.
  if (platform === 'linux' && !env.DISPLAY?.trim())
    throw new DiagnosticError('DISPLAY_UNAVAILABLE');
}
export function checkTerminal(
  interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY),
): void {
  if (!interactive) throw new DiagnosticError('INTERACTIVE_TERMINAL_REQUIRED');
}
export async function launchBrowser(headless: boolean) {
  if (!headless) checkDisplay();
  return launchSelectedBrowser(headless);
}
export async function saveSession(work: () => Promise<string>): Promise<void> {
  try {
    await privateWrite(stateFile, await work());
  } catch (error) {
    throw new DiagnosticError(storageCode(error, true), error);
  }
}
export async function authenticate(): Promise<void> {
  checkTerminal();
  await sessionDirectory();
  const browser = await launchBrowser(false);
  try {
    const context = await stage('BROWSER_LAUNCH_FAILED', () =>
      browser.newContext({ acceptDownloads: false }),
    );
    const page = await stage('BROWSER_LAUNCH_FAILED', () => context.newPage());
    console.log(
      'Complete Atlassian login, SSO and MFA in this browser. Waiting up to ten minutes for Light House; no terminal credential input is required.',
    );
    await stage('AUTH_NAVIGATION_FAILED', () =>
      page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60_000 }),
    );
    await stage('AUTH_TIMEOUT', () => findApp(page, true));
    await saveSession(async () => JSON.stringify(await context.storageState()));
    console.log(
      'Authenticated Light House session stored privately. Run npm run test:e2e:development.',
    );
  } finally {
    await browser.close().catch(() => undefined);
  }
}

export async function doctor(): Promise<boolean> {
  let passed = true;
  async function check(name: string, work: () => Promise<void>) {
    try {
      await work();
      console.log(`PASS ${name}`);
    } catch (error) {
      const { diagnosticMessage } = await import('./diagnostics.js');
      console.error(`FAIL ${name}: ${diagnosticMessage(error)}`);
      passed = false;
    }
  }
  await check('Node 22 desktop runtime', async () => {
    const [major, minor, patch] = process.versions.node.split('.').map(Number);
    if (major !== 22 || (minor ?? 0) < 23 || (minor === 23 && (patch ?? 0) < 4))
      throw new DiagnosticError('LOCAL_PREREQUISITE_FAILED');
  });
  await check('interactive terminal', async () => {
    checkTerminal();
  });
  await check('private session directory and atomic write', async () => {
    await sessionDirectory();
    try {
      await privateCheck(stateFile); // Metadata only; never read existing authentication contents.
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ))
        throw new DiagnosticError(storageCode(error), error);
    }
    const probe = path.join(path.dirname(stateFile), `.doctor-${randomUUID()}`);
    try {
      await privateWrite(probe, 'Light House synthetic prerequisite probe');
      const stat = await fs.lstat(probe);
      if ((stat.mode & 0o777) !== 0o600) throw new Error('UNSAFE_PRIVATE_FILE');
    } catch (error) {
      throw new DiagnosticError(storageCode(error, true), error);
    } finally {
      await fs.unlink(probe).catch(() => undefined);
    }
  });
  for (const headless of [true, false]) {
    await check(
      headless
        ? 'headless selected browser and system dependencies'
        : 'headed selected browser and desktop display',
      async () => {
        const browser = await launchBrowser(headless);
        try {
          const page = await stage('BROWSER_LAUNCH_FAILED', () =>
            browser.newPage(),
          );
          await stage('BROWSER_LAUNCH_FAILED', () => page.goto('about:blank'));
        } finally {
          await browser.close().catch(() => undefined);
        }
      },
    );
  }
  console.log(
    'Doctor used only local blank pages and synthetic storage; no Atlassian request or session contents read.',
  );
  return passed;
}

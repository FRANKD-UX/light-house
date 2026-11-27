import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Browser } from '@playwright/test';
import {
  browserChannel,
  checkBrowserUser,
  launchBrowser,
  launchConfiguration,
} from '../src/launch.js';
import { launchBrowser as launchForWorkflow } from '../src/auth.js';
import { diagnosticMessage } from '../src/diagnostics.js';

test('Chrome Stable is default and supported channels are explicit', () => {
  const previous = process.env.LIGHT_HOUSE_E2E_BROWSER_CHANNEL;
  delete process.env.LIGHT_HOUSE_E2E_BROWSER_CHANNEL;
  try {
    assert.equal(browserChannel(), 'chrome');
    for (const channel of ['chrome', 'chromium'] as const) {
      process.env.LIGHT_HOUSE_E2E_BROWSER_CHANNEL = channel;
      assert.equal(browserChannel(), channel);
    }
  } finally {
    if (previous === undefined)
      delete process.env.LIGHT_HOUSE_E2E_BROWSER_CHANNEL;
    else process.env.LIGHT_HOUSE_E2E_BROWSER_CHANNEL = previous;
  }
});

test('unknown channels, paths and sandbox arguments are rejected without echoing input', () => {
  for (const value of [
    '',
    'chrome-beta',
    'firefox',
    '/private/chrome',
    '--no-sandbox',
    false,
    null,
    {},
  ]) {
    assert.throws(() => browserChannel(value), {
      code: 'BROWSER_CHANNEL_INVALID',
    });
    try {
      browserChannel(value);
    } catch (error) {
      assert.ok(!diagnosticMessage(error).includes('/private/chrome'));
    }
  }
});

test('every supported channel and mode requires sandboxing and a fresh profile', () => {
  for (const channel of ['chrome', 'chromium'] as const)
    for (const headless of [true, false]) {
      const config = launchConfiguration(headless, channel);
      assert.deepEqual(config, {
        channel,
        headless,
        chromiumSandbox: true,
        timeout: 30_000,
      });
      assert.ok(Object.isFrozen(config));
      assert.throws(() => Object.assign(config, { chromiumSandbox: false }));
      assert.equal('args' in config, false);
      assert.equal('executablePath' in config, false);
      assert.equal('userDataDir' in config, false);
    }
});

test('root execution is denied while normal users remain supported', () => {
  assert.throws(() => checkBrowserUser(0), { code: 'BROWSER_ROOT_DENIED' });
  assert.doesNotThrow(() => checkBrowserUser(1000));
});

test('workflow launcher passes shared configuration to Playwright for both modes and channels', async () => {
  const previousChannel = process.env.LIGHT_HOUSE_E2E_BROWSER_CHANNEL;
  const previousDisplay = process.env.DISPLAY;
  const browser = {} as Browser;
  const launch = mock.method(chromium, 'launch', async () => browser);
  try {
    process.env.DISPLAY = ':synthetic';
    for (const channel of ['chrome', 'chromium'] as const) {
      process.env.LIGHT_HOUSE_E2E_BROWSER_CHANNEL = channel;
      for (const headless of [true, false]) {
        assert.equal(await launchForWorkflow(headless), browser);
        assert.deepEqual(launch.mock.calls.at(-1)?.arguments, [
          launchConfiguration(headless, channel),
        ]);
      }
    }
    assert.equal(launch.mock.callCount(), 4);
  } finally {
    launch.mock.restore();
    if (previousChannel === undefined)
      delete process.env.LIGHT_HOUSE_E2E_BROWSER_CHANNEL;
    else process.env.LIGHT_HOUSE_E2E_BROWSER_CHANNEL = previousChannel;
    if (previousDisplay === undefined) delete process.env.DISPLAY;
    else process.env.DISPLAY = previousDisplay;
  }
});

test('failed channel launch never retries with another channel or disabled sandbox', async () => {
  const launch = mock.method(chromium, 'launch', async () => {
    throw new Error('No usable sandbox! private-path');
  });
  try {
    await assert.rejects(() => launchBrowser(true), {
      code: 'BROWSER_LAUNCH_FAILED',
    });
    assert.equal(launch.mock.callCount(), 1);
    assert.equal(launch.mock.calls[0]?.arguments[0]?.chromiumSandbox, true);
  } finally {
    launch.mock.restore();
  }
});

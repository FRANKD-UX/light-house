import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDisplay, checkTerminal } from '../src/auth.js';
import {
  DiagnosticError,
  diagnosticMessage,
  launchCode,
  stage,
  storageCode,
} from '../src/diagnostics.js';

test('Linux display and interactive terminal prerequisites are explicit', () => {
  assert.throws(() => checkDisplay('linux', {}), {
    code: 'DISPLAY_UNAVAILABLE',
  });
  assert.throws(() => checkDisplay('linux', { WAYLAND_DISPLAY: 'synthetic' }), {
    code: 'DISPLAY_UNAVAILABLE',
  });
  assert.doesNotThrow(() => checkDisplay('linux', { DISPLAY: ':synthetic' }));
  assert.doesNotThrow(() => checkDisplay('darwin', {}));
  assert.throws(() => checkTerminal(false), {
    code: 'INTERACTIVE_TERMINAL_REQUIRED',
  });
  assert.doesNotThrow(() => checkTerminal(true));
});
test('launch errors are projected without leaking arbitrary content', () => {
  for (const [message, code] of [
    ['Host system is missing dependencies', 'BROWSER_DEPENDENCIES_MISSING'],
    [
      'error while loading shared libraries: private.so',
      'BROWSER_DEPENDENCIES_MISSING',
    ],
    ['Missing X server or $DISPLAY', 'DISPLAY_UNAVAILABLE'],
    ["Executable doesn't exist at private-path", 'BROWSER_EXECUTABLE_MISSING'],
    [
      'sandbox startup denied cookie=synthetic-private',
      'BROWSER_LAUNCH_FAILED',
    ],
  ]) {
    const error = new Error(message);
    assert.equal(launchCode(error), code);
    assert.ok(
      !diagnosticMessage(
        new DiagnosticError(launchCode(error), error),
      ).includes(message!),
    );
  }
  assert.equal(launchCode({ message: 'untrusted' }), 'BROWSER_LAUNCH_FAILED');
});
test('directory, permission and save failures remain distinct', () => {
  assert.equal(
    storageCode(Object.assign(new Error('private'), { code: 'EACCES' })),
    'SESSION_PERMISSION_DENIED',
  );
  assert.equal(
    storageCode(Object.assign(new Error('private'), { code: 'EPERM' }), true),
    'SESSION_PERMISSION_DENIED',
  );
  assert.equal(
    storageCode(new Error('UNSAFE_PRIVATE_DIRECTORY')),
    'SESSION_PERMISSION_DENIED',
  );
  assert.equal(storageCode(new Error('disk')), 'SESSION_DIRECTORY_FAILED');
  assert.equal(storageCode(new Error('disk'), true), 'SESSION_SAVE_FAILED');
});
test('authentication stages retain fixed category while hiding navigation and session causes', async () => {
  for (const code of [
    'AUTH_NAVIGATION_FAILED',
    'AUTH_TIMEOUT',
    'SESSION_SAVE_FAILED',
  ] as const) {
    try {
      await stage(code, async () => {
        throw new Error('cookie=synthetic-private');
      });
      assert.fail('Expected failure');
    } catch (error) {
      assert.equal((error as DiagnosticError).code, code);
      assert.ok(diagnosticMessage(error).includes(code));
      assert.ok(!diagnosticMessage(error).includes('synthetic-private'));
    }
  }
  assert.ok(
    !diagnosticMessage(new Error('token=synthetic-private')).includes(
      'synthetic-private',
    ),
  );
  assert.equal(await stage('AUTH_TIMEOUT', async () => 42), 42);
});

test('failed session capture is categorised before touching saved state', async () => {
  const { saveSession } = await import('../src/auth.js');
  await assert.rejects(
    () =>
      saveSession(async () => {
        throw new Error('synthetic-private');
      }),
    { code: 'SESSION_SAVE_FAILED' },
  );
});

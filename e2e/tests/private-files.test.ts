import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { local } from '../src/policy.js';
import {
  privateDirectory,
  privateRead,
  privateWrite,
} from '../src/private-files.js';

test('private artifacts enforce owner-only modes and reject escape/symlink reads', async () => {
  const dir = path.join(local, 'fixture-' + randomUUID());
  const file = path.join(dir, 'fixture.json');
  await privateWrite(file, 'synthetic evidence');
  try {
    assert.equal((await fs.stat(dir)).mode & 0o777, 0o700);
    assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
    assert.equal(await privateRead(file), 'synthetic evidence');
    await fs.chmod(file, 0o644);
    await assert.rejects(() => privateRead(file));
    await privateWrite(file, 'replacement');
    assert.equal(await privateRead(file), 'replacement');
    await fs.symlink(file, path.join(dir, 'link.json'));
    await assert.rejects(() => privateRead(path.join(dir, 'link.json')));
    await fs.symlink(dir, path.join(dir, 'nested'));
    await assert.rejects(() => privateDirectory(path.join(dir, 'nested')));
    await assert.rejects(() => privateDirectory(path.dirname(local)));
    await assert.rejects(() => privateDirectory(local + '/../escape'));
    // Atomic writes replace links rather than overwriting their targets.
    await privateWrite(path.join(dir, 'link.json'), 'new evidence');
    assert.equal(await privateRead(file), 'replacement');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

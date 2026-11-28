import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { local } from './policy.js';

export async function privateDirectory(dir: string): Promise<void> {
  if (
    path.resolve(dir) !== dir ||
    (dir !== local && !dir.startsWith(local + path.sep))
  )
    throw new Error('PATH_DENIED');
  const parts = path.relative(local, dir).split(path.sep).filter(Boolean);
  let current = local;
  for (const part of ['', ...parts]) {
    if (part) current = path.join(current, part);
    await fs.mkdir(current, { mode: 0o700 }).catch((error) => {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'EEXIST'
      ))
        throw error;
    });
    const stat = await fs.lstat(current);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (process.getuid && stat.uid !== process.getuid())
    )
      throw new Error('UNSAFE_PRIVATE_DIRECTORY');
    await fs.chmod(current, 0o700);
  }
}
export async function privateWrite(
  file: string,
  content: string,
): Promise<void> {
  await privateDirectory(path.dirname(file));
  const temporary = path.join(path.dirname(file), `.write-${randomUUID()}`);
  const handle = await fs.open(
    temporary,
    fs.constants.O_WRONLY |
      fs.constants.O_CREAT |
      fs.constants.O_EXCL |
      fs.constants.O_NOFOLLOW,
    0o600,
  );
  try {
    try {
      await handle.chmod(0o600);
      await handle.writeFile(content);
    } finally {
      await handle.close();
    }
    await fs.rename(temporary, file);
  } finally {
    await fs.unlink(temporary).catch(() => undefined);
  }
}
async function openPrivate(file: string) {
  await privateDirectory(path.dirname(file));
  const handle = await fs.open(
    file,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
  );
  try {
    const stat = await handle.stat();
    if (
      !stat.isFile() ||
      stat.nlink !== 1 ||
      stat.size > 5 * 1024 * 1024 ||
      (stat.mode & 0o077) !== 0 ||
      (process.getuid && stat.uid !== process.getuid())
    )
      throw new Error('UNSAFE_PRIVATE_FILE');
    return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
}
export async function privateCheck(file: string): Promise<void> {
  const handle = await openPrivate(file);
  await handle.close();
}
export async function privateRead(file: string): Promise<string> {
  const handle = await openPrivate(file);
  try {
    return await handle.readFile('utf8');
  } finally {
    await handle.close();
  }
}

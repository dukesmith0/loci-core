/**
 * Git Operations — sync, commit, push for vault repo
 */

import { simpleGit, type SimpleGit } from 'simple-git';
import { existsSync } from 'fs';
import { join } from 'path';

function getGit(path: string): SimpleGit {
  return simpleGit(path);
}

export function isRepo(path: string): boolean {
  return existsSync(join(path, '.git'));
}

export async function initRepo(path: string): Promise<void> {
  await getGit(path).init();
}

export async function addRemote(path: string, url: string): Promise<void> {
  const git = getGit(path);
  const remotes = await git.getRemotes();
  if (remotes.some(r => r.name === 'origin')) {
    await git.removeRemote('origin');
  }
  await git.addRemote('origin', url);
}

export async function sync(path: string, autoPull = true, autoPush = true): Promise<{ pulled: number; pushed: boolean }> {
  const git = getGit(path);
  let pulled = 0;
  let pushed = false;

  try {
    const remotes = await git.getRemotes();
    if (remotes.length === 0) return { pulled, pushed };

    if (autoPull) {
      try {
        const result = await git.pull('origin', 'main', { '--rebase': 'true' });
        pulled = result.summary.changes;
      } catch {
        // Pull may fail on first push or no remote branch yet
      }
    }

    if (autoPush) {
      try {
        const status = await git.status();
        if (status.ahead > 0 || status.files.length > 0) {
          if (status.files.length > 0) {
            await git.add('-A');
            await git.commit(`vault sync ${new Date().toISOString().slice(0, 10)}`);
          }
          await git.push('origin', 'main', { '--set-upstream': null });
          pushed = true;
        }
      } catch {
        // Push may fail if no remote or auth issue — non-fatal
      }
    }
  } catch {
    // Git operations are best-effort for sync
  }

  return { pulled, pushed };
}

export async function commit(path: string, message: string): Promise<boolean> {
  const git = getGit(path);
  const status = await git.status();
  if (status.files.length === 0) return false;
  await git.add('-A');
  await git.commit(message);
  return true;
}

export async function push(path: string): Promise<boolean> {
  try {
    const git = getGit(path);
    await git.push('origin', 'main');
    return true;
  } catch {
    return false;
  }
}

export async function hasChanges(path: string): Promise<boolean> {
  const git = getGit(path);
  const status = await git.status();
  return status.files.length > 0;
}

export async function getLog(path: string, maxCount = 10): Promise<Array<{ hash: string; date: string; message: string }>> {
  const git = getGit(path);
  const log = await git.log({ maxCount });
  return log.all.map(entry => ({
    hash: entry.hash.slice(0, 7),
    date: entry.date,
    message: entry.message,
  }));
}

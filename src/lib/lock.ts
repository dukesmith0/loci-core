/**
 * Lock Management — PID-based locks with stale detection
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getVaultPath, resolveConfig } from './config.js';

interface LockData {
  pid: number;
  machine_id: string;
  started: string;
  status: string;
  progress?: { done: number; total: number };
}

function getLockPath(name: string): string {
  const vault = getVaultPath(resolveConfig());
  return join(vault, '_brain', `${name}.lock`);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function acquireLock(name: string, status = 'active'): boolean {
  const lockPath = getLockPath(name);

  if (existsSync(lockPath)) {
    const existing = readLock(name);
    if (existing && isProcessAlive(existing.pid)) {
      return false; // Lock held by alive process
    }
    // Stale lock — clean it up
    unlinkSync(lockPath);
  }

  const config = resolveConfig();
  const data: LockData = {
    pid: process.pid,
    machine_id: config.machine_id || 'unknown',
    started: new Date().toISOString(),
    status,
  };
  writeFileSync(lockPath, JSON.stringify(data, null, 2), 'utf-8');
  return true;
}

export function releaseLock(name: string): void {
  const lockPath = getLockPath(name);
  if (existsSync(lockPath)) {
    try { unlinkSync(lockPath); } catch { /* best effort */ }
  }
}

export function isLocked(name: string): boolean {
  const lockPath = getLockPath(name);
  if (!existsSync(lockPath)) return false;
  const data = readLock(name);
  if (!data) return false;
  return isProcessAlive(data.pid);
}

export function readLock(name: string): LockData | null {
  const lockPath = getLockPath(name);
  if (!existsSync(lockPath)) return null;
  try {
    return JSON.parse(readFileSync(lockPath, 'utf-8'));
  } catch {
    return null;
  }
}

export function updateLockProgress(name: string, done: number, total: number): void {
  const lockPath = getLockPath(name);
  if (!existsSync(lockPath)) return;
  try {
    const data: LockData = JSON.parse(readFileSync(lockPath, 'utf-8'));
    data.progress = { done, total };
    writeFileSync(lockPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch { /* best effort */ }
}

export function cleanStaleLocks(): number {
  let cleaned = 0;
  for (const name of ['embed', 'session']) {
    const lockPath = getLockPath(name);
    if (!existsSync(lockPath)) continue;
    const data = readLock(name);
    if (data && !isProcessAlive(data.pid)) {
      unlinkSync(lockPath);
      cleaned++;
    }
  }
  return cleaned;
}

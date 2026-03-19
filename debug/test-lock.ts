/**
 * Lock safety test — concurrent access, stale detection, edge cases
 * Run: npx tsx debug/test-lock.ts
 */

import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync, spawn } from 'child_process';

const PASS = '✓';
const FAIL = '✗';
let passed = 0;
let failed = 0;

function log(ok: boolean, name: string, detail?: string) {
  if (ok) { console.log(`  ${PASS} ${name}${detail ? ` (${detail})` : ''}`); passed++; }
  else { console.log(`  ${FAIL} ${name}${detail ? ` — ${detail}` : ''}`); failed++; }
}

async function main() {
  console.log('\n=== Lock Safety Test ===\n');

  // Create a temporary vault with _brain/ for lock testing
  const testVault = join(tmpdir(), 'talos-lock-test-' + Date.now());
  mkdirSync(join(testVault, '_brain'), { recursive: true });

  // We need a config pointing to this vault
  // Save current config, write test config
  const configDir = join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.talos');
  const configPath = join(configDir, 'config.yaml');
  const backupPath = join(configDir, 'config.yaml.bak');
  let hadConfig = false;

  if (existsSync(configPath)) {
    hadConfig = true;
    execSync(`cp "${configPath}" "${backupPath}"`);
  } else {
    mkdirSync(configDir, { recursive: true });
  }

  writeFileSync(configPath, `vault_path: "${testVault.replace(/\\/g, '/')}"\nmachine_id: test\n`);

  try {
    // Test 1: Acquire and release
    const { acquireLock, releaseLock, isLocked, readLock, cleanStaleLocks } = await import('../src/lib/lock.js');

    const acquired = acquireLock('test-lock');
    log(acquired, 'Lock acquired');

    const locked = isLocked('test-lock');
    log(locked, 'Lock detected as active');

    const lockData = readLock('test-lock');
    log(lockData?.pid === process.pid, 'Lock contains correct PID', `pid=${lockData?.pid}`);

    releaseLock('test-lock');
    log(!isLocked('test-lock'), 'Lock released');

    // Test 2: Double acquire (should fail)
    acquireLock('test-double');
    const second = acquireLock('test-double');
    log(!second, 'Double acquire correctly rejected');
    releaseLock('test-double');

    // Test 3: Stale lock detection
    const staleLockPath = join(testVault, '_brain', 'stale.lock');
    writeFileSync(staleLockPath, JSON.stringify({
      pid: 99999999, // Almost certainly dead
      machine_id: 'test',
      started: new Date(Date.now() - 3600000).toISOString(),
      status: 'embedding',
    }));

    // acquireLock should detect stale PID and clean it up
    const acquiredStale = acquireLock('stale');
    log(acquiredStale, 'Stale lock auto-cleaned and acquired');
    releaseLock('stale');

    // Test 4: Lock file cleanup
    writeFileSync(join(testVault, '_brain', 'embed.lock'), JSON.stringify({
      pid: 99999998, machine_id: 'test', started: new Date().toISOString(), status: 'stuck',
    }));
    writeFileSync(join(testVault, '_brain', 'session.lock'), JSON.stringify({
      pid: 99999997, machine_id: 'test', started: new Date().toISOString(), status: 'active',
    }));

    const cleaned = cleanStaleLocks();
    log(cleaned === 2, 'cleanStaleLocks cleaned 2 stale locks', `cleaned=${cleaned}`);

  } finally {
    // Restore config
    if (hadConfig) {
      execSync(`cp "${backupPath}" "${configPath}"`);
      rmSync(backupPath, { force: true });
    } else {
      rmSync(configPath, { force: true });
    }
    // Cleanup test vault
    rmSync(testVault, { recursive: true, force: true });
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'─'.repeat(40)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();

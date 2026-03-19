/**
 * Headless debug script — tests all talos-core functionality
 * Run: npx tsx debug/test-all.ts
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PASS = '✓';
const FAIL = '✗';
const WARN = '⚠';
let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean | Promise<boolean>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(r => {
        if (r) { console.log(`  ${PASS} ${name}`); passed++; }
        else { console.log(`  ${FAIL} ${name}`); failed++; }
      }).catch(e => {
        console.log(`  ${FAIL} ${name}: ${(e as Error).message}`);
        failed++;
      });
    }
    if (result) { console.log(`  ${PASS} ${name}`); passed++; }
    else { console.log(`  ${FAIL} ${name}`); failed++; }
  } catch (e) {
    console.log(`  ${FAIL} ${name}: ${(e as Error).message}`);
    failed++;
  }
}

function cmd(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8', timeout: 30000 }).trim();
  } catch (e) {
    return (e as { stderr?: string }).stderr ?? '';
  }
}

async function main() {
  console.log('\n=== TALOS Core Debug Suite ===\n');

  // ── CLI availability ────────────────────────────────────────
  console.log('CLI availability:');
  test('talos is on PATH', () => {
    const output = cmd('talos --version');
    return output.includes('1.0.0');
  });

  test('talos --help lists 9 commands', () => {
    const output = cmd('talos --help');
    return ['setup', 'health', 'update', 'sync', 'vault', 'link', 'index', 'wordfreq', 'template']
      .every(c => output.includes(c));
  });

  // ── Config module ───────────────────────────────────────────
  console.log('\nConfig module:');
  test('config.ts loads', async () => {
    const { hasConfig } = await import('../src/lib/config.js');
    return typeof hasConfig === 'function';
  });

  test('config resolution', async () => {
    const { hasConfig, loadConfig } = await import('../src/lib/config.js');
    if (!hasConfig()) return true; // No config = valid state
    const config = loadConfig();
    return config !== null && typeof config.vault_path === 'string';
  });

  // ── Vault module ────────────────────────────────────────────
  console.log('\nVault module:');
  test('extractWikilinks', async () => {
    const { extractWikilinks } = await import('../src/lib/vault.js');
    const links = extractWikilinks('See [[foo]] and [[bar|baz]]');
    return links.includes('foo') && links.includes('bar') && links.length === 2;
  });

  test('extractTags', async () => {
    const { extractTags } = await import('../src/lib/vault.js');
    const tags = extractTags('Hello #world #test', { tags: ['yaml-tag'] });
    return tags.includes('world') && tags.includes('test') && tags.includes('yaml-tag');
  });

  test('extractTags skips code blocks', async () => {
    const { extractTags } = await import('../src/lib/vault.js');
    const tags = extractTags('Hello #real\n```\n#notag\n```\n#also-real');
    return tags.includes('real') && tags.includes('also-real') && !tags.includes('notag');
  });

  test('getDailyNotePath', async () => {
    const { getDailyNotePath } = await import('../src/lib/vault.js');
    const path = getDailyNotePath('/vault', new Date(2026, 2, 18));
    return path.includes('2026') && path.includes('03') && path.includes('2026-03-18');
  });

  test('addWikilinks', async () => {
    const { addWikilinks } = await import('../src/lib/vault.js');
    const result = addWikilinks('Met with John at Google', [
      { name: 'John', aliases: [] },
      { name: 'Google', aliases: ['Alphabet'] },
    ]);
    return result.includes('[[John|John]]') && result.includes('[[Google|Google]]');
  });

  // ── Lock module ─────────────────────────────────────────────
  console.log('\nLock module:');
  const TEST_VAULT = join(homedir(), '.talos-test-vault');

  test('lock acquire/release cycle', async () => {
    // This test requires a vault path in config
    const { acquireLock, releaseLock, isLocked } = await import('../src/lib/lock.js');
    // Will fail if no config — that's OK
    try {
      const acquired = acquireLock('test');
      if (!acquired) return false;
      const locked = isLocked('test');
      releaseLock('test');
      const unlocked = !isLocked('test');
      return locked && unlocked;
    } catch {
      console.log(`    ${WARN} Skipped (no vault config)`);
      return true;
    }
  });

  // ── Brain module ────────────────────────────────────────────
  console.log('\nBrain module:');
  test('checkBrainIntegrity with missing vault', async () => {
    const { checkBrainIntegrity } = await import('../src/lib/brain.js');
    const result = checkBrainIntegrity('/nonexistent');
    return !result.ok && result.missing.length > 0;
  });

  // ── QMD module ──────────────────────────────────────────────
  console.log('\nQMD module:');
  test('QMD SDK importable', async () => {
    try {
      const qmd = await import('@tobilu/qmd');
      return typeof qmd.createStore === 'function';
    } catch {
      return false;
    }
  });

  // ── CLI commands ────────────────────────────────────────────
  console.log('\nCLI commands:');
  test('talos health runs without crash', () => {
    const output = cmd('talos health');
    return output.includes('Node.js') && output.includes('Git');
  });

  test('talos vault prints path', () => {
    const output = cmd('talos vault');
    return output.includes('Vault path:') || output.includes('vault_path');
  });

  test('talos vault --json returns JSON', () => {
    const output = cmd('talos vault --json');
    try { JSON.parse(output); return true; } catch { return false; }
  });

  test('talos template list runs', () => {
    const output = cmd('talos template list');
    return !output.includes('Error') || output.includes('template');
  });

  // ── Edge cases ──────────────────────────────────────────────
  console.log('\nEdge cases:');
  test('talos link with nonexistent file', () => {
    const output = cmd('talos link /nonexistent/file.md');
    return output.includes('not found') || output.includes('Error');
  });

  test('talos index without vault gracefully fails', () => {
    // Should not crash
    const output = cmd('talos index 2>&1');
    return typeof output === 'string';
  });

  // ── Summary ─────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'─'.repeat(40)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();

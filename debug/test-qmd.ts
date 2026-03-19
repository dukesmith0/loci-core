/**
 * QMD SDK integration test — tests search, embedding, store lifecycle
 * Run: npx tsx debug/test-qmd.ts
 */

import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const PASS = '✓';
const FAIL = '✗';
let passed = 0;
let failed = 0;

function log(ok: boolean, name: string, detail?: string) {
  if (ok) { console.log(`  ${PASS} ${name}${detail ? ` (${detail})` : ''}`); passed++; }
  else { console.log(`  ${FAIL} ${name}${detail ? ` — ${detail}` : ''}`); failed++; }
}

async function main() {
  console.log('\n=== QMD SDK Integration Test ===\n');

  const testDir = join(tmpdir(), 'talos-qmd-test-' + Date.now());
  const dbPath = join(testDir, 'test.sqlite');
  const docsDir = join(testDir, 'docs');

  // Setup test data
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(docsDir, 'test1.md'), '---\ntitle: React Hooks\ntags: [react, frontend]\n---\n\n# React Hooks\n\nHooks let you use state in function components.\n\n## useState\nManages local state.\n\n## useEffect\nRuns side effects.\n');
  writeFileSync(join(docsDir, 'test2.md'), '---\ntitle: TypeScript Generics\ntags: [typescript, types]\n---\n\n# TypeScript Generics\n\nGenerics provide type safety with flexibility.\n\n```typescript\nfunction identity<T>(arg: T): T { return arg; }\n```\n');
  writeFileSync(join(docsDir, 'test3.md'), '---\ntitle: Meeting with [[John Smith]]\ntags: [meeting, contact]\n---\n\n# Meeting Notes\n\nDiscussed the [[React]] migration project with [[John Smith]].\nNext steps: review the #typescript codebase.\n');

  try {
    // Test 1: Import
    const { createStore } = await import('@tobilu/qmd');
    log(true, 'QMD SDK imported');

    // Test 2: Create store
    const store = await createStore({
      dbPath,
      config: { collections: { test: { path: docsDir, pattern: '**/*.md' } } },
    });
    log(true, 'Store created');

    // Test 3: Update (index)
    const updateResult = await store.update();
    log(updateResult.indexed === 3, 'Indexed 3 docs', `indexed=${updateResult.indexed}`);

    // Test 4: BM25 search
    const lexResults = await store.searchLex('React');
    log(lexResults.length > 0, 'BM25 search returns results', `count=${lexResults.length}`);

    // Test 5: Embed
    console.log('\n  Embedding (may download model on first run)...');
    const embedResult = await store.embed({
      onProgress: (p) => process.stdout.write(`\r    chunks: ${p.chunksEmbedded}`),
    });
    console.log('');
    log(embedResult.errors === 0, 'Embedding completed', `chunks=${embedResult.chunksEmbedded}, errors=${embedResult.errors}`);

    // Test 6: Vector search (only if embeddings exist)
    if (embedResult.chunksEmbedded > 0) {
      const vecResults = await store.searchVector('function components state management');
      log(vecResults.length > 0, 'Vector search returns results', `count=${vecResults.length}`);
    } else {
      log(true, 'Vector search (skipped — no embeddings)');
    }

    // Test 7: Document retrieval
    const doc = await store.get('test1.md');
    log('filepath' in doc, 'Document retrieval works');

    // Test 8: Status
    const status = await store.getStatus();
    log(true, 'Status check', `docs=${(status as Record<string, unknown>).totalDocuments}`);

    // Test 9: Re-index (idempotent)
    const reindexResult = await store.update();
    log(reindexResult.unchanged === 3, 'Re-index is idempotent', `unchanged=${reindexResult.unchanged}`);

    // Test 10: Close
    await store.close();
    log(true, 'Store closed cleanly');

    // Test 11: Reopen
    const store2 = await createStore({ dbPath });
    const results2 = await store2.searchLex('typescript');
    log(results2.length > 0, 'Reopened store retains data', `results=${results2.length}`);
    await store2.close();
    log(true, 'Second close clean');

  } catch (e) {
    log(false, 'Test suite', (e as Error).message);
  } finally {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'─'.repeat(40)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();

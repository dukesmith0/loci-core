/**
 * wordfreq — Build word frequency table from vault .md files
 */

import { join } from 'path';
import { globSync } from 'glob';
import chalk from 'chalk';
import { resolveConfig, getVaultPath } from '../lib/config.js';
import { readFile } from '../lib/vault.js';
import { writeWordFreq, type WordEntry } from '../lib/brain.js';

const SKIP_DIRS = ['_brain', '_templates', '.git', 'node_modules'];

const STOPWORDS = new Set([
  'the', 'a', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'because', 'but', 'and', 'or', 'if', 'while', 'although',
  'this', 'that', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we',
  'us', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they',
  'them', 'their', 'what', 'which', 'who', 'whom', 'whose',
]);

export async function execute(): Promise<void> {
  const config = resolveConfig();
  const vaultPath = getVaultPath(config);

  console.log(chalk.dim('Building word frequency index...'));

  const pattern = '**/*.md';
  const ignore = SKIP_DIRS.map(d => `${d}/**`);
  const files = globSync(pattern, { cwd: vaultPath, ignore });

  // word -> { docCount: Set<fileIndex>, totalCount: number }
  const wordStats = new Map<string, { docs: Set<number>; total: number }>();

  for (let i = 0; i < files.length; i++) {
    const absPath = join(vaultPath, files[i]);
    try {
      const vaultFile = readFile(absPath);
      const tokens = vaultFile.content
        .split(/\W+/)
        .map(t => t.toLowerCase())
        .filter(t => t.length > 1 && !STOPWORDS.has(t) && !/^\d+$/.test(t));

      const seen = new Set<string>();
      for (const token of tokens) {
        if (!wordStats.has(token)) {
          wordStats.set(token, { docs: new Set(), total: 0 });
        }
        const entry = wordStats.get(token)!;
        entry.total++;
        if (!seen.has(token)) {
          entry.docs.add(i);
          seen.add(token);
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Convert to WordEntry[] sorted by doc_count desc
  const entries: WordEntry[] = [];
  for (const [word, stats] of wordStats) {
    entries.push({
      word,
      doc_count: stats.docs.size,
      total_count: stats.total,
    });
  }
  entries.sort((a, b) => b.doc_count - a.doc_count || b.total_count - a.total_count);

  writeWordFreq(vaultPath, entries);

  console.log(chalk.green(`Word frequency built: ${entries.length} unique words from ${files.length} files`));
  if (entries.length > 0) {
    const top5 = entries.slice(0, 5).map(e => `${e.word}(${e.doc_count})`).join(', ');
    console.log(chalk.dim(`  Top words: ${top5}`));
  }
}

/**
 * index — Build link index from vault .md files
 */

import { statSync } from 'fs';
import { join, relative } from 'path';
import { globSync } from 'glob';
import chalk from 'chalk';
import { resolveConfig, getVaultPath } from '../lib/config.js';
import { readFile, extractWikilinks, extractTags } from '../lib/vault.js';
import { readLinkIndex, writeLinkIndex, type LinkIndex, type LinkEntry } from '../lib/brain.js';

interface IndexOptions {
  full?: boolean;
}

const SKIP_DIRS = ['_brain', '_templates', '.git', 'node_modules'];

export async function execute(options: IndexOptions = {}): Promise<void> {
  const config = resolveConfig();
  const vaultPath = getVaultPath(config);

  console.log(chalk.dim('Building link index...'));

  const existing = options.full ? { files: {}, tags: {}, updated: '' } : readLinkIndex(vaultPath);
  const lastUpdated = existing.updated ? new Date(existing.updated).getTime() : 0;

  // Find all .md files, skip excluded dirs
  const pattern = '**/*.md';
  const ignore = SKIP_DIRS.map(d => `${d}/**`);
  const files = globSync(pattern, { cwd: vaultPath, ignore });

  const index: LinkIndex = {
    files: {},
    tags: {},
    updated: '',
  };

  let processed = 0;
  let skipped = 0;

  for (const relPath of files) {
    const absPath = join(vaultPath, relPath);
    const normalizedPath = relPath.replace(/\\/g, '/');

    // Incremental: skip files older than last index
    if (!options.full && lastUpdated > 0) {
      try {
        const mtime = statSync(absPath).mtimeMs;
        if (mtime < lastUpdated && existing.files[normalizedPath]) {
          // Keep existing entry
          index.files[normalizedPath] = existing.files[normalizedPath];
          skipped++;
          continue;
        }
      } catch {
        continue;
      }
    }

    try {
      const vaultFile = readFile(absPath);
      const links = extractWikilinks(vaultFile.content);
      const tags = extractTags(vaultFile.content, vaultFile.data);

      index.files[normalizedPath] = {
        links_to: links,
        linked_from: [],
        tags,
      };
      processed++;
    } catch {
      // Skip unreadable files
    }
  }

  // Build reverse links (linked_from)
  for (const [filePath, entry] of Object.entries(index.files)) {
    for (const link of entry.links_to) {
      // Find the target file that matches this link name
      const targetKey = Object.keys(index.files).find(
        k => k.endsWith(`${link}.md`) || k === `${link}.md`
      );
      if (targetKey && index.files[targetKey]) {
        if (!index.files[targetKey].linked_from.includes(filePath)) {
          index.files[targetKey].linked_from.push(filePath);
        }
      }
    }
  }

  // Build tag index
  const tagIndex: Record<string, string[]> = {};
  for (const [filePath, entry] of Object.entries(index.files)) {
    for (const tag of entry.tags) {
      if (!tagIndex[tag]) tagIndex[tag] = [];
      if (!tagIndex[tag].includes(filePath)) {
        tagIndex[tag].push(filePath);
      }
    }
  }
  index.tags = tagIndex;

  writeLinkIndex(vaultPath, index);

  const totalFiles = Object.keys(index.files).length;
  const totalTags = Object.keys(index.tags).length;

  console.log(chalk.green(`Index built: ${totalFiles} files, ${totalTags} tags`));
  console.log(chalk.dim(`  Processed: ${processed}, Skipped (unchanged): ${skipped}`));
}

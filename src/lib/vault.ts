/**
 * Vault File Operations — read, write, frontmatter, wikilinks, daily notes
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import matter from 'gray-matter';

export interface VaultFile {
  path: string;
  content: string;
  data: Record<string, unknown>;
}

export function readFile(filePath: string): VaultFile {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return { path: filePath, content, data };
}

export function writeFile(filePath: string, content: string, frontmatter?: Record<string, unknown>): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (frontmatter && Object.keys(frontmatter).length > 0) {
    writeFileSync(filePath, matter.stringify(content, frontmatter), 'utf-8');
  } else {
    writeFileSync(filePath, content, 'utf-8');
  }
}

export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
}

export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/** Extract [[wikilinks]] from text, return unique names. */
export function extractWikilinks(text: string): string[] {
  const matches = text.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/, '$1')))];
}

/** Extract #tags from text (frontmatter tags + inline). */
export function extractTags(text: string, frontmatter?: Record<string, unknown>): string[] {
  const tags = new Set<string>();
  // Frontmatter tags
  if (frontmatter?.tags && Array.isArray(frontmatter.tags)) {
    for (const t of frontmatter.tags) tags.add(String(t).toLowerCase());
  }
  // Inline #tags (not inside code blocks)
  const inCode = new Set<number>();
  const codeBlocks = text.matchAll(/```[\s\S]*?```/g);
  for (const m of codeBlocks) {
    for (let i = m.index!; i < m.index! + m[0].length; i++) inCode.add(i);
  }
  const tagMatches = text.matchAll(/#([a-zA-Z][a-zA-Z0-9_-]*)/g);
  for (const m of tagMatches) {
    if (!inCode.has(m.index!)) tags.add(m[1].toLowerCase());
  }
  return [...tags];
}

/** Add [[wikilinks]] for entity names found in text. Returns modified text. */
export function addWikilinks(text: string, entities: Array<{ name: string; aliases: string[] }>): string {
  let modified = text;
  for (const entity of entities) {
    const names = [entity.name, ...entity.aliases];
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<!\\[\\[)\\b(${escaped})\\b(?!\\]\\])`, 'i');
      // Only link first occurrence
      modified = modified.replace(regex, `[[${entity.name}|$1]]`);
    }
  }
  return modified;
}

/** Get daily note path for a date. */
export function getDailyNotePath(vaultPath: string, date?: Date): string {
  const d = date ?? new Date();
  const yyyy = d.getFullYear().toString();
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return join(vaultPath, 'journal', yyyy, mm, `${yyyy}-${mm}-${dd}.md`);
}

/** Append a timestamped entry to today's daily note auto-log section. */
export function appendAutoLog(message: string, vaultPath: string): void {
  const notePath = getDailyNotePath(vaultPath);
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, '0');
  const min = now.getMinutes().toString().padStart(2, '0');
  const entry = `- ${hh}:${min} | ${message}\n`;

  if (!existsSync(notePath)) {
    const yyyy = now.getFullYear();
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    writeFile(notePath, `\n## Auto-Log\n\n${entry}`, {
      type: 'episode',
      date: `${yyyy}-${mm}-${dd}`,
    });
    return;
  }

  let content = readFileSync(notePath, 'utf-8');
  if (content.includes('## Auto-Log')) {
    content = content.replace('## Auto-Log\n', `## Auto-Log\n${entry}`);
  } else {
    content += `\n## Auto-Log\n\n${entry}`;
  }
  writeFileSync(notePath, content, 'utf-8');
}

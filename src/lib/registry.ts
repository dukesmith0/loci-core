/**
 * Entity Registry — reads entities from link-index.yaml
 */

import { readLinkIndex, type LinkIndex } from './brain.js';

export interface Entity {
  name: string;
  file: string;
  aliases: string[];
  tags: string[];
}

/** Extract entities from link index (files that are linked to by many others = entities). */
export function getEntities(vaultPath: string): Entity[] {
  const index = readLinkIndex(vaultPath);
  const entities: Entity[] = [];

  for (const [filePath, entry] of Object.entries(index.files)) {
    // Consider files that are linked FROM at least 2 other files as entities
    if (entry.linked_from.length >= 2) {
      const name = filePath.split('/').pop()?.replace('.md', '') ?? filePath;
      entities.push({
        name,
        file: filePath,
        aliases: [], // Could be populated from frontmatter aliases field
        tags: entry.tags,
      });
    }
  }

  return entities;
}

/** Find an entity by name (case-insensitive). */
export function findEntity(name: string, vaultPath: string): Entity | null {
  const entities = getEntities(vaultPath);
  const lower = name.toLowerCase();
  return entities.find(e =>
    e.name.toLowerCase() === lower ||
    e.aliases.some(a => a.toLowerCase() === lower)
  ) ?? null;
}

/** Get all entity names and aliases for wikilink scanning. */
export function getEntityNames(vaultPath: string): Array<{ name: string; aliases: string[] }> {
  return getEntities(vaultPath).map(e => ({ name: e.name, aliases: e.aliases }));
}

/**
 * Config Resolution — ~/.talos/config.yaml
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import yaml from 'js-yaml';

export interface GitConfig {
  vault_remote: string;
  auto_pull: boolean;
  auto_push: boolean;
}

export interface ProjectEntry {
  path: string;
  vault_entry?: string;
}

export interface TalosConfig {
  vault_path: string;
  machine_id: string;
  default_mode: string;
  git: GitConfig;
  projects: Record<string, ProjectEntry>;
}

const CONFIG_DIR = join(homedir(), '.talos');
const CONFIG_PATH = join(CONFIG_DIR, 'config.yaml');

const DEFAULTS: TalosConfig = {
  vault_path: '',
  machine_id: '',
  default_mode: 'default',
  git: { vault_remote: '', auto_pull: true, auto_push: true },
  projects: {},
};

export function loadConfig(): TalosConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  const parsed = yaml.load(raw) as Partial<TalosConfig> | null;
  if (!parsed) return null;
  return {
    ...DEFAULTS,
    ...parsed,
    git: { ...DEFAULTS.git, ...(parsed.git ?? {}) },
    projects: parsed.projects ?? {},
  };
}

export function resolveConfig(): TalosConfig {
  const config = loadConfig();
  if (!config) throw new Error('No TALOS configuration found. Run "talos setup" to get started.');
  return config;
}

export function getVaultPath(config?: TalosConfig): string {
  const cfg = config ?? resolveConfig();
  if (!cfg.vault_path) throw new Error('vault_path not configured. Run "talos setup".');
  return cfg.vault_path;
}

export function saveConfig(config: TalosConfig): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, yaml.dump(config, { lineWidth: 120, noRefs: true }), 'utf-8');
}

export function hasConfig(): boolean {
  return existsSync(CONFIG_PATH);
}

export function getConfigDir(): string { return CONFIG_DIR; }
export function getConfigPath(): string { return CONFIG_PATH; }

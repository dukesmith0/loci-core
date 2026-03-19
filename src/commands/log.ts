/**
 * log — Quick append to daily note auto-log
 */

import { resolveConfig } from '../lib/config.js';
import { appendAutoLog } from '../lib/vault.js';
import chalk from 'chalk';

interface LogOptions {
  message: string;
}

export async function execute(options: LogOptions): Promise<void> {
  try {
    const config = resolveConfig();
    const machineId = config.machine_id ?? 'unknown';
    const entry = `${machineId} | log | ${options.message}`;
    appendAutoLog(entry, config.vault_path);
    console.log(chalk.green('  Logged:'), options.message);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red('  Log failed:'), msg);
    process.exitCode = 1;
  }
}

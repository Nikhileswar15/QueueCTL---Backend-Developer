import chalk from 'chalk';
import Table from 'cli-table3';
import { ConfigManager } from '../lib/ConfigManager';
import { Config } from '../types';

export async function handleConfigGet() {
  try {
    const config = await ConfigManager.getConfig();
    console.log(chalk.bold.blue('🔧 Current Configuration'));
    const table = new Table();
    table.push(
      { 'Default Max Retries': config.maxRetries },
      { 'Backoff Base': config.backoffBase }
    );
    console.log(table.toString());
  } catch (error) {
    console.error(chalk.red('Error getting config:', error));
  }
}

export async function handleConfigSet(key: string, value: string) {
  try {
    // Convert kebab-case to camelCase
    const keyMap: Record<string, keyof Config> = {
      'max-retries': 'maxRetries',
      'maxRetries': 'maxRetries',
      'backoff-base': 'backoffBase',
      'backoffBase': 'backoffBase'
    };

    const camelKey = keyMap[key];
    
    if (!camelKey) {
      console.error(chalk.red(`Error: Invalid config key '${key}'. Must be 'max-retries' or 'backoff-base'.`));
      return;
    }
    
    const newConfig = await ConfigManager.setConfig(camelKey, value);
    console.log(chalk.green(`✅ Config updated. ${key} is now ${newConfig[camelKey]}.`));
  } catch (error) {
    console.error(chalk.red('Error setting config:', error));
  }
}

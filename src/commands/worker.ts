import chalk from 'chalk';
import { WorkerManager } from '../lib/WorkerManager';

export function handleWorkerStart(count: number) {
  try {
    WorkerManager.start(count);
  } catch (error) {
    console.error(chalk.red('Error starting workers:', error));
  }
}

export async function handleWorkerStop() {
  try {
    await WorkerManager.stop();
  } catch (error) {
    console.error(chalk.red('Error stopping workers:', error));
  }
}

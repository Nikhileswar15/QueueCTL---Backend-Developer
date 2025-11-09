import chalk from 'chalk';
import Table from 'cli-table3';
import { JobQueue } from '../lib/JobQueue';
import { ConfigManager } from '../lib/ConfigManager';
import { JobState } from '../types';
import { Storage } from '../db/Storage';

export async function handleStatus() {
  try {
    const config = await ConfigManager.getConfig();
    const jobQueue = new JobQueue(config);
    const summary = await jobQueue.getStatus();
    
    console.log(chalk.bold.blue('📊 Queue Status Summary'));
    const table = new Table({
      head: [chalk.cyan('State'), chalk.cyan('Count')],
      colWidths: [20, 10],
    });

    const states = Object.values(JobState);
    states.forEach(state => {
        table.push([state, summary[state] || 0]);
    });
    console.log(table.toString());

    console.log(chalk.bold.blue('\n👷 Worker Status'));
    const workers = await Storage.readWorkerStatus();

    if (workers.length > 0) {
      const workerPids = workers.map(w => w.pid);
      console.log(chalk.green(`${workers.length} worker(s) running. PIDs: ${workerPids.join(', ')}`));
      
      const workerTable = new Table({
          head: [chalk.cyan('PID'), chalk.cyan('Status'), chalk.cyan('Current Job ID')],
          colWidths: [10, 15, 40],
      });
      
      workers.forEach(w => {
          workerTable.push([w.pid, w.status, w.jobId ? w.jobId.substring(0, 18) + '...' : 'N/A']);
      });
      console.log(workerTable.toString());

    } else {
      console.log(chalk.yellow('No workers are running.'));
    }

  } catch (error) {
    console.error(chalk.red('Error fetching status:', error));
  }
}

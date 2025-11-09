import chalk from 'chalk';
import Table from 'cli-table3';
import { JobQueue } from '../lib/JobQueue';
import { ConfigManager } from '../lib/ConfigManager';
import { Job, JobState } from '../types';

export async function handleList(state?: JobState, jsonOutput?: boolean) {
  try {
    const config = await ConfigManager.getConfig();
    const jobQueue = new JobQueue(config);
    const jobs = await jobQueue.getJobsByState(state || 'all');

    if (jsonOutput) {
      console.log(JSON.stringify(jobs, null, 2));
      return;
    }

    if (jobs.length === 0) {
      console.log(chalk.yellow('No jobs found.'));
      return;
    }
    
    const table = new Table({
      head: [
        chalk.cyan('ID'),
        chalk.cyan('Command'),
        chalk.cyan('State'),
        chalk.cyan('Priority'),
        chalk.cyan('Attempts'),
        chalk.cyan('Last Updated'),
      ],
      colWidths: [10, 20, 12, 10, 10, 25],
      wordWrap: true,
    });

    jobs.forEach(job => {
      table.push([
        job.id.substring(0, 8),
        job.command,
        getStateColored(job.state),
        job.priority,
        `${job.attempts}/${job.max_retries}`,
        new Date(job.updated_at).toLocaleString(),
      ]);
    });

    console.log(table.toString());
  } catch (error) {
    console.error(chalk.red('Error listing jobs:', error));
  }
}

function getStateColored(state: JobState): string {
    switch (state) {
        case JobState.PENDING: return chalk.blue(state);
        case JobState.PROCESSING: return chalk.yellow(state);
        case JobState.COMPLETED: return chalk.green(state);
        case JobState.FAILED: return chalk.magenta(state);
        case JobState.DEAD: return chalk.red(state);
        default: return state;
    }
}

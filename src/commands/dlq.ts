import chalk from 'chalk';
import Table from 'cli-table3';
import { JobQueue } from '../lib/JobQueue';
import { ConfigManager } from '../lib/ConfigManager';
import { Job, JobState } from '../types';

export async function handleDlqList(jsonOutput?: boolean) {
  try {
    const config = await ConfigManager.getConfig();
    const jobQueue = new JobQueue(config);
    const jobs = await jobQueue.getJobsByState(JobState.DEAD);

    if (jsonOutput) {
      console.log(JSON.stringify(jobs, null, 2));
      return;
    }

    if (jobs.length === 0) {
      console.log(chalk.yellow('Dead Letter Queue is empty.'));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan('ID'),
        chalk.cyan('Command'),
        chalk.cyan('Attempts'),
        chalk.cyan('Last Updated'),
      ],
      colWidths: [38, 30, 10, 25],
      wordWrap: true,
    });

    jobs.forEach(job => {
      table.push([
        job.id,
        job.command,
        `${job.attempts}/${job.max_retries}`,
        new Date(job.updated_at).toLocaleString(),
      ]);
    });

    console.log(table.toString());
  } catch (error) {
    console.error(chalk.red('Error listing DLQ jobs:', error));
  }
}

export async function handleDlqRetry(jobId: string) {
  try {
    const config = await ConfigManager.getConfig();
    const jobQueue = new JobQueue(config);
    const job = await jobQueue.retryDeadJob(jobId);

    if (!job) {
      console.error(chalk.red(`Error: Job with ID ${jobId} not found or not in the Dead Letter Queue.`));
      return;
    }

    console.log(chalk.green(`✅ Job ${job.id} has been moved from DLQ to pending queue for retry.`));

  } catch (error) {
    console.error(chalk.red(`Error retrying job ${jobId}:`, error));
  }
}

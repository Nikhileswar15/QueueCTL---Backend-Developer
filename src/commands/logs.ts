import chalk from 'chalk';
import { JobQueue } from '../lib/JobQueue';
import { ConfigManager } from '../lib/ConfigManager';

export async function handleLogs(jobId: string) {
  try {
    const config = await ConfigManager.getConfig();
    const jobQueue = new JobQueue(config);
    const job = await jobQueue.getJobById(jobId);

    if (!job) {
      console.error(chalk.red(`Error: Job with ID matching '${jobId}' not found.`));
      return;
    }

    console.log(chalk.bold.blue(`📄 Logs for Job ${job.id}`));
    console.log(chalk.gray(`   Command: ${job.command}`));
    console.log(chalk.gray(`   State: ${job.state}`));
    console.log('----------------------------------------');

    if (job.log && job.log.length > 0) {
      job.log.forEach(line => console.log(line));
    } else {
      console.log(chalk.yellow('No logs found for this job.'));
    }
    console.log('----------------------------------------');

  } catch (error) {
    console.error(chalk.red(`Error fetching logs for job ${jobId}:`, error));
  }
}

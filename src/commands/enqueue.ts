import chalk from 'chalk';
import { JobQueue } from '../lib/JobQueue';
import { ConfigManager } from '../lib/ConfigManager';
import { JobPriority } from '../types';

export async function handleEnqueue(jobJson: string, priority: JobPriority, maxRetries?: number) {
  try {
    let jobData: { id?: string; command: string };
    
    // Try to parse as JSON first
    try {
      // Handle potential escaped quotes from shell
      let cleanJson = jobJson.trim();
      
      // If it doesn't start with {, try to clean it
      if (!cleanJson.startsWith('{')) {
        cleanJson = cleanJson.replace(/^["']|["']$/g, '');
      }
      
      // Try to parse as-is first
      try {
        jobData = JSON.parse(cleanJson);
      } catch (firstError) {
        // PowerShell often strips quotes, try to fix it: {id:job1,command:sleep 2} -> {"id":"job1","command":"sleep 2"}
        const fixed = cleanJson.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/g, '$1"$2":')
                               .replace(/:\s*([a-zA-Z_][a-zA-Z0-9_\s-]*?)(\s*[,}])/g, ':"$1"$2');
        jobData = JSON.parse(fixed);
      }
      
      if (!jobData.command) {
        console.error(chalk.red('Error: JSON must contain a "command" field.'));
        console.error(chalk.yellow('Example: \'{"id":"job1","command":"sleep 2"}\''));
        return;
      }
    } catch (e) {
      console.error(chalk.red('Error: Invalid JSON format.'));
      console.error(chalk.yellow('Expected format: \'{"id":"job1","command":"sleep 2"}\''));
      console.error(chalk.gray(`Received: ${jobJson}`));
      return;
    }

    const config = await ConfigManager.getConfig();
    const jobQueue = new JobQueue(config);
    const job = await jobQueue.enqueue(jobData.command, priority, maxRetries);
    
    const displayId = jobData.id || job.id.substring(0, 8);
    console.log(chalk.green(`✅ Job enqueued with ID: ${displayId}`));
    console.log(chalk.gray(`   Full ID: ${job.id}`));
  } catch (error) {
    console.error(chalk.red('Error enqueuing job:', error));
  }
}

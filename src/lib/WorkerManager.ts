declare const process: any;
declare const __dirname: string;

import { spawn, exec } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { JobQueue } from './JobQueue';
import { Job, JobState, WorkerStatus } from '../types';
import { ConfigManager } from './ConfigManager';
import { Storage } from '../db/Storage';

const IS_DEV = process.argv.some((arg: string) => arg.includes('ts-node')) || !fs.existsSync(path.resolve(__dirname, '..', 'commands', 'worker-process.js'));

async function updateWorkerStatus(pid: number, status: 'idle' | 'processing', jobId: string | null): Promise<void> {
    await Storage.workerStatusTransaction((statuses) => {
        const existing = statuses.find(ws => ws.pid === pid);
        if (existing) {
            existing.status = status;
            existing.jobId = jobId;
        } else {
            statuses.push({ pid, status, jobId });
        }
        return { statuses, result: undefined };
    });
}

async function removeWorkerStatus(pid: number): Promise<void> {
    await Storage.workerStatusTransaction((statuses) => {
        const newStatuses = statuses.filter(ws => ws.pid !== pid);
        return { statuses: newStatuses, result: undefined };
    });
}

export class WorkerManager {
  public static start(count: number): void {
    let workerScript: string;
    let spawnCommand: string;
    let spawnArgs: string[];

    const compiledWorker1 = path.resolve(__dirname, '..', 'commands', 'worker-process.js');
    const compiledWorker2 = path.resolve(process.cwd(), 'dist', 'commands', 'worker-process.js');
    const sourceWorker = path.resolve(__dirname, '..', 'commands', 'worker-process.ts');
    
    let compiledWorker = compiledWorker1;
    if (!fs.existsSync(compiledWorker1) && fs.existsSync(compiledWorker2)) {
        compiledWorker = compiledWorker2;
    }
    
    if (fs.existsSync(compiledWorker)) {
        workerScript = compiledWorker;
        spawnCommand = 'node';
        spawnArgs = [workerScript];
        console.log(chalk.gray(`Using compiled worker: ${workerScript}`));
    } else if (fs.existsSync(sourceWorker)) {
        workerScript = sourceWorker;
        const tsNodeCmd = path.resolve(process.cwd(), 'node_modules', '.bin', 'ts-node.cmd');
        const tsNodeExe = path.resolve(process.cwd(), 'node_modules', '.bin', 'ts-node');
        
        if (process.platform === 'win32' && fs.existsSync(tsNodeCmd)) {
            spawnCommand = 'cmd';
            spawnArgs = ['/c', tsNodeCmd, workerScript];
        } else if (fs.existsSync(tsNodeExe)) {
            spawnCommand = tsNodeExe;
            spawnArgs = [workerScript];
        } else {
            spawnCommand = 'npx';
            spawnArgs = ['ts-node', workerScript];
        }
        console.log(chalk.gray(`Using TypeScript worker: ${workerScript}`));
    } else {
        console.error(chalk.red(`Error: Worker script not found. Tried:\n  - ${compiledWorker}\n  - ${sourceWorker}`));
        console.error(chalk.yellow(`Run 'npm run build' first.`));
        return;
    }

    const pids: number[] = [];
    for (let i = 0; i < count; i++) {
      const child = spawn(spawnCommand, spawnArgs, {
        detached: true,
        stdio: 'ignore',
        shell: false,
      });
      child.unref();
      if (child.pid) {
        pids.push(child.pid);
      }
    }
    
    console.log(chalk.green(`✅ Started ${count} workers in the background. PIDs: ${pids.join(', ')}`));
  }

  public static async stop(): Promise<void> {
    const statusesToStop = await Storage.workerStatusTransaction((statuses) => {
        return { statuses: [], result: statuses };
    });

    if (statusesToStop.length === 0) {
      console.log(chalk.yellow('No active workers found.'));
      return;
    }

    let stoppedCount = 0;
    for (const worker of statusesToStop) {
      try {
        process.kill(worker.pid, 'SIGTERM');
        stoppedCount++;
      } catch (e) {
      }
    }

    if (stoppedCount > 0) {
        console.log(chalk.green(`✅ Sent stop signal to ${stoppedCount} workers.`));
    } else {
        console.log(chalk.yellow('No running workers to stop. Cleaned up status file.'));
    }
  }
}

export async function runWorkerProcess() {
  const config = await ConfigManager.getConfig();
  const jobQueue = new JobQueue(config);
  let isShuttingDown = false;
  const workerPid = process.pid;

  await updateWorkerStatus(workerPid, 'idle', null);

  const shutdown = async () => {
    if (!isShuttingDown) {
      isShuttingDown = true;
      await removeWorkerStatus(workerPid).catch(err => console.error(`Worker ${workerPid} failed to cleanup status on exit:`, err));
      process.exit(0);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  while (!isShuttingDown) {
    const job = await jobQueue.getNextProcessableJob();

    if (job) {
      await updateWorkerStatus(workerPid, 'processing', job.id);
      await executeJob(job);
      await updateWorkerStatus(workerPid, 'idle', null);
    } else {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function executeJob(job: Job) {
    const config = await ConfigManager.getConfig();
    const jobQueue = new JobQueue(config);
    
    job.attempts += 1;
    job.log.push(`[${new Date().toISOString()}] Attempt ${job.attempts} started by worker ${process.pid}.`);
    job.log.push(`[${new Date().toISOString()}] Executing: ${job.command}`);
    await jobQueue.updateJob(job);

    return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            job.log.push(`[${new Date().toISOString()}] Command execution timeout (60s).`);
            if (job.attempts >= job.max_retries) {
                job.state = JobState.DEAD;
                job.log.push(`[${new Date().toISOString()}] Job moved to DLQ after ${job.attempts} failed attempts.`);
            } else {
                job.state = JobState.PENDING;
                const delay = Math.pow(config.backoffBase, job.attempts) * 1000;
                job.retry_at = Date.now() + delay;
                job.log.push(`[${new Date().toISOString()}] Scheduled for retry in ${Math.round(delay/1000)}s.`);
            }
            jobQueue.updateJob(job).then(() => resolve()).catch(err => {
                console.error(`Worker ${process.pid} failed to update job ${job.id} after timeout:`, err);
                resolve();
            });
        }, 60000);

        exec(job.command, (error, stdout, stderr) => {
            clearTimeout(timeout);
            
            try {
                if (stdout) job.log.push(`[${new Date().toISOString()}] STDOUT: ${stdout.trim()}`);
                if (stderr) job.log.push(`[${new Date().toISOString()}] STDERR: ${stderr.trim()}`);
                
                if (error) {
                    job.log.push(`[${new Date().toISOString()}] Command failed with exit code ${error.code}.`);
                    if (job.attempts >= job.max_retries) {
                        job.state = JobState.DEAD;
                        job.log.push(`[${new Date().toISOString()}] Job moved to DLQ after ${job.attempts} failed attempts.`);
                    } else {
                        job.state = JobState.PENDING;
                        const delay = Math.pow(config.backoffBase, job.attempts) * 1000;
                        job.retry_at = Date.now() + delay;
                        job.log.push(`[${new Date().toISOString()}] Scheduled for retry in ${Math.round(delay/1000)}s.`);
                    }
                } else {
                    job.state = JobState.COMPLETED;
                    job.log.push(`[${new Date().toISOString()}] Command completed successfully.`);
                }

                jobQueue.updateJob(job).then(() => resolve()).catch(err => {
                    console.error(`Worker ${process.pid} failed to update job ${job.id}:`, err);
                    resolve();
                });
            } catch (err) {
                console.error(`Worker ${process.pid} encountered error processing job ${job.id}:`, err);
                job.log.push(`[${new Date().toISOString()}] Internal error: ${err}`);
                job.state = JobState.PENDING;
                job.retry_at = Date.now() + Math.pow(config.backoffBase, job.attempts) * 1000;
                jobQueue.updateJob(job).then(() => resolve()).catch(() => resolve());
            }
        });
    });
}
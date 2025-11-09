import { v4 as uuidv4 } from 'uuid';
import { Job, JobState, JobPriority, Config } from '../types';
import { Storage } from '../db/Storage';

export class JobQueue {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  public async enqueue(command: string, priority: JobPriority, max_retries?: number): Promise<Job> {
    const job: Job = {
      id: uuidv4(),
      command,
      state: JobState.PENDING,
      priority: priority || JobPriority.MEDIUM,
      attempts: 0,
      max_retries: max_retries ?? this.config.maxRetries,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      log: [`Job created at ${new Date().toISOString()}`],
    };

    return Storage.transaction((db) => {
        db.jobs.push(job);
        return { db, result: job };
    });
  }

  public async getNextProcessableJob(): Promise<Job | null> {
    return Storage.transaction((db) => {
        const now = Date.now();
        
        const priorityOrder: Record<JobPriority, number> = {
            [JobPriority.HIGH]: 0,
            [JobPriority.MEDIUM]: 1,
            [JobPriority.LOW]: 2,
        };

        const pendingJobs = db.jobs
            .filter(job => job.state === JobState.PENDING && (!job.retry_at || job.retry_at <= now))
            .sort((a, b) => {
                const priorityComparison = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (priorityComparison !== 0) return priorityComparison;

                const timeA = a.retry_at || new Date(a.created_at).getTime();
                const timeB = b.retry_at || new Date(b.created_at).getTime();
                return timeA - timeB;
            });

        if (pendingJobs.length === 0) {
            return { db, result: null };
        }
        
        const jobToProcess = pendingJobs[0];
        jobToProcess.state = JobState.PROCESSING;
        jobToProcess.updated_at = new Date().toISOString();
        
        return { db, result: jobToProcess };
    });
  }

  public async getJobsByState(state: JobState | 'all'): Promise<Job[]> {
    const db = await Storage.readDb();
    if (state === 'all') {
        return db.jobs;
    }
    return db.jobs.filter(job => job.state === state);
  }

  public async getJobById(jobId: string): Promise<Job | undefined> {
    const db = await Storage.readDb();
    // Allow for short IDs
    return db.jobs.find(j => j.id === jobId || j.id.startsWith(jobId));
  }

  public async updateJob(job: Job): Promise<Job> {
    return Storage.transaction(db => {
        const jobIndex = db.jobs.findIndex(j => j.id === job.id);
        if (jobIndex > -1) {
            job.updated_at = new Date().toISOString();
            db.jobs[jobIndex] = job;
            return { db, result: job };
        } else {
           throw new Error(`Job with id ${job.id} not found for update.`);
        }
    });
  }
  
  public async getStatus(): Promise<Record<JobState, number>> {
    const db = await Storage.readDb();
    const summary: Record<JobState, number> = {
        [JobState.PENDING]: 0,
        [JobState.PROCESSING]: 0,
        [JobState.COMPLETED]: 0,
        [JobState.FAILED]: 0,
        [JobState.DEAD]: 0,
    };
    db.jobs.forEach(job => {
        summary[job.state] = (summary[job.state] || 0) + 1;
    });
    return summary;
  }

  public async retryDeadJob(jobId: string): Promise<Job | null> {
    return Storage.transaction(db => {
        const jobIndex = db.jobs.findIndex(j => (j.id === jobId || j.id.startsWith(jobId)) && j.state === JobState.DEAD);
        if (jobIndex > -1) {
            const job = db.jobs[jobIndex];
            job.state = JobState.PENDING;
            job.attempts = 0;
            job.retry_at = undefined;
            job.updated_at = new Date().toISOString();
            job.log.push(`[${job.updated_at}] Job manually retried from DLQ.`);
            db.jobs[jobIndex] = job;
            return { db, result: job };
        }
        return { db, result: null };
    });
  }
}

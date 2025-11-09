export enum JobState {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  DEAD = "dead",
}

export enum JobPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface Job {
  id: string;
  command: string;
  state: JobState;
  priority: JobPriority;
  attempts: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
  log: string[];
  retry_at?: number; // Timestamp for next retry
}

export interface Config {
  maxRetries: number;
  backoffBase: number;
}

export interface DbSchema {
  jobs: Job[];
}

export interface WorkerStatus {
  pid: number;
  status: 'idle' | 'processing';
  jobId: string | null;
}

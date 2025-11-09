# QueueCTL Architecture

## Overview

QueueCTL is a lightweight, CLI-based background job queue system built with Node.js and TypeScript. It uses file-based persistence with file locking for concurrency safety.

## Core Components

### 1. **CLI Interface** (`src/queuectl.ts`)
- Entry point for all command-line operations
- Built with `yargs` for command parsing and validation
- Provides commands: `enqueue`, `list`, `status`, `worker`, `dlq`, `config`

### 2. **Storage Layer** (`src/db/Storage.ts`)
- **File-based persistence** using JSON files in `~/.queuectl/`
  - `db.json` - Job queue data
  - `config.json` - System configuration
  - `workers.json` - Active worker PIDs
- **Concurrency control** via `proper-lockfile` to prevent race conditions
- All read/write operations acquire a file lock first

### 3. **Job Queue** (`src/lib/JobQueue.ts`)
- Manages job lifecycle: `pending` → `processing` → `completed`/`failed` → `dead` (DLQ)
- **Priority-based processing** (high → medium → low)
- **Retry logic** with exponential backoff: delay = backoffBase^(attempts)
- **Atomic state transitions** protected by file locks

### 4. **Worker Manager** (`src/lib/WorkerManager.ts`)
- Spawns and manages worker processes using Node.js `child_process`
- Workers run as background processes, continuously polling for jobs
- **PID tracking** for monitoring and graceful shutdown
- Each worker:
  1. Acquires lock
  2. Fetches highest priority pending job
  3. Executes command via `child_process.exec`
  4. Updates job state
  5. Releases lock and repeats

### 5. **Configuration** (`src/lib/ConfigManager.ts`)
- Runtime configuration management
- Settings: `maxRetries`, `backoffBase`, `workerPollInterval`
- Persisted to `config.json`

### 6. **Web Dashboard** (`src/server.ts`)
- Express.js REST API server
- CORS-enabled for local network access
- Serves static HTML dashboard (`public/index.html`)
- Real-time monitoring and control interface

## Data Flow

```
┌─────────────┐
│   CLI/API   │
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌──────────────┐
│  JobQueue   │◄────►│   Storage    │
│             │      │  (JSON+Lock) │
└──────┬──────┘      └──────────────┘
       │
       ▼
┌─────────────┐
│   Worker    │──► Execute Command
│  Processes  │
└─────────────┘
```

## Concurrency Model

- **File locking** ensures atomicity of operations
- Multiple workers can run safely in parallel
- Each operation flow:
  1. Acquire lock on `db.json`
  2. Read current state
  3. Modify state
  4. Write updated state
  5. Release lock

## Retry & Error Handling

1. **Job Execution**: If command fails, increment `attempts`
2. **Exponential Backoff**: Calculate `nextRunAt = now + backoffBase^attempts`
3. **Max Retries**: After `maxRetries` attempts, move to DLQ
4. **Dead Letter Queue**: Jobs in DLQ can be manually retried or inspected

## Design Decisions

### Why File-based Storage?
- **Simplicity**: No external dependencies (Redis, PostgreSQL)
- **Portability**: Works on any system with Node.js
- **Persistence**: Data survives restarts automatically
- **Trade-off**: Not suitable for high-throughput production (use Redis/PostgreSQL for scale)

### Why File Locking?
- **Correctness**: Prevents race conditions without complex distributed locks
- **No Daemon Required**: No background service needed for coordination
- **Trade-off**: Slower than in-memory solutions, but sufficient for CLI use case

### Why Child Processes for Workers?
- **Isolation**: Worker crashes don't affect main process
- **Parallelism**: True parallel execution via OS processes
- **Monitoring**: PID tracking enables status checks and graceful shutdown

## Extending the System

### Add New Commands
1. Define command in `src/queuectl.ts` using `yargs`
2. Implement handler in `src/commands/`
3. Use `JobQueue` or `Storage` APIs

### Custom Job Types
1. Extend `Job` interface in `src/types.ts`
2. Update `JobQueue` to handle new job types
3. Modify worker execution logic if needed

### Alternative Storage Backend
1. Implement `Storage` interface for new backend (e.g., SQLite)
2. Swap implementation in `Storage.ts`
3. Update locking mechanism if needed

## Performance Characteristics

- **Job throughput**: ~10-50 jobs/sec (limited by file I/O)
- **Worker count**: Recommended 2-4 workers per core
- **Lock contention**: Increases with worker count
- **Scalability**: Single machine only (no distributed support)

## Security Considerations

- **Command execution**: Uses `child_process.exec` - sanitize inputs in production
- **File permissions**: Queue data stored in user home directory
- **API access**: No authentication - use firewall rules for network access
- **Input validation**: Commands are user-provided - validate before execution

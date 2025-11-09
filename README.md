# QueueCTL - A CLI-Based Background Job Queue System

`queuectl` is a minimal, production-grade background job queue system built as a command-line interface (CLI) tool. It manages background jobs with worker processes, handles retries using exponential backoff, and maintains a Dead Letter Queue (DLQ) for permanently failed jobs.

---

## 🎯 **Features**

- **Enqueue Jobs**: Add new shell commands to the queue.
- **Persistent Storage**: Job data persists across restarts using a local JSON file.
- **Multiple Workers**: Run multiple worker processes in parallel to execute jobs.
- **Concurrency Safe**: Uses file locking to prevent race conditions and duplicate job processing.
- **Retry & Exponential Backoff**: Automatically retries failed jobs with a configurable exponential backoff delay.
- **Dead Letter Queue (DLQ)**: Moves jobs to a DLQ after exhausting all retries.
- **Configuration Management**: Manage settings like max retries and backoff base via the CLI.
- **Job Priorities**: Process higher-priority jobs first.
- **Clean CLI Interface**: User-friendly commands with formatted table outputs and help texts.

---

## 🌐 **Web Dashboard**

QueueCTL includes a real-time web dashboard for visual monitoring and control.

### **Features**
- Real-time job queue visualization
- Start/stop workers
- Enqueue jobs with priority
- Monitor worker status
- View job logs and states
- Retry jobs from DLQ
- Configure system settings

### **Quick Start**
```bash
npm run dashboard
```
Then open in your browser:
- **Local:** http://localhost:3001
- **Network:** http://Nikhileswar:3001

---

## 🔧 **Setup Instructions**

### **Prerequisites**
- Node.js (v16 or higher)
- npm

### **Installation**
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Nikhileswar03/QueueCTL---Backend-Developer.git
    cd QueueCTL---Backend-Developer
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the project:**
    ```bash
    npm run build
    ```

4.  **Make `queuectl` globally available:**
    Use `npm link` to create a symbolic link to the `queuectl` executable. This allows you to run `queuectl` from anywhere in your terminal.
    ```bash
    npm link
    ```
    You can now run the tool using the `queuectl` command.

---

## 🚀 **Usage Examples**

### **1. Enqueue a Job**
Add a new job to the queue using JSON format.

```bash
# Enqueue a simple job (PowerShell)
queuectl enqueue '{"id":"job1","command":"echo Hello World"}'

# Enqueue a job with priority
queuectl enqueue '{"id":"job2","command":"sleep 3"}' --priority high

# Enqueue a job with custom retries
queuectl enqueue '{"id":"job3","command":"npm install"}' --priority high --max-retries 5
```
_Output:_
```
✅ Job enqueued with ID: job1
   Full ID: 6a8f1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c
```

### **2. Start Workers**
Start worker processes to execute jobs from the queue.

```bash
# Start 3 worker processes in the background
queuectl worker start --count 3
```
_Output:_
```
✅ Started 3 workers in the background. PIDs: 12345, 12346, 12347
```

### **3. Check Status**
Show a summary of all job states and active workers.

```bash
queuectl status
```
_Output:_
```
📊 Queue Status Summary
┌────────────┬───────┐
│ State      │ Count │
├────────────┼───────┤
│ pending    │ 5     │
│ processing │ 3     │
│ completed  │ 12    │
│ failed     │ 1     │
│ dead       │ 2     │
└────────────┴───────┘

👷 Worker Status
3 workers running. PIDs: 12345, 12346, 12347
```

### **4. List Jobs**
List jobs, with an option to filter by state.

```bash
# List all jobs
queuectl list

# List only pending jobs
queuectl list --state pending
```
_Output:_
```
┌──────────┬──────────────────┬──────────┬──────────┬──────────┬──────────────────────────┐
│ ID       │ Command          │ State    │ Priority │ Attempts │ Last Updated             │
├──────────┼──────────────────┼──────────┼──────────┼────────────────────────────────────┤
│ 6a8f1b2c │ echo 'Hello ...' │ pending  │ medium   │ 0/3      │ 2023-10-27T10:30:00.123Z │
│ 7b9c2d3e │ sleep 3 && e ... │ pending  │ medium   │ 0/3      │ 2023-10-27T10:31:00.456Z │
└──────────┴──────────────────┴──────────┴──────────┴──────────┴──────────────────────────┘
```

### **5. Manage the Dead Letter Queue (DLQ)**
View or retry jobs that have permanently failed.

```bash
# List all jobs in the DLQ
queuectl dlq list

# Retry a specific job from the DLQ by its ID
queuectl dlq retry 6a8f1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c
```

### **6. Manage Configuration**
View or update system configuration.

```bash
# Get the current configuration
queuectl config get

# Set the default max retries for new jobs (kebab-case)
queuectl config set max-retries 5

# Set the backoff base for retry delays (kebab-case)
queuectl config set backoff-base 3
```

### **7. Stop Workers**
Gracefully stop all running worker processes.

```bash
queuectl worker stop
```
_Output:_
```
✅ Stopped 3 workers.
```
---

## 🏛️ **Architecture Overview**

-   **CLI Entrypoint (`src/queuectl.ts`)**: Uses `yargs` to define commands and parse arguments.
-   **Persistence (`src/db/Storage.ts`)**: Job and configuration data are stored in JSON files (`.queuectl/db.json`, `.queuectl/config.json`) in the user's home directory. `proper-lockfile` prevents multiple workers from corrupting the database by acquiring a lock before any read or write operation.
-   **Worker Logic (`src/lib/WorkerManager.ts`)**: Spawns and manages worker processes in the background using `child_process`.
-   **Job Queue (`src/lib/JobQueue.ts`)**: Manages job lifecycle, priorities, and retry logic.
-   **Config Manager (`src/lib/ConfigManager.ts`)**: Handles system configuration.

For detailed architecture and design decisions, see **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## 🤔 **Assumptions & Trade-offs**

-   **Persistence**: JSON files chosen for simplicity. For larger-scale applications, SQLite or Redis would offer better performance.
-   **Worker Management**: PID tracking approach is straightforward. A process manager like PM2 could provide additional monitoring.
-   **Job Execution**: `child_process.exec` used for simplicity. For production, `child_process.spawn` would be more secure.

---

## 🧪 **Testing**

Test the system functionality:

```bash
chmod +x ./test-scenario.sh
./test-scenario.sh
```

Or manually test via CLI:
```bash
# Start workers
queuectl worker start --count 2

# Enqueue jobs
queuectl enqueue '{"id":"test1","command":"echo Hello"}'

# Check status
queuectl status
queuectl list
```

---

## 🌐 **REST API**

QueueCTL provides a REST API for programmatic access.

### **Start API Server**
```bash
npm run dashboard
```

Server accessible at:
- **Local:** `http://localhost:3001`
- **Network:** `http://Nikhileswar:3001` (from any device on same network)
  - **Windows:** `http://Nikhileswar:3001`
  - **Mac/iOS:** `http://Nikhileswar.local:3001`
  - **Fallback:** `http://192.168.31.73:3001`

### **API Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/data` | Get all jobs, workers, config, and summary |
| `POST` | `/api/jobs` | Enqueue a new job |
| `POST` | `/api/workers/start` | Start worker processes |
| `POST` | `/api/workers/stop` | Stop all workers |
| `POST` | `/api/dlq/retry/:id` | Retry a job from DLQ |
| `PUT` | `/api/config` | Update configuration |

### **Example API Request**
```javascript
// Enqueue a job via API
const response = await fetch('http://localhost:3001/api/jobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: 'echo "API Job"',
    priority: 'high',
    max_retries: 3
  })
});
const job = await response.json();
console.log('Job created:', job.id);
```

---

## 🎬 **Demo**

[PASTE YOUR DEMO VIDEO LINK HERE]

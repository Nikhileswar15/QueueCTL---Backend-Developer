declare const __dirname: string;

import express from 'express';
import cors from 'cors';
import path from 'path';
import os from 'os';
import { JobQueue } from './lib/JobQueue';
import { ConfigManager } from './lib/ConfigManager';
import { WorkerManager } from './lib/WorkerManager';
import { JobPriority } from './types';
import { Storage } from './db/Storage';

const app = express();
const port = 3001;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

console.log('Serving static files from:', publicPath);

app.get('/api/data', async (req, res) => {
    try {
        const config = await ConfigManager.getConfig();
        const jobQueue = new JobQueue(config);
        const jobs = await jobQueue.getJobsByState('all');
        const workerStatuses = await Storage.readWorkerStatus();
        const summary = await jobQueue.getStatus();
        
        res.json({ jobs, workers: workerStatuses, config, summary });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

app.post('/api/jobs', async (req, res) => {
    try {
        const { command, max_retries, priority } = req.body;
        if (!command) {
            return res.status(400).json({ error: 'Command is required' });
        }
        const config = await ConfigManager.getConfig();
        const jobQueue = new JobQueue(config);
        const job = await jobQueue.enqueue(command, priority || JobPriority.MEDIUM, max_retries);
        res.status(201).json(job);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to enqueue job' });
    }
});

app.post('/api/workers/start', (req, res) => {
    try {
        const { count } = req.body;
        const workerCount = count || 1;
        
        console.log(`Starting ${workerCount} workers...`);
        
        WorkerManager.start(workerCount);
        
        setTimeout(async () => {
            try {
                const workerStatuses = await Storage.readWorkerStatus();
                console.log(`Workers started. Active workers: ${workerStatuses.length}`);
                res.json({ 
                    message: `Started ${workerCount} workers`, 
                    workers: workerStatuses.length 
                });
            } catch (err) {
                res.json({ message: `Started ${workerCount} workers` });
            }
        }, 1000);
        
    } catch (error: any) {
        console.error('Exception starting workers:', error);
        res.status(500).json({ error: 'Failed to start workers', details: error.message });
    }
});

app.post('/api/workers/stop', async (req, res) => {
    try {
        console.log('Stopping workers...');
        await WorkerManager.stop();
        
        setTimeout(async () => {
            const workerStatuses = await Storage.readWorkerStatus();
            console.log(`Workers stopped. Remaining workers: ${workerStatuses.length}`);
        }, 500);
        
        res.json({ message: 'Workers stopped' });
    } catch (error: any) {
        console.error('Exception stopping workers:', error);
        res.status(500).json({ error: 'Failed to stop workers', details: error.message });
    }
});

app.post('/api/dlq/retry/:id', async (req, res) => {
    try {
        const config = await ConfigManager.getConfig();
        const jobQueue = new JobQueue(config);
        const job = await jobQueue.retryDeadJob(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found in DLQ' });
        }
        res.json(job);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retry job' });
    }
});

app.put('/api/config', async (req, res) => {
    try {
        const { maxRetries, backoffBase } = req.body;
        if (maxRetries !== undefined) {
            await ConfigManager.setConfig('maxRetries', maxRetries);
        }
        if (backoffBase !== undefined) {
            await ConfigManager.setConfig('backoffBase', backoffBase);
        }
        const config = await ConfigManager.getConfig();
        res.json(config);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update config' });
    }
});

app.listen(port, '0.0.0.0', () => {
    const hostname = os.hostname();
    console.log(`QueueCTL Dashboard API running on http://0.0.0.0:${port}`);
    console.log(`Access locally: http://localhost:${port}`);
    console.log(`Access from network: http://${hostname}:${port}`);
});

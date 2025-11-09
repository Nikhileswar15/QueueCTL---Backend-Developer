declare const process: any;

import { runWorkerProcess } from '../lib/WorkerManager';

runWorkerProcess().catch(error => {
    console.error(`Worker process ${process.pid} encountered a fatal error and will exit.`, error);
    process.exit(1);
});
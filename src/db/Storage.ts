import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import lockfile from 'proper-lockfile';
import { DbSchema, Config, WorkerStatus } from '../types';

declare const process: any;

const homeDir = os.homedir();
const dataDir = path.join(homeDir, '.queuectl');
const dbPath = path.join(dataDir, 'db.json');
const configPath = path.join(dataDir, 'config.json');
const workerStatusPath = path.join(dataDir, 'worker_status.json');

const lockOptions = {
  stale: 15000,
  retries: {
    retries: 5,
    factor: 3,
    minTimeout: 100,
    maxTimeout: 2000,
  },
};

const defaultConfig: Config = {
  maxRetries: 3,
  backoffBase: 2,
};

const defaultDb: DbSchema = {
  jobs: [],
};

fs.ensureDirSync(dataDir);
if (!fs.existsSync(dbPath)) {
  fs.writeJSONSync(dbPath, defaultDb, { spaces: 2 });
}
if (!fs.existsSync(configPath)) {
  fs.writeJSONSync(configPath, defaultConfig, { spaces: 2 });
}
if (!fs.existsSync(workerStatusPath)) {
  fs.writeJSONSync(workerStatusPath, [], { spaces: 2 });
}

export class Storage {
  public static async transaction<T>(updateFn: (db: DbSchema) => { db: DbSchema; result: T }): Promise<T> {
    let release: (() => Promise<void>) | undefined;
    try {
      release = await lockfile.lock(dbPath, lockOptions);
      const currentDb = await fs.readJSON(dbPath);
      const { db: newDb, result } = updateFn(currentDb);
      await fs.writeJSON(dbPath, newDb, { spaces: 2 });
      await release();
      return result;
    } catch (error) {
      if (release) {
        await release();
      }
      throw error;
    }
  }

  public static async workerStatusTransaction<T>(updateFn: (statuses: WorkerStatus[]) => { statuses: WorkerStatus[]; result: T }): Promise<T> {
    let release: (() => Promise<void>) | undefined;
    try {
      release = await lockfile.lock(workerStatusPath, lockOptions);
      const currentStatuses = await fs.readJSON(workerStatusPath).catch(() => []);
      const { statuses: newStatuses, result } = updateFn(currentStatuses);
      await fs.writeJSON(workerStatusPath, newStatuses, { spaces: 2 });
      await release();
      return result;
    } catch (error) {
      if (release) {
        await release();
      }
      throw error;
    }
  }

  public static async configTransaction<T>(updateFn: (config: Config) => { config: Config; result: T }): Promise<T> {
    let release: (() => Promise<void>) | undefined;
    try {
      release = await lockfile.lock(configPath, lockOptions);
      let currentConfig: Config;
      try {
        currentConfig = await fs.readJSON(configPath);
      } catch (e) {
        currentConfig = defaultConfig;
      }

      const { config: newConfig, result } = updateFn({ ...defaultConfig, ...currentConfig });
      await fs.writeJSON(configPath, newConfig, { spaces: 2 });
      await release();
      return result;
    } catch (error) {
      if (release) {
        await release();
      }
      throw error;
    }
  }

  public static async readDb(): Promise<DbSchema> {
    const release = await lockfile.lock(dbPath, lockOptions);
    try {
      const data = await fs.readJSON(dbPath);
      return data;
    } finally {
      await release();
    }
  }

  public static async readConfig(): Promise<Config> {
    return this.configTransaction(config => ({ config, result: config }));
  }

  public static async readWorkerStatus(): Promise<WorkerStatus[]> {
    return this.workerStatusTransaction((statuses) => {
      const activeStatuses = statuses.filter(ws => {
        try {
          process.kill(ws.pid, 0);
          return true;
        } catch (e) {
          return false;
        }
      });

      return { statuses: activeStatuses, result: activeStatuses };
    });
  }
}
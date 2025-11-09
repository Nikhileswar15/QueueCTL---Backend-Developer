import { Storage } from '../db/Storage';
import { Config } from '../types';

export class ConfigManager {
  public static async getConfig(): Promise<Config> {
    return await Storage.readConfig();
  }

  public static async setConfig(key: keyof Config, value: any): Promise<Config> {
    return Storage.configTransaction((currentConfig) => {
        let parsedValue = value;
        if (key === 'maxRetries' || key === 'backoffBase') {
            parsedValue = Number(value);
            if (isNaN(parsedValue)) {
                throw new Error(`Invalid number value for ${key}`);
            }
        }

        const newConfig: Config = {
          ...currentConfig,
          [key]: parsedValue,
        };
        
        return { config: newConfig, result: newConfig };
    });
  }
}

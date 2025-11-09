#!/usr/bin/env node
declare const process: any;

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { handleEnqueue } from './commands/enqueue';
import { handleWorkerStart, handleWorkerStop } from './commands/worker';
import { handleStatus } from './commands/status';
import { handleList } from './commands/list';
import { handleDlqList, handleDlqRetry } from './commands/dlq';
import { handleConfigGet, handleConfigSet } from './commands/config';
import { handleLogs } from './commands/logs';
import { JobPriority } from './types';

yargs(hideBin(process.argv))
  .command(
    'enqueue <jobJson>',
    'Add a new job to the queue',
    (yargs) => {
      return yargs
        .positional('jobJson', {
          describe: 'JSON string with job details: {"id":"job1","command":"sleep 2"}',
          type: 'string',
        })
        .option('priority', {
          alias: 'p',
          describe: 'Set job priority',
          choices: Object.values(JobPriority),
          default: JobPriority.MEDIUM,
        })
        .option('max-retries', {
          alias: 'r',
          describe: 'Override the default max retries for this job',
          type: 'number',
        });
    },
    (argv) => {
      if (argv.jobJson) {
        handleEnqueue(argv.jobJson, argv.priority as JobPriority, argv['max-retries']);
      }
    }
  )
  .command(
    'worker <action>',
    'Manage worker processes',
    (yargs) => {
      return yargs
        .positional('action', {
          describe: 'Action to perform',
          choices: ['start', 'stop'],
        })
        .option('count', {
          alias: 'c',
          describe: 'Number of workers to start',
          type: 'number',
          default: 1,
        });
    },
    (argv) => {
      if (argv.action === 'start') {
        handleWorkerStart(argv.count);
      } else if (argv.action === 'stop') {
        handleWorkerStop();
      }
    }
  )
  .command(
    'status',
    'Show a summary of job states & active workers',
    () => {},
    handleStatus
  )
  .command(
    'list',
    'List jobs',
    (yargs) => {
      return yargs.option('state', {
        alias: 's',
        describe: 'Filter jobs by state',
        choices: ['pending', 'processing', 'completed', 'failed', 'dead'],
        type: 'string',
      })
      .option('json', {
        describe: 'Output as JSON',
        type: 'boolean',
        default: false,
      });
    },
    (argv) => {
      handleList(argv.state as any, argv.json);
    }
  )
  .command(
    'dlq <action> [jobId]',
    'Manage the Dead Letter Queue (DLQ)',
    (yargs) => {
      return yargs
        .positional('action', {
          describe: 'Action to perform on the DLQ',
          choices: ['list', 'retry'],
        })
        .positional('jobId', {
          describe: 'The ID of the job to retry (for retry action)',
          type: 'string',
        })
        .option('json', {
          describe: 'Output as JSON (for list action)',
          type: 'boolean',
          default: false,
        });
    },
    (argv) => {
      if (argv.action === 'list') {
        handleDlqList(argv.json);
      } else if (argv.action === 'retry') {
        if (!argv.jobId) {
          console.error('Error: Job ID is required for the retry action.');
          process.exit(1);
        }
        handleDlqRetry(argv.jobId as string);
      }
    }
  )
  .command(
    'config <action> [key] [value]',
    'Manage configuration',
    (yargs) => {
      return yargs
        .positional('action', {
          describe: 'Action to perform',
          choices: ['get', 'set'],
        })
        .positional('key', {
          describe: 'The config key to set (e.g., maxRetries)',
          type: 'string',
        })
        .positional('value', {
          describe: 'The value to set for the key',
          type: 'string',
        });
    },
    (argv) => {
      if (argv.action === 'get') {
        handleConfigGet();
      } else if (argv.action === 'set') {
        if (!argv.key || argv.value === undefined) {
          console.error('Error: Both key and value are required for set action.');
          process.exit(1);
        }
        handleConfigSet(argv.key as string, argv.value as string);
      }
    }
  )
  .command(
    'logs <jobId>',
    'Show the execution log for a specific job',
    (yargs) => {
      return yargs
        .positional('jobId', {
          describe: 'The ID of the job to view logs for',
          type: 'string',
          required: true,
        });
    },
    (argv) => {
        handleLogs(argv.jobId as string);
    }
  )
  .demandCommand(1, 'You need at least one command before moving on')
  .help()
  .alias('h', 'help')
  .strict().argv;
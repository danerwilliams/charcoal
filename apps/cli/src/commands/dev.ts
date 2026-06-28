import { Argv } from 'yargs';
import { registerCommands } from '../lib/register_commands';
import * as cache from './dev-commands/cache';
import * as meta from './dev-commands/meta';

export const command = 'dev <command>';
export const description = false;

export const builder = function (yargs: Argv): Argv {
  return registerCommands(yargs, [cache, meta]).strict().demandCommand();
};

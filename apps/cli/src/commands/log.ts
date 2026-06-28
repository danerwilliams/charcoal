import { Argv } from 'yargs';
import { registerCommands } from '../lib/register_commands';
import * as logDefault from './log-commands/default';
import * as logLong from './log-commands/long';
import * as logShort from './log-commands/short';

export const command = 'log <command>';
export const desc = 'Commands that log your stacks.';
export const aliases = ['l'];
export const builder = function (yargs: Argv): Argv {
  return registerCommands(yargs, [logDefault, logLong, logShort]).strict();
};

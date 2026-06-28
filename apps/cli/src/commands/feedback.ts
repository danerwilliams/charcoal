import { Argv } from 'yargs';
import { registerCommands } from '../lib/register_commands';
import * as debugContext from './feedback-commands/debug_context';

export const command = 'feedback <command>';
export const desc = 'Commands for providing feedback and debug state.';
export const builder = function (yargs: Argv): Argv {
  return registerCommands(yargs, [debugContext])
    .strict()
    .showHelpOnFail(false, `Use 'ch feedback --help' for usage`);
};

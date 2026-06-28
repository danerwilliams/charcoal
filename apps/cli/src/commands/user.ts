import { Argv } from 'yargs';
import { registerCommands } from '../lib/register_commands';
import * as branchDate from './user-commands/branch_date';
import * as branchPrefix from './user-commands/branch_prefix';
import * as branchReplacement from './user-commands/branch_replacement';
import * as editor from './user-commands/editor';
import * as pager from './user-commands/pager';
import * as restackDate from './user-commands/restack_date';
import * as submitBody from './user-commands/submit_body';
import * as tips from './user-commands/tips';

export const command = 'user <command>';
export const desc =
  "Read or write Charcoal's user configuration settings. Run `ch user --help` to learn more.";

export const builder = function (yargs: Argv): Argv {
  return registerCommands(yargs, [
    branchDate,
    branchPrefix,
    branchReplacement,
    editor,
    pager,
    restackDate,
    submitBody,
    tips,
  ])
    .strict()
    .demandCommand();
};

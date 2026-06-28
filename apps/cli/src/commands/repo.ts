import { Argv } from 'yargs';
import { registerCommands } from '../lib/register_commands';
import * as repoDisableGithub from './repo-commands/repo_disable_github';
import * as repoInit from './repo-commands/repo_init';
import * as repoName from './repo-commands/repo_name';
import * as repoOwner from './repo-commands/repo_owner';
import * as repoPrTemplates from './repo-commands/repo_pr_templates';
import * as repoRemote from './repo-commands/repo_remote';
import * as repoSync from './repo-commands/repo_sync';

export const command = 'repo <command>';
export const desc =
  "Read or write Charcoal's configuration settings for the current repo. Run `ch repo --help` to learn more.";

export const builder = function (yargs: Argv): Argv {
  return registerCommands(yargs, [
    repoInit,
    repoName,
    repoOwner,
    repoRemote,
    repoPrTemplates,
    repoSync,
    repoDisableGithub,
  ])
    .strict()
    .demandCommand();
};

import yargs from 'yargs';
import { trackBranch, trackStack } from '../actions/track_branch';
import { graphite } from '../lib/runner';

const args = {
  branch: {
    describe: `Branch to begin tracking. Defaults to the current branch.`,
    demandOption: false,
    positional: true,
    type: 'string',
    hidden: true,
  },
  parent: {
    describe: `The tracked branch's parent. If unset, prompts for a parent branch`,
    demandOption: false,
    positional: false,
    type: 'string',
    alias: 'p',
  },
  force: {
    describe: `Sets the parent to the most recent tracked ancestor of the branch being tracked. Takes precedence over \`--parent\``,
    demandOption: false,
    default: false,
    type: 'boolean',
    alias: 'f',
  },
  downstack: {
    describe: `Track a series of untracked branches downstack, starting at the current (or provided) branch and stopping at the first tracked branch.`,
    demandOption: false,
    default: false,
    type: 'boolean',
    alias: 'd',
  },
} as const;
type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;

export const command = 'track [branch]';
export const canonical = 'track';
export const aliases = ['tr'];
export const description = [
  'Start tracking the current (or provided) branch with Charcoal by selecting its parent.',
  'This command can also be used to fix corrupted Charcoal metadata.',
].join(' ');
export const builder = args;
export const handler = async (argv: argsT): Promise<void> =>
  graphite(argv, canonical, async (context) =>
    argv.downstack
      ? await trackStack(
          { branchName: argv.branch, force: argv.force },
          context
        )
      : await trackBranch(
          {
            branchName: argv.branch,
            parentBranchName: argv.parent,
            force: argv.force,
          },
          context
        )
  );

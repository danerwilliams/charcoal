import chalk from 'chalk';
import yargs from 'yargs';
import { currentBranchOnto } from '../actions/current_branch_onto';
import { interactiveBranchSelection } from '../actions/log';
import { graphite } from '../lib/runner';

const args = {
  branch: {
    describe: `Optional branch to rebase the current stack onto.`,
    demandOption: false,
    positional: true,
    hidden: true,
    type: 'string',
  },
  source: {
    describe: `Optional branch to rebase (defaults to current branch).`,
    demandOption: false,
    positional: false,
    type: 'string',
    aliases: ['s'],
  },
} as const;

export const command = 'move [branch]';
export const canonical = 'move';
export const aliases = ['mv'];
export const description =
  'Rebase the current branch onto the latest commit of the target branch and restack all of its descendants. If no branch is passed in, opens an interactive selector.';
export const builder = args;
type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;
export const handler = async (argv: argsT): Promise<void> => {
  return graphite(argv, canonical, async (context) => {
    const originalBranch = argv.source
      ? context.engine.currentBranch
      : undefined;
    argv.source && context.engine.checkoutBranch(argv.source);

    const dest =
      argv.branch ??
      (await interactiveBranchSelection(
        {
          message: `Choose a new base for ${chalk.yellow(
            context.engine.currentBranchPrecondition
          )} (autocomplete or arrow keys)`,
          omitCurrentBranch: true,
        },
        context
      ));

    currentBranchOnto(dest, context);

    originalBranch && context.engine.checkoutBranch(originalBranch);
  });
};

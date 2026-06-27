import yargs from 'yargs';
import { restackBranches } from '../actions/restack';
import { SCOPE } from '../lib/engine/scope_spec';
import { graphite } from '../lib/runner';

const args = {
  branch: {
    describe: 'Which branch to run this command from (default: current branch)',
    type: 'string',
  },
  downstack: {
    describe: 'Only restack this branch and its ancestors.',
    type: 'boolean',
    default: false,
    alias: 'd',
  },
  upstack: {
    describe: 'Only restack this branch and its descendants.',
    type: 'boolean',
    default: false,
    alias: 'u',
  },
  only: {
    describe: 'Only restack this branch.',
    type: 'boolean',
    default: false,
    alias: 'o',
  },
} as const;
type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;

export const aliases = ['r'];
export const command = 'restack';
export const canonical = 'restack';
export const description =
  'Ensure each branch in the current stack is based on its parent, rebasing if necessary. Use --upstack, --downstack, or --only to limit the scope.';
export const builder = args;
export const handler = async (argv: argsT): Promise<void> =>
  graphite(argv, canonical, async (context) => {
    const scope = argv.only
      ? SCOPE.BRANCH
      : argv.upstack
      ? SCOPE.UPSTACK
      : argv.downstack
      ? SCOPE.DOWNSTACK
      : SCOPE.STACK;
    return restackBranches(
      context.engine.getRelativeStack(
        argv.branch ?? context.engine.currentBranchPrecondition,
        scope
      ),
      context
    );
  });

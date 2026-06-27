import yargs from 'yargs';
import { testStack } from '../actions/test';
import { SCOPE } from '../lib/engine/scope_spec';
import { graphite } from '../lib/runner';

const args = {
  command: {
    describe: `The command you'd like to run on each branch of your stack.`,
    demandOption: true,
    type: 'string',
    positional: true,
    hidden: true,
  },
  downstack: {
    describe: 'Run the command from trunk to the current branch.',
    type: 'boolean',
    default: false,
    alias: 'd',
  },
  upstack: {
    describe: 'Run the command on the current branch and its descendants.',
    type: 'boolean',
    default: false,
    alias: 'u',
  },
  trunk: {
    describe: `Run the command on the trunk branch in addition to the rest of the stack.`,
    demandOption: false,
    default: false,
    alias: 't',
    type: 'boolean',
  },
} as const;
type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;

export const command = 'test <command>';
export const canonical = 'test';
export const description =
  'Run the provided command on each branch in the current stack and aggregate the results. Use --upstack or --downstack to limit the scope.';
export const builder = args;
export const handler = async (argv: argsT): Promise<void> =>
  graphite(argv, canonical, async (context) => {
    const scope = argv.upstack
      ? SCOPE.UPSTACK
      : argv.downstack
      ? SCOPE.DOWNSTACK
      : SCOPE.STACK;
    return testStack(
      {
        scope,
        includeTrunk: argv.trunk,
        command: argv.command,
      },
      context
    );
  });

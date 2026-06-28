import yargs from 'yargs';
import { commitAmendAction } from '../actions/commit_amend';
import { commitCreateAction } from '../actions/commit_create';
import { graphite } from '../lib/runner';

const args = {
  all: {
    describe: `Stage all changes before committing.`,
    demandOption: false,
    default: false,
    type: 'boolean',
    alias: 'a',
  },
  commit: {
    describe: `Create a new commit instead of amending the current one.`,
    demandOption: false,
    default: false,
    type: 'boolean',
    alias: 'c',
  },
  message: {
    type: 'string',
    alias: 'm',
    describe: 'The message for the commit.',
    demandOption: false,
  },
  edit: {
    type: 'boolean',
    describe: 'Modify the existing commit message when amending.',
    demandOption: false,
    default: true,
  },
  patch: {
    describe: `Pick hunks to stage before committing.`,
    demandOption: false,
    default: false,
    type: 'boolean',
    alias: 'p',
  },
  'no-edit': {
    type: 'boolean',
    describe:
      "Don't modify the existing commit message. Takes precedence over --edit",
    demandOption: false,
    default: false,
    alias: 'n',
  },
} as const;
type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;

export const command = 'modify';
export const canonical = 'modify';
export const aliases = ['m'];
export const description =
  'Modify the current branch by amending its commit (or creating a new one with --commit) and restack upstack branches.';
export const builder = args;
export const handler = async (argv: argsT): Promise<void> => {
  return graphite(argv, canonical, async (context) =>
    argv.commit
      ? commitCreateAction(
          {
            message: argv.message,
            addAll: argv.all,
            patch: argv.patch,
          },
          context
        )
      : commitAmendAction(
          {
            message: argv.message,
            noEdit: argv['no-edit'] || !argv.edit,
            addAll: argv.all,
            patch: argv.patch,
          },
          context
        )
  );
};

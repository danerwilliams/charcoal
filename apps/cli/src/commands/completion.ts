import { Argv, Arguments } from 'yargs';
import { composeGit } from '../lib/git/git';

export function registerCompletion(yargs: Argv): Argv {
  return yargs.completion(
    'completion',
    'Set up bash or zsh tab completion.',
    //@ts-expect-error types/yargs is out of date with yargs
    // eslint-disable-next-line max-params
    (current, argv, defaultCompletion, done) => {
      return shouldCompleteBranch(current, argv)
        ? // we don't want to load a full context here, so we'll just use the git call directly
          // once we persist the meta cache to disk, we can consider using a context here
          done(Object.keys(composeGit().getBranchNamesAndRevisions()))
        : defaultCompletion();
    }
  );
}

const BRANCH_COMPLETING_COMMANDS = [
  'checkout',
  'co',
  'delete',
  'dl',
  'track',
  'tr',
  'untrack',
  'ut',
  'move',
  'mv',
  'get',
  'g',
];

function shouldCompleteBranch(current: string, argv: Arguments): boolean {
  // this handles both with and without --branch because it's the only string arg
  return (
    argv['_'].length <= 3 &&
    BRANCH_COMPLETING_COMMANDS.includes('' + argv['_'][1]) &&
    typeof current === 'string'
  );
}

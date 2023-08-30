import { TContext } from './context';
import { PreconditionsFailedError } from './errors';
import { detectStagedChanges } from './git/diff';
import {
  trackedUncommittedChanges,
  unstagedChanges,
} from './git/git_status_utils';
import { runGitCommand } from './git/runner';

export function getRepoRootPathPrecondition(): string {
  const repoRootPath = runGitCommand({
    args: [`rev-parse`, `--git-common-dir`],
    onError: 'ignore',
    resource: 'getRepoRootPathPrecondition',
  });

  if (!repoRootPath) {
    throw new PreconditionsFailedError('No .git repository found.');
  }
  return repoRootPath;
}

export function uncommittedTrackedChangesPrecondition(): void {
  if (trackedUncommittedChanges()) {
    throw new PreconditionsFailedError(
      `There are tracked changes that have not been committed. Please resolve and then retry.`
    );
  }
}

export function ensureSomeStagedChangesPrecondition(context: TContext): void {
  if (detectStagedChanges()) {
    return;
  }

  if (unstagedChanges()) {
    context.splog.tip(
      'There are unstaged changes. Use the `--all` option to stage all changes.'
    );
  }

  throw new PreconditionsFailedError(`Cannot run without staged changes.`);
}

export function currentGitRepoPrecondition(): string {
  const repoRootPath = runGitCommand({
    args: [`rev-parse`, `--show-toplevel`],
    onError: 'ignore',
    resource: 'currentGitRepoPrecondition',
  });
  if (!repoRootPath) {
    throw new PreconditionsFailedError('No .git repository found.');
  }
  return repoRootPath;
}

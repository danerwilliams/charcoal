import chalk from 'chalk';
import { TContext } from '../../lib/context';
import { SCOPE } from '../../lib/engine/scope_spec';
import { KilledError } from '../../lib/errors';
import { uncommittedTrackedChangesPrecondition } from '../../lib/preconditions';
import { restackBranches } from '../restack';
import { cleanBranches } from './clean_branches';

export async function syncAction(
  opts: {
    pull: boolean;
    force: boolean;
    delete: boolean;
    showDeleteProgress: boolean;
    restack: boolean;
  },
  context: TContext
): Promise<void> {
  uncommittedTrackedChangesPrecondition();

  if (opts.pull) {
    await pullTrunk(opts.force, context);
    context.splog.tip('You can skip pulling trunk with the `--no-pull` flag.');
  }

  const branchesToRestack: string[] = [];

  // TODO: Sync PR info with GitHub API, syncing with Graphite API was removed here

  if (opts.delete) {
    context.splog.info(
      `🧹 Checking if any branches have been merged/closed and can be deleted...`
    );
    const branchesWithNewParents = await cleanBranches(
      { showDeleteProgress: opts.showDeleteProgress, force: opts.force },
      context
    );
    context.splog.tip(
      [
        'You can skip deleting branches with the `--no-delete` flag.',
        ...(opts.force
          ? []
          : [
              'Try the `--force` flag to delete merged branches without prompting for each.',
            ]),
        ...(opts.restack
          ? []
          : [
              'Try the `--restack` flag to automatically restack the current stack as well as any stacks with deleted branches.',
            ]),
      ].join('\n')
    );
    if (!opts.restack) {
      return;
    }

    branchesWithNewParents
      .flatMap((branchName) =>
        context.engine.getRelativeStack(branchName, SCOPE.UPSTACK)
      )
      .forEach((branchName) => branchesToRestack.push(branchName));
  }
  if (!opts.restack) {
    context.splog.tip(
      'Try the `--restack` flag to automatically restack the current stack.'
    );
    return;
  }

  const currentBranch = context.engine.currentBranch;

  // The below conditional doesn't handle the trunk case because
  // isBranchTracked returns false for trunk.  Also, in this case
  // we don't want to append to our existing branchesToRestack
  // because trunk's stack will include everything anyway.
  if (currentBranch && context.engine.isTrunk(currentBranch)) {
    restackBranches(
      context.engine.getRelativeStack(currentBranch, SCOPE.STACK),
      context
    );
    return;
  }

  if (
    currentBranch &&
    context.engine.isBranchTracked(currentBranch) &&
    !branchesToRestack.includes(currentBranch)
  ) {
    context.engine
      .getRelativeStack(currentBranch, SCOPE.STACK)
      .forEach((branchName) => branchesToRestack.push(branchName));
  }

  restackBranches(branchesToRestack, context);
}

export async function pullTrunk(
  force: boolean,
  context: TContext
): Promise<void> {
  context.splog.info(
    `🌲 Pulling ${chalk.cyan(context.engine.trunk)} from remote...`
  );
  const pullResult = context.engine.pullTrunk();
  if (pullResult !== 'PULL_CONFLICT') {
    context.splog.info(
      pullResult === 'PULL_UNNEEDED'
        ? `${chalk.green(context.engine.trunk)} is up to date.`
        : `${chalk.green(context.engine.trunk)} fast-forwarded to ${chalk.gray(
            context.engine.getRevision(context.engine.trunk)
          )}.`
    );
    return;
  }

  // If trunk cannot be fast-forwarded, prompt the user to reset to remote
  context.splog.warn(
    `${chalk.blueBright(context.engine.trunk)} could not be fast-forwarded.`
  );
  if (
    force ||
    (context.interactive &&
      (
        await context.prompts({
          type: 'confirm',
          name: 'value',
          message: `Overwrite ${chalk.yellow(
            context.engine.trunk
          )} with the version from remote?`,
          initial: true,
        })
      ).value)
  ) {
    context.engine.resetTrunkToRemote();
    context.splog.info(
      `${chalk.green(context.engine.trunk)} set to ${chalk.gray(
        context.engine.getRevision(context.engine.trunk)
      )}.`
    );
  } else {
    throw new KilledError();
  }
}

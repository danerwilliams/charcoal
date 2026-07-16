import chalk from 'chalk';
import { TContext } from '../lib/context';
import { SCOPE } from '../lib/engine/scope_spec';
import { ExitFailedError } from '../lib/errors';
import { preserveMergedAncestors } from './merged_ancestors';
import { restackBranches } from './restack';

export function deleteBranchAction(
  args: {
    branchName: string;
    force?: boolean;
  },
  context: TContext
): void {
  if (context.engine.isTrunk(args.branchName)) {
    throw new ExitFailedError('Cannot delete trunk!');
  }

  if (!args.force && !isSafeToDelete(args.branchName, context).result) {
    throw new ExitFailedError(
      [
        `The branch ${args.branchName} is neither merged nor closed.  Use the \`--force\` option to delete it.`,
        `Note that its changes will be lost, as its children will be restacked onto its parent.`,
      ].join('\n')
    );
  }

  const branchesToRestack = context.engine.getRelativeStack(
    args.branchName,
    SCOPE.UPSTACK_EXCLUSIVE
  );
  preserveMergedAncestors(
    context.engine.getChildren(args.branchName),
    [args.branchName],
    context
  );
  context.engine.deleteBranch(args.branchName);
  context.splog.info(`Deleted branch ${chalk.red(args.branchName)}`);

  restackBranches(branchesToRestack, context);
}

// Where did we merge this? If it was merged on GitHub, we see where it was
// merged into. If we don't detect that it was merged in GitHub but we do
// see the code in trunk, we fallback to say that it was merged into trunk.
// This extra check (rather than just saying trunk) is used to catch the
// case where one feature branch is merged into another on GitHub.
export function isSafeToDelete(
  branchName: string,
  context: TContext
): { result: true; reason: string } | { result: false } {
  const prInfo = context.engine.getPrInfo(branchName);

  const reason =
    prInfo?.state === 'CLOSED'
      ? `${chalk.redBright(branchName)} is closed on GitHub`
      : prInfo?.state === 'MERGED'
      ? `${chalk.green(branchName)} is merged into ${chalk.cyan(
          prInfo?.base ?? context.engine.trunk
        )}`
      : context.engine.isMergedIntoTrunk(branchName)
      ? `${chalk.green(branchName)} is merged into ${chalk.cyan(
          context.engine.trunk
        )}`
      : context.engine.isBranchEmpty(branchName)
      ? `${chalk.yellow(branchName)} is empty`
      : undefined;

  return reason ? { result: true, reason } : { result: false };
}

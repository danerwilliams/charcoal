import chalk from 'chalk';
import { TContext } from '../lib/context';
import { SCOPE } from '../lib/engine/scope_spec';
import { preserveMergedAncestors } from './merged_ancestors';
import { restackBranches } from './restack';

export function foldCurrentBranch(keep: boolean, context: TContext): void {
  const currentBranchName = context.engine.currentBranchPrecondition;
  const parentBranchName =
    context.engine.getParentPrecondition(currentBranchName);
  preserveMergedAncestors(
    [keep ? currentBranchName : parentBranchName],
    [keep ? parentBranchName : currentBranchName],
    context
  );
  context.engine.foldCurrentBranch(keep);
  if (keep) {
    context.splog.info(
      `Folded ${chalk.green(currentBranchName)} into ${chalk.blueBright(
        parentBranchName
      )}.`
    );
  } else {
    context.splog.info(
      `Folded ${chalk.blueBright(currentBranchName)} into ${chalk.green(
        parentBranchName
      )}.`
    );
    context.splog.tip(
      `To keep the name of the current branch, use the \`--keep\` flag.`
    );
  }
  restackBranches(
    context.engine.getRelativeStack(
      context.engine.currentBranchPrecondition,
      SCOPE.UPSTACK_EXCLUSIVE
    ),
    context
  );
}

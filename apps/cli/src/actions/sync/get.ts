import chalk from 'chalk';
import { execFileSync } from 'child_process';
import { TContext } from '../../lib/context';
import {
  ExitFailedError,
  KilledError,
  RebaseConflictError,
} from '../../lib/errors';
import { assertUnreachable } from '../../lib/utils/assert_unreachable';
import { persistContinuation } from '../persist_continuation';
import { printConflictStatus } from '../print_conflict_status';

export async function getAction(
  args: { branchName: string | undefined; force: boolean },
  context: TContext
): Promise<void> {
  const trunk = context.engine.trunk;

  let target = args.branchName ?? context.engine.currentBranch;
  if (!target) {
    throw new ExitFailedError(
      'No branch or PR specified, and no current branch to get.'
    );
  }

  // A numeric argument is a PR number; resolve it to its head branch.
  if (/^\d+$/.test(target)) {
    target = prFieldOrThrow(target, 'headRefName');
  }

  if (target === trunk) {
    context.splog.info(`Nothing to get: ${chalk.cyan(trunk)} is trunk.`);
    return;
  }

  // Charcoal doesn't push branch metadata to the remote, so we reconstruct the
  // downstack chain (trunk -> target) by walking each PR's base ref.
  const downstack: string[] = [];
  const seen = new Set<string>();
  let branch: string | undefined = target;
  while (branch && branch !== trunk) {
    if (seen.has(branch)) {
      throw new ExitFailedError(
        `Encountered a cycle while resolving the stack for ${chalk.yellow(
          target
        )}.`
      );
    }
    seen.add(branch);
    downstack.unshift(branch);
    branch = prFieldMaybe(branch, 'baseRefName');
  }

  if (branch !== trunk) {
    throw new ExitFailedError(
      [
        `Could not trace ${chalk.yellow(target)} back to trunk (${chalk.cyan(
          trunk
        )}) from its pull requests.`,
        `\`ch get\` reconstructs a stack from open PRs, so every branch from trunk to ${chalk.yellow(
          target
        )} needs one.`,
      ].join('\n')
    );
  }

  await getBranchesFromRemote(
    { downstack, base: trunk, force: args.force },
    context
  );

  context.engine.checkoutBranch(target);
}

function prFieldMaybe(
  branchOrNumber: string,
  field: 'headRefName' | 'baseRefName'
): string | undefined {
  try {
    const pr = JSON.parse(
      execFileSync('gh', ['pr', 'view', branchOrNumber, '--json', field], {
        stdio: ['ignore', 'pipe', 'ignore'],
      }).toString()
    );
    return pr[field] || undefined;
  } catch {
    return undefined;
  }
}

function prFieldOrThrow(
  branchOrNumber: string,
  field: 'headRefName' | 'baseRefName'
): string {
  const value = prFieldMaybe(branchOrNumber, field);
  if (!value) {
    throw new ExitFailedError(
      `Could not find an open pull request for "${branchOrNumber}".`
    );
  }
  return value;
}

export async function getBranchesFromRemote(
  args: { downstack: string[]; base: string; force: boolean },
  context: TContext
): Promise<void> {
  let parentBranchName = args.base;
  for (const [index, branchName] of args.downstack.entries()) {
    context.engine.fetchBranch(branchName, parentBranchName);
    if (args.force || !context.engine.branchExists(branchName)) {
      context.engine.checkoutBranchFromFetched(branchName, parentBranchName);
      context.splog.info(`Synced ${chalk.cyan(branchName)} from remote.`);
    } else if (!context.engine.isBranchTracked(branchName)) {
      await handleUntrackedLocally(branchName, parentBranchName, context);
    } else if (
      context.engine.getParentPrecondition(branchName) !== parentBranchName
    ) {
      await handleDifferentParents(branchName, parentBranchName, context);
    } else if (context.engine.branchMatchesFetched(branchName)) {
      context.splog.info(`${chalk.cyan(branchName)} is up to date.`);
    } else {
      const remainingBranchesToSync = args.downstack.slice(index + 1);
      await handleSameParent(
        { branchName, parentBranchName, remainingBranchesToSync },
        context
      );
    }
    parentBranchName = branchName;
  }
}

async function handleUntrackedLocally(
  branchName: string,
  parentBranchName: string,
  context: TContext
): Promise<void> {
  context.splog.info(
    [
      `${chalk.yellow(
        branchName
      )} shares a name with a local branch that is not tracked by Charcoal.`,
      `In order to sync it, you must overwrite your local copy of the branch.`,
      `If you do not wish to overwrite your copy, the command will be aborted.`,
    ].join('\n')
  );
  await maybeOverwriteBranch(branchName, parentBranchName, context);
}

async function handleDifferentParents(
  branchName: string,
  parentBranchName: string,
  context: TContext
): Promise<void> {
  context.splog.info(
    [
      `${chalk.yellow(
        branchName
      )} shares a name with a local branch, but they have different parents.`,
      `In order to sync it, you must overwrite your local copy of the branch.`,
      `If you do not wish to overwrite your copy, the command will be aborted.`,
    ].join('\n')
  );
  await maybeOverwriteBranch(branchName, parentBranchName, context);
}

// Helper function for cases where we can either overwrite local or abort
async function maybeOverwriteBranch(
  branchName: string,
  parentBranchName: string,
  context: TContext
) {
  if (
    !context.interactive ||
    !(
      await context.prompts({
        type: 'confirm',
        name: 'value',
        message: `Overwrite ${chalk.yellow(
          branchName
        )} with the version from remote?`,
        initial: false,
      })
    ).value
  ) {
    throw new KilledError();
  }

  context.engine.checkoutBranchFromFetched(branchName, parentBranchName);
  context.splog.info(`Synced ${chalk.cyan(branchName)} from remote.`);
}

// This is the most complex case - if the branch's parent matches meta,
// we need to not only allow for overwrite and abort, but also rebasing
// local changes onto the changes from remote.
async function handleSameParent(
  args: {
    branchName: string;
    parentBranchName: string;
    remainingBranchesToSync: string[];
  },
  context: TContext
): Promise<void> {
  context.splog.info(
    [
      `${chalk.yellow(
        args.branchName
      )} shares a name with a local branch, and they have the same parent.`,
      `You can either overwrite your copy of the branch, or rebase your local changes onto the remote version.`,
      `You can also abort the command entirely and keep your local state as is.`,
    ].join('\n')
  );

  const fetchChoice: 'REBASE' | 'OVERWRITE' | 'ABORT' = !context.interactive
    ? 'ABORT'
    : (
        await context.prompts({
          type: 'select',
          name: 'value',
          message: `How would you like to handle ${chalk.yellow(
            args.branchName
          )}?`,
          choices: [
            {
              title: 'Rebase your changes on top of the remote version',
              value: 'REBASE',
            },
            {
              title: 'Overwrite the local copy with the remote version',
              value: 'OVERWRITE',
            },
            { title: 'Abort this command', value: 'ABORT' },
          ],
        })
      ).value;

  switch (fetchChoice) {
    case 'REBASE': {
      const result = context.engine.rebaseBranchOntoFetched(args.branchName);
      if (result.result === 'REBASE_CONFLICT') {
        persistContinuation(
          {
            branchesToSync: args.remainingBranchesToSync,
            rebasedBranchBase: result.rebasedBranchBase,
          },
          context
        );
        printConflictStatus(
          `Hit conflict rebasing ${chalk.yellow(
            args.branchName
          )} onto remote source of truth.`,
          context
        );
        throw new RebaseConflictError();
      }
      context.splog.info(
        `Rebased local changes to ${chalk.cyan(
          args.branchName
        )} onto remote source of truth.`
      );
      context.splog.tip(
        `If this branch has local children, they likely need to be restacked.`
      );
      break;
    }
    case 'OVERWRITE':
      context.engine.checkoutBranchFromFetched(
        args.branchName,
        args.parentBranchName
      );
      context.splog.info(`Synced ${chalk.cyan(args.branchName)} from remote.`);
      break;
    case 'ABORT':
      throw new KilledError();
    default:
      assertUnreachable(fetchChoice);
  }
}

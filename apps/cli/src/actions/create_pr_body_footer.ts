import { TContext } from '../lib/context';

export const footerTitle = '\n\n\n#### PR Dependency Tree\n\n';
export const footerFooter =
  '\n\nThis comment was auto-generated by [Graphite Open Source](https://github.com/danerwilliams/graphite-cli)';

export function createPrBodyFooter(
  context: TContext,
  branch: string,
  prNumber?: number
): string {
  const terminalParent = findTerminalParent(context, branch);

  const tree = buildBranchTree({
    context,
    currentBranches: [terminalParent],
    prBranch: branch,
    prNumber,
    currentDepth: 0,
  });

  return `${footerTitle}${tree}${footerFooter}`;
}

function buildBranchTree({
  context,
  currentBranches,
  prBranch,
  prNumber,
  currentDepth,
}: {
  context: TContext;
  currentBranches: string[];
  prBranch: string;
  prNumber?: number;
  currentDepth: number;
}): string {
  let tree = '';

  for (const branch of currentBranches) {
    if (!context.engine.getChildren(branch).includes(branch)) {
      continue;
    }

    tree += `\n${buildLeaf({
      context,
      branch,
      depth: currentDepth,
      prBranch,
      prNumber,
    })}`;

    const children = context.engine.getChildren(branch);

    if (children.length) {
      tree += `${buildBranchTree({
        context,
        currentBranches: children,
        prBranch,
        prNumber,
        currentDepth: currentDepth + 1,
      })}`;
    }
  }

  return tree;
}

function buildLeaf({
  context,
  branch,
  depth,
  prBranch,
  prNumber,
}: {
  context: TContext;
  branch: string;
  depth: number;
  prBranch: string;
  prNumber?: number;
}): string {
  const prInfo = context.engine.getPrInfo(branch);

  // If the PR is being created for the first time, it hasn't been assigned a number yet.
  // We allow for passing the number to do an update to the body after PR creation to handle that case.
  // The PR hasn't been persisted by the context.engine yet, so we manually pass it as a parameter to this method
  const number = prInfo?.number ?? prNumber;

  if (!number) {
    throw new Error('PR number is undefined');
  }

  return `${'  '.repeat(depth)}* **PR #${number}**${
    branch === prBranch ? ' 👈' : ''
  }`;
}

function findTerminalParent(context: TContext, currentBranch: string): string {
  const parent = context.engine.getParent(currentBranch);
  if (!parent) {
    throw new Error('Parent branch is undefined');
  }

  if (context.engine.isTrunk(parent)) {
    return currentBranch;
  }

  return findTerminalParent(context, parent);
}

import { TContext } from '../lib/context';

export const footerTitle = '\n\n\n#### PR Dependency Tree\n\n';
export const footerFooter =
  '\n\nThis tree was auto-generated by [Charcoal](https://github.com/danerwilliams/charcoal)';

export function createPrBodyFooter(
  context: TContext,
  branch: string,
  prNumber?: number
): string {
  const terminalParent = findTerminalParent(context, branch);

  // eslint-disable-next-line no-console
  console.log({ terminalParent });

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
    if (branch !== prBranch && !isParentOfBranch(context, branch, prBranch)) {
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

    // eslint-disable-next-line no-console
    console.log({ children });

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

function isParentOfBranch(
  context: TContext,
  parent: string,
  branch: string
): boolean {
  const children = context.engine.getChildren(parent);

  if (children.includes(branch)) {
    return true;
  }

  for (const child of children) {
    if (isParentOfBranch(context, child, branch)) {
      return true;
    }
  }

  return false;
}

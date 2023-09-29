import { TContext } from '../lib/context';

export function createPrBodyFooter(context: TContext, branch: string): string {
  const terminalParent = findTerminalParent(context, branch);

  const tree = buildBranchTree({
    context,
    currentBranches: [terminalParent],
    currentTree: '',
    prBranch: branch,
    currentDepth: 0,
  });

  // eslint-disable-next-line no-console
  console.log(tree);
  return '';
}

function buildBranchTree({
  context,
  currentBranches,
  currentTree,
  prBranch,
  currentDepth,
}: {
  context: TContext;
  currentBranches: string[];
  currentTree: string;
  prBranch: string;
  currentDepth: number;
}): string {
  for (const branch of currentBranches) {
    currentTree += `\n${buildLeaf({
      context,
      branch,
      depth: currentDepth,
      prBranch,
    })}`;

    const children = context.engine.getChildren(branch);

    if (children.length) {
      currentTree += `\n${buildBranchTree({
        context,
        currentBranches: children,
        currentTree,
        prBranch,
        currentDepth: currentDepth + 1,
      })}`;
    }
  }

  return currentTree;
}

function buildLeaf({
  context,
  branch,
  depth,
  prBranch,
}: {
  context: TContext;
  branch: string;
  depth: number;
  prBranch: string;
}): string {
  const prInfo = context.engine.getPrInfo(branch);

  if (!prInfo?.number) {
    throw new Error('PR number is undefined');
  }

  return `${' '.repeat(depth)}* **PR #${prInfo.number}**${
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

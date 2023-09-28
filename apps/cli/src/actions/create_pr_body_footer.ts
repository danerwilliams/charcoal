import { TContext } from '../lib/context';

export function createPrBodyFooter(context: TContext, branch: string): string {
  const terminalParent = findTerminalParent(context, branch);
  // eslint-disable-next-line no-console
  console.log({ terminalParent });
  return '';
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

import { TContext } from '../lib/context';

/**
 * Forwards merged-ancestor history from branches leaving a stack onto the
 * survivors that take their place, so PR footers keep showing PRs that landed.
 * Only branches that actually merged contribute their own PR number; abandoned
 * (closed/empty) branches still forward any history they had accumulated.
 *
 * `removed` should be ordered trunk-side first. Safe to call with no survivors
 * or nothing to inherit (no-op).
 */
export function preserveMergedAncestors(
  survivors: string[],
  removed: string[],
  context: TContext
): void {
  const inherited: number[] = [];
  for (const branch of removed) {
    const prInfo = context.engine.getPrInfo(branch);
    inherited.push(...(prInfo?.mergedStackAncestors ?? []));
    if (prInfo?.number !== undefined && isLandedMerge(branch, context)) {
      inherited.push(prInfo.number);
    }
  }

  if (inherited.length === 0) {
    return;
  }

  for (const survivor of survivors) {
    const existing =
      context.engine.getPrInfo(survivor)?.mergedStackAncestors ?? [];
    context.engine.upsertPrInfo(survivor, {
      mergedStackAncestors: [...new Set([...inherited, ...existing])],
    });
  }
}

function isLandedMerge(branch: string, context: TContext): boolean {
  const state = context.engine.getPrInfo(branch)?.state;
  if (state === 'CLOSED') {
    return false;
  }
  if (state === 'MERGED') {
    return true;
  }
  return (
    !context.engine.isBranchEmpty(branch) &&
    context.engine.isMergedIntoTrunk(branch)
  );
}

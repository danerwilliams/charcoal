import { PreconditionsFailedError } from '../errors';
import { getMergeBase } from '../git/merge_base';
import { TSplog } from '../utils/splog';
import { TCachedMeta } from './cached_meta';
import {
  deleteMetadataRef,
  readMetadataRef,
  TMeta,
  writeMetadataRef,
} from './metadata_ref';

type TBranchToParse = {
  branchName: string;
  branchRevision: string;
} & TMeta;

function getAllBranchesAndMeta(
  args: Omit<TCacheSeed, 'version' | 'trunkName'>,
  splog: TSplog
): TBranchToParse[] {
  splog.debug(`Building cache from disk...`);
  const branchesWithMeta = new Set(
    Object.keys(args.metadataRefList).filter((branchName) => {
      if (args.gitBranchNamesAndRevisions[branchName]) {
        return true;
      }
      // Clean up refs whose branch is missing
      splog.debug(`Deleting metadata for missing branch: ${branchName}`);
      deleteMetadataRef(branchName);
      return false;
    })
  );

  return Object.keys(args.gitBranchNamesAndRevisions).map((branchName) => ({
    branchName,
    branchRevision: args.gitBranchNamesAndRevisions[branchName],
    ...(branchesWithMeta.has(branchName) ? readMetadataRef(branchName) : {}),
  }));
}

export type TCacheSeed = {
  version: string;
  trunkName: string | undefined;
  rebaseHead: string | undefined;
  gitBranchNamesAndRevisions: Record<string, string>;
  metadataRefList: Record<string, string>;
};

export function parseBranchesAndMeta(
  args: TCacheSeed,
  splog: TSplog
): Record<string, TCachedMeta> {
  const branchesToParse = getAllBranchesAndMeta(args, splog);

  const allBranchNames = new Set(
    branchesToParse.map((meta) => meta.branchName)
  );
  const parsedBranches: Record<string, TCachedMeta> = {};

  splog.debug('Validating branches...');

  // If we have n branches, it takes at most n(n+1)/2 iterations
  // to parse all of them (worst case is reverse sorted order)
  let cycleDetector =
    (branchesToParse.length * (branchesToParse.length + 1)) / 2;
  while (branchesToParse.length > 0) {
    if (cycleDetector-- <= 0) {
      throw new PreconditionsFailedError('Cycle detected in Charcoal metadata');
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const current = branchesToParse.shift()!;
    const {
      branchName,
      branchRevision,
      parentBranchName,
      parentBranchRevision,
      prInfo,
    } = current;

    if (branchName === args.trunkName) {
      splog.debug(`trunk: ${branchName}`);
      parsedBranches[branchName] = {
        validationResult: 'TRUNK',
        branchRevision: branchRevision,
        children: [],
      };
      continue;
    }

    // Check parentBranchName
    if (
      !parentBranchName ||
      parentBranchName === branchName ||
      !allBranchNames.has(parentBranchName)
    ) {
      splog.debug(
        `bad parent name: ${branchName}\n\t${parentBranchName ?? 'missing'}`
      );
      parsedBranches[branchName] = {
        validationResult: 'BAD_PARENT_NAME',
        branchRevision,
        prInfo,
        children: [],
      };
      continue;
    }

    // If parent hasn't been checked yet, we'll come back to this branch
    if (typeof parsedBranches[parentBranchName] === 'undefined') {
      branchesToParse.push(current);
      continue;
    }

    parsedBranches[parentBranchName].children.push(branchName);

    // Check if the parent is valid (or trunk)
    if (
      !['VALID', 'TRUNK'].includes(
        parsedBranches[parentBranchName].validationResult
      )
    ) {
      splog.debug(`invalid parent: ${branchName}`);
      parsedBranches[branchName] = {
        validationResult: 'INVALID_PARENT',
        parentBranchName,
        parentBranchRevision,
        branchRevision,
        prInfo,
        children: [],
      };
      continue;
    }

    // If we make it here, we just need to validate the parent branch revision!
    const result = validateOrFixParentBranchRevision(
      {
        ...current,
        parentBranchCurrentRevision:
          parsedBranches[parentBranchName].branchRevision,
      } as TBranchToParseWithValidatedParent,
      splog
    );

    parsedBranches[branchName] = {
      ...{
        parentBranchName,
        branchRevision,
        prInfo,
        children: [],
      },
      ...result,
    };
  }

  return parsedBranches;
}

type TBranchToParseWithValidatedParent = TBranchToParse & {
  parentBranchName: string;
  parentBranchCurrentRevision: string;
};

export function validateOrFixParentBranchRevision(
  {
    branchName,
    parentBranchName,
    parentBranchRevision,
    prInfo,
    parentBranchCurrentRevision,
  }: TBranchToParseWithValidatedParent,
  splog: TSplog
):
  | { validationResult: 'VALID'; parentBranchRevision: string }
  | { validationResult: 'BAD_PARENT_REVISION' } {
  // This branch is valid because its PBR is in its history
  if (
    parentBranchRevision &&
    getMergeBase(branchName, parentBranchRevision) === parentBranchRevision
  ) {
    if (
      parentBranchRevision !== parentBranchCurrentRevision &&
      getMergeBase(branchName, parentBranchCurrentRevision) ===
        parentBranchCurrentRevision
    ) {
      // If the parent is ahead of where the metadata has it, we update
      // it to the current value, as long as it is still in our history
      writeMetadataRef(branchName, {
        parentBranchName,
        parentBranchRevision: parentBranchCurrentRevision,
        prInfo,
      });
      splog.debug(
        `validated and updated parent rev: ${branchName}\n\t${parentBranchCurrentRevision}`
      );
      return {
        validationResult: 'VALID',
        parentBranchRevision: parentBranchCurrentRevision,
      };
    }
    splog.debug(`validated: ${branchName}`);
    return { validationResult: 'VALID', parentBranchRevision };
  }

  // PBR cannot be fixed because its parent is not in its history
  if (
    getMergeBase(branchName, parentBranchCurrentRevision) !==
    parentBranchCurrentRevision
  ) {
    splog.debug(
      `bad parent rev: ${branchName}\n\t${parentBranchRevision ?? 'missing'}`
    );
    return { validationResult: 'BAD_PARENT_REVISION' };
  }

  // PBR can be fixed because we see the parent in the branch's history
  writeMetadataRef(branchName, {
    parentBranchName,
    parentBranchRevision: parentBranchCurrentRevision,
    prInfo,
  });
  splog.debug(
    `validated and fixed parent rev: ${branchName}\n\t${parentBranchCurrentRevision}`
  );
  return {
    validationResult: 'VALID',
    parentBranchRevision: parentBranchCurrentRevision,
  };
}

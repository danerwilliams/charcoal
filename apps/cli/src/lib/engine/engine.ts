import chalk from 'chalk';
import {
  DetachedError,
  NoBranchError,
  PreconditionsFailedError,
} from '../errors';
import { TCommitOpts } from '../git/commit';
import { TCommitFormat } from '../git/commit_range';
import { TGit } from '../git/git';
import { cuteString } from '../utils/cute_string';
import { TSplog } from '../utils/splog';
import {
  assertCachedMetaIsNotTrunk,
  assertCachedMetaIsValidAndNotTrunk,
  assertCachedMetaIsValidOrTrunk,
  TValidCachedMetaExceptTrunk,
} from './cached_meta';
import { composeCacheLoader } from './cache_loader';
import { TChangedFile, TStatusFile } from '../git/changed_files';
import {
  deleteMetadataRef,
  getMetadataRefList,
  TBranchPRInfo,
  writeMetadataRef,
} from './metadata_ref';
import { validateOrFixParentBranchRevision } from './parse_branches_and_meta';
import { TScopeSpec } from './scope_spec';
import fjsh from 'fast-json-stable-hash';

export type TEngine = {
  debug: string;
  persist: () => void;
  clear: () => void;

  reset: (newTrunkName?: string) => void;
  rebuild: (newTrunkName?: string) => void;
  trunk: string;
  isTrunk: (branchName: string) => boolean;

  branchExists(branchName: string | undefined): branchName is string;
  allBranchNames: string[];
  isBranchTracked: (branchName: string) => boolean;
  isDescendantOf: (branchName: string, parentBranchName: string) => boolean;
  trackBranch: (branchName: string, parentBranchName: string) => void;
  untrackBranch: (branchName: string) => void;

  currentBranch: string | undefined;
  currentBranchPrecondition: string;

  rebaseInProgress: () => boolean;
  detectStagedChanges: () => boolean;
  findRemoteBranch: () => string | undefined;
  getUnmergedFiles: () => string[];
  getRebaseHead: () => string | undefined;
  getUnstagedChanges: () => string;
  getStatus: () => TStatusFile[];
  logLong: () => void;

  showCommits: (branchName: string, patch: boolean) => string;
  showDiff: (branchName: string) => string;
  getDiff: (left: string, right: string | undefined) => string;
  getStackDiff: (branchName: string) => string;
  getParentOrPrev: (branchName: string) => string;
  getChangedFiles: (branchName: string) => TChangedFile[];
  getFileContents: (ref: string, file: string) => string;
  restoreFile: (file: string) => void;

  getRevision: (branchName: string) => string;
  getBaseRevision: (branchName: string) => string;
  getAllCommits: (branchName: string, format: TCommitFormat) => string[];

  getCommitDate: (branchName: string) => Promise<Date>;
  getCommitAuthor: (branchName: string) => Promise<string>;

  getPrInfo: (branchName: string) => TBranchPRInfo | undefined;
  upsertPrInfo: (branchName: string, prInfo: Partial<TBranchPRInfo>) => void;
  clearPrInfo: (branchName: string) => void;

  getChildren: (branchName: string) => string[];

  setParent: (branchName: string, parentBranchName: string) => void;
  getParent: (branchName: string) => string | undefined;
  getParentPrecondition: (branchName: string) => string;

  getRelativeStack: (branchName: string, scope: TScopeSpec) => string[];

  checkoutNewBranch: (branchName: string) => void;
  checkoutBranch: (branchName: string) => void;
  renameCurrentBranch: (branchName: string) => void;
  foldCurrentBranch: (keep: boolean) => void;
  deleteBranch: (branchName: string) => void;
  commit: (opts: TCommitOpts) => void;
  squashCurrentBranch: (opts: { message?: string; noEdit?: boolean }) => void;

  addAll: () => void;
  detach: () => void;
  unbranch: () => void;
  detachAndResetBranchChanges: () => void;
  applySplitToCommits: (args: {
    branchToSplit: string;
    branchNames: string[];
    branchPoints: number[];
  }) => void;
  forceCheckoutBranch: (branchToSplit: string) => void;

  restackBranch: (branchName: string) =>
    | {
        result: 'REBASE_CONFLICT';
        rebasedBranchBase: string;
      }
    | { result: 'REBASE_DONE' | 'REBASE_UNNEEDED' };

  rebaseInteractive: (branchName: string) =>
    | {
        result: 'REBASE_CONFLICT';
        rebasedBranchBase: string;
      }
    | { result: 'REBASE_DONE' };
  continueRebase: (parentBranchRevision: string) =>
    | {
        result: 'REBASE_DONE';
        branchName: string;
      }
    | { result: 'REBASE_CONFLICT' };
  abortRebase: () => void;

  isMergedIntoTrunk: (branchName: string) => boolean;
  isBranchFixed: (branchName: string) => boolean;
  isBranchEmpty: (branchName: string) => boolean;
  populateRemoteShas: () => Promise<void>;
  branchMatchesRemote: (branchName: string) => boolean;

  pushBranch: (branchName: string, forcePush: boolean) => void;
  pullTrunk: () => 'PULL_DONE' | 'PULL_UNNEEDED' | 'PULL_CONFLICT';
  hardReset: (sha?: string) => void;
  resetTrunkToRemote: () => void;
  clean: () => void;

  fetchBranch: (branchName: string, parentBranchName: string) => void;
  branchMatchesFetched: (branchName: string) => boolean;
  checkoutBranchFromFetched: (
    branchName: string,
    parentBranchName: string
  ) => void;
  rebaseBranchOntoFetched: (branchName: string) =>
    | {
        result: 'REBASE_CONFLICT';
        rebasedBranchBase: string;
      }
    | { result: 'REBASE_DONE' };
};

// eslint-disable-next-line max-lines-per-function
export function composeEngine({
  git,
  trunkName,
  currentBranchOverride,
  splog,
  noVerify,
  remote,
  restackCommitterDateIsAuthorDate,
}: {
  git: TGit;
  trunkName?: string;
  currentBranchOverride?: string;
  splog: TSplog;
  noVerify: boolean;
  remote: string;
  restackCommitterDateIsAuthorDate?: boolean;
}): TEngine {
  const cacheLoader = composeCacheLoader(splog);
  void cacheLoader;
  const originallyLoadedBranches = cacheLoader.loadCachedBranches(trunkName);
  const cache = {
    currentBranch: currentBranchOverride ?? git.getCurrentBranchName(),
    branches: originallyLoadedBranches,
  };

  const assertTrunk = () => {
    if (!trunkName) {
      throw new PreconditionsFailedError(`No trunk found.`);
    }
    return trunkName;
  };

  const branchExists = (branchName: string): branchName is string =>
    branchName in cache.branches;

  const assertBranch: (branchName: string) => asserts branchName is string = (
    branchName
  ) => {
    if (!branchExists(branchName)) {
      throw new NoBranchError(branchName);
    }
  };

  const getCurrentBranchOrThrow = () => {
    if (!cache.currentBranch) {
      throw new DetachedError();
    }
    assertBranch(cache.currentBranch);
    return cache.currentBranch;
  };

  const assertBranchIsValidOrTrunkAndGetMeta = (branchName: string) => {
    assertBranch(branchName);
    const meta = cache.branches[branchName];
    assertCachedMetaIsValidOrTrunk(branchName, meta);
    return meta;
  };

  const assertBranchIsValidAndNotTrunkAndGetMeta = (branchName: string) => {
    assertBranch(branchName);
    const meta = cache.branches[branchName];
    assertCachedMetaIsValidAndNotTrunk(branchName, meta);
    return meta;
  };

  const isDescendantOf = (branchName: string, parentBranchName: string) => {
    assertBranch(branchName);
    assertBranch(parentBranchName);
    return (
      branchName !== parentBranchName &&
      git.getMergeBase(branchName, parentBranchName) ===
        cache.branches[parentBranchName].branchRevision
    );
  };

  const isBranchFixed = (branchName: string): boolean => {
    const cachedMeta = cache.branches[branchName];
    if (cachedMeta?.validationResult === 'TRUNK') {
      return true;
    }
    if (cachedMeta?.validationResult !== 'VALID') {
      return false;
    }
    splog.debug(`${branchName} fixed?`);
    splog.debug(`${cachedMeta.parentBranchRevision}`);
    splog.debug(
      `${cache.branches[cachedMeta.parentBranchName].branchRevision}`
    );
    return (
      cachedMeta.parentBranchRevision ===
      cache.branches[cachedMeta.parentBranchName].branchRevision
    );
  };

  const getChildren = (branchName: string) =>
    cache.branches[branchName].children.filter(
      (childBranchName) =>
        cache.branches[childBranchName]?.validationResult === 'VALID'
    );

  const getRecursiveChildren = (branchName: string): string[] =>
    getChildren(branchName).flatMap((child) => [
      child,
      ...getRecursiveChildren(child),
    ]);

  const removeChild = (parentBranchName: string, childBranchName: string) => {
    assertBranch(parentBranchName);
    const parentCachedChildren = cache.branches[parentBranchName].children;
    const index = parentCachedChildren.indexOf(childBranchName);
    if (index > -1) {
      parentCachedChildren.splice(index, 1);
    }
  };

  const validateNewParent = (branchName: string, parentBranchName: string) => {
    if (branchName === parentBranchName) {
      throw new PreconditionsFailedError(
        `Cannot set parent of ${chalk.yellow(branchName)} to itself!`
      );
    }
    if (
      branchName in cache.branches &&
      getRecursiveChildren(branchName).includes(parentBranchName)
    ) {
      throw new PreconditionsFailedError(
        `Cannot set parent of ${chalk.yellow(branchName)} to ${chalk.yellow(
          parentBranchName
        )}!`
      );
    }
  };

  const setParent = (branchName: string, parentBranchName: string) => {
    validateNewParent(branchName, parentBranchName);
    const cachedMeta = assertBranchIsValidAndNotTrunkAndGetMeta(branchName);

    const oldParentBranchName = cachedMeta.parentBranchName;
    if (oldParentBranchName === parentBranchName) {
      return;
    }

    assertBranchIsValidOrTrunkAndGetMeta(parentBranchName);
    updateMeta(branchName, { ...cachedMeta, parentBranchName });
  };

  const getParent = (branchName: string) => {
    const meta = cache.branches[branchName];
    return meta?.validationResult === 'BAD_PARENT_NAME' ||
      meta?.validationResult === 'TRUNK'
      ? undefined
      : meta?.parentBranchName;
  };

  const getRecursiveParentsExcludingTrunk = (branchName: string): string[] => {
    const parent = getParent(branchName);
    return parent && parent !== trunkName
      ? [...getRecursiveParentsExcludingTrunk(parent), parent]
      : [];
  };

  const checkoutBranch = (branchName: string) => {
    if (cache.currentBranch === branchName) {
      return;
    }
    assertBranch(branchName);
    git.switchBranch(branchName);
    cache.currentBranch = branchName;
  };

  // Any writes should go through this function, which:
  // Validates the new metadata
  // Updates children of the old+new parent
  // Writes to disk
  // Revalidates 'INVALID_PARENT' children
  const updateMeta = (
    branchName: string,
    newCachedMeta: TValidCachedMetaExceptTrunk
  ) => {
    // Get current meta and ensure this branch isn't trunk.
    const oldCachedMeta = cache.branches[branchName] ?? {
      validationResult: 'BAD_PARENT_NAME',
      branchRevision: git.getShaOrThrow(branchName),
      children: [],
    };
    assertCachedMetaIsNotTrunk(oldCachedMeta);

    // Get new cached meta and handle updating children
    cache.branches[branchName] = newCachedMeta;
    const oldParentBranchName =
      oldCachedMeta.validationResult === 'BAD_PARENT_NAME'
        ? undefined
        : oldCachedMeta.parentBranchName;
    const newParentBranchName = newCachedMeta.parentBranchName;
    assertBranch(newParentBranchName);

    if (oldParentBranchName !== newParentBranchName) {
      if (oldParentBranchName && oldParentBranchName in cache.branches) {
        removeChild(oldParentBranchName, branchName);
      }
    }

    if (!cache.branches[newParentBranchName].children.includes(branchName)) {
      cache.branches[newParentBranchName].children.push(branchName);
    }

    // Write to disk
    writeMetadataRef(branchName, {
      parentBranchName: newCachedMeta.parentBranchName,
      parentBranchRevision: newCachedMeta.parentBranchRevision,
      prInfo: newCachedMeta.prInfo,
    });

    splog.debug(
      `Updated cached meta for branch ${branchName}:\n${cuteString(
        newCachedMeta
      )}`
    );

    // Any 'INVALID_PARENT' children can be revalidated
    if (oldCachedMeta.validationResult !== 'VALID') {
      revalidateChildren(newCachedMeta.children);
    }
  };

  const revalidateChildren = (children: string[]) => {
    children.forEach((childBranchName) => {
      assertBranch(childBranchName);
      const childCachedMeta = cache.branches[childBranchName];
      if (childCachedMeta.validationResult !== 'INVALID_PARENT') {
        return;
      }

      const result = validateOrFixParentBranchRevision(
        {
          branchName: childBranchName,
          ...childCachedMeta,
          parentBranchCurrentRevision:
            cache.branches[childCachedMeta.parentBranchName].branchRevision,
        },
        splog
      );
      cache.branches[childBranchName] = { ...childCachedMeta, ...result };
      // fix children recursively
      revalidateChildren(childCachedMeta.children);
    });
  };

  const deleteAllBranchData = (branchName: string) => {
    const cachedMeta = assertBranchIsValidAndNotTrunkAndGetMeta(branchName);

    removeChild(cachedMeta.parentBranchName, branchName);
    delete cache.branches[branchName];
    git.deleteBranch(branchName);
    deleteMetadataRef(branchName);
  };

  const handleSuccessfulRebase = (
    branchName: string,
    parentBranchRevision: string
  ) => {
    const cachedMeta = assertBranchIsValidAndNotTrunkAndGetMeta(branchName);

    updateMeta(branchName, {
      ...cachedMeta,
      branchRevision: git.getShaOrThrow(branchName),
      parentBranchRevision,
    });

    if (cache.currentBranch && cache.currentBranch in cache.branches) {
      git.switchBranch(cache.currentBranch);
    }
  };

  return {
    get debug() {
      return cuteString(cache);
    },
    persist() {
      if (
        fjsh.hash(originallyLoadedBranches, 'sha256') !==
        fjsh.hash(cache.branches, 'sha256')
      ) {
        cacheLoader.persistCache(trunkName, cache.branches);
      }
    },
    clear() {
      cacheLoader.clearPersistedCache();
    },
    reset(newTrunkName?: string) {
      trunkName = newTrunkName ?? trunkName;
      Object.keys(getMetadataRefList()).forEach((branchName) =>
        deleteMetadataRef(branchName)
      );
      cache.branches = cacheLoader.loadCachedBranches(trunkName);
    },
    rebuild(newTrunkName?: string) {
      trunkName = newTrunkName ?? trunkName;
      cache.branches = cacheLoader.loadCachedBranches(trunkName);
    },
    get trunk() {
      return assertTrunk();
    },
    isTrunk: (branchName: string) => branchName === trunkName,
    branchExists,
    get allBranchNames() {
      return Object.keys(cache.branches);
    },
    isBranchTracked: (branchName: string) => {
      assertBranch(branchName);
      return cache.branches[branchName].validationResult === 'VALID';
    },
    isDescendantOf: isDescendantOf,
    trackBranch: (branchName: string, parentBranchName: string) => {
      validateNewParent(branchName, parentBranchName);
      assertBranch(branchName);
      assertBranchIsValidOrTrunkAndGetMeta(parentBranchName);

      updateMeta(branchName, {
        ...cache.branches[branchName],
        validationResult: 'VALID',
        parentBranchName,
        // This is parentMeta.branchRevision unless parent is trunk
        parentBranchRevision: git.getMergeBase(branchName, parentBranchName),
      });
      return 'TRACKED';
    },
    untrackBranch: (branchName: string) => {
      const cachedMeta = assertBranchIsValidAndNotTrunkAndGetMeta(branchName);
      deleteMetadataRef(branchName);
      cache.branches[branchName] = {
        ...cachedMeta,
        validationResult: 'BAD_PARENT_NAME',
      };

      // We have to fix validation state for any recursive children
      const childrenToUntrack = cachedMeta.children.slice();
      while (childrenToUntrack.length) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const childBranchName = childrenToUntrack.pop()!;
        const childCachedMeta = cache.branches[childBranchName];
        assertCachedMetaIsNotTrunk(childCachedMeta);
        if (childCachedMeta.validationResult !== 'BAD_PARENT_NAME') {
          cache.branches[childBranchName] = {
            ...childCachedMeta,
            validationResult: 'INVALID_PARENT',
          };
        }
        childrenToUntrack.concat(childCachedMeta.children);
      }
    },
    get currentBranch() {
      return cache.currentBranch;
    },
    get currentBranchPrecondition(): string {
      const branchName = getCurrentBranchOrThrow();
      assertBranchIsValidOrTrunkAndGetMeta(branchName);
      return branchName;
    },
    rebaseInProgress: git.rebaseInProgress,
    detectStagedChanges: git.detectStagedChanges,
    findRemoteBranch: () => git.findRemoteBranch(remote),
    getUnmergedFiles: git.getUnmergedFiles,
    getRebaseHead: git.getRebaseHead,
    getUnstagedChanges: git.getUnstagedChanges,
    getStatus: git.getStatus,
    logLong: git.logLong,
    showCommits: (branchName: string, patch: boolean) => {
      const meta = assertBranchIsValidOrTrunkAndGetMeta(branchName);
      return git.showCommits(
        meta.validationResult === 'TRUNK'
          ? `${branchName}~`
          : meta.parentBranchRevision,
        branchName,
        patch
      );
    },
    getChangedFiles: (branchName: string) => {
      const meta = cache.branches[branchName];
      return git.getFilesChanged(
        !meta || meta.validationResult !== 'VALID'
          ? `${branchName}~`
          : meta.parentBranchRevision,
        branchName
      );
    },
    getFileContents: git.getFileContents,
    restoreFile: git.restoreFile,
    showDiff: (branchName: string) => {
      const meta = assertBranchIsValidOrTrunkAndGetMeta(branchName);
      return git.showDiff(
        meta.validationResult === 'TRUNK'
          ? `${branchName}~`
          : meta.parentBranchRevision,
        branchName
      );
    },
    getDiff: git.getDiff,
    getStackDiff: (branchName: string) => {
      const meta = assertBranchIsValidOrTrunkAndGetMeta(branchName);
      return git.getDiff(
        meta.validationResult === 'TRUNK'
          ? `${branchName}~`
          : meta.parentBranchRevision,
        branchName
      );
    },
    getParentOrPrev: (branchName: string) => {
      const meta = assertBranchIsValidOrTrunkAndGetMeta(branchName);
      return meta.validationResult === 'TRUNK'
        ? `${branchName}~`
        : meta.parentBranchRevision;
    },
    getRevision: (branchName: string) => {
      assertBranch(branchName);
      const meta = cache.branches[branchName];
      return meta.branchRevision;
    },
    getBaseRevision: (branchName: string) =>
      assertBranchIsValidAndNotTrunkAndGetMeta(branchName).parentBranchRevision,
    getAllCommits: (branchName: string, format: TCommitFormat) => {
      const meta = assertBranchIsValidOrTrunkAndGetMeta(branchName);

      return git.getCommitRange(
        // for trunk, commit range is just one commit
        meta.validationResult === 'TRUNK'
          ? undefined
          : meta.parentBranchRevision,
        meta.branchRevision,
        format
      );
    },
    getCommitDate: git.getCommitDate,
    getCommitAuthor: git.getCommitAuthor,
    getPrInfo: (branchName: string) => {
      const meta = cache.branches[branchName];
      return meta?.validationResult === 'TRUNK' ? undefined : meta?.prInfo;
    },
    upsertPrInfo: (branchName: string, prInfo: Partial<TBranchPRInfo>) => {
      const meta = cache.branches[branchName];
      if (meta?.validationResult !== 'VALID') {
        return;
      }
      updateMeta(branchName, {
        ...meta,
        prInfo: { ...meta.prInfo, ...prInfo },
      });
    },
    clearPrInfo: (branchName: string) => {
      const meta = cache.branches[branchName];
      if (meta?.validationResult !== 'VALID') {
        return;
      }
      updateMeta(branchName, {
        ...meta,
        prInfo: { mergedStackAncestors: meta.prInfo?.mergedStackAncestors },
      });
    },
    getChildren,
    setParent,
    getParent,
    getParentPrecondition: (branchName: string) =>
      assertBranchIsValidAndNotTrunkAndGetMeta(branchName).parentBranchName,
    getRelativeStack: (branchName: string, scope: TScopeSpec) => {
      assertBranchIsValidOrTrunkAndGetMeta(branchName);
      // Only includes trunk if branchName is trunk
      return [
        ...(scope.recursiveParents
          ? getRecursiveParentsExcludingTrunk(branchName)
          : []),
        ...(scope.currentBranch ? [branchName] : []),
        ...(scope.recursiveChildren ? getRecursiveChildren(branchName) : []),
      ];
    },
    checkoutNewBranch: (branchName: string) => {
      const parentBranchName = getCurrentBranchOrThrow();
      const parentCachedMeta =
        assertBranchIsValidOrTrunkAndGetMeta(parentBranchName);
      validateNewParent(branchName, parentBranchName);
      git.switchBranch(branchName, { new: true });
      updateMeta(branchName, {
        validationResult: 'VALID',
        parentBranchName,
        parentBranchRevision: parentCachedMeta.branchRevision,
        branchRevision: parentCachedMeta.branchRevision,
        children: [],
      });
      cache.currentBranch = branchName;
    },
    checkoutBranch,
    renameCurrentBranch: (branchName: string) => {
      const currentBranchName = getCurrentBranchOrThrow();
      if (branchName === currentBranchName) {
        return;
      }
      const cachedMeta =
        assertBranchIsValidAndNotTrunkAndGetMeta(currentBranchName);

      git.moveBranch(branchName);
      updateMeta(branchName, {
        ...cachedMeta,
        prInfo: {
          mergedStackAncestors: cachedMeta.prInfo?.mergedStackAncestors,
        },
      });

      cachedMeta.children.forEach((childBranchName) =>
        setParent(childBranchName, branchName)
      );

      removeChild(cachedMeta.parentBranchName, currentBranchName);
      delete cache.branches[currentBranchName];
      deleteMetadataRef(currentBranchName);
      cache.currentBranch = branchName;
    },
    foldCurrentBranch: (keep: boolean) => {
      const currentBranchName = getCurrentBranchOrThrow();
      const cachedMeta =
        assertBranchIsValidAndNotTrunkAndGetMeta(currentBranchName);

      const parentBranchName = cachedMeta.parentBranchName;
      const parentCachedMeta =
        assertBranchIsValidAndNotTrunkAndGetMeta(parentBranchName);

      if (keep) {
        updateMeta(currentBranchName, {
          ...cachedMeta,
          parentBranchName: parentCachedMeta.parentBranchName,
          parentBranchRevision: parentCachedMeta.parentBranchRevision,
        });
        parentCachedMeta.children
          .filter((childBranchName) => childBranchName !== currentBranchName)
          .forEach((childBranchName) =>
            setParent(childBranchName, currentBranchName)
          );
        deleteAllBranchData(parentBranchName);
      } else {
        git.forceCheckoutNewBranch(parentBranchName, cachedMeta.branchRevision);
        updateMeta(parentBranchName, {
          ...parentCachedMeta,
          branchRevision: cachedMeta.branchRevision,
        });
        cachedMeta.children.forEach((childBranchName) =>
          setParent(childBranchName, parentBranchName)
        );
        checkoutBranch(cachedMeta.parentBranchName);
        deleteAllBranchData(currentBranchName);
      }
    },
    deleteBranch: (branchName: string) => {
      const cachedMeta = assertBranchIsValidAndNotTrunkAndGetMeta(branchName);

      if (branchName === cache.currentBranch) {
        checkoutBranch(cachedMeta.parentBranchName);
      }

      cachedMeta.children.forEach((childBranchName) =>
        setParent(childBranchName, cachedMeta.parentBranchName)
      );

      deleteAllBranchData(branchName);
    },
    commit: (opts: TCommitOpts) => {
      const branchName = getCurrentBranchOrThrow();
      const cachedMeta = assertBranchIsValidAndNotTrunkAndGetMeta(branchName);
      git.commit({ ...opts, noVerify });
      cache.branches[branchName] = {
        ...cachedMeta,
        branchRevision: git.getShaOrThrow(branchName),
      };
    },
    squashCurrentBranch: (opts: Pick<TCommitOpts, 'message' | 'noEdit'>) => {
      const branchName = getCurrentBranchOrThrow();
      const cachedMeta = assertBranchIsValidAndNotTrunkAndGetMeta(branchName);
      git.softReset(
        git
          .getCommitRange(
            cachedMeta.parentBranchRevision,
            cachedMeta.branchRevision,
            'SHA'
          )
          .reverse()[0]
      );
      try {
        git.commit({
          ...opts,
          amend: true,
          noVerify,
        });
      } catch (e) {
        try {
          git.softReset(cachedMeta.branchRevision);
        } catch {
          // pass
        }
        throw e;
      }
      cache.branches[branchName] = {
        ...cachedMeta,
        branchRevision: git.getShaOrThrow(branchName),
      };
    },
    addAll: git.addAll,
    detach() {
      const branchName = getCurrentBranchOrThrow();
      const cachedMeta = assertBranchIsValidAndNotTrunkAndGetMeta(branchName);
      git.switchBranch(cachedMeta.branchRevision, { detach: true });
    },
    unbranch() {
      const branchName = getCurrentBranchOrThrow();
      const cachedMeta = assertBranchIsValidAndNotTrunkAndGetMeta(branchName);
      git.switchBranch(cachedMeta.branchRevision, { detach: true });
      const parentBranchName = cachedMeta.parentBranchName;
      deleteAllBranchData(branchName);
      git.mixedReset(parentBranchName);
      git.switchBranch(parentBranchName);
    },
    detachAndResetBranchChanges() {
      const branchName = getCurrentBranchOrThrow();
      const cachedMeta = assertBranchIsValidAndNotTrunkAndGetMeta(branchName);
      git.switchBranch(cachedMeta.branchRevision, { detach: true });
      git.trackedReset(cachedMeta.parentBranchRevision);
    },
    applySplitToCommits({
      branchToSplit,
      branchNames,
      branchPoints,
    }: {
      branchToSplit: string;
      branchNames: string[];
      branchPoints: number[];
    }) {
      if (branchNames.length !== branchPoints.length) {
        splog.debug(branchNames.toString());
        splog.debug(branchPoints.toString());
        throw new PreconditionsFailedError(`Invalid number of branch names.`);
      }
      const cachedMeta =
        assertBranchIsValidAndNotTrunkAndGetMeta(branchToSplit);

      const children = cachedMeta.children;

      // we reverse the branch points because they are referencing
      // commits from newest to oldest, but we name branches from
      // oldest to newest (parent to child)
      const reversedBranchPoints = branchPoints.slice().reverse();
      // keep track of the last branch's name + SHA for metadata
      const lastBranch = {
        name: cachedMeta.parentBranchName,
        revision: cachedMeta.parentBranchRevision,
      };
      branchNames.forEach((branchName, idx) => {
        const branchRevision = git.getShaOrThrow(
          `@~${reversedBranchPoints[idx]}`
        );
        git.forceCreateBranch(branchName, branchRevision);
        updateMeta(branchName, {
          validationResult: 'VALID',
          branchRevision,
          parentBranchName: lastBranch.name,
          parentBranchRevision: lastBranch.revision,
          children: [],
          prInfo: branchName === branchToSplit ? cachedMeta.prInfo : undefined,
        });
        lastBranch.name = branchName;
        lastBranch.revision = branchRevision;
      });
      if (lastBranch.name !== branchToSplit) {
        children.forEach((childBranchName) =>
          setParent(childBranchName, lastBranch.name)
        );
      }
      if (!branchNames.includes(branchToSplit)) {
        deleteAllBranchData(branchToSplit);
      }
      cache.currentBranch = lastBranch.name;
      git.switchBranch(lastBranch.name);
    },
    forceCheckoutBranch: (branchToSplit: string) => {
      git.switchBranch(branchToSplit, { force: true });
    },
    restackBranch: (branchName: string) => {
      const cachedMeta = assertBranchIsValidOrTrunkAndGetMeta(branchName);
      if (isBranchFixed(branchName)) {
        return { result: 'REBASE_UNNEEDED' };
      }
      assertCachedMetaIsNotTrunk(cachedMeta);
      assertBranch(cachedMeta.parentBranchName);
      const newBase =
        cache.branches[cachedMeta.parentBranchName].branchRevision;

      if (
        git.rebase({
          branchName,
          onto: cachedMeta.parentBranchName,
          from: cachedMeta.parentBranchRevision,
          restackCommitterDateIsAuthorDate,
        }) === 'REBASE_CONFLICT'
      ) {
        return {
          result: 'REBASE_CONFLICT',
          rebasedBranchBase: newBase,
        };
      }
      handleSuccessfulRebase(branchName, newBase);
      return { result: 'REBASE_DONE' };
    },
    rebaseInteractive: (branchName: string) => {
      const cachedMeta = assertBranchIsValidAndNotTrunkAndGetMeta(branchName);

      if (
        git.rebaseInteractive({
          branchName,
          parentBranchRevision: cachedMeta.parentBranchRevision,
        }) === 'REBASE_CONFLICT'
      ) {
        return {
          result: 'REBASE_CONFLICT',
          rebasedBranchBase: cachedMeta.parentBranchRevision,
        };
      }

      handleSuccessfulRebase(branchName, cachedMeta.parentBranchRevision);
      return { result: 'REBASE_DONE' };
    },
    continueRebase: (parentBranchRevision: string) => {
      const result = git.rebaseContinue();
      if (result === 'REBASE_CONFLICT') {
        return { result };
      }
      const branchName = git.getCurrentBranchName();
      if (!branchName) {
        throw new PreconditionsFailedError(
          'Must be on a branch after a rebase.'
        );
      }
      assertBranchIsValidAndNotTrunkAndGetMeta(branchName);
      handleSuccessfulRebase(branchName, parentBranchRevision);
      return { result, branchName };
    },
    abortRebase: () => {
      git.rebaseAbort();
    },
    isMergedIntoTrunk: (branchName: string) => {
      assertBranch(branchName);
      const trunkName = assertTrunk();
      return git.isMerged({ branchName, trunkName });
    },
    isBranchFixed,
    isBranchEmpty: (branchName: string) => {
      assertBranch(branchName);
      const cachedMeta = assertBranchIsValidAndNotTrunkAndGetMeta(branchName);
      return git.isDiffEmpty(branchName, cachedMeta.parentBranchRevision);
    },
    populateRemoteShas: async () => {
      await git.populateRemoteShas(remote);
    },
    branchMatchesRemote: (branchName: string) => {
      const cachedMeta = assertBranchIsValidOrTrunkAndGetMeta(branchName);
      const remoteParentRevision = git.getRemoteSha(branchName);
      return cachedMeta.branchRevision === remoteParentRevision;
    },
    pushBranch: (branchName: string, forcePush: boolean) => {
      assertBranchIsValidAndNotTrunkAndGetMeta(branchName);
      git.pushBranch({ remote, branchName, noVerify, forcePush });
    },
    pullTrunk: () => {
      git.pruneRemote(remote);
      const currentBranchName = getCurrentBranchOrThrow();
      const trunkName = assertTrunk();
      const oldTrunkCachedMeta = cache.branches[trunkName];
      try {
        git.switchBranch(trunkName);
        const result = git.pullBranch(remote, trunkName);
        if (result === 'CONFLICT') {
          git.switchBranch(currentBranchName);
          return 'PULL_CONFLICT';
        }
        const newTrunkRevision = git.getShaOrThrow(trunkName);
        cache.branches[trunkName] = {
          ...oldTrunkCachedMeta,
          branchRevision: newTrunkRevision,
        };
        return oldTrunkCachedMeta.branchRevision === newTrunkRevision
          ? 'PULL_UNNEEDED'
          : 'PULL_DONE';
      } finally {
        git.switchBranch(currentBranchName);
      }
    },
    hardReset: git.hardReset,
    resetTrunkToRemote: () => {
      const currentBranchName = getCurrentBranchOrThrow();
      const trunkName = assertTrunk();
      const oldTrunkCachedMeta = cache.branches[trunkName];

      try {
        git.switchBranch(trunkName);
        const remoteTrunkRevision = git.getShaOrThrow(`${remote}/${trunkName}`);
        git.hardReset(remoteTrunkRevision);
        cache.branches[trunkName] = {
          ...oldTrunkCachedMeta,
          branchRevision: remoteTrunkRevision,
        };
      } finally {
        git.switchBranch(currentBranchName);
      }
    },
    clean: git.clean,
    fetchBranch: (branchName: string, parentBranchName: string) => {
      const parentMeta = assertBranchIsValidOrTrunkAndGetMeta(parentBranchName);
      if (parentMeta.validationResult === 'TRUNK') {
        // If this is a trunk-child, its base is its merge base with trunk.
        git.fetchBranch(remote, branchName);
        git.writeFetchBase(
          git.getMergeBase(git.readFetchHead(), parentMeta.branchRevision)
        );
      } else {
        // Otherwise, its base is the head of the previous fetch
        git.writeFetchBase(git.readFetchHead());
        git.fetchBranch(remote, branchName);
      }
    },
    branchMatchesFetched: (branchName: string) => {
      assertBranch(branchName);
      return cache.branches[branchName].branchRevision === git.readFetchHead();
    },
    checkoutBranchFromFetched: (
      branchName: string,
      parentBranchName: string
    ) => {
      validateNewParent(branchName, parentBranchName);
      assertBranch(parentBranchName);
      const { head, base } = {
        head: git.readFetchHead(),
        base: git.readFetchBase(),
      };
      git.forceCheckoutNewBranch(branchName, head);
      git.setRemoteTracking({ remote, branchName, sha: head });

      updateMeta(branchName, {
        validationResult: 'VALID',
        parentBranchName,
        parentBranchRevision: base,
        branchRevision: head,
        children: [],
      });
      cache.currentBranch = branchName;
    },
    rebaseBranchOntoFetched: (branchName: string) => {
      const cachedMeta = assertBranchIsValidAndNotTrunkAndGetMeta(branchName);

      const { head, base } = {
        head: git.readFetchHead(),
        base: git.readFetchBase(),
      };
      git.setRemoteTracking({ remote, branchName, sha: head });

      // setting the current branch to this branch is correct in either case
      // failure case, we want it so that currentBranchOverride will be set
      // success case, it ends up as HEAD after the rebase.
      cache.currentBranch = branchName;
      if (
        git.rebase({
          onto: head,
          from: cachedMeta.parentBranchRevision,
          branchName,
          restackCommitterDateIsAuthorDate,
        }) === 'REBASE_CONFLICT'
      ) {
        return {
          result: 'REBASE_CONFLICT',
          rebasedBranchBase: base,
        };
      }
      handleSuccessfulRebase(branchName, base);
      return { result: 'REBASE_DONE' };
    },
  };
}

import { BranchInfo } from '@danerwilliams/gti-cli-shared-types';
import yargs from 'yargs';
import { TContext } from '../../lib/context';
import { UntrackedBranchError } from '../../lib/errors';
import { getMergeBaseAsync } from '../../lib/git/merge_base';
import { graphite } from '../../lib/runner';

const args = {} as const;

export const command = 'log';
export const canonical = 'internal-only log';
export const description = false;
export const builder = args;

type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;
export const handler = async (argv: argsT): Promise<void> => {
  return graphite(argv, canonical, async (context) => {
    // Need to do this before checking if you need submit
    await context.engine.populateRemoteShas();

    const commitInfos: Array<BranchInfo> = await Promise.all(
      context.engine.allBranchNames.map(async (branchName) => {
        const prInfo = context.engine.getPrInfo(branchName);
        const parent = context.engine.getParent(branchName);
        const revision = context.engine.getRevision(branchName);
        const needsSubmit = getNeedsSubmit(context, branchName);

        const [commitDate, commitAuthor, mergeBaseWithTrunk] =
          await Promise.all([
            context.engine.getCommitDate(branchName),
            context.engine.getCommitAuthor(branchName),
            getMergeBaseAsync(context.engine.trunk, revision),
          ]);

        return {
          branch: branchName,

          // Cache
          parents: parent ? [parent] : [],
          isHead: context.engine.currentBranch === branchName,
          partOfTrunk:
            mergeBaseWithTrunk === revision ||
            context.engine.isTrunk(branchName),
          needsRestack: !context.engine.isBranchFixed(branchName),

          // Git
          author: commitAuthor,
          date: commitDate.toISOString(),

          // PR
          needsSubmit,
          title: prInfo?.title || '',
          description: prInfo?.body || '',
          pr:
            prInfo && prInfo.number
              ? {
                  number: prInfo.number?.toString(),
                  isDraft: prInfo.isDraft || false,
                }
              : undefined,
        };
      })
    );

    context.splog.info(JSON.stringify(commitInfos));
  });
};

function getNeedsSubmit(context: TContext, branchName: string) {
  try {
    return !context.engine.branchMatchesRemote(branchName);
  } catch (e) {
    // untracked branches never need submit
    if (e instanceof UntrackedBranchError) {
      return false;
    }

    throw e;
  }
}

import { getPrInfoForBranches, TPRInfoToUpsert } from '../lib/api/pr_info';
import { TContext } from '../lib/context';
import { TEngine } from '../lib/engine/engine';

export async function syncPrInfo(
  branchNames: string[],
  context: TContext
): Promise<TPRInfoToUpsert> {
  const isGithubIntegrationEnabled =
    context.repoConfig.getIsGithubIntegrationEnabled();
  if (!isGithubIntegrationEnabled) {
    return [];
  }

  const upsertInfo = await getPrInfoForBranches(
    branchNames.map((branchName) => ({
      branchName,
      prNumber: context.engine.getPrInfo(branchName)?.number,
    }))
  );

  upsertPrInfoForBranches(upsertInfo, context.engine);

  return upsertInfo;
}

export function upsertPrInfoForBranches(
  prInfoToUpsert: TPRInfoToUpsert,
  engine: TEngine
): void {
  prInfoToUpsert.forEach((pr) =>
    engine.upsertPrInfo(pr.headRefName, {
      number: pr.prNumber,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      reviewDecision: pr.reviewDecision ?? undefined,
      base: pr.baseRefName,
      url: pr.url,
      isDraft: pr.isDraft,
    })
  );
}

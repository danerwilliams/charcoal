import { API_ROUTES } from '@withgraphite/graphite-cli-routes';

import t from '@withgraphite/retype';
import { execFileSync } from 'child_process';

type TBranchNameWithPrNumber = {
  branchName: string;
  prNumber: number | undefined;
};

export type TPRInfoToUpsert = t.UnwrapSchemaMap<
  typeof API_ROUTES.pullRequestInfo.response
>['prs'];

export async function getPrInfoForBranches(
  branchNamesWithExistingPrInfo: TBranchNameWithPrNumber[]
): Promise<TPRInfoToUpsert> {
  // We sync branches without existing PR info by name.  For branches
  // that are already associated with a PR, we only sync if both the
  // the associated PR (keyed by number) if the name matches the headRef.

  const branchesWithoutPrInfo = new Set<string>();
  const existingPrInfo = new Map<number, string>();

  branchNamesWithExistingPrInfo.forEach((branch) => {
    if (branch?.prNumber === undefined) {
      branchesWithoutPrInfo.add(branch.branchName);
    } else {
      existingPrInfo.set(branch.prNumber, branch.branchName);
    }
  });

  try {
    const response: TPRInfoToUpsert = [];

    // Gh CLI allows for looking up by pr number of branch name
    for (const prId of [...existingPrInfo.keys(), ...branchesWithoutPrInfo]) {
      try {
        const pr = await JSON.parse(
          execFileSync('gh', [
            'pr',
            'view',
            `${prId}`,
            '--json',
            'state,url,title,body,number,headRefName,baseRefName,reviewDecision,isDraft',
          ]).toString()
        );

        pr.prNumber = pr.number;
        delete pr.number;

        if (pr.reviewDecision === '') {
          pr.reviewDecision = undefined;
        }

        response.push(pr);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('no pull requests found')
        ) {
          continue;
        }

        throw error;
      }
    }

    return response.filter((pr) => {
      const branchNameIfAssociated = existingPrInfo.get(pr.prNumber);

      const shouldAssociatePrWithBranch =
        !branchNameIfAssociated &&
        pr.state === 'OPEN' &&
        branchesWithoutPrInfo.has(pr.headRefName);

      const shouldUpdateExistingBranch =
        branchNameIfAssociated === pr.headRefName;

      return shouldAssociatePrWithBranch || shouldUpdateExistingBranch;
    });
  } catch {
    // Not really sure why this pattern was accepted but when this used the
    // Graphite API they'd just return an empty array if the request failed.
    return [];
  }
}

import { API_ROUTES } from '@withgraphite/graphite-cli-routes';

import t from '@withgraphite/retype';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ExitFailedError } from '../errors';

const execFileAsync = promisify(execFile);

type TBranchNameWithPrNumber = {
  branchName: string;
  prNumber: number | undefined;
};

export type TPRInfoToUpsert = t.UnwrapSchemaMap<
  typeof API_ROUTES.pullRequestInfo.response
>['prs'];

export async function getPrInfoForBranches(
  branchNamesWithExistingPrInfo: TBranchNameWithPrNumber[],
  repo: string
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

  // gh can look up by PR number or branch name. These lookups are independent,
  // so run them concurrently rather than one blocking subprocess at a time.
  const prIds = [...existingPrInfo.keys(), ...branchesWithoutPrInfo];
  const results = await Promise.all(
    prIds.map(async (prId) => {
      try {
        const { stdout } = await execFileAsync('gh', [
          'pr',
          'view',
          `${prId}`,
          '--repo',
          repo,
          '--json',
          'state,url,title,body,number,headRefName,baseRefName,reviewDecision,isDraft',
        ]);
        const pr = JSON.parse(stdout);

        pr.prNumber = pr.number;
        delete pr.number;

        if (pr.reviewDecision === '') {
          pr.reviewDecision = undefined;
        }

        return pr;
      } catch (error) {
        const detail =
          error instanceof Error
            ? `${error.message}\n${
                (error as Error & { stderr?: string }).stderr ?? ''
              }`
            : String(error);

        // A branch simply having no PR is expected; anything else (gh missing,
        // auth expired, rate limit, network) is a real failure we must surface
        // rather than silently treating it as "no PR info".
        if (/no .*pull requests found/i.test(detail)) {
          return undefined;
        }

        throw new ExitFailedError(
          [
            `Failed to fetch pull request info from GitHub (via \`gh\`) for "${prId}".`,
            `Ensure the GitHub CLI is installed and authenticated (run \`ch auth\`).`,
            detail.trim(),
          ].join('\n')
        );
      }
    })
  );

  const response: TPRInfoToUpsert = results.filter((pr) => pr !== undefined);

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
}

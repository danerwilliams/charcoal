import yargs from 'yargs';
import { graphite } from '../../lib/runner';
import { RepoInfo } from '@danerwilliams/gti-cli-shared-types';
import {
  currentGitRepoPrecondition,
  getRepoRootPathPrecondition,
} from '../../lib/preconditions';

const args = {} as const;

export const command = 'repo-info';
export const canonical = 'internal-only repo-info';
export const description = false;
export const builder = args;

type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;
export const handler = async (argv: argsT): Promise<void> => {
  return graphite(argv, canonical, async (context) => {
    let remote: RepoInfo['remote'];

    try {
      const hostname = context.repoConfig.getRepoHost();
      const owner = context.repoConfig.getRepoOwner();
      const name = context.repoConfig.getRepoName();

      remote = {
        hostname,
        owner,
        name,
      };
    } catch {
      // PASS
    }

    context.splog.info(
      JSON.stringify({
        remote,
        dotDir: getRepoRootPathPrecondition(),
        rootDir: currentGitRepoPrecondition(),
        trunkBranch: context.engine.trunk,
      } as RepoInfo)
    );
  });
};

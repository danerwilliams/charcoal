import * as t from '@withgraphite/retype';
import { ExitFailedError } from '../errors';
import { runGitCommand } from '../git/runner';
import { spiffy } from './spiffy';

const schema = t.shape({
  host: t.optional(t.string),
  owner: t.optional(t.string),
  name: t.optional(t.string),
  trunk: t.optional(t.string),
  remote: t.optional(t.string),
  lastFetchedPRInfoMs: t.optional(t.number),
  isGithubIntegrationEnabled: t.optional(t.boolean),
});

export const repoConfigFactory = spiffy({
  schema,
  defaultLocations: [
    {
      relativePath: '.graphite_repo_config',
      relativeTo: 'REPO',
    },
  ],
  initialize: () => {
    return {};
  },
  helperFunctions: (data, update) => {
    return {
      setRemote: (remote: string) => {
        update((data) => (data.remote = remote));
      },

      getRemote: () => data.remote ?? 'origin',

      setTrunk: (trunk: string) => {
        update((data) => (data.trunk = trunk));
      },

      setIsGithubIntegrationEnabled: (isEnabled: boolean) => {
        update((data) => (data.isGithubIntegrationEnabled = isEnabled));
      },

      getIsGithubIntegrationEnabled: (): boolean =>
        data.isGithubIntegrationEnabled ?? true,

      graphiteInitialized: (): boolean => !!data.trunk,

      getRepoHost: (): string => {
        const configHost = data.host;
        if (configHost) {
          return configHost;
        }

        const inferredInfo = inferRepoGitHubInfo(data.remote ?? 'origin');
        if (inferredInfo?.repoHost) {
          return inferredInfo.repoHost;
        }

        throw new ExitFailedError(
          "Could not determine the host of this repo (e.g. 'github.com' in the repo 'https://github.com/danerwilliams/charcoal'). Please run `gt repo owner --set <owner>` to manually set the repo owner."
        );
      },

      getRepoOwner: (): string => {
        const configOwner = data.owner;
        if (configOwner) {
          return configOwner;
        }

        const inferredInfo = inferRepoGitHubInfo(data.remote ?? 'origin');
        if (inferredInfo?.repoOwner) {
          return inferredInfo.repoOwner;
        }

        throw new ExitFailedError(
          "Could not determine the owner of this repo (e.g. 'charcoal' in the repo 'danerwilliams/charcoal'). Please run `gt repo owner --set <owner>` to manually set the repo owner."
        );
      },

      getRepoName: (): string => {
        if (data.name) {
          return data.name;
        }

        const inferredInfo = inferRepoGitHubInfo(data.remote ?? 'origin');
        if (inferredInfo?.repoName) {
          return inferredInfo.repoName;
        }

        throw new ExitFailedError(
          "Could not determine the name of this repo (e.g. 'charcoal' in the repo 'danerwilliams/charcoal'). Please run `gt repo name --set <owner>` to manually set the repo name."
        );
      },
    } as const;
  },
});

function inferRepoGitHubInfo(remote: string): {
  repoOwner: string;
  repoName: string;
  repoHost: string;
} {
  // This assumes the remote to fetch from is the same as the remote to push to.
  // If a user runs into this is not true, they can manually edit the repo config
  // file to overrule what our CLI tries to intelligently infer.
  const url = runGitCommand({
    args: [`config`, `--get`, `remote.${remote}.url`],
    onError: 'ignore',
    resource: 'inferRepoGitHubInfo',
  });

  const inferError = new ExitFailedError(
    `Failed to infer the owner and name of this repo from remote ${remote} "${url}". Please run \`gt repo owner --set <owner>\` and \`gt repo name --set <name>\` to manually set the repo owner/name. (e.g. in the repo 'danerwilliams/charcoal', 'charcoal' is the repo owner and 'charcoal' is the repo name)`
  );
  if (!url) {
    throw inferError;
  }

  const match = getOwnerAndNameFromURL(url);
  if (match === null) {
    throw inferError;
  }

  return {
    repoOwner: match.owner,
    repoName: match.name,
    repoHost: match.hostname,
  };
}

/**
 * FROM ISL: https://github.com/facebook/sapling/blob/main/addons/isl-server/src/Repository.ts#L887-L914
 *
 * extract repo info from a remote url, typically for GitHub or GitHub Enterprise,
 * in various formats:
 * https://github.com/owner/repo
 * https://github.com/owner/repo.git
 * github.com:owner/repo.git
 * git@github.com:owner/repo.git
 * ssh:git@github.com:owner/repo.git
 * ssh://git@github.com/owner/repo.git
 * git+ssh:git@github.com:owner/repo.git
 *
 * or similar urls with GitHub Enterprise hostnames:
 * https://ghe.myCompany.com/owner/repo
 */
export function getOwnerAndNameFromURL(
  url: string
): { name: string; owner: string; hostname: string } | null {
  const match =
    /(?:https:\/\/(.*)\/|(?:git\+ssh:\/\/|ssh:\/\/)?(?:git@)?([^:/]*)[:/])([^/]+)\/(.+?)(?:\.git)?$/.exec(
      url
    );

  if (match == null) {
    return null;
  }

  const [, hostname1, hostname2, owner, repo] = match;
  return { owner, name: repo, hostname: hostname1 ?? hostname2 };
}

export type TRepoConfig = ReturnType<typeof repoConfigFactory.load>;

import yargs from 'yargs';
import { graphiteWithoutRepo } from '../lib/runner';
import { execSync } from 'child_process';

const args = {
  token: {
    type: 'string',
    alias: 't',
    describe: 'Authenticate with the GitHub API using OAuth.',
    demandOption: false,
  },
} as const;
type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;

export const command = 'auth';
export const description =
  'Authenticate with the GitHub CLI to create and manage PRs in GitHub from the Graphite CLI.';
export const builder = args;
export const canonical = 'auth';

const MIN_GH_VERSION = '2.0.0';

export const handler = async (argv: argsT): Promise<void> => {
  return graphiteWithoutRepo(argv, canonical, async (context) => {
    const ghVersion = getGhVersion();

    if (!ghVersion || ghVersion < MIN_GH_VERSION) {
      context.splog.message(
        `❌ Please install GitHub CLI version ${MIN_GH_VERSION} or higher.`
      );
      return;
    }

    const isGhAuthorized = getGithubAuthorizationStatus();

    if (isGhAuthorized) {
      context.splog.message('✅ Already authenticated with GitHub.');
      return;
    }

    context.splog.message(
      '❌ Graphite is not authenticated with GitHub. Please authenticate.'
    );

    try {
      execSync('gh auth login', {
        stdio: 'inherit',
      });

      context.splog.message(
        '✅ Successfully authenticated Graphite with GitHub.'
      );
    } catch {
      context.splog.message(
        '❌ Failed to authenticate Graphite with GitHub. Please try again.'
      );
    }
  });
};

const getGhVersion = (): string | null => {
  try {
    const output = execSync('gh --version').toString();
    const match = output.match(/gh version (\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
};

export const getGithubAuthorizationStatus = (): boolean => {
  try {
    execSync('gh auth status', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

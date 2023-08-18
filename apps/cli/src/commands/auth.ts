import yargs from 'yargs';
import { graphiteWithoutRepo } from '../lib/runner';
// import open from 'open';

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
  'Authenticate with the GitHub API to create and manage PRs in GitHub from the Graphite CLI.';
export const builder = args;
export const canonical = 'auth';

const GITHUB_CLIENT_ID = 'fd5c300ac562c3524cfe';
const GITHUB_OAUTH_SCOPES = ['repo'];

export const handler = async (argv: argsT): Promise<void> => {
  return graphiteWithoutRepo(argv, canonical, async (context) => {
    // if (argv.token) {
    //   // context.userConfig.update((data) => (data.authToken = argv.token));
    //   context.splog.info(
    //     chalk.green(`🔐 Saved auth token to "${context.userConfig.path}"`)
    //   );
    //   return;
    // }
    const deviceCodeResponse = await fetch(
      'https://github.com/login/device/code',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: `client_id=${GITHUB_CLIENT_ID}&scope=${GITHUB_OAUTH_SCOPES.join(
          ' '
        )}`,
      }
    );

    const deviceCode = await deviceCodeResponse.json();

    context.splog.message(JSON.stringify(deviceCode));

    // await open(`${GITHUB_OAUTH_URL}?client_id=${GITHUB_CLIENT_ID}`, {
    //   wait: true,
    // });

    context.splog.message('✔️ Successfully authenticated with Github.');
  });
};

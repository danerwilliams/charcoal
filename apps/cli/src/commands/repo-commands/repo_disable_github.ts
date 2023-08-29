import yargs from 'yargs';
import { graphite } from '../../lib/runner';

const args = {} as const;

type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;

export const command = 'disable-github';
export const canonical = 'repo disable-github';
export const description = 'Disable GitHub integration for this repo.';
export const builder = args;
export const handler = async (argv: argsT): Promise<void> =>
  graphite(argv, canonical, async (context) => {
    context.repoConfig.setIsGithubIntegrationEnabled(false);
    context.splog.info('GitHub integration is now disabled for this repo.');
  });

import yargs from 'yargs';
import { graphite } from '../../lib/runner';

const args = {
  enable: {
    describe: `Whether to enable or disable GitHub integration.`,
    demandOption: true,
    optional: false,
    type: 'boolean',
  },
} as const;

type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;

export const command = 'github';
export const canonical = 'repo github';
export const description = 'Toggle the GitHub integration for this repo.';
export const builder = args;
export const handler = async (argv: argsT): Promise<void> =>
  graphite(argv, canonical, async (context) => {
    if (argv.enable) {
      context.repoConfig.setIsGithubIntegrationEnabled(true);
      context.splog.info('GitHub integration is now enabled for this repo.');
      return;
    }

    context.repoConfig.setIsGithubIntegrationEnabled(false);
    context.splog.info('GitHub integration is now disabled for this repo.');
  });

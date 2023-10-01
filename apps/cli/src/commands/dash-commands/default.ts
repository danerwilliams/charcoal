import open from 'open';
import yargs from 'yargs';
import { graphiteWithoutRepo } from '../../lib/runner';

const args = {} as const;

export const command = '*';
export const description = 'Opens your Charcoal dashboard in the web.';
export const builder = args;
export const canonical = 'dash';
export const aliases = ['d'];

type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;

export const handler = async (argv: argsT): Promise<void> =>
  graphiteWithoutRepo(argv, canonical, async (context) => {
    void open(context.userConfig.getAppServerUrl());
  });

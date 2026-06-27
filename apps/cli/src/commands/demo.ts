import tmp from 'tmp';
import yargs from 'yargs';
import { graphiteWithoutRepo } from '../lib/runner';
import { GitRepo } from '../lib/utils/git_repo';
import { makeId } from '../lib/utils/make_id';

export const command = 'demo';
export const canonical = 'demo';
export const description = false;

const args = {} as const;
export const builder = args;

type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;
export const handler = async (argv: argsT): Promise<void> => {
  return graphiteWithoutRepo(argv, canonical, async (context) => {
    const tmpDir = tmp.dirSync();
    context.splog.info(tmpDir.name);
    const repo = new GitRepo(tmpDir.name);
    const id = makeId(8);

    repo.createChangeAndCommit('First commit');
    repo.createChangeAndCommit('Second commit');

    repo.runCliCommand(['repo', 'init', `--no-interactive`]);

    repo.createChange('[Product] Add review queue filter api');
    repo.runCliCommand([
      'create',
      `${id}-review_queue_api`,
      '-m',
      '[Product] Add review queue filter api',
    ]);

    repo.createChange('[Product] Add review queue filter server');
    repo.runCliCommand([
      'create',
      `${id}-review_queue_server`,
      '-m',
      '[Product] Add review queue filter server',
    ]);

    repo.createChange('[Product] Add review queue filter frontend');
    repo.runCliCommand([
      'create',
      `${id}-review_queue_frontend`,
      '-m',
      '[Product] Add review queue filter frontend',
    ]);

    repo.checkoutBranch('main');

    repo.createChange('[Bug Fix] Fix crashes on reload');
    repo.runCliCommand([
      'create',
      `${id}-fix_crash_on_reload`,
      '-m',
      '[Bug Fix] Fix crashes on reload',
    ]);

    repo.checkoutBranch('main');

    repo.createChange('[Bug Fix] Account for empty state');
    repo.runCliCommand([
      'create',
      `${id}-account_for_empty_state`,
      '-m',
      '[Bug Fix] Account for empty state',
    ]);

    repo.checkoutBranch('main');

    repo.runGitCommand([
      'remote',
      'add',
      'origin',
      'git@github.com:withgraphite/graphite-demo-repo.git',
    ]);

    repo.runGitCommand(['push', 'origin', 'main', '-f']);
  });
};

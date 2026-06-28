import fs from 'fs-extra';
import tmp from 'tmp';
import {
  initContext,
  initContextLite,
  TContext,
} from '../../../src/lib/context';
import { composeGit } from '../../../src/lib/git/git';
import { cuteString } from '../../../src/lib/utils/cute_string';
import { GitRepo } from '../../../src/lib/utils/git_repo';

export abstract class AbstractScene {
  tmpDir: tmp.DirResult;
  repo: GitRepo;
  dir: string;
  oldDir: string;

  constructor() {
    this.tmpDir = tmp.dirSync();
    this.dir = this.tmpDir.name;
    this.repo = new GitRepo(this.dir);
    this.oldDir = process.cwd();
  }

  abstract toString(): string;

  public setup(): void {
    this.tmpDir = tmp.dirSync();
    this.dir = this.tmpDir.name;
    this.repo = new GitRepo(this.dir);
    fs.writeFileSync(
      `${this.dir}/.git/.graphite_repo_config`,
      cuteString({ trunk: 'main', isGithubIntegrationEnabled: false })
    );
    const userConfigPath = `${this.dir}/.git/.graphite_user_config`;
    fs.writeFileSync(userConfigPath, cuteString({ tips: false }));
    process.env.GRAPHITE_USER_CONFIG_PATH = userConfigPath;
    process.env.GRAPHITE_PROFILE = '';
    this.oldDir = process.cwd();
    process.chdir(this.dir);
  }

  public cleanup(): void {
    process.chdir(this.oldDir);
    if (!process.env.DEBUG) {
      // Best-effort temp cleanup. Retry to ride out the ENOTEMPTY/EBUSY race
      // when a lingering git/background process still holds files in the dir,
      // and swallow any residual error so teardown never fails the suite.
      try {
        fs.rmSync(this.dir, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 100,
        });
      } catch {
        // ignore — the OS will reclaim the temp dir
      }
    }
  }

  public getContext(interactive = false): TContext {
    const oldDir = process.cwd();
    process.chdir(this.tmpDir.name);
    const context = initContext(
      initContextLite({
        interactive,
        quiet: !process.env.DEBUG,
        debug: !!process.env.DEBUG,
      }),
      composeGit(),
      {
        verify: false,
      }
    );
    process.chdir(oldDir);
    return context;
  }
}

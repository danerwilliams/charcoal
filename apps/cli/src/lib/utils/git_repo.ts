import { spawnSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { USER_CONFIG_OVERRIDE_ENV } from '../context';

const TEXT_FILE_NAME = 'test.txt';

// This class should only be used by tests and `ch demo`
export class GitRepo {
  dir: string;
  userConfigPath: string;
  constructor(
    dir: string,
    opts?: { existingRepo?: boolean; repoUrl?: string }
  ) {
    this.dir = dir;
    this.userConfigPath = path.join(dir, '.git/.graphite_user_config');
    if (opts?.existingRepo) {
      return;
    }
    spawnSync(
      'git',
      opts?.repoUrl ? [`clone`, opts.repoUrl, dir] : [`init`, dir, `-b`, `main`]
    );
  }

  runGitCommand(args: string[]): void {
    spawnSync('git', args, {
      stdio: process.env.DEBUG ? 'inherit' : 'pipe',
      cwd: this.dir,
    });
  }

  runCliCommand(command: string[], opts?: { cwd?: string }): void {
    const result = spawnSync(
      process.argv[0],
      [
        path.join(__dirname, `..`, `..`, `..`, `..`, `dist`, `src`, `index.js`),
        ...command,
      ],
      {
        stdio: process.env.DEBUG ? 'inherit' : 'pipe',
        cwd: opts?.cwd || this.dir,
        env: {
          ...process.env,
          [USER_CONFIG_OVERRIDE_ENV]: this.userConfigPath,
          GRAPHITE_DISABLE_TELEMETRY: '1',
          GRAPHITE_DISABLE_UPGRADE_PROMPT: '1',
          GRAPHITE_DISABLE_SURVEY: '1',
          GRAPHITE_PROFILE: undefined,
        },
      }
    );
    if (result.status) {
      throw new Error(
        [
          `command result: ${JSON.stringify(result)}`,
          'stdout:',
          result.stdout.toString(),
          'stderr:',
          result.stderr.toString(),
        ].join('\n')
      );
    }
  }

  runGitCommandAndGetOutput(args: string[]): string {
    return (
      spawnSync('git', args, {
        encoding: 'utf-8',
        cwd: this.dir,
      }).stdout?.trim() ?? ''
    );
  }

  runCliCommandAndGetOutput(args: string[]): string {
    return (
      spawnSync(
        process.argv[0],
        [
          path.join(
            __dirname,
            `..`,
            `..`,
            `..`,
            `..`,
            `dist`,
            `src`,
            `index.js`
          ),
          ...args,
        ],
        {
          encoding: 'utf-8',
          cwd: this.dir,
          env: {
            ...process.env,
            [USER_CONFIG_OVERRIDE_ENV]: this.userConfigPath,
            GRAPHITE_DISABLE_TELEMETRY: '1',
            GRAPHITE_DISABLE_UPGRADE_PROMPT: '1',
          },
        }
      ).stdout?.trim() ?? ''
    );
  }

  createChange(textValue: string, prefix?: string, unstaged?: boolean): void {
    const filePath = path.join(
      `${this.dir}`,
      `${prefix ? prefix + '_' : ''}${TEXT_FILE_NAME}`
    );
    fs.writeFileSync(filePath, textValue);
    if (!unstaged) {
      this.runGitCommand([`add`, filePath]);
    }
  }

  createChangeAndCommit(textValue: string, prefix?: string): void {
    this.createChange(textValue, prefix);
    this.runGitCommand([`add`, `.`]);
    this.runGitCommand([`commit`, `-m`, textValue]);
  }

  createChangeAndAmend(textValue: string, prefix?: string): void {
    this.createChange(textValue, prefix);
    this.runGitCommand([`add`, `.`]);
    this.runGitCommand([`commit`, `--amend`, `--no-edit`]);
  }

  deleteBranch(name: string): void {
    this.runGitCommand([`branch`, `-D`, name]);
  }

  createPrecommitHook(contents: string): void {
    fs.mkdirpSync(`${this.dir}/.git/hooks`);
    fs.writeFileSync(`${this.dir}/.git/hooks/pre-commit`, contents);
    spawnSync('chmod', [`+x`, `${this.dir}/.git/hooks/pre-commit`]);
  }

  createAndCheckoutBranch(name: string): void {
    this.runGitCommand([`checkout`, `-b`, name]);
  }

  checkoutBranch(name: string): void {
    this.runGitCommand([`checkout`, name]);
  }

  rebaseInProgress(): boolean {
    return fs.existsSync(path.join(this.dir, '.git', 'rebase-merge'));
  }

  resolveMergeConflicts(): void {
    this.runGitCommand([`checkout`, `--theirs`, `.`]);
  }

  markMergeConflictsAsResolved(): void {
    this.runGitCommand([`add`, `.`]);
  }

  currentBranchName(): string {
    return this.runGitCommandAndGetOutput([`branch`, `--show-current`]);
  }

  getRef(refName: string): string {
    return this.runGitCommandAndGetOutput([`show-ref`, `-s`, refName]);
  }

  listCurrentBranchCommitMessages(): string[] {
    return this.runGitCommandAndGetOutput([`log`, `--oneline`, `--format=%B`])
      .split('\n')
      .filter((l) => l.length > 0);
  }

  mergeBranch(args: { branch: string; mergeIn: string }): void {
    this.checkoutBranch(args.branch);
    this.runGitCommand([`merge`, args.mergeIn]);
  }

  trackBranch(branch: string, parentBranch?: string): void {
    return this.runCliCommand(
      ['branch', 'track']
        .concat(parentBranch ? ['--parent', parentBranch] : [])
        .concat([branch])
    );
  }
}

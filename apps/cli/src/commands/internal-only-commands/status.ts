import { ChangedFile, Status } from '@danerwilliams/gti-cli-shared-types';
import yargs from 'yargs';
import { TStatusFile } from '../../lib/git/changed_files';
import { graphite } from '../../lib/runner';

const args = {} as const;

export const command = 'status';
export const canonical = 'internal-only status';
export const description = false;
export const builder = args;

type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;
export const handler = async (argv: argsT): Promise<void> => {
  return graphite(argv, canonical, async (context) => {
    const statusFiles = context.engine.getStatus();
    const rebaseInProgress = context.engine.rebaseInProgress();

    const statusFilesForInteractive: ChangedFile[] = statusFiles.map(
      (file) => ({
        status: interactiveStatusFromStatus(file.status, file.staged),
        path: file.path,
        copy: file.from,
      })
    );

    const status: Status = {
      conflicts: rebaseInProgress,
      files: statusFilesForInteractive,
    };

    context.splog.info(JSON.stringify(status));
  });
};

function interactiveStatusFromStatus(
  status: TStatusFile['status'],
  staged: TStatusFile['staged']
): ChangedFile['status'] {
  if (status === 'unresolved') {
    return 'UNRESOLVED';
  }

  return `${
    {
      full: 'TRACKED' as const,
      partial: 'PARTIALLY_TRACKED' as const,
      none: 'UNTRACKED' as const,
    }[staged]
  }_${
    {
      added: 'ADD' as const,
      modified: 'MODIFY' as const,
      deleted: 'REMOVE' as const,
      copied: 'COPY' as const,
      renamed: 'RENAME' as const,
    }[status]
  }`;
}

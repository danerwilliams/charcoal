import { API_ROUTES } from '@withgraphite/graphite-cli-routes';
import * as t from '@withgraphite/retype';
import chalk from 'chalk';
import { TContext } from '../../lib/context';
import { ExitFailedError } from '../../lib/errors';
import { Unpacked } from '../../lib/utils/ts_helpers';
import { execFileSync } from 'child_process';

export type TPRSubmissionInfo = t.UnwrapSchemaMap<
  typeof API_ROUTES.submitPullRequests.params
>['prs'];

type TSubmittedPRRequest = Unpacked<TPRSubmissionInfo>;

type TSubmittedPRResponse = Unpacked<
  t.UnwrapSchemaMap<typeof API_ROUTES.submitPullRequests.response>['prs']
>;

type TSubmittedPR = {
  request: TSubmittedPRRequest;
  response: TSubmittedPRResponse;
};

export async function submitPullRequest(
  submissionInfo: TPRSubmissionInfo,
  context: TContext,
  options?: { automerge?: boolean; browser?: boolean }
): Promise<void> {
  const pr = await requestServerToSubmitPR({
    submissionInfo,
  });

  if (pr.response.status === 'error') {
    throw new ExitFailedError(
      `Failed to submit PR for ${pr.response.head}: ${pr.response.error}`
    );
  }

  context.engine.upsertPrInfo(pr.response.head, {
    number: pr.response.prNumber,
    url: pr.response.prURL,
    base: pr.request.base,
    state: 'OPEN', // We know this is not closed or merged because submit succeeded
    ...(pr.request.action === 'create'
      ? {
          title: pr.request.title,
          body: pr.request.body,
          reviewDecision: 'REVIEW_REQUIRED', // Because we just opened this PR
        }
      : {}),
    ...(pr.request.draft !== undefined ? { draft: pr.request.draft } : {}),
  });

  // Enable automerge if requested
  if (options?.automerge && pr.response.prNumber) {
    try {
      execFileSync('gh', [
        'pr',
        'merge',
        pr.response.prNumber.toString(),
        '--auto',
        '--squash',
      ]);
      context.splog.info(
        `${chalk.green('✓')} Automerge enabled for ${chalk.cyan(
          pr.response.head
        )}`
      );
    } catch (error) {
      context.splog.warn(
        `Failed to enable automerge for ${chalk.cyan(pr.response.head)}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  // Open in browser if requested
  if (options?.browser && pr.response.prURL) {
    try {
      const platform = process.platform;
      let openCommand: string;

      switch (platform) {
        case 'darwin': // macOS
          openCommand = 'open';
          break;
        case 'win32': // Windows
          openCommand = 'start';
          break;
        default: // Linux and others
          openCommand = 'xdg-open';
          break;
      }

      execFileSync(openCommand, [pr.response.prURL]);
      context.splog.info(
        `${chalk.green('🌐')} Opened ${chalk.cyan(pr.response.head)} in browser`
      );
    } catch (error) {
      context.splog.warn(
        `Failed to open ${chalk.cyan(pr.response.head)} in browser: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  context.splog.info(
    `${chalk.green(pr.response.head)}: ${pr.response.prURL} (${{
      updated: chalk.yellow,
      created: chalk.green,
    }[pr.response.status](pr.response.status)})`
  );
}

async function requestServerToSubmitPR({
  submissionInfo,
}: {
  submissionInfo: TPRSubmissionInfo;
}): Promise<TSubmittedPR> {
  const request = submissionInfo[0];

  try {
    const response = await submitPrToGithub({
      request,
    });

    return {
      request,
      response,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        response: { error: error.message, status: 'error', head: request.head },
        request,
      };
    }

    throw Error(`Unknown error: ${error}`);
  }
}

async function submitPrToGithub({
  request,
}: {
  request: TSubmittedPRRequest;
}): Promise<TSubmittedPRResponse> {
  try {
    const prInfo = await JSON.parse(
      execFileSync('gh', [
        'pr',
        'view',
        request.head,
        '--json',
        'headRefName,url,number,baseRefName,body',
      ]).toString()
    );

    if (prInfo.headRefName !== request.head) {
      throw Error(
        `PR head mismatch: ${prInfo.headRefName} !== ${request.head}`
      );
    }

    const prBaseChanged = prInfo.baseRefName !== request.base;

    if (prBaseChanged) {
      execFileSync('gh', [
        'pr',
        'edit',
        prInfo.headRefName,
        '--base',
        request.base,
      ]);
    }

    return {
      head: prInfo.headRefName,
      status: 'updated',
      prNumber: prInfo.number,
      prURL: prInfo.url,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('no pull requests found')
    ) {
      const result = execFileSync('gh', [
        'pr',
        'create',
        '--head',
        request.head,
        '--base',
        request.base,
        '--title',
        request.title ?? '',
        '--body',
        request.body ?? '',
        ...(request.draft ? ['--draft'] : []),
      ])
        .toString()
        .trim();

      const prNumber = getPrNumberFromUrl(result);

      return {
        head: request.head,
        status: 'created',
        prNumber,
        prURL: result,
      };
    }

    throw error;
  }
}

function getPrNumberFromUrl(url: string): number {
  const prNumber = url.match(/\/pull\/(\d+)$/)?.[1];

  if (!prNumber) {
    throw Error(`Could not find PR number in response: ${url}`);
  }

  return Number(prNumber);
}

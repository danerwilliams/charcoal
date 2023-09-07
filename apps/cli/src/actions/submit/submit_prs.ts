import { API_ROUTES } from '@withgraphite/graphite-cli-routes';
import * as t from '@withgraphite/retype';
import chalk from 'chalk';
import { TContext } from '../../lib/context';
import { ExitFailedError } from '../../lib/errors';
import { Unpacked } from '../../lib/utils/ts_helpers';
import { execSync } from 'child_process';

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
  args: {
    submissionInfo: TPRSubmissionInfo;
    mergeWhenReady: boolean;
    trunkBranchName: string;
  },
  context: TContext
): Promise<void> {
  const pr = await requestServerToSubmitPR({
    submissionInfo: args.submissionInfo,
    context,
  });

  if (pr.response.status === 'error') {
    throw new ExitFailedError(
      `Failed to submit PR for ${
        pr.response.head
      }: ${'TODO: insert error message from gh'}`
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
  context.splog.info(
    `${chalk.green(pr.response.head)}: ${pr.response.prURL} (${{
      updated: chalk.yellow,
      created: chalk.green,
    }[pr.response.status](pr.response.status)})`
  );
}

async function requestServerToSubmitPR({
  submissionInfo,
  context,
}: {
  submissionInfo: TPRSubmissionInfo;
  context: TContext;
}): Promise<TSubmittedPR> {
  // eslint-disable-next-line no-console
  console.log(submissionInfo);

  const request = submissionInfo[0];
  const response = await submitPrToGithub({
    _context: context,
    request: request,
  });

  return {
    request,
    response,
  };
}

async function submitPrToGithub({
  request,
  _context,
}: {
  request: TSubmittedPRRequest;
  _context: TContext;
}): Promise<TSubmittedPRResponse> {
  const test = execSync(
    `gh pr create --head '${request.head}' \
                  --base '${request.base}' \
                  --title '${request.title}' \
                  --body '${request.body}' \
                  ${request.draft ? '--draft' : ''}`
  ).toString();

  // eslint-disable-next-line no-console
  console.log({ test });

  return {
    head: 'head',
    status: 'updated',
    prNumber: 1,
    prURL: '',
  };
}

import { API_ROUTES } from '@withgraphite/graphite-cli-routes';
import * as t from '@withgraphite/retype';
import chalk from 'chalk';
import { TContext } from '../../lib/context';
import { ExitFailedError } from '../../lib/errors';
import { Unpacked } from '../../lib/utils/ts_helpers';

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
    cliAuthToken: string;
  },
  context: TContext
): Promise<void> {
  const pr = (
    await requestServerToSubmitPRs({
      submissionInfo: args.submissionInfo,
      mergeWhenReady: args.mergeWhenReady,
      trunkBranchName: args.trunkBranchName,
      context,
    })
  )[0];

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

async function requestServerToSubmitPRs({
  submissionInfo,
  context,
}: // mergeWhenReady,
// trunkBranchName,
{
  submissionInfo: TPRSubmissionInfo;
  mergeWhenReady: boolean;
  trunkBranchName: string;
  context: TContext;
}): Promise<TSubmittedPR[]> {
  // const response = await requestWithArgs(
  //   context.userConfig,
  //   API_ROUTES.submitPullRequests,
  //   {
  //     repoOwner: context.repoConfig.getRepoOwner(),
  //     repoName: context.repoConfig.getRepoName(),
  //     mergeWhenReady,
  //     trunkBranchName,
  //     prs: submissionInfo,
  //   }
  // );
  context.splog.info(submissionInfo.toString());

  const response: { prs: TSubmittedPRResponse[] } = {
    prs: [
      {
        head: '',
        status: 'created',
        prNumber: 1,
        prURL: '',
      },
    ],
  };

  const requests: { [head: string]: TSubmittedPRRequest } = {};

  submissionInfo.forEach((prRequest) => {
    requests[prRequest.head] = prRequest;
  });

  return response.prs.map((prResponse) => {
    return {
      request: requests[prResponse.head],
      response: prResponse,
    };
  });
}

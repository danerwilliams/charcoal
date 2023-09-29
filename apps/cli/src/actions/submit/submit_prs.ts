import { API_ROUTES } from '@withgraphite/graphite-cli-routes';
import * as t from '@withgraphite/retype';
import chalk from 'chalk';
import { TContext } from '../../lib/context';
import { ExitFailedError } from '../../lib/errors';
import { Unpacked } from '../../lib/utils/ts_helpers';
import { execSync } from 'child_process';
import {
  createPrBodyFooter,
  footerFooter,
  footerTitle,
} from '../create_pr_body_footer';

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
  const request = submissionInfo[0];

  try {
    const response = await submitPrToGithub({
      request,
      context,
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
  context,
}: {
  request: TSubmittedPRRequest;
  context: TContext;
}): Promise<TSubmittedPRResponse> {
  try {
    const prInfo = await JSON.parse(
      execSync(
        `gh pr view ${request.head} --json headRefName,url,number,baseRefName,body`
      ).toString()
    );

    if (prInfo.headRefName !== request.head) {
      throw Error(
        `PR head mismatch: ${prInfo.headRefName} !== ${request.head}`
      );
    }

    const footer = createPrBodyFooter(context, request.head);

    // eslint-disable-next-line no-console
    console.log('test');
    // eslint-disable-next-line no-console
    console.log(footer);

    const prBaseChanged = prInfo.baseRefName !== request.base;
    const prFooterChanged = !prInfo.body.includes(footer);

    if (prBaseChanged || prFooterChanged) {
      execSync(
        `gh pr edit ${prInfo.headRefName} ${
          prBaseChanged ? `--base ${request.base}` : ''
        } ${
          prFooterChanged
            ? `--body '${
                prInfo.body.replace(
                  new RegExp(footerTitle + '.*?' + footerFooter, 's'),
                  '' // instead of just replacing with footer we handle the case where there is no existing footer
                ) + footer
              }'`
            : ''
        }
      `
      );
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
      const result = execSync(
        `gh pr create --head '${request.head}' \
                    --base '${request.base}' \
                    --title '${request.title}' \
                    --body '${request.body}' \
                    ${request.draft ? '--draft' : ''}`
      )
        .toString()
        .trim();

      const prNumber = getPrNumberFromUrl(result);

      const footer = createPrBodyFooter(context, request.head, prNumber);
      execSync(`gh pr edit ${prNumber} --body '${request.body + footer}'`);

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

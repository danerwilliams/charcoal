import { composeEngine, TEngine } from './engine/engine';
import { TGit } from './git/git';
import { rebaseInProgress } from './git/rebase_in_progress';
import {
  continueConfigFactory,
  TContinueConfig,
} from './spiffy/continuation_spf';
import { prInfoConfigFactory } from './spiffy/pr_info_spf';
import { repoConfigFactory, TRepoConfig } from './spiffy/repo_config_spf';
import {
  surveyConfigFactory,
  TSurveyConfig,
} from './spiffy/survey_responses_spf';
import {
  messageConfigFactory,
  TMessageConfig,
} from './spiffy/upgrade_message_spf';
import { TUserConfig, userConfigFactory } from './spiffy/user_config_spf';
import { composeSplog, TSplog } from './utils/splog';
import { NonInteractiveError } from './errors';
import { gtPrompts, TPrompts } from './utils/prompts_helpers';

export const USER_CONFIG_OVERRIDE_ENV = 'GRAPHITE_USER_CONFIG_PATH' as const;

export type TContextLite = {
  splog: TSplog;
  interactive: boolean;
  surveyConfig: TSurveyConfig;
  userConfig: TUserConfig;
  messageConfig: TMessageConfig;
  userEmail?: string;
  prompts: TPrompts;
};

type TRepoContext = {
  repoConfig: TRepoConfig;
  continueConfig: TContinueConfig;
  engine: TEngine;
};

export function initContextLite(opts?: {
  interactive?: boolean;
  quiet?: boolean;
  debug?: boolean;
  userEmail?: string;
}): TContextLite {
  const userConfig = userConfigFactory.load(
    process.env[USER_CONFIG_OVERRIDE_ENV]
  );
  const splog = composeSplog({
    quiet: opts?.quiet,
    outputDebugLogs: opts?.debug,
    tips: userConfig.data.tips,
    pager: userConfig.getPager(),
  });

  const interactive =
    // Confusing, but if invoked from GTI, behave as if `--no-interactive` was passed
    !process.env.GRAPHITE_INTERACTIVE && (opts?.interactive ?? true);

  return {
    splog,
    interactive,
    prompts: async (...args: Parameters<TPrompts>) => {
      if (!interactive) {
        throw new NonInteractiveError();
      }
      return gtPrompts(...args);
    },
    surveyConfig: surveyConfigFactory.load(),
    userConfig,
    messageConfig: messageConfigFactory.load(),
    userEmail: opts?.userEmail,
  };
}

export type TContext = TRepoContext & TContextLite;

export function initContext(
  contextLite: TContextLite,
  git: TGit,
  opts?: {
    verify?: boolean;
  }
): TContext {
  const repoConfig = repoConfigFactory.load();
  if (!rebaseInProgress()) {
    continueConfigFactory.load().delete();
  }
  const continueConfig = continueConfigFactory.load();
  const engine = composeEngine({
    git,
    trunkName: repoConfig.data.trunk,
    currentBranchOverride: continueConfig.data.currentBranchOverride,
    splog: contextLite.splog,
    noVerify: !(opts?.verify ?? true),
    remote: repoConfig.getRemote(),
    restackCommitterDateIsAuthorDate:
      contextLite.userConfig.data.restackCommitterDateIsAuthorDate,
  });
  const prInfoConfig = prInfoConfigFactory.loadIfExists();
  if (prInfoConfig) {
    prInfoConfig.delete();
  }
  return {
    ...contextLite,
    repoConfig,
    continueConfig,
    engine,
  };
}

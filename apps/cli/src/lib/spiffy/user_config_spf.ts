import * as t from '@withgraphite/retype';
import { execSync } from 'child_process';
import { getGitEditor, getGitPager } from '../git/git_editor';
import { CommandFailedError } from '../git/runner';
import { spiffy } from './spiffy';

const schema = t.shape({
  branchPrefix: t.optional(t.string),
  branchDate: t.optional(t.boolean),
  branchReplacement: t.optional(
    t.unionMany([t.literal('_'), t.literal('-'), t.literal('')])
  ),
  tips: t.optional(t.boolean),
  editor: t.optional(t.string),
  pager: t.optional(t.string),
  restackCommitterDateIsAuthorDate: t.optional(t.boolean),
  submitIncludeCommitMessages: t.optional(t.boolean),
  connectCliToLocalServer: t.optional(t.boolean),
  gtiConfigs: t.optional(
    t.array(
      t.shape({
        key: t.string,
        value: t.string,
      })
    )
  ),
  alternativeProfiles: t.optional(
    t.array(
      t.shape({
        name: t.string,
        hostPrefix: t.string,
      })
    )
  ),
});

export type TProfile = Required<
  t.TypeOf<typeof schema>
>['alternativeProfiles'][number];

export type TApiServerUrl = string;
export type TAppServerUrl = string;
export const DEFAULT_GRAPHITE_API_SERVER: TApiServerUrl =
  'https://api.graphite.dev/v1';

export const DEFAULT_GRAPHITE_APP_SERVER: TAppServerUrl =
  'https://app.graphite.dev';

export const userConfigFactory = spiffy({
  schema,
  defaultLocations: [
    {
      relativePath: '.graphite_user_config',
      relativeTo: 'USER_HOME',
    },
  ],
  initialize: () => {
    return {};
  },
  helperFunctions: (data) => {
    // Read the user config and return a host prefix.
    // If none specified, default to empty string.
    const getDefaultProfile = (): TProfile => {
      const alternativeProfiles = data.alternativeProfiles ?? [];
      if (process.env.GRAPHITE_PROFILE) {
        const alternativeProfile = alternativeProfiles.find(
          (p) => p.name === process.env.GRAPHITE_PROFILE
        );
        if (alternativeProfile) {
          return alternativeProfile;
        } else {
          throw new Error(`Unknown profile ${process.env.GRAPHITE_PROFILE}`);
        }
      }
      const optionalDefaultProfile = alternativeProfiles.find(
        (p) => p.name === 'default'
      );
      if (optionalDefaultProfile) {
        return optionalDefaultProfile;
      } else {
        return {
          name: 'default',
          hostPrefix: '',
        };
      }
    };

    const getApiServerUrl = (): TApiServerUrl => {
      if (data.connectCliToLocalServer) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        return 'https://localhost:8000/v1';
      }
      const hostPrefix = getDefaultProfile().hostPrefix;
      return hostPrefix
        ? `https://api.${hostPrefix}.graphite.dev/v1`
        : DEFAULT_GRAPHITE_API_SERVER;
    };

    const getAppServerUrl = (): TAppServerUrl => {
      const hostPrefix = getDefaultProfile().hostPrefix;
      return hostPrefix
        ? `https://app.${hostPrefix}.graphite.dev`
        : DEFAULT_GRAPHITE_APP_SERVER;
    };

    const getEditor = () => {
      return (
        process.env.GT_EDITOR ?? // single command override
        data.editor ??
        process.env.TEST_GT_EDITOR ?? // for tests
        // If we don't have an editor set, do what git would do
        getGitEditor() ??
        process.env.GIT_EDITOR ??
        process.env.EDITOR ??
        'vi'
      );
    };

    const getPager = () => {
      // If we don't have a pager set, do what git would do
      const pager =
        process.env.GT_PAGER ?? // single command override
        data.pager ??
        process.env.TEST_GT_PAGER ?? // for tests
        // If we don't have a pager set, do what git would do
        getGitPager() ??
        process.env.GIT_PAGER ??
        process.env.PAGER ??
        'less';
      return pager === '' ? undefined : pager;
    };

    return {
      getEditor,
      getApiServerUrl,
      getAppServerUrl,
      getPager,
      execEditor: (editFilePath: string) => {
        const command = `${getEditor()} ${editFilePath}`;
        try {
          execSync(command, { stdio: 'inherit', encoding: 'utf-8' });
        } catch (e) {
          throw new CommandFailedError({ command, args: [editFilePath], ...e });
        }
      },
    };
  },
});

export type TUserConfig = ReturnType<typeof userConfigFactory.load>;

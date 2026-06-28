import { TContext } from '../context';

// The `owner/name` slug to scope every `gh` call with `--repo`. Without it, gh
// resolves the target repo from the cwd's remotes — which picks the *parent*
// for a fork, so submit/get would operate on the wrong repository.
export function githubRepoSlug(context: TContext): string {
  return `${context.repoConfig.getRepoOwner()}/${context.repoConfig.getRepoName()}`;
}

import { execFileSync } from 'child_process';

/**
 * Updates a PR's fields using either `gh api` (default) or `gh pr edit` (legacy).
 *
 * By default, uses `gh api` to avoid GitHub CLI bug with Projects (classic)
 * deprecation error: https://github.com/cli/cli/issues/11983
 *
 * Set GT_USE_GH_PR_EDIT=1 to use the legacy `gh pr edit` command instead.
 */
export function updatePullRequest(
  prNumber: number,
  fields: { base?: string; body?: string }
): void {
  if (process.env.GT_USE_GH_PR_EDIT) {
    // Legacy behavior using gh pr edit
    const args = ['pr', 'edit', `${prNumber}`];
    if (fields.base !== undefined) {
      args.push('--base', fields.base);
    }
    if (fields.body !== undefined) {
      args.push('--body', fields.body);
    }
    execFileSync('gh', args);
  } else {
    // Use gh api to avoid Projects (classic) deprecation error
    const args = [
      'api',
      '--method',
      'PATCH',
      `/repos/{owner}/{repo}/pulls/${prNumber}`,
    ];
    if (fields.base !== undefined) {
      args.push('-f', `base=${fields.base}`);
    }
    if (fields.body !== undefined) {
      args.push('-f', `body=${fields.body}`);
    }
    execFileSync('gh', args);
  }
}

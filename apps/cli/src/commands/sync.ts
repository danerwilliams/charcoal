export { builder, handler } from './repo-commands/repo_sync';
export const command = 'sync';
export const canonical = 'sync';
export const description =
  'Pull the trunk branch from remote and delete any branches that have been merged. If trunk cannot be fast-forwarded to match remote, overwrites trunk with the remote version.';

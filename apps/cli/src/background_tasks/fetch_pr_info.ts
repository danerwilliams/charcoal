import { TContext } from '../lib/context';
import { spawnDetached } from '../lib/utils/spawn';

export function refreshPRInfoInBackground(context: TContext): void {
  if (!context.repoConfig.graphiteInitialized()) {
    return;
  }

  const now = Date.now();
  const lastFetchedMs = context.repoConfig.data.lastFetchedPRInfoMs;
  const msInSecond = 1000;

  // rate limit refreshing PR info to once per minute
  if (lastFetchedMs === undefined || now - lastFetchedMs > 60 * msInSecond) {
    // do our potential write before we kick off the child process so that we
    // don't incur a possible race condition with the write
    context.repoConfig.update((data) => (data.lastFetchedPRInfoMs = now));

    spawnDetached(__filename);
  }
}

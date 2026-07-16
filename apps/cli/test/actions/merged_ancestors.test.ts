import { expect } from 'chai';
import { TContext } from '../../src/lib/context';
import { preserveMergedAncestors } from '../../src/actions/merged_ancestors';

type Branch = {
  number?: number;
  state?: 'OPEN' | 'CLOSED' | 'MERGED';
  mergedStackAncestors?: number[];
  empty?: boolean;
  inTrunk?: boolean;
};

function fakeContext(initial: Record<string, Branch>): {
  context: TContext;
  read: (branch: string) => number[] | undefined;
} {
  const store: Record<string, Branch> = JSON.parse(JSON.stringify(initial));
  const engine = {
    getPrInfo: (branch: string) => store[branch],
    isBranchEmpty: (branch: string) => !!store[branch]?.empty,
    isMergedIntoTrunk: (branch: string) => !!store[branch]?.inTrunk,
    upsertPrInfo: (branch: string, patch: Partial<Branch>) => {
      store[branch] = { ...store[branch], ...patch };
    },
  };
  return {
    context: { engine } as unknown as TContext,
    read: (branch) => store[branch]?.mergedStackAncestors,
  };
}

describe('preserveMergedAncestors', () => {
  it('captures a merged ancestor with a PR number', () => {
    const { context, read } = fakeContext({
      a: { number: 100, state: 'MERGED' },
      b: {},
    });
    preserveMergedAncestors(['b'], ['a'], context);
    expect(read('b')).to.deep.equal([100]);
  });

  it('does not capture a closed ancestor, even if in trunk', () => {
    const { context, read } = fakeContext({
      a: { number: 100, state: 'CLOSED', inTrunk: true },
      b: {},
    });
    preserveMergedAncestors(['b'], ['a'], context);
    expect(read('b')).to.be.undefined;
  });

  it('does not capture an empty ancestor with a PR number', () => {
    const { context, read } = fakeContext({
      a: { number: 100, empty: true, inTrunk: true },
      b: {},
    });
    preserveMergedAncestors(['b'], ['a'], context);
    expect(read('b')).to.be.undefined;
  });

  it('captures via the isMergedIntoTrunk fallback (no PR state, non-empty)', () => {
    const { context, read } = fakeContext({
      a: { number: 100, inTrunk: true },
      b: {},
    });
    preserveMergedAncestors(['b'], ['a'], context);
    expect(read('b')).to.deep.equal([100]);
  });

  it('captures an explicitly MERGED ancestor even if the branch is empty', () => {
    // The empty guard applies only to the git fallback, not to MERGED state.
    const { context, read } = fakeContext({
      a: { number: 100, state: 'MERGED', empty: true },
      b: {},
    });
    preserveMergedAncestors(['b'], ['a'], context);
    expect(read('b')).to.deep.equal([100]);
  });

  it('forwards an abandoned ancestor\'s history but not its own number', () => {
    const { context, read } = fakeContext({
      a: { number: 100, state: 'CLOSED', mergedStackAncestors: [98] },
      b: {},
    });
    preserveMergedAncestors(['b'], ['a'], context);
    expect(read('b')).to.deep.equal([98]);
  });

  it('dedupes against the survivor\'s existing list', () => {
    const { context, read } = fakeContext({
      a: { number: 100, state: 'MERGED' },
      b: { mergedStackAncestors: [100] },
    });
    preserveMergedAncestors(['b'], ['a'], context);
    expect(read('b')).to.deep.equal([100]);
  });
});

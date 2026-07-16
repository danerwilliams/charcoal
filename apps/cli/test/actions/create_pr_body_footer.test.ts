import { expect } from 'chai';
import { TContext } from '../../src/lib/context';
import {
  createPrBodyFooter,
  footerFooter,
  footerTitle,
} from '../../src/actions/create_pr_body_footer';

const TRUNK = 'main';

/**
 * Builds a minimal fake context whose engine answers the methods the footer
 * relies on, derived from a branch -> parent map. Every non-trunk branch gets
 * a PR number equal to its position in `parents` insertion order plus 100,
 * unless overridden. `merged` maps a branch to the PR numbers it carries in
 * `mergedStackAncestors`.
 */
function fakeContext(
  parents: Record<string, string>,
  merged: Record<string, number[]> = {}
): TContext {
  const branches = Object.keys(parents);
  const prNumber = (branch: string) => 100 + branches.indexOf(branch);

  const ancestors = (branch: string): string[] => {
    const parent = parents[branch];
    return !parent || parent === TRUNK ? [] : [parent, ...ancestors(parent)];
  };
  const descendants = (branch: string): string[] =>
    branches
      .filter((b) => parents[b] === branch)
      .flatMap((child) => [child, ...descendants(child)]);

  const engine = {
    isTrunk: (branch: string) => branch === TRUNK,
    getParent: (branch: string) => parents[branch],
    getChildren: (branch: string) =>
      branches.filter((b) => parents[b] === branch),
    getPrInfo: (branch: string) =>
      branch === TRUNK
        ? undefined
        : { number: prNumber(branch), mergedStackAncestors: merged[branch] },
    getRelativeStack: (branch: string) => [
      ...ancestors(branch),
      branch,
      ...descendants(branch),
    ],
  };

  return { engine } as unknown as TContext;
}

/** Extracts the tree body between the footer's title and trailing signature. */
function treeOf(footer: string): string {
  return footer
    .slice(footerTitle.length, footer.length - footerFooter.length)
    .replace(/^\n/, '');
}

describe('createPrBodyFooter', () => {
  it('renders a linear stack as a flat list', () => {
    // main -> a -> b -> c, PR on b
    const context = fakeContext({ a: TRUNK, b: 'a', c: 'b' });

    const tree = treeOf(createPrBodyFooter(context, 'b'));

    expect(tree).to.equal(
      ['* **PR #100**', '* **PR #101** 👈', '* **PR #102**'].join('\n')
    );
  });

  it('does not indent a single-child descendant', () => {
    // main -> a -> b, PR on a
    const context = fakeContext({ a: TRUNK, b: 'a' });

    const tree = treeOf(createPrBodyFooter(context, 'a'));

    expect(tree).to.equal(['* **PR #100** 👈', '* **PR #101**'].join('\n'));
  });

  it('indents each sub-branch at a genuine fork', () => {
    // main -> x, x -> y -> z, x -> m -> n, PR on x
    const context = fakeContext({
      x: TRUNK,
      y: 'x',
      z: 'y',
      m: 'x',
      n: 'm',
    });

    const tree = treeOf(createPrBodyFooter(context, 'x'));

    expect(tree).to.equal(
      [
        '* **PR #100** 👈',
        '  * **PR #101**',
        '    * **PR #102**',
        '  * **PR #103**',
        '    * **PR #104**',
      ].join('\n')
    );
  });

  it('keeps a linear sub-stack below a fork flat (no staircase within a branch)', () => {
    // main -> x, x -> y -> z -> z2, x -> m, PR on x
    const context = fakeContext({
      x: TRUNK,
      y: 'x',
      z: 'y',
      z2: 'z',
      m: 'x',
    });

    const tree = treeOf(createPrBodyFooter(context, 'x'));

    expect(tree).to.equal(
      [
        '* **PR #100** 👈',
        '  * **PR #101**',
        '    * **PR #102**',
        '    * **PR #103**',
        '  * **PR #104**',
      ].join('\n')
    );
  });

  it('flattens the ancestor spine, indenting only at a downstream fork', () => {
    // main -> a -> b, b -> c, b -> d, PR on a
    const context = fakeContext({
      a: TRUNK,
      b: 'a',
      c: 'b',
      d: 'b',
    });

    const tree = treeOf(createPrBodyFooter(context, 'a'));

    expect(tree).to.equal(
      [
        '* **PR #100** 👈',
        '* **PR #101**',
        '  * **PR #102**',
        '  * **PR #103**',
      ].join('\n')
    );
  });

  it('renders merged ancestors struck through above the live stack', () => {
    // main -> b -> c, PR on b, with #98 and #99 merged below
    const context = fakeContext({ b: TRUNK, c: 'b' }, { b: [98, 99] });

    const tree = treeOf(createPrBodyFooter(context, 'b'));

    expect(tree).to.equal(
      [
        '* ~~**PR #98**~~ (merged)',
        '* ~~**PR #99**~~ (merged)',
        '* **PR #100** 👈',
        '* **PR #101**',
      ].join('\n')
    );
  });

  it('surfaces merged history stored on a non-terminal branch (reorder-robust)', () => {
    // main -> a -> b -> c, PR on a, history parked on c (as if reordered)
    const context = fakeContext({ a: TRUNK, b: 'a', c: 'b' }, { c: [98] });

    const tree = treeOf(createPrBodyFooter(context, 'a'));

    expect(tree).to.equal(
      [
        '* ~~**PR #98**~~ (merged)',
        '* **PR #100** 👈',
        '* **PR #101**',
        '* **PR #102**',
      ].join('\n')
    );
  });

  it('dedupes and sorts merged ancestors across the stack', () => {
    const context = fakeContext(
      { b: TRUNK, c: 'b' },
      { b: [99, 98], c: [98] }
    );

    const tree = treeOf(createPrBodyFooter(context, 'b'));

    expect(tree).to.equal(
      [
        '* ~~**PR #98**~~ (merged)',
        '* ~~**PR #99**~~ (merged)',
        '* **PR #100** 👈',
        '* **PR #101**',
      ].join('\n')
    );
  });

  it('omits the merged prefix when there are none', () => {
    const context = fakeContext({ b: TRUNK, c: 'b' });

    const tree = treeOf(createPrBodyFooter(context, 'b'));

    expect(tree).to.equal(['* **PR #100** 👈', '* **PR #101**'].join('\n'));
  });

  it('excludes a merged number that is still a live PR number in the stack', () => {
    // main -> b -> c, PR on b, b's merged history collides with c's live #101
    const context = fakeContext({ b: TRUNK, c: 'b' }, { b: [101] });

    const tree = treeOf(createPrBodyFooter(context, 'b'));

    expect(tree).to.equal(['* **PR #100** 👈', '* **PR #101**'].join('\n'));
  });
});

import { expect } from 'chai';
import { TContext } from '../../src/lib/context';
import {
  createPrBodyFooter,
  footerFooter,
  footerTitle,
} from '../../src/actions/create_pr_body_footer';

const TRUNK = 'main';

/**
 * Builds a minimal fake context whose engine answers the four methods the
 * footer relies on, derived from a branch -> parent map. Every non-trunk
 * branch gets a PR number equal to its position in `parents` insertion order
 * plus 100, unless overridden.
 */
function fakeContext(parents: Record<string, string>): TContext {
  const branches = Object.keys(parents);
  const prNumber = (branch: string) => 100 + branches.indexOf(branch);

  const engine = {
    isTrunk: (branch: string) => branch === TRUNK,
    getParent: (branch: string) => parents[branch],
    getChildren: (branch: string) =>
      branches.filter((b) => parents[b] === branch),
    getPrInfo: (branch: string) =>
      branch === TRUNK ? undefined : { number: prNumber(branch) },
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
});

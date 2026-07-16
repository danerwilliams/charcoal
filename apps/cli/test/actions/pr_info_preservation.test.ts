import { expect } from 'chai';
import { BasicScene } from '../lib/scenes/basic_scene';
import { configureTest } from '../lib/utils/configure_test';

for (const scene of [new BasicScene()]) {
  // eslint-disable-next-line max-lines-per-function
  describe(`(${scene}): prInfo mergedStackAncestors preservation`, function () {
    configureTest(this, scene);

    it('clearPrInfo retains mergedStackAncestors', () => {
      scene.repo.createChange('2', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);

      const context = scene.getContext();
      context.engine.upsertPrInfo('a', {
        number: 100,
        mergedStackAncestors: [98],
      });
      context.engine.clearPrInfo('a');

      const prInfo = context.engine.getPrInfo('a');
      expect(prInfo?.mergedStackAncestors).to.deep.equal([98]);
      expect(prInfo?.number).to.be.undefined;
    });

    it('renameCurrentBranch retains mergedStackAncestors', () => {
      scene.repo.createChange('2', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);

      const context = scene.getContext();
      context.engine.upsertPrInfo('a', {
        number: 100,
        mergedStackAncestors: [98],
      });
      context.engine.renameCurrentBranch('a2');

      expect(
        context.engine.getPrInfo('a2')?.mergedStackAncestors
      ).to.deep.equal([98]);
    });

    it('persists mergedStackAncestors through a setParent + reload (engine-level)', () => {
      scene.repo.createChange('2', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);
      scene.repo.createChange('3', 'b');
      scene.repo.runCliCommand([`create`, `b`, `-m`, `b`]);

      // Persist the field (upsert writes the metadata ref immediately).
      scene
        .getContext()
        .engine.upsertPrInfo('b', { number: 100, mergedStackAncestors: [98] });

      // A fresh context reloads from refs; reparent b onto trunk — the same
      // updateMeta write path that move/reorder/restack go through. This is an
      // engine-level persistence guard for the "preserved through updateMeta +
      // reload" claim; it passes once Task 1's schema field exists (not a
      // red-first case). The user-facing removal flows are exercised at the
      // command level by the `repo sync` tests in Task 4.
      scene.getContext().engine.setParent('b', scene.getContext().engine.trunk);

      expect(
        scene.getContext().engine.getPrInfo('b')?.mergedStackAncestors
      ).to.deep.equal([98]);
    });

    it('moves merged history to the bottom when a split renames the branch', () => {
      scene.repo.createChange('2', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);
      scene.repo.createChange('3', 'b');
      scene.repo.runCliCommand([`create`, `b`, `-m`, `b`]);

      const context = scene.getContext();
      context.engine.upsertPrInfo('b', {
        number: 100,
        mergedStackAncestors: [98],
      });

      // Single new branch b2 at HEAD: b is deleted, b2 becomes the new bottom.
      context.engine.detach();
      context.engine.applySplitToCommits({
        branchToSplit: 'b',
        branchNames: ['b2'],
        branchPoints: [0],
      });

      expect(
        context.engine.getPrInfo('b2')?.mergedStackAncestors
      ).to.deep.equal([98]);
    });

    it('keeps merged history when a split retains the original name', () => {
      scene.repo.createChange('2', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);
      scene.repo.createChange('3', 'b');
      scene.repo.runCliCommand([`create`, `b`, `-m`, `b`]);

      const context = scene.getContext();
      context.engine.upsertPrInfo('b', {
        number: 100,
        mergedStackAncestors: [98],
      });

      // Split into a single branch that keeps the name b: b is retained and
      // keeps its full prInfo (branchName === branchToSplit branch of the ternary).
      context.engine.detach();
      context.engine.applySplitToCommits({
        branchToSplit: 'b',
        branchNames: ['b'],
        branchPoints: [0],
      });

      const prInfo = context.engine.getPrInfo('b');
      expect(prInfo?.mergedStackAncestors).to.deep.equal([98]);
      expect(prInfo?.number).to.equal(100);
    });

    it('puts merged history only on the bottom of a multi-branch split', () => {
      scene.repo.createChange('2', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);
      scene.repo.createChange('3', 'b');
      scene.repo.runCliCommand([`create`, `b`, `-m`, `b`]);
      scene.repo.createChangeAndCommit('b2'); // second commit on b

      const context = scene.getContext();
      context.engine.upsertPrInfo('b', {
        number: 100,
        mergedStackAncestors: [98],
      });

      // Split b into lower (b's first commit) and upper (HEAD); b renamed away.
      context.engine.detach();
      context.engine.applySplitToCommits({
        branchToSplit: 'b',
        branchNames: ['lower', 'upper'],
        branchPoints: [0, 1],
      });

      expect(
        context.engine.getPrInfo('lower')?.mergedStackAncestors
      ).to.deep.equal([98]);
      expect(context.engine.getPrInfo('upper')?.mergedStackAncestors).to.be
        .undefined;
    });

    it('puts merged history on the bottom when a split keeps the name above it', () => {
      scene.repo.createChange('2', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);
      scene.repo.createChange('3', 'b');
      scene.repo.runCliCommand([`create`, `b`, `-m`, `b`]);
      scene.repo.createChangeAndCommit('b2');

      const context = scene.getContext();
      context.engine.upsertPrInfo('b', {
        number: 100,
        mergedStackAncestors: [98],
      });

      // Retain b as the TOP branch; a new branch `lower` is the bottom.
      context.engine.detach();
      context.engine.applySplitToCommits({
        branchToSplit: 'b',
        branchNames: ['lower', 'b'],
        branchPoints: [0, 1],
      });

      expect(
        context.engine.getPrInfo('lower')?.mergedStackAncestors
      ).to.deep.equal([98]);
    });
  });
}

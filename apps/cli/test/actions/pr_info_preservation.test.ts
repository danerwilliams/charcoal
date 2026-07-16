import { expect } from 'chai';
import { BasicScene } from '../lib/scenes/basic_scene';
import { configureTest } from '../lib/utils/configure_test';

for (const scene of [new BasicScene()]) {
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
  });
}

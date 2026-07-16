import { expect } from 'chai';
import { allScenes } from '../../lib/scenes/all_scenes';
import {
  readMetadataRef,
  writeMetadataRef,
} from '../../../src/lib/engine/metadata_ref';
import { configureTest } from '../../lib/utils/configure_test';
import { expectBranches } from '../../lib/utils/expect_branches';

for (const scene of allScenes) {
  describe(`(${scene}): branch delete`, function () {
    configureTest(this, scene);

    it('Can run branch delete', () => {
      const branchName = 'a';

      scene.repo.createChangeAndCommit('2', '2');
      scene.repo.runCliCommand([`create`, branchName, `-m`, branchName]);
      expect(scene.repo.currentBranchName()).to.equal(branchName);

      scene.repo.checkoutBranch('main');
      scene.repo.runCliCommand([`delete`, branchName, `-f`]);
      expectBranches(scene.repo, 'main');
    });

    it('preserves a merged branch in its child when deleted manually', () => {
      scene.repo.createChange('2', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);
      scene.repo.createChange('3', 'b');
      scene.repo.runCliCommand([`create`, `b`, `-m`, `b`]);

      writeMetadataRef(
        'a',
        {
          ...readMetadataRef('a', scene.dir),
          prInfo: { number: 100, state: 'MERGED' },
        },
        scene.dir
      );

      scene.repo.runCliCommand([`delete`, `a`, `-f`]);

      expect(
        readMetadataRef('b', scene.dir).prInfo?.mergedStackAncestors
      ).to.deep.equal([100]);
    });

    it('does not preserve an unmerged branch deleted manually', () => {
      scene.repo.createChange('2', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);
      scene.repo.createChange('3', 'b');
      scene.repo.runCliCommand([`create`, `b`, `-m`, `b`]);

      scene.repo.runCliCommand([`delete`, `a`, `-f`]);

      expect(readMetadataRef('b', scene.dir).prInfo?.mergedStackAncestors).to.be
        .undefined;
    });
  });
}

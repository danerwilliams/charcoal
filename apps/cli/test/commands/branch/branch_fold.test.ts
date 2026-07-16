import { expect } from 'chai';
import { allScenes } from '../../lib/scenes/all_scenes';
import { configureTest } from '../../lib/utils/configure_test';
import { expectBranches } from '../../lib/utils/expect_branches';
import { expectCommits } from '../../lib/utils/expect_commits';
import {
  readMetadataRef,
  writeMetadataRef,
} from '../../../src/lib/engine/metadata_ref';

for (const scene of allScenes) {
  describe(`(${scene}): fold`, function () {
    configureTest(this, scene);

    it("Can't fold from trunk or into trunk", () => {
      scene.repo.createChange('a', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);

      expect(() => scene.repo.runCliCommand([`fold`])).to.throw();
      expect(() =>
        scene.repo.runCliCommand([`fold`, `--keep`])
      ).to.throw();

      scene.repo.runCliCommand([`down`]);

      expect(() => scene.repo.runCliCommand([`fold`])).to.throw();
      expect(() =>
        scene.repo.runCliCommand([`fold`, `--keep`])
      ).to.throw();
    });

    it('Can fold without --keep and restack children accordingly', () => {
      scene.repo.createChange('a', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);
      scene.repo.createChange('b', 'b');
      scene.repo.runCliCommand([`create`, `b`, `-m`, `b`]);
      scene.repo.createChange('c', 'c');
      scene.repo.runCliCommand([`create`, `c`, `-m`, `c`]);
      scene.repo.runCliCommand([`down`, `2`]);
      scene.repo.createChange('d', 'd');
      scene.repo.runCliCommand([`create`, `d`, `-m`, `d`]);
      scene.repo.checkoutBranch('b');

      scene.repo.runCliCommand([`fold`]);
      expectBranches(scene.repo, 'a, c, d, main');
      expectCommits(scene.repo, 'b, a, 1');

      scene.repo.runCliCommand([`down`]);
      expectCommits(scene.repo, '1');

      scene.repo.checkoutBranch('c');
      expectCommits(scene.repo, 'c, b, a, 1');

      scene.repo.checkoutBranch('d');
      expectCommits(scene.repo, 'd, b, a, 1');
    });

    it('Can fold with --keep and restack children accordingly', () => {
      scene.repo.createChange('a', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);
      scene.repo.createChange('b', 'b');
      scene.repo.runCliCommand([`create`, `b`, `-m`, `b`]);
      scene.repo.createChange('c', 'c');
      scene.repo.runCliCommand([`create`, `c`, `-m`, `c`]);
      scene.repo.runCliCommand([`down`, `2`]);
      scene.repo.createChange('d', 'd');
      scene.repo.runCliCommand([`create`, `d`, `-m`, `d`]);
      scene.repo.checkoutBranch('b');

      scene.repo.runCliCommand([`fold`, `--keep`]);
      expectBranches(scene.repo, 'b, c, d, main');
      expectCommits(scene.repo, 'b, a, 1');

      scene.repo.runCliCommand([`down`]);
      expectCommits(scene.repo, '1');

      scene.repo.checkoutBranch('c');
      expectCommits(scene.repo, 'c, b, a, 1');

      scene.repo.checkoutBranch('d');
      expectCommits(scene.repo, 'd, b, a, 1');
    });

    it('forwards merged history to the survivor (keep=false)', () => {
      scene.repo.createChange('2', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);
      scene.repo.createChange('3', 'b');
      scene.repo.runCliCommand([`create`, `b`, `-m`, `b`]);

      writeMetadataRef(
        'b',
        {
          ...readMetadataRef('b', scene.dir),
          prInfo: {
            ...readMetadataRef('b', scene.dir).prInfo,
            mergedStackAncestors: [98],
          },
        },
        scene.dir
      );

      scene.repo.runCliCommand([`fold`]); // b absorbed into a; a survives

      expect(
        readMetadataRef('a', scene.dir).prInfo?.mergedStackAncestors
      ).to.deep.equal([98]);
    });

    it('forwards merged history to the survivor (keep=true)', () => {
      scene.repo.createChange('2', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);
      scene.repo.createChange('3', 'b');
      scene.repo.runCliCommand([`create`, `b`, `-m`, `b`]);

      // Parent a carries the merged ancestor; folding with --keep keeps b,
      // which must inherit a's history.
      writeMetadataRef(
        'a',
        {
          ...readMetadataRef('a', scene.dir),
          prInfo: {
            ...readMetadataRef('a', scene.dir).prInfo,
            mergedStackAncestors: [98],
          },
        },
        scene.dir
      );

      scene.repo.runCliCommand([`fold`, `--keep`]); // a absorbed into b; b survives

      expect(
        readMetadataRef('b', scene.dir).prInfo?.mergedStackAncestors
      ).to.deep.equal([98]);
    });
  });
}

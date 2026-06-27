import { expect } from 'chai';
import { allScenes } from '../../lib/scenes/all_scenes';
import { configureTest } from '../../lib/utils/configure_test';
import { expectCommits } from '../../lib/utils/expect_commits';

for (const scene of allScenes) {
  describe(`(${scene}): rename`, function () {
    configureTest(this, scene);

    it('Can rename a branch', () => {
      scene.repo.createChange('a', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);

      scene.repo.createChange('b', 'b');
      scene.repo.runCliCommand([`create`, `b`, `-m`, `b`]);

      scene.repo.checkoutBranch('a');
      scene.repo.runCliCommand([`rename`, `a1`]);

      expect(() => scene.repo.runCliCommand([`ls`])).not.to.throw();

      scene.repo.checkoutBranch('b');

      expectCommits(scene.repo, 'b, a, 1');

      scene.repo.runCliCommand([`down`, `--no-interactive`]);
      expect(scene.repo.currentBranchName()).to.equal('a1');

      scene.repo.runCliCommand([`down`, `--no-interactive`]);
      expect(scene.repo.currentBranchName()).to.equal('main');
    });
    it("Renaming a branch to its own name doesn't break", () => {
      scene.repo.createChange('a', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);

      scene.repo.createChange('b', 'b');
      scene.repo.runCliCommand([`create`, `b`, `-m`, `b`]);

      scene.repo.checkoutBranch('a');
      scene.repo.runCliCommand([`rename`, `a`]);

      expect(() => scene.repo.runCliCommand([`ls`])).not.to.throw();
      expect(() => scene.repo.runCliCommand([`up`])).not.to.throw();
      expectCommits(scene.repo, 'b, a, 1');
    });
  });
}

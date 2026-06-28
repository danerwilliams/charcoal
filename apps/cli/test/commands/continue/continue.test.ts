import { expect } from 'chai';
import { allScenes } from '../../lib/scenes/all_scenes';
import { configureTest } from '../../lib/utils/configure_test';

for (const scene of allScenes) {
  describe('(${scene}): continue', function () {
    configureTest(this, scene);

    beforeEach(function () {
      scene.repo.createAndCheckoutBranch('a');
      scene.repo.trackBranch('a', 'main');
      scene.repo.createChangeAndCommit('a1');

      scene.repo.createAndCheckoutBranch('b');
      scene.repo.trackBranch('b', 'a');
      scene.repo.createChangeAndCommit('b1');

      scene.repo.checkoutBranch('a');
      scene.repo.createChangeAndCommit('a2');
    });

    describe('While not during a rebase', function () {
      it('Will error', () => {
        expect(() => scene.repo.runCliCommand(['continue'])).to.throw();
      });
    });

    describe('During a git initiated rebase', function () {
      beforeEach(function () {
        scene.repo.checkoutBranch('b');
        scene.repo.runGitCommand(['rebase', 'a']);
      });

      it('Stops during a rebase', function () {
        expect(scene.repo.rebaseInProgress()).to.be.true;
      });

      it('Will not continue', () => {
        expect(() => scene.repo.runCliCommand(['continue'])).to.throw();
      });

      describe('After resolving conflict', function () {
        beforeEach(function () {
          scene.repo.resolveMergeConflicts();
          scene.repo.markMergeConflictsAsResolved();
        });

        it('Will not continue', () => {
          expect(() => scene.repo.runCliCommand(['continue'])).to.throw();
        });
      });
    });

    describe('During a Grahite initiated rebase', function () {
      beforeEach(function () {
        scene.repo.checkoutBranch('b');
        expect(() => scene.repo.runCliCommand(['restack'])).to.throw();
      });

      it('Stops during a rebase conflict', function () {
        expect(scene.repo.rebaseInProgress()).to.be.true;
      });

      it('Will not continue without resolving conflict', function () {
        expect(() => scene.repo.runCliCommand(['continue'])).to.throw();
      });

      describe('After resolving conflict and continuing', function () {
        beforeEach(function () {
          scene.repo.resolveMergeConflicts();
          scene.repo.markMergeConflictsAsResolved();
          scene.repo.runCliCommand(['continue']);
        });

        it('Lands on the restacked branch', function () {
          expect(scene.repo.currentBranchName()).to.equal('b');
        });

        it('No longer is in a rebase', function () {
          expect(scene.repo.rebaseInProgress()).to.be.false;
        });
      });
    });
  });
}

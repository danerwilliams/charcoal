import { expect } from 'chai';
import { allScenes } from '../../lib/scenes/all_scenes';
import { configureTest } from '../../lib/utils/configure_test';
import { expectCommits } from '../../lib/utils/expect_commits';
import { removeUnsupportedTrailingCharacters } from '../../../src/lib/utils/branch_name';

for (const scene of allScenes) {
  describe(`(${scene}): branch create`, function () {
    configureTest(this, scene);

    it('Can run branch create', () => {
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);
      expect(scene.repo.currentBranchName()).to.equal('a');
      scene.repo.createChangeAndCommit('2', '2');

      scene.repo.runCliCommand(['down']);
      expect(scene.repo.currentBranchName()).to.equal('main');
    });

    it('Can rollback changes on a failed commit hook', () => {
      // Aggressive AF commit hook from your angry coworker
      scene.repo.createPrecommitHook('exit 1');
      scene.repo.createChange('2');
      expect(() => {
        scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);
      }).to.throw(Error);
      expect(scene.repo.currentBranchName()).to.equal('main');
    });

    it('Can create a branch without providing a name', () => {
      scene.repo.createChange('2');
      scene.repo.runCliCommand([`create`, `-m`, `feat(test): info.`]);
      expect(scene.repo.currentBranchName().includes('feat_test_info')).to.be
        .true;
      expectCommits(scene.repo, 'feat(test): info.');
    });

    it('Can create a branch with add all option', () => {
      scene.repo.createChange('23', 'test', true);
      scene.repo.runCliCommand([
        `create`,
        `test-branch`,
        `-m`,
        `add all`,
        `-a`,
      ]);
    });

    it('Can restack its parents children', () => {
      scene.repo.createChange('a', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);

      scene.repo.createChange('b', 'b');
      scene.repo.runCliCommand([`create`, `b`, `-m`, `b`]);
      scene.repo.runCliCommand(['down']);

      scene.repo.createChange('c', 'c');
      scene.repo.runCliCommand([`create`, `c`, `-m`, `c`, `--insert`]);
      expect(() => scene.repo.runCliCommand(['up'])).not.to.throw();

      expectCommits(scene.repo, 'b, c, a');
    });
  });
}

describe('removeUnsupportedTrailingCharacters', () => {
  [
    {
      name: 'No unsupported trailing characters',
      input: 'Hello world',
      expected: 'Hello world',
    },
    {
      name: 'Trailing dot',
      input: 'Hello world.',
      expected: 'Hello world',
    },
    {
      name: 'Trailing slash',
      input: 'Hello world/',
      expected: 'Hello world',
    },
    {
      name: 'Multiple unsupported trailing characters',
      input: 'Hello world/_./.',
      expected: 'Hello world/_',
    },
  ].forEach((tc) => {
    it(tc.name, () => {
      const strippedInput = removeUnsupportedTrailingCharacters(tc.input);
      expect(strippedInput).equals(tc.expected);
    });
  });
});

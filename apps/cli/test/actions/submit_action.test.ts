import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { inferPRBody } from '../../src/actions/submit/pr_body';
import { getPRTitle } from '../../src/actions/submit/pr_title';
import { updatePrBodyFooter } from '../../src/actions/submit/submit_action';
import { validateNoEmptyBranches } from '../../src/actions/submit/validate_branches';
import { BasicScene } from '../lib/scenes/basic_scene';
import { configureTest } from '../lib/utils/configure_test';

use(chaiAsPromised);

for (const scene of [new BasicScene()]) {
  describe(`(${scene}): correctly infers submit info from commits`, function () {
    configureTest(this, scene);

    it('can infer title/body from single commit', async () => {
      const title = 'Test Title';
      const body = ['Test body line 1.', 'Test body line 2.'].join('\n');
      const message = `${title}\n\n${body}`;

      scene.repo.createChange('a');
      scene.repo.runCliCommand([`branch`, `create`, `a`, `-m`, message]);

      expect(
        await getPRTitle(
          { branchName: 'a', editPRFieldsInline: false },
          scene.getContext()
        )
      ).to.equals(title);
      expect(
        inferPRBody(
          { branchName: 'a', template: 'template' },
          scene.getContext()
        ).inferredBody
      ).to.equals(`template`);

      scene
        .getContext()
        .userConfig.update((data) => (data.submitIncludeCommitMessages = true));

      expect(
        await getPRTitle(
          { branchName: 'a', editPRFieldsInline: false },
          scene.getContext()
        )
      ).to.equals(title);
      expect(
        inferPRBody(
          { branchName: 'a', template: 'template' },
          scene.getContext()
        ).inferredBody
      ).to.equals(`${body}\n\ntemplate`);
    });

    it('can infer just title with no body', async () => {
      const title = 'Test Title';
      const commitMessage = title;

      scene.repo.createChange('a');
      scene.repo.runCliCommand([`branch`, `create`, `a`, `-m`, commitMessage]);

      expect(
        await getPRTitle(
          { branchName: 'a', editPRFieldsInline: false },
          scene.getContext()
        )
      ).to.equals(title);
      expect(
        inferPRBody(
          { branchName: 'a', template: 'template' },
          scene.getContext()
        ).inferredBody
      ).to.equal('template');
    });

    it('can infer title/body from multiple commits', async () => {
      const title = 'Test Title';
      const secondSubj = 'Second commit subject';

      scene.repo.createChange('a');
      scene.repo.runCliCommand([`branch`, `create`, `a`, `-m`, title]);
      scene.repo.createChangeAndCommit(secondSubj);

      expect(
        await getPRTitle(
          { branchName: 'a', editPRFieldsInline: false },
          scene.getContext()
        )
      ).to.equals(title);
      expect(
        inferPRBody({ branchName: 'a' }, scene.getContext()).inferredBody
      ).to.equal(``);

      scene
        .getContext()
        .userConfig.update((data) => (data.submitIncludeCommitMessages = true));

      expect(
        await getPRTitle(
          { branchName: 'a', editPRFieldsInline: false },
          scene.getContext()
        )
      ).to.equals(title);
      expect(
        inferPRBody({ branchName: 'a' }, scene.getContext()).inferredBody
      ).to.equal(`${title}\n\n${secondSubj}`);
    });

    it('aborts if the branch is empty', async () => {
      scene.repo.runCliCommand([`branch`, `create`, `a`, `-m`, `a`]);
      await expect(validateNoEmptyBranches(['a'], scene.getContext())).to.be
        .rejected;
    });

    it('does not abort if the branch is not empty', async () => {
      scene.repo.createChange('a');
      scene.repo.runCliCommand([`branch`, `create`, `a`, `-m`, `a`]);
      await expect(validateNoEmptyBranches(['a'], scene.getContext())).to.be
        .fulfilled;
    });
  });
}

describe('updatePrBodyFooter', () => {
  const newFooter = `#### PR Dependency Tree


* **PR #83** 👈

This tree was auto-generated by [Charcoal](https://github.com/danerwilliams/charcoal)`;

  describe('when there is no existing body', () => {
    it('adds the footer', () => {
      const updatedPrBodyFooter = updatePrBodyFooter(undefined, newFooter);

      expect(newFooter).equal(updatedPrBodyFooter);
    });
  });

  describe('when there is already a body', () => {
    it('replaces the footer', () => {
      const existingBody = `Fix issue where dependency tree prints multiple times

**Changes In This Pull Request:**

**Test Plan:**

![CleanShot 2024-02-08 at 21 18 49@2x](https://github.com/danerwilliams/charcoal/assets/22798229/3821e8dc-d6df-4e1d-bd4b-2ed5ccf7aec9)


#### PR Dependency Tree


* **PR #83** 👈

This tree was auto-generated by [Charcoal](https://github.com/danerwilliams/charcoal)`;

      const updatedPrBody = updatePrBodyFooter(existingBody, newFooter);

      expect(existingBody).equal(updatedPrBody);
    });
    describe('and there is no existing footer', () => {
      it('adds the footer', () => {
        const existingBody = `Fix issue where dependency tree prints multiple times

**Changes In This Pull Request:**

**Test Plan:**

![CleanShot 2024-02-08 at 21 18 49@2x](https://github.com/danerwilliams/charcoal/assets/22798229/3821e8dc-d6df-4e1d-bd4b-2ed5ccf7aec9)`;

        const updatedPrBodyFooter = updatePrBodyFooter(existingBody, newFooter);

        expect(existingBody + newFooter).equal(updatedPrBodyFooter);
      });
    });
  });
});

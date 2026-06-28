import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { inferPRBody } from '../../src/actions/submit/pr_body';
import { getPRTitle } from '../../src/actions/submit/pr_title';
import {
  footerFooter,
  footerTitle,
} from '../../src/actions/create_pr_body_footer';
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
      scene.repo.runCliCommand([`create`, `a`, `-m`, message]);

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
      scene.repo.runCliCommand([`create`, `a`, `-m`, commitMessage]);

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
      scene.repo.runCliCommand([`create`, `a`, `-m`, title]);
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
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);
      await expect(validateNoEmptyBranches(['a'], scene.getContext())).to.be
        .rejected;
    });

    it('does not abort if the branch is not empty', async () => {
      scene.repo.createChange('a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);
      await expect(validateNoEmptyBranches(['a'], scene.getContext())).to.be
        .fulfilled;
    });
  });
}

describe('updatePrBodyFooter', () => {
  // Use the real footer format (leading newlines from footerTitle), unlike the
  // simplified literal the original test used.
  const newFooter = `${footerTitle}* **PR #83** 👈${footerFooter}`;
  const footerCount = (s: string) =>
    (s.match(/#### PR Dependency Tree/g) ?? []).length;
  const description = `Some PR description

**Changes In This Pull Request:**`;

  it('returns the footer when there is no body', () => {
    expect(updatePrBodyFooter(undefined, newFooter)).to.equal(newFooter);
  });

  it('appends the footer when the body has none', () => {
    expect(updatePrBodyFooter(description, newFooter)).to.equal(
      description + newFooter
    );
  });

  it('replaces an existing footer rather than appending a second', () => {
    const existing = description + newFooter;
    const result = updatePrBodyFooter(existing, newFooter);
    expect(result).to.equal(existing);
    expect(footerCount(result)).to.equal(1);
  });

  it('does not duplicate the footer when content was appended after it', () => {
    // e.g. an external bot appended a section after Charcoal's footer (#118)
    const existing = `${description}${newFooter}\n\n---\n_posted by a bot_`;
    const result = updatePrBodyFooter(existing, newFooter);
    expect(footerCount(result)).to.equal(1);
    expect(result).to.contain('_posted by a bot_');
    expect(result.endsWith(newFooter)).to.equal(true);
  });

  it('collapses an already-duplicated footer to a single one', () => {
    const existing = `${description}${newFooter}${newFooter}`;
    const result = updatePrBodyFooter(existing, newFooter);
    expect(footerCount(result)).to.equal(1);
    expect(result).to.equal(description + newFooter);
  });
});

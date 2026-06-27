import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import prompts from 'prompts';
import { getPRInfoForBranches } from '../../../src/actions/submit/prepare_branches';
import { BasicScene } from '../../lib/scenes/basic_scene';
import { configureTest } from '../../lib/utils/configure_test';
import fs from 'fs-extra';
import { TPRSubmissionInfo } from '../../../src/actions/submit/submit_prs';

use(chaiAsPromised);

const scene = new BasicScene();
describe(`(${scene}): correctly get PR information for branches`, function () {
  configureTest(this, scene);

  // TODO: Add more tests for different scenarios

  it('should be able to update PR title and body if editPRFieldsInline is set', async () => {
    const title = 'Test Title';
    const body = 'Test body';
    const message = `${title}\n\n${body}`;

    scene.repo.createChange('a');
    scene.repo.runCliCommand([`create`, `a`, `-m`, message]);

    const context = scene.getContext(true);

    const updatedTitle = 'updatedTitle';
    prompts.inject([updatedTitle]);

    const updatedBody = 'updatedBody';
    // Skip editor and inject the updated body
    context.userConfig.execEditor = function (editFilePath: string) {
      fs.writeFileSync(editFilePath, updatedBody);
    };
    // Pretend the stack has been submitted
    context.engine.getPrInfo = function (_branchName: string) {
      return {
        number: 1,
      };
    };

    await expect(
      getPRInfoForBranches(
        {
          branchNames: ['a'],
          editPRFieldsInline: true,
          draft: false,
          publish: true,
          updateOnly: false,
          dryRun: false,
          reviewers: undefined,
          select: false,
          always: false,
        },
        context
      )
    ).to.eventually.satisfy((info: TPRSubmissionInfo) => {
      if (info.length !== 1) {
        return false;
      }
      const datum = info[0];
      return (
        datum.action === 'update' &&
        datum.title === updatedTitle &&
        datum.body === updatedBody
      );
    });
  });
});

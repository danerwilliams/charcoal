import { expect } from 'chai';
import fs from 'fs-extra';
import path from 'path';
import { BasicScene } from '../scenes/basic_scene';
import { configureTest } from '../utils/configure_test';

const CACHE_FILE = '.graphite_cache_persist';

for (const scene of [new BasicScene()]) {
  describe(`(${scene}): cache persistence`, function () {
    configureTest(this, scene);

    const cachePath = () => path.join(scene.dir, '.git', CACHE_FILE);

    it('Persists the cache after a read-only command rebuilds it', () => {
      scene.repo.createChange('a', 'a');
      scene.repo.runCliCommand([`create`, `a`, `-m`, `a`]);
      fs.removeSync(cachePath());

      scene.repo.runCliCommand([`ls`]);

      expect(fs.existsSync(cachePath())).to.be.true;
    });

    it('Persists the cache when an untracked branch has no PR info', () => {
      scene.repo.createAndCheckoutBranch('untracked');
      scene.repo.checkoutBranch('main');
      fs.removeSync(cachePath());

      scene.repo.runCliCommand([`ls`]);
      scene.repo.runCliCommand([`ls`]);

      expect(fs.existsSync(cachePath())).to.be.true;
    });
  });
}

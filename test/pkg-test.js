import { createRequire } from 'node:module';
import fs from 'node:fs/promises';

const nodeRequire = createRequire(import.meta.url);

const pkg = nodeRequire('../package.json');

describe('package', () => {
  it('has exported files', async () => {
    expect((await fs.stat(pkg.module)).isFile(), pkg.module).to.be.true;
    expect((await fs.stat(pkg.main)).isFile(), pkg.main).to.be.true;
    expect((await fs.stat(pkg.types)).isFile(), pkg.types).to.be.true;

    for (const [r, v] of Object.entries(pkg.exports)) {
      for (const [k, p] of Object.entries(v)) {
        expect((await fs.stat(p)).isFile(), `exports/${r}/${k} ${p}`).to.be.true;
      }
    }
  });
});

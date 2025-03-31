import { execFile } from 'node:child_process';

describe('stdout', () => {
  it('logs to stdout by default', async () => {
    const { stdout } = await new Promise((resolve, reject) =>
      execFile('node', ['./test/logger.cjs'], (err, stdout, stderr) => {
        if (err) return reject(err);
        resolve({ stdout, stderr });
      })
    );

    const lines = stdout.split('\n').filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      expect(JSON.parse(lines[i]), i).to.have.property('severity').that.is.ok;
    }
  });
});

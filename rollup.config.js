import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import commonjs from '@rollup/plugin-commonjs';

const nodeRequire = createRequire(fileURLToPath(import.meta.url));
const { module, main, peerDependencies, optionalDependencies } = nodeRequire('./package.json');

const external = new Set(
  ['node:crypto', 'node:stream', 'node:async_hooks', 'node:url', 'node:events']
    .concat(Object.keys(peerDependencies))
    .concat(Object.keys(optionalDependencies ?? []))
);

export default [
  {
    input: module,
    external: [...external],
    plugins: [commonjs()],
    output: [
      {
        file: main,
        exports: 'named',
        format: 'cjs',
        footer: 'module.exports = Object.assign(exports.default, exports);',
      },
    ],
  },
  {
    input: './src/tracing.js',
    external: [...external],
    plugins: [commonjs()],
    output: [
      {
        file: './lib/tracing.cjs',
        exports: 'named',
        format: 'cjs',
      },
    ],
  },
];

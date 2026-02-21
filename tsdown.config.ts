import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.ts',
  },
  format: ['esm'],
  dts: {
    resolve: true,
  },
  target: 'es2022',
  splitting: true,
  treeshake: true,
  clean: true,
  platform: 'browser',
  external: ['web-vitals'],
});

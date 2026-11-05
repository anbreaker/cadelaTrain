import { defineConfig } from 'vitest/config';

// Security rules tests run against the Firestore emulator (Java), so they live apart from the
// fast jsdom unit tests. Run them with `npm run test:rules`.
// `test/data/*.integration.ts` drive the real repositories against the same emulator; they do not
// use the `.spec.ts` suffix so the jsdom unit run (`vitest.config.ts`) never picks them up.
export default defineConfig({
  resolve: {
    alias: {
      '@core': '/src/app/core',
      '@data': '/src/app/data',
      '@domain': '/src/app/domain',
      '@environments': '/src/environments',
    },
  },
  test: {
    environment: 'node',
    // One emulator is shared and cleared between tests: files must not run concurrently.
    fileParallelism: false,
    hookTimeout: 30000,
    include: ['test/rules/**/*.spec.ts', 'test/data/**/*.integration.ts'],
    testTimeout: 15000,
  },
});

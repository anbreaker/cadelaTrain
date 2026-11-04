import { defineConfig } from 'vitest/config';

// Security rules tests run against the Firestore emulator (Java), so they live apart from the
// fast jsdom unit tests. Run them with `npm run test:rules`.
export default defineConfig({
  test: {
    environment: 'node',
    // One emulator is shared and cleared between tests: files must not run concurrently.
    fileParallelism: false,
    hookTimeout: 30000,
    include: ['test/rules/**/*.spec.ts'],
    testTimeout: 15000,
  },
});

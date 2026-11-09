import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    angular({
      tsconfig: 'tsconfig.json',
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['**/*.spec.ts'],
    // Rules tests need the Firestore emulator: `npm run test:rules` (vitest.rules.config.ts).
    exclude: ['node_modules/**', 'dist/**', 'test/rules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test-setup.ts',
        '**/*.spec.ts',
        '**/*.config.ts',
        '**/main.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@assets': '/public/assets',
      '@core': '/src/app/core',
      '@data': '/src/app/data',
      '@domain': '/src/app/domain',
      '@environments': '/src/environments',
      '@features': '/src/app/features',
      '@shared': '/src/app/shared',
      '@styles': '/src/styles',
    },
  },
});

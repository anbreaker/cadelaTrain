import { resolve } from 'node:path';
import angular from '@analogjs/vite-plugin-angular';

import { defineConfig } from 'vite';

import { stagingRobots } from './build-plugins/staging-robots';

const environmentFileByMode: Record<string, string> = {
  prod: 'environment.prod.ts',
  production: 'environment.prod.ts',
};

export default defineConfig(({ mode }) => {
  const environmentFile = resolve(
    import.meta.dirname,
    'src/environments',
    environmentFileByMode[mode] ?? 'environment.ts'
  );

  return {
    // `root` is `src`, so without this Vite would look for `.env*` files inside `src/`.
    envDir: import.meta.dirname,
    envPrefix: 'NG_APP_',
    root: 'src',
    publicDir: '../public',

    build: {
      outDir: '../dist',
      emptyOutDir: true,
    },

    plugins: [
      angular({
        tsconfig: '../tsconfig.json',
      }),
      stagingRobots(process.env['VERCEL_ENV']),
    ],

    resolve: {
      alias: [
        { find: '@environments/environment', replacement: environmentFile },
        { find: '@assets', replacement: '/assets' },
        { find: '@core', replacement: '/app/core' },
        { find: '@data', replacement: '/app/data' },
        { find: '@domain', replacement: '/app/domain' },
        { find: '@environments', replacement: '/environments' },
        { find: '@features', replacement: '/app/features' },
        { find: '@shared', replacement: '/app/shared' },
        { find: '@styles', replacement: '/styles' },
      ],
    },

    server: {
      port: 4200,
      open: true,
      hmr: true,
    },
  };
});

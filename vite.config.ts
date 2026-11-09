import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import angular from '@analogjs/vite-plugin-angular';

import { stagingRobots } from './build-plugins/staging-robots';

import { defineConfig, type Plugin } from 'vite';

const environmentFileByMode: Record<string, string> = {
  prod: 'environment.prod.ts',
  production: 'environment.prod.ts',
};

/**
 * Without the Angular CLI builder nothing emits the service worker, so this does what it would:
 * copies the worker scripts and generates `ngsw.json` (hashes of the built files) from `ngsw-config.json`.
 */
function angularServiceWorker(): Plugin {
  let outDir = '';

  return {
    apply: 'build',
    name: 'angular-service-worker',

    configResolved(config): void {
      outDir = resolve(config.root, config.build.outDir);
    },

    // Runs after the public folder is copied, so the manifest and icons are hashed too.
    closeBundle(): void {
      const packageDir = dirname(
        createRequire(import.meta.url).resolve('@angular/service-worker/package.json')
      );
      for (const workerFile of ['ngsw-worker.js', 'safety-worker.js']) {
        copyFileSync(resolve(packageDir, workerFile), resolve(outDir, workerFile));
      }
      // The CLI joins its arguments onto the working directory, so they must be relative paths.
      execFileSync(
        process.execPath,
        [
          resolve(packageDir, 'ngsw-config.js'),
          relative(import.meta.dirname, outDir),
          'ngsw-config.json',
        ],
        { cwd: import.meta.dirname, stdio: 'inherit' }
      );
    },
  };
}

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
      angularServiceWorker(),
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

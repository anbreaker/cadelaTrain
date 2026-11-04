import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Plugin } from 'vite';

/**
 * Keeps search engines out of any deployment that is not production.
 * Vercel sets `VERCEL_ENV` to `production`, `preview` or `development`; a local build has none, so only
 * non-production Vercel builds are affected (the fixed staging domain is a preview deployment).
 */
export function stagingRobots(vercelEnv: string | undefined): Plugin | null {
  if (vercelEnv === undefined || vercelEnv === 'production') return null;

  let outDir = '';

  return {
    name: 'staging-robots',

    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },

    transformIndexHtml() {
      return [
        { attrs: { content: 'noindex, nofollow', name: 'robots' }, injectTo: 'head', tag: 'meta' },
      ];
    },

    // Runs after the public folder is copied, so it replaces the production robots.txt.
    closeBundle() {
      writeFileSync(resolve(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
    },
  };
}

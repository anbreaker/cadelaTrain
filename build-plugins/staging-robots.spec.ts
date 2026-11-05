import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Plugin, ResolvedConfig } from 'vite';

import { stagingRobots } from './staging-robots';

type Hook = (...args: never[]) => unknown;

const call = (
  plugin: Plugin,
  name: 'closeBundle' | 'configResolved',
  ...args: unknown[]
): unknown => (plugin[name] as unknown as Hook)(...(args as never[]));

describe('stagingRobots', () => {
  it.each([[undefined], ['production']])(
    'should do nothing for %s, so production and local builds are untouched',
    (env) => {
      expect(stagingRobots(env)).toBeNull();
    }
  );

  it.each([['preview'], ['development']])('should apply to a %s deployment', (env) => {
    expect(stagingRobots(env)).not.toBeNull();
  });

  it('should add a noindex meta tag to the page head', () => {
    const plugin = stagingRobots('preview') as Plugin;
    const transform = plugin.transformIndexHtml as unknown as () => unknown;

    expect(transform()).toEqual([
      { attrs: { content: 'noindex, nofollow', name: 'robots' }, injectTo: 'head', tag: 'meta' },
    ]);
  });

  it('should replace robots.txt in the output with one that disallows everything', () => {
    const dir = mkdtempSync(join(tmpdir(), 'staging-robots-'));
    writeFileSync(join(dir, 'robots.txt'), 'User-agent: *\nAllow: /\n');
    const plugin = stagingRobots('preview') as Plugin;

    try {
      call(plugin, 'configResolved', {
        build: { outDir: dir },
        root: '/ignored',
      } as unknown as ResolvedConfig);
      call(plugin, 'closeBundle');

      expect(readFileSync(join(dir, 'robots.txt'), 'utf8')).toBe('User-agent: *\nDisallow: /\n');
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});

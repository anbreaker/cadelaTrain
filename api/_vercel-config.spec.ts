// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Rewrite {
  destination: string;
  source: string;
}

interface VercelConfig {
  buildCommand: string;
  outputDirectory: string;
  rewrites: Rewrite[];
}

/**
 * Vercel serves files and functions first and only then applies the rewrites. The SPA rewrite must
 * leave `/api/*` to the functions and `/assets/*` to their files (a missing translation file answers
 * 404, not the app's HTML).
 */
describe('vercel.json', () => {
  const config = JSON.parse(
    readFileSync(join(__dirname, '..', 'vercel.json'), 'utf8')
  ) as VercelConfig;
  const appRewrite = config.rewrites.find((rewrite) => rewrite.destination === '/index.html');
  const sendsToApp = (path: string): boolean =>
    new RegExp(`^${appRewrite?.source ?? '$^'}$`).test(path);

  it('should build the app into dist', () => {
    expect(config.buildCommand).toBe('npm run build');
    expect(config.outputDirectory).toBe('dist');
  });

  it.each(['/', '/today', '/log', '/weekly', '/household/join/abc', '/nope'])(
    'should send the app route %s to the app',
    (path) => {
      expect(sendsToApp(path)).toBe(true);
    }
  );

  it.each([
    '/api/sign-upload',
    '/api/delete-media',
    '/assets/i18n/es.json',
    '/assets/i18n/xx.json',
  ])('should leave %s to its function or file', (path) => {
    expect(sendsToApp(path)).toBe(false);
  });
});

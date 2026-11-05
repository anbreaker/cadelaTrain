// Post-build smoke check of the service worker output. The Vite plugin in `vite.config.ts` replaces
// the Angular CLI step that emits it, so a silent break there would ship an app that is not a PWA.
// Usage: node scripts/check-ngsw.mjs [distDir]   (defaults to `dist`)
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const distDir = resolve(process.argv[2] ?? 'dist');
const REQUIRED_FILES = ['ngsw.json', 'ngsw-worker.js', 'safety-worker.js'];
const PREFETCHED_TRANSLATIONS = [
  '/assets/i18n/en.json',
  '/assets/i18n/es.json',
  '/assets/i18n/pt.json',
];
const API_PROBE = '/api/daily-guidance';

/** @param {{ regex: string }} rule */
const matchesApi = (rule) => new RegExp(rule.regex).test(API_PROBE);

/** @param {{ patterns?: string[], urls?: string[] }} group */
const groupMatchesApi = (group) =>
  (group.urls ?? []).some((url) => url.startsWith('/api')) ||
  (group.patterns ?? []).some((pattern) => new RegExp(pattern).test(API_PROBE));

function findProblems() {
  const missingFiles = REQUIRED_FILES.filter((file) => !existsSync(resolve(distDir, file)));
  if (missingFiles.includes('ngsw.json')) return missingFiles.map((file) => `missing ${file}`);

  const manifest = JSON.parse(readFileSync(resolve(distDir, 'ngsw.json'), 'utf8'));
  const assetGroups = manifest.assetGroups ?? [];
  const dataGroups = manifest.dataGroups ?? [];
  const navigationUrls = manifest.navigationUrls ?? [];
  const prefetchedUrls = assetGroups
    .filter((group) => group.installMode === 'prefetch')
    .flatMap((group) => group.urls ?? []);

  return [
    ...missingFiles.map((file) => `missing ${file}`),
    manifest.index === '/index.html' ? null : `index is ${manifest.index}, expected /index.html`,
    navigationUrls.some((rule) => rule.positive === false && matchesApi(rule))
      ? null
      : 'navigationUrls has no negative rule excluding /api/',
    ...[...assetGroups, ...dataGroups]
      .filter(groupMatchesApi)
      .map((group) => `group "${group.name}" caches /api`),
    ...PREFETCHED_TRANSLATIONS.filter((url) => !prefetchedUrls.includes(url)).map(
      (url) => `${url} is not in a prefetch asset group`
    ),
  ].filter((problem) => problem !== null);
}

const problems = findProblems();
if (problems.length > 0) {
  console.error(`check-ngsw: service worker build output in ${distDir} is invalid:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`check-ngsw: ${distDir} has a valid service worker build.`);

// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The functions run as native ES modules on Vercel (`"type": "module"`), where a relative import
 * needs its extension: `./_sign-upload` fails at start-up with ERR_MODULE_NOT_FOUND. Tests and the
 * type checker do not notice, so this pins it.
 */
describe('api function imports', () => {
  const sources = readdirSync(__dirname).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.spec.ts')
  );

  it('should deploy only the function wrappers: every other file starts with an underscore', () => {
    const deployed = readdirSync(__dirname).filter((name) => !name.startsWith('_'));

    expect(deployed.sort()).toEqual(['delete-media.ts', 'sign-upload.ts']);
  });

  it('should find the function files', () => {
    expect(sources).toEqual(
      expect.arrayContaining(['sign-upload.ts', 'delete-media.ts', '_firebase-auth.ts'])
    );
  });

  it.each(sources)('should give every relative import in %s its .js extension', (name) => {
    const code = readFileSync(join(__dirname, name), 'utf8');
    const relative = [...code.matchAll(/from\s+'(\.[^']*)'/g)].map((match) => match[1]);

    expect(relative.filter((path) => !path.endsWith('.js'))).toEqual([]);
  });

  it.each(sources)('should never import the app aliases or firebase in %s', (name) => {
    const code = readFileSync(join(__dirname, name), 'utf8');
    const imports = [...code.matchAll(/from\s+'([^']*)'/g)].map((match) => match[1]);

    expect(imports.filter((path) => /^(@(core|data|features|shared)|firebase)/.test(path))).toEqual(
      []
    );
  });
});

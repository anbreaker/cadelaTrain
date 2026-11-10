// @vitest-environment node
import { createHash } from 'node:crypto';

import { handleSignUpload, sign, SignUploadEnv, UPLOAD_PRESET } from './_sign-upload.js';

const ENV: SignUploadEnv = {
  apiKey: 'key-123',
  apiSecret: 'secret-xyz',
  cloudName: 'demo-cloud',
  firebaseProjectId: 'demo-project',
};

const NOW = 1_700_000_000_000;

const tokenFor = (uid: string): string =>
  `h.${Buffer.from(JSON.stringify({ sub: uid })).toString('base64url')}.s`;

const post = (
  body: unknown = { householdId: 'h1' },
  token: string | undefined = tokenFor('uid-1'),
  method = 'POST'
): Request =>
  new Request('https://example.test/api/sign-upload', {
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    method,
  });

const firestoreReturns = (status: number) =>
  vi.fn(async () => Response.json({ fields: {} }, { status }));

const handle = (request: Request, fetchFn = firestoreReturns(200), env = ENV) =>
  handleSignUpload(request, env, fetchFn, () => NOW);

describe('sign-upload', () => {
  it('should sign the sorted params followed by the secret with SHA-1', () => {
    const expected = createHash('sha1')
      .update('folder=f&timestamp=10&upload_preset=p' + 'secret-xyz')
      .digest('hex');

    expect(sign({ upload_preset: 'p', timestamp: 10, folder: 'f' }, 'secret-xyz')).toBe(expected);
  });

  it("should sign an upload into the caller's own folder of the household", async () => {
    const fetchFn = firestoreReturns(200);
    const token = tokenFor('uid-1');

    const response = await handle(post({ householdId: 'h1' }, token), fetchFn);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({
      apiKey: 'key-123',
      cloudName: 'demo-cloud',
      folder: 'dela/h1/uid-1',
      signature: sign(
        { folder: 'dela/h1/uid-1', timestamp: 1_700_000_000, upload_preset: 'dela' },
        'secret-xyz'
      ),
      timestamp: 1_700_000_000,
      uploadPreset: 'dela',
    });
    expect(UPLOAD_PRESET).toBe('dela');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://firestore.googleapis.com/v1/projects/demo-project/databases/(default)/documents/households/h1',
      { headers: { Authorization: `Bearer ${token}` }, signal: expect.any(AbortSignal) }
    );
  });

  it('should put each member in a folder named by the uid of their own token', async () => {
    const response = await handle(post({ householdId: 'h1' }, tokenFor('uid-2')));
    const body = (await response.json()) as { folder: string; signature: string };

    expect(body.folder).toBe('dela/h1/uid-2');
    expect(body.signature).toBe(
      sign(
        { folder: 'dela/h1/uid-2', timestamp: 1_700_000_000, upload_preset: 'dela' },
        'secret-xyz'
      )
    );
  });

  it('should never put the secret in the response', async () => {
    expect(await (await handle(post())).text()).not.toContain('secret-xyz');
  });

  it('should refuse a non-member or a missing household with 403', async () => {
    for (const status of [401, 403, 404]) {
      const response = await handle(post(), firestoreReturns(status));

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'forbidden' });
    }
  });

  it('should answer 503 when Firestore is unavailable, never signing', async () => {
    const down = vi.fn(async () => Promise.reject(new Error('network')));

    expect((await handle(post(), down)).status).toBe(503);
    expect((await handle(post(), firestoreReturns(500))).status).toBe(503);
  });

  it('should refuse a missing or malformed token without calling Firestore', async () => {
    const fetchFn = firestoreReturns(200);

    expect((await handle(post(undefined, ''), fetchFn)).status).toBe(401);
    expect((await handle(post(undefined, 'garbage'), fetchFn)).status).toBe(401);
    expect((await handle(post(undefined, tokenFor('a/b')), fetchFn)).status).toBe(401);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('should refuse a bad body or household id without calling Firestore', async () => {
    const fetchFn = firestoreReturns(200);

    for (const body of ['not json', {}, { householdId: '..' }, { householdId: 'a/b' }, [], null]) {
      const response = await handle(post(body), fetchFn);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'bad-request' });
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('should only accept POST', async () => {
    expect((await handle(post(undefined, undefined, 'GET'))).status).toBe(405);
  });

  it('should fail closed when the server is not configured', async () => {
    const fetchFn = firestoreReturns(200);

    for (const key of ['apiKey', 'apiSecret', 'cloudName', 'firebaseProjectId'] as const) {
      const response = await handle(post(), fetchFn, { ...ENV, [key]: undefined });

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'not-configured' });
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

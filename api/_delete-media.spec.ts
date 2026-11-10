// @vitest-environment node
import { DeleteMediaEnv, handleDeleteMedia } from './_delete-media.js';
import { sign } from './_sign-upload.js';

const ENV: DeleteMediaEnv = {
  apiKey: 'key-123',
  apiSecret: 'secret-xyz',
  cloudName: 'demo-cloud',
  firebaseProjectId: 'demo-project',
};

const NOW = 1_700_000_000_000;
const DOC_URL =
  'https://firestore.googleapis.com/v1/projects/demo-project/databases/(default)/documents/households/h1/dogs/d1/media/m1';
const DESTROY_URL = 'https://api.cloudinary.com/v1_1/demo-cloud/image/destroy';

const tokenFor = (uid: string): string =>
  `h.${Buffer.from(JSON.stringify({ sub: uid })).toString('base64url')}.s`;

const TOKEN = tokenFor('uid-1');
const IDS = { dogId: 'd1', householdId: 'h1', mediaId: 'm1' };

const post = (body: unknown = IDS, token: string | undefined = TOKEN, method = 'POST'): Request =>
  new Request('https://example.test/api/delete-media', {
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    method,
  });

const mediaDoc = (overrides: Record<string, string> = {}) => ({
  fields: Object.fromEntries(
    Object.entries({
      addedBy: 'uid-1',
      kind: 'photo',
      publicId: 'dela/h1/abc123',
      ...overrides,
    }).map(([key, value]) => [key, { stringValue: value }])
  ),
  name: 'x',
});

interface Fakes {
  deleteStatus?: number;
  destroy?: () => Promise<Response>;
  read?: () => Promise<Response>;
}

/** Routes each outgoing call by URL and method, so a test asserts exactly which calls happened. */
const fakeFetch = ({
  deleteStatus = 200,
  destroy = async () => Response.json({ result: 'ok' }),
  read = async () => Response.json(mediaDoc()),
}: Fakes = {}) =>
  vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
    if (url === DESTROY_URL) {
      return destroy();
    }

    return init?.method === 'DELETE' ? Response.json({}, { status: deleteStatus }) : read();
  });

const handle = (request: Request, fetchFn = fakeFetch(), env = ENV) =>
  handleDeleteMedia(request, env, fetchFn, () => NOW);

const READ_CALL = [
  DOC_URL,
  { headers: { Authorization: `Bearer ${TOKEN}` }, signal: expect.any(AbortSignal) },
];
const DESTROY_BODY = new URLSearchParams({
  api_key: 'key-123',
  invalidate: 'true',
  public_id: 'dela/h1/abc123',
  signature: sign(
    { invalidate: 'true', public_id: 'dela/h1/abc123', timestamp: 1_700_000_000 },
    'secret-xyz'
  ),
  timestamp: '1700000000',
}).toString();
const DESTROY_CALL = [
  DESTROY_URL,
  {
    body: DESTROY_BODY,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
    signal: expect.any(AbortSignal),
  },
];
const DELETE_CALL = [
  DOC_URL,
  {
    headers: { Authorization: `Bearer ${TOKEN}` },
    method: 'DELETE',
    signal: expect.any(AbortSignal),
  },
];

describe('delete-media', () => {
  it('should destroy the asset, then delete the document, as the author', async () => {
    const fetchFn = fakeFetch();

    const response = await handle(post(), fetchFn);

    expect(response.status).toBe(204);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(fetchFn.mock.calls).toEqual([READ_CALL, DESTROY_CALL, DELETE_CALL]);
  });

  it('should treat an asset Cloudinary no longer has as destroyed', async () => {
    const fetchFn = fakeFetch({ destroy: async () => Response.json({ result: 'not found' }) });

    expect((await handle(post(), fetchFn)).status).toBe(204);
    expect(fetchFn.mock.calls).toEqual([READ_CALL, DESTROY_CALL, DELETE_CALL]);
  });

  it('should answer 502 and keep the document when the destroy fails', async () => {
    const failures = [
      async () => Response.json({ result: 'error' }),
      async () => Response.json({ error: { message: 'x' } }, { status: 401 }),
      async () => Promise.reject(new Error('network')),
      async () => new Response('not json'),
    ];

    for (const destroy of failures) {
      const fetchFn = fakeFetch({ destroy });
      const response = await handle(post(), fetchFn);

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: 'destroy-failed' });
      expect(fetchFn.mock.calls).toEqual([READ_CALL, DESTROY_CALL]);
    }
  });

  it('should refuse someone who is not the author, never calling Cloudinary', async () => {
    const fetchFn = fakeFetch({ read: async () => Response.json(mediaDoc({ addedBy: 'uid-2' })) });
    const response = await handle(post(), fetchFn);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
    expect(fetchFn.mock.calls).toEqual([READ_CALL]);
  });

  it('should refuse a non-member, never calling Cloudinary', async () => {
    for (const status of [401, 403]) {
      const fetchFn = fakeFetch({ read: async () => Response.json({}, { status }) });

      expect((await handle(post(), fetchFn)).status).toBe(403);
      expect(fetchFn.mock.calls).toEqual([READ_CALL]);
    }
  });

  it('should answer 404 for a missing item and 503 when Firestore is unavailable', async () => {
    const missing = fakeFetch({ read: async () => Response.json({}, { status: 404 }) });
    const down = fakeFetch({ read: async () => Promise.reject(new Error('network')) });

    expect((await handle(post(), missing)).status).toBe(404);
    expect((await handle(post(), down)).status).toBe(503);
    expect(missing.mock.calls).toEqual([READ_CALL]);
    expect(down.mock.calls).toEqual([READ_CALL]);
  });

  it('should refuse a video or a public id outside the household folder', async () => {
    const cases: Record<string, string>[] = [
      { kind: 'video' },
      { publicId: 'dela/h2/abc' },
      { publicId: 'dela/h1' },
      { publicId: 'other/dela/h1/abc' },
      { publicId: '' },
    ];

    for (const overrides of cases) {
      const fetchFn = fakeFetch({ read: async () => Response.json(mediaDoc(overrides)) });
      const response = await handle(post(), fetchFn);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'not-a-photo' });
      expect(fetchFn.mock.calls).toEqual([READ_CALL]);
    }
  });

  it('should report a refused or failed document delete after the destroy', async () => {
    const refused = fakeFetch({ deleteStatus: 403 });
    const down = fakeFetch({ deleteStatus: 500 });

    expect((await handle(post(), refused)).status).toBe(403);
    expect((await handle(post(), down)).status).toBe(503);
    expect(refused.mock.calls).toEqual([READ_CALL, DESTROY_CALL, DELETE_CALL]);
  });

  it('should refuse a missing or malformed token without any call', async () => {
    const fetchFn = fakeFetch();

    expect((await handle(post(IDS, ''), fetchFn)).status).toBe(401);
    expect((await handle(post(IDS, 'garbage'), fetchFn)).status).toBe(401);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('should refuse a bad body or ids without any call', async () => {
    const fetchFn = fakeFetch();

    for (const body of [
      'not json',
      null,
      { householdId: 'h1', dogId: 'd1' },
      { ...IDS, mediaId: '..' },
      { ...IDS, dogId: 'a/b' },
      { ...IDS, householdId: 7 },
    ]) {
      const response = await handle(post(body), fetchFn);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'bad-request' });
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('should only accept POST', async () => {
    expect((await handle(post(IDS, TOKEN, 'DELETE'))).status).toBe(405);
  });

  it('should fail closed when the server is not configured', async () => {
    const fetchFn = fakeFetch();

    for (const key of ['apiKey', 'apiSecret', 'cloudName', 'firebaseProjectId'] as const) {
      expect((await handle(post(), fetchFn, { ...ENV, [key]: undefined })).status).toBe(500);
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

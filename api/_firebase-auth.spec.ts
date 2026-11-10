// @vitest-environment node
import {
  deleteDocument,
  documentUrl,
  fetchDocument,
  isValidId,
  readCaller,
  readUid,
  stringField,
} from './_firebase-auth.js';

const tokenFor = (uid: string): string =>
  `h.${Buffer.from(JSON.stringify({ sub: uid })).toString('base64url')}.s`;

const respond = (status: number, body: unknown = {}) =>
  vi.fn(async () => Response.json(body, { status }));

const BASE =
  'https://firestore.googleapis.com/v1/projects/demo-project/databases/(default)/documents';

describe('firebase-auth', () => {
  it('should read the uid from the token payload and refuse malformed tokens or uids', () => {
    expect(readUid(tokenFor('uid-1'))).toBe('uid-1');
    expect(readUid('not-a-jwt')).toBeNull();
    expect(readUid('a.%%%.c')).toBeNull();
    expect(readUid(tokenFor('../admins'))).toBeNull();
    expect(readUid(tokenFor('a/b'))).toBeNull();
    expect(
      readUid(`h.${Buffer.from(JSON.stringify({ sub: 7 })).toString('base64url')}.s`)
    ).toBeNull();
  });

  it('should read the caller from a bearer header only', () => {
    const token = tokenFor('uid-1');
    const withHeader = (value?: string): Request =>
      new Request('https://example.test/api/x', {
        headers: value ? { Authorization: value } : {},
        method: 'POST',
      });

    expect(readCaller(withHeader(`Bearer ${token}`))).toEqual({ idToken: token, uid: 'uid-1' });
    expect(readCaller(withHeader())).toBeNull();
    expect(readCaller(withHeader(token))).toBeNull();
    expect(readCaller(withHeader('Bearer garbage'))).toBeNull();
  });

  it('should accept only path-safe ids', () => {
    expect(isValidId('Abc_12-x')).toBe(true);
    expect(isValidId('a'.repeat(128))).toBe(true);
    expect(isValidId('a'.repeat(129))).toBe(false);
    for (const bad of ['', '..', 'a/b', 'a%2Fb', 'a b', 7, null, undefined]) {
      expect(isValidId(bad)).toBe(false);
    }
  });

  it('should build the document URL and refuse unsafe segments', () => {
    expect(documentUrl('demo-project', ['households', 'h1', 'dogs', 'd1'])).toBe(
      `${BASE}/households/h1/dogs/d1`
    );
    expect(documentUrl('demo-project', ['households', '..'])).toBeNull();
    expect(documentUrl('demo-project', ['households', 'a/b'])).toBeNull();
    expect(documentUrl('demo-project', [])).toBeNull();
  });

  it('should fetch a document as the caller and return its fields', async () => {
    const fields = { addedBy: { stringValue: 'uid-1' } };
    const fetchFn = respond(200, { fields, name: 'x' });

    const result = await fetchDocument(fetchFn, 'demo-project', ['households', 'h1'], 'tok');

    expect(result).toEqual({ fields, status: 'found' });
    expect(fetchFn).toHaveBeenCalledWith(`${BASE}/households/h1`, {
      headers: { Authorization: 'Bearer tok' },
      signal: expect.any(AbortSignal),
    });
  });

  it('should map Firestore answers to not-found, refused and unavailable', async () => {
    const read = (fetchFn: ReturnType<typeof respond>) =>
      fetchDocument(fetchFn, 'demo-project', ['households', 'h1'], 'tok');

    expect(await read(respond(404))).toEqual({ status: 'not-found' });
    expect(await read(respond(401))).toEqual({ status: 'refused' });
    expect(await read(respond(403))).toEqual({ status: 'refused' });
    expect(await read(respond(500))).toEqual({ status: 'unavailable' });
    expect(await read(vi.fn(async () => Promise.reject(new Error('net'))))).toEqual({
      status: 'unavailable',
    });
    expect(await read(respond(200, { fields: 'nope' }))).toEqual({ status: 'unavailable' });
  });

  it('should treat a found document without fields as empty', async () => {
    expect(
      await fetchDocument(respond(200, { name: 'x' }), 'p', ['households', 'h1'], 't')
    ).toEqual({ fields: {}, status: 'found' });
  });

  it('should never call Firestore for an unsafe path', async () => {
    const fetchFn = respond(200);

    expect(await fetchDocument(fetchFn, 'p', ['households', '..'], 't')).toEqual({
      status: 'not-found',
    });
    expect(await deleteDocument(fetchFn, 'p', ['households', 'a/b'], 't')).toBe('refused');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('should delete a document as the caller', async () => {
    const fetchFn = respond(200);

    expect(await deleteDocument(fetchFn, 'demo-project', ['households', 'h1'], 'tok')).toBe(
      'deleted'
    );
    expect(fetchFn).toHaveBeenCalledWith(`${BASE}/households/h1`, {
      headers: { Authorization: 'Bearer tok' },
      method: 'DELETE',
      signal: expect.any(AbortSignal),
    });
    expect(await deleteDocument(respond(403), 'p', ['households', 'h1'], 't')).toBe('refused');
    expect(await deleteDocument(respond(503), 'p', ['households', 'h1'], 't')).toBe('unavailable');
  });

  it('should read string fields from the REST shape', () => {
    const fields = { kind: { stringValue: 'photo' }, width: { integerValue: '3' } };

    expect(stringField(fields, 'kind')).toBe('photo');
    expect(stringField(fields, 'width')).toBeNull();
    expect(stringField(fields, 'missing')).toBeNull();
  });
});

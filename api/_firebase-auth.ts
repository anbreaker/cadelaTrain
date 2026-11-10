export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** Firestore REST field values, e.g. `{ stringValue: 'photo' }`. */
export type FirestoreFields = Record<string, unknown>;

export type DocumentResult =
  | { fields: FirestoreFields; status: 'found' }
  | { status: 'not-found' | 'refused' | 'unavailable' };

export interface Caller {
  idToken: string;
  uid: string;
}

const FIRESTORE_TIMEOUT_MS = 8000;

/**
 * Firebase uids and the app's document ids. Anything else must never be placed in a URL path
 * (`..`, `/`, `%`).
 */
const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;

export const isValidId = (value: unknown): value is string =>
  typeof value === 'string' && VALID_ID.test(value);

export const json = (status: number, body: Record<string, number | string>): Response =>
  Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status });

/** Reads the Firebase uid from the ID token payload. Not a verification: Firestore verifies the token. */
export const readUid = (idToken: string): string | null => {
  const payload = idToken.split('.')[1];

  if (!payload) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: unknown;
    };

    return isValidId(claims.sub) ? claims.sub : null;
  } catch {
    return null;
  }
};

/** The caller of a request: its bearer ID token and the uid it claims, or null when there is none. */
export const readCaller = (request: Request): Caller | null => {
  const idToken = /^Bearer (.+)$/.exec(request.headers.get('Authorization') ?? '')?.[1];
  const uid = idToken ? readUid(idToken) : null;

  return idToken && uid ? { idToken, uid } : null;
};

/** The REST URL of a document, or null when a segment is not a safe id. */
export const documentUrl = (projectId: string, path: readonly string[]): string | null =>
  path.length > 0 && path.every((segment) => isValidId(segment))
    ? `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${path.map(encodeURIComponent).join('/')}`
    : null;

const refusedOrUnavailable = (status: number): 'refused' | 'unavailable' =>
  status === 401 || status === 403 ? 'refused' : 'unavailable';

/**
 * Reads a document from Firestore as the caller, with their own ID token. The security rules decide:
 * a forged token, a non-member or a foreign household is refused there.
 */
export const fetchDocument = async (
  fetchFn: FetchFn,
  projectId: string,
  path: readonly string[],
  idToken: string
): Promise<DocumentResult> => {
  const url = documentUrl(projectId, path);

  if (!url) {
    return { status: 'not-found' };
  }

  try {
    const response = await fetchFn(url, {
      headers: { Authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(FIRESTORE_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        status: response.status === 404 ? 'not-found' : refusedOrUnavailable(response.status),
      };
    }

    const { fields = {} } = (await response.json()) as { fields?: unknown };

    return typeof fields === 'object' && fields !== null && !Array.isArray(fields)
      ? { fields: fields as FirestoreFields, status: 'found' }
      : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
};

/** Deletes a document as the caller; the security rules decide who may. */
export const deleteDocument = async (
  fetchFn: FetchFn,
  projectId: string,
  path: readonly string[],
  idToken: string
): Promise<'deleted' | 'refused' | 'unavailable'> => {
  const url = documentUrl(projectId, path);

  if (!url) {
    return 'refused';
  }

  try {
    const response = await fetchFn(url, {
      headers: { Authorization: `Bearer ${idToken}` },
      method: 'DELETE',
      signal: AbortSignal.timeout(FIRESTORE_TIMEOUT_MS),
    });

    return response.ok ? 'deleted' : refusedOrUnavailable(response.status);
  } catch {
    return 'unavailable';
  }
};

/** A string field of a REST document, or null when it is missing or of another type. */
export const stringField = (fields: FirestoreFields, name: string): string | null => {
  const value = (fields[name] as { stringValue?: unknown } | undefined)?.stringValue;

  return typeof value === 'string' ? value : null;
};

/** Parses a JSON object body; null for anything else. */
export const readJsonObject = async (request: Request): Promise<Record<string, unknown> | null> => {
  try {
    const body: unknown = await request.json();

    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

import {
  deleteDocument,
  fetchDocument,
  type FetchFn,
  isValidId,
  json,
  readCaller,
  readJsonObject,
  stringField,
} from './_firebase-auth.js';
import { sign, uploaderFolder } from './_sign-upload.js';

export interface DeleteMediaEnv {
  apiKey: string | undefined;
  apiSecret: string | undefined;
  cloudName: string | undefined;
  firebaseProjectId: string | undefined;
}

interface CloudinaryConfig {
  apiKey: string;
  apiSecret: string;
  cloudName: string;
}

const CLOUDINARY_TIMEOUT_MS = 8000;

/** Cloudinary answers `not found` when the asset is already gone: the goal is reached either way. */
const DESTROYED = new Set(['not found', 'ok']);

const ASSET_NAME = /^[A-Za-z0-9_-]{1,100}$/;

/** Exactly `dela/<householdId>/<uid>/<id>`: an asset the caller uploaded into their own folder. */
const isCallerAsset = (publicId: string, householdId: string, uid: string): boolean => {
  const prefix = `${uploaderFolder(householdId, uid)}/`;

  return publicId.startsWith(prefix) && ASSET_NAME.test(publicId.slice(prefix.length));
};

const READ_ERRORS = {
  'not-found': () => json(404, { error: 'not-found' }),
  refused: () => json(403, { error: 'forbidden' }),
  unavailable: () => json(503, { error: 'auth-unavailable' }),
} as const;

const DELETE_RESPONSES = {
  deleted: () => new Response(null, { headers: { 'Cache-Control': 'no-store' }, status: 204 }),
  refused: () => json(403, { error: 'forbidden' }),
  unavailable: () => json(503, { error: 'auth-unavailable' }),
} as const;

/** Removes an image asset with a signed Admin API call; true when it no longer exists. */
const destroyAsset = async (
  fetchFn: FetchFn,
  { apiKey, apiSecret, cloudName }: CloudinaryConfig,
  publicId: string,
  timestamp: number
): Promise<boolean> => {
  const params = { invalidate: 'true', public_id: publicId, timestamp };
  const body = new URLSearchParams({
    api_key: apiKey,
    invalidate: params.invalidate,
    public_id: publicId,
    signature: sign(params, apiSecret),
    timestamp: String(timestamp),
  }).toString();

  try {
    const response = await fetchFn(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`,
      {
        body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST',
        signal: AbortSignal.timeout(CLOUDINARY_TIMEOUT_MS),
      }
    );
    const { result } = (await response.json()) as { result?: unknown };

    return response.ok && typeof result === 'string' && DESTROYED.has(result);
  } catch {
    return false;
  }
};

const readIds = async (
  request: Request
): Promise<{ dogId: string; householdId: string; mediaId: string } | null> => {
  const body = await readJsonObject(request);
  const householdId = body?.['householdId'];
  const dogId = body?.['dogId'];
  const mediaId = body?.['mediaId'];

  return isValidId(householdId) && isValidId(dogId) && isValidId(mediaId)
    ? { dogId, householdId, mediaId }
    : null;
};

/**
 * `POST { householdId, dogId, mediaId }`: the author deletes their own photo. The media document is
 * read with the caller's token (the rules let only members read it); only an asset in the caller's
 * own folder `dela/<householdId>/<uid>/` is destroyed (a document can name any id), the asset is
 * destroyed, and only then the document is deleted with the caller's token (the rules let only the
 * author delete it). A failed destroy keeps the document, so the asset is never orphaned silently.
 */
export const handleDeleteMedia = async (
  request: Request,
  env: DeleteMediaEnv,
  fetchFn: FetchFn = fetch,
  now: () => number = Date.now
): Promise<Response> => {
  if (request.method !== 'POST') {
    return json(405, { error: 'method-not-allowed' });
  }

  const { apiKey, apiSecret, cloudName, firebaseProjectId } = env;

  if (!apiKey || !apiSecret || !cloudName || !firebaseProjectId) {
    return json(500, { error: 'not-configured' });
  }

  const caller = readCaller(request);

  if (!caller) {
    return json(401, { error: 'unauthorized' });
  }

  const ids = await readIds(request);

  if (!ids) {
    return json(400, { error: 'bad-request' });
  }

  const path = ['households', ids.householdId, 'dogs', ids.dogId, 'media', ids.mediaId];
  const media = await fetchDocument(fetchFn, firebaseProjectId, path, caller.idToken);

  if (media.status !== 'found') {
    return READ_ERRORS[media.status]();
  }

  if (stringField(media.fields, 'addedBy') !== caller.uid) {
    return json(403, { error: 'forbidden' });
  }

  if (stringField(media.fields, 'kind') !== 'photo') {
    return json(400, { error: 'not-a-photo' });
  }

  const publicId = stringField(media.fields, 'publicId') ?? '';

  if (!isCallerAsset(publicId, ids.householdId, caller.uid)) {
    return json(403, { error: 'not-your-asset' });
  }

  const destroyed = await destroyAsset(
    fetchFn,
    { apiKey, apiSecret, cloudName },
    publicId,
    Math.floor(now() / 1000)
  );

  if (!destroyed) {
    return json(502, { error: 'destroy-failed' });
  }

  return DELETE_RESPONSES[await deleteDocument(fetchFn, firebaseProjectId, path, caller.idToken)]();
};

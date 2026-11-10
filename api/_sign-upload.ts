import { createHash } from 'node:crypto';

import {
  fetchDocument,
  type FetchFn,
  isValidId,
  json,
  readCaller,
  readJsonObject,
} from './_firebase-auth.js';

/** Signed upload preset configured in Cloudinary: images only, max 10 MB, unique random public ids. */
export const UPLOAD_PRESET = 'dela';

/** Each member uploads into their own folder, so nobody can claim (and delete) another's asset. */
export const uploaderFolder = (householdId: string, uid: string): string =>
  `dela/${householdId}/${uid}`;

export interface SignUploadEnv {
  apiKey: string | undefined;
  apiSecret: string | undefined;
  cloudName: string | undefined;
  firebaseProjectId: string | undefined;
}

/** Cloudinary signature: SHA-1 of the sorted `key=value` pairs joined by `&`, followed by the secret. */
export const sign = (params: Record<string, number | string>, apiSecret: string): string => {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
};

const MEMBERSHIP_ERRORS = {
  'not-found': () => json(403, { error: 'forbidden' }),
  refused: () => json(403, { error: 'forbidden' }),
  unavailable: () => json(503, { error: 'auth-unavailable' }),
} as const;

/**
 * `POST { householdId }`: a short-lived signature for one photo upload into the caller's own folder
 * `dela/<householdId>/<uid>`.
 * Only members get it: the household document is read with the caller's token and the rules let
 * only members read it.
 */
export const handleSignUpload = async (
  request: Request,
  env: SignUploadEnv,
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

  const householdId = (await readJsonObject(request))?.['householdId'];

  if (!isValidId(householdId)) {
    return json(400, { error: 'bad-request' });
  }

  const membership = await fetchDocument(
    fetchFn,
    firebaseProjectId,
    ['households', householdId],
    caller.idToken
  );

  if (membership.status !== 'found') {
    return MEMBERSHIP_ERRORS[membership.status]();
  }

  const folder = uploaderFolder(householdId, caller.uid);
  const timestamp = Math.floor(now() / 1000);

  return json(200, {
    apiKey,
    cloudName,
    folder,
    signature: sign({ folder, timestamp, upload_preset: UPLOAD_PRESET }, apiSecret),
    timestamp,
    uploadPreset: UPLOAD_PRESET,
  });
};

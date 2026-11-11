import { inject, Injectable, InjectionToken } from '@angular/core';

import { AUTH_GATEWAY } from '@core/auth/auth-gateway';
import { isOwnPublicId, Media, MediaKind, PhotoFileError, validatePhotoFile } from '@domain/media';
import { environment } from '@environments/environment';

import { MediaRepository } from './media.repository';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** Seam for HTTP: the app uses the browser `fetch`, tests pass a fake. */
export const FETCH = new InjectionToken<FetchFn>('FETCH', {
  factory: (): FetchFn => (input, init) => globalThis.fetch(input, init),
  providedIn: 'root',
});

/** Public Cloudinary cloud name; empty means photos are off (videos still work). */
export const CLOUDINARY_CLOUD_NAME = new InjectionToken<string>('CLOUDINARY_CLOUD_NAME', {
  factory: (): string => environment.cloudinaryCloudName,
  providedIn: 'root',
});

export type PhotoUploadErrorCode =
  | 'deleteFailed'
  | 'notConfigured'
  | 'notSignedIn'
  | 'signFailed'
  | 'unexpectedPublicId'
  | 'uploadFailed'
  | PhotoFileError;

/** Why a photo upload or a media deletion through `api/` failed. */
export class PhotoUploadError extends Error {
  constructor(readonly code: PhotoUploadErrorCode) {
    super(`Photo upload: ${code}`);
    this.name = 'PhotoUploadError';
  }
}

/** What Cloudinary stored, as the media record needs it (AC7.2). */
export interface UploadedPhoto {
  height: number;
  publicId: string;
  width: number;
}

/** An upload plus its short-lived delete token (null when Cloudinary sent none). */
export interface PhotoUpload extends UploadedPhoto {
  deleteToken: null | string;
}

/** `POST /api/sign-upload` response: the signed parameters of one upload. */
interface UploadSignature {
  apiKey: string;
  cloudName: string;
  folder: string;
  signature: string;
  timestamp: number;
  uploadPreset: string;
}

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null;

const isSignature = (value: unknown): value is UploadSignature =>
  isObject(value) &&
  ['apiKey', 'cloudName', 'folder', 'signature', 'uploadPreset'].every(
    (field) => typeof value[field] === 'string'
  ) &&
  typeof value['timestamp'] === 'number';

const isSide = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

/** Runs a request; a network failure or a non-2xx answer becomes `code`. */
async function request(
  run: () => Promise<Response>,
  code: PhotoUploadErrorCode
): Promise<Response> {
  const response = await run().catch(() => null);
  if (!response?.ok) throw new PhotoUploadError(code);
  return response;
}

const readJson = (response: Response, code: PhotoUploadErrorCode): Promise<unknown> =>
  response.json().catch(() => {
    throw new PhotoUploadError(code);
  });

/**
 * Photos go straight from the browser to Cloudinary with a signature from `api/` (AC7.2); deleting a
 * photo also goes through `api/`, which removes the Cloudinary asset and the document (AC7.6).
 */
@Injectable({ providedIn: 'root' })
export class PhotoUploadService {
  private readonly fetch = inject(FETCH);
  private readonly gateway = inject(AUTH_GATEWAY);
  private readonly repository = inject(MediaRepository);
  private readonly cloudName = inject(CLOUDINARY_CLOUD_NAME);

  private readonly removers: Readonly<
    Record<MediaKind, (householdId: string, dogId: string, mediaId: string) => Promise<void>>
  > = {
    photo: (householdId, dogId, mediaId) => this.deleteMedia(householdId, dogId, mediaId),
    video: (householdId, dogId, mediaId) => this.repository.remove(householdId, dogId, mediaId),
  };

  /**
   * Uploads an image of at most 10 MB to the signed-in member's folder `dela/<householdId>/<uid>/`
   * and returns what Cloudinary stored.
   */
  async uploadPhoto(householdId: string, uid: string, file: File): Promise<PhotoUpload> {
    if (!this.cloudName) throw new PhotoUploadError('notConfigured');
    const [fileError] = validatePhotoFile(file);
    if (fileError) throw new PhotoUploadError(fileError);

    const signature = await this.signature(householdId);
    const response = await request(
      () =>
        this.fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, {
          body: this.uploadForm(file, signature),
          method: 'POST',
        }),
      'uploadFailed'
    );
    const body = await readJson(response, 'uploadFailed');
    if (!isObject(body) || !isSide(body['width']) || !isSide(body['height']))
      throw new PhotoUploadError('uploadFailed');
    const publicId = body['public_id'];
    if (typeof publicId !== 'string' || !isOwnPublicId(publicId, householdId, uid))
      throw new PhotoUploadError('unexpectedPublicId');
    const deleteToken = typeof body['delete_token'] === 'string' ? body['delete_token'] : null;
    return { deleteToken, height: body['height'], publicId, width: body['width'] };
  }

  /**
   * Best effort: deletes a photo just uploaded whose record then failed, with the delete token
   * Cloudinary returned (valid for 10 minutes). A failure only leaves the asset orphaned.
   */
  async discardUpload(deleteToken: null | string): Promise<void> {
    if (!deleteToken) return;
    const form = new FormData();
    form.append('token', deleteToken);
    await this.fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/delete_by_token`, {
      body: form,
      method: 'POST',
    }).catch((error: unknown) => console.warn('Photo upload: could not discard the photo', error));
  }

  /** Asks `api/` to delete a photo: its Cloudinary asset and its document (author only). */
  async deleteMedia(householdId: string, dogId: string, mediaId: string): Promise<void> {
    await this.post('/api/delete-media', { dogId, householdId, mediaId }, 'deleteFailed');
  }

  /** Deletes an item the way its kind needs: a photo through `api/`, a video document directly. */
  removeMedia(householdId: string, dogId: string, media: Media): Promise<void> {
    return this.removers[media.kind](householdId, dogId, media.id);
  }

  private async signature(householdId: string): Promise<UploadSignature> {
    const response = await this.post(
      '/api/sign-upload',
      { deleteToken: true, householdId },
      'signFailed'
    );
    const body = await readJson(response, 'signFailed');
    if (!isSignature(body)) throw new PhotoUploadError('signFailed');
    return body;
  }

  private uploadForm(file: File, signature: UploadSignature): FormData {
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', signature.apiKey);
    form.append('timestamp', String(signature.timestamp));
    form.append('signature', signature.signature);
    form.append('folder', signature.folder);
    form.append('upload_preset', signature.uploadPreset);
    form.append('return_delete_token', 'true');
    return form;
  }

  /** A JSON `POST` to `api/` with the signed-in user's ID token. */
  private async post(url: string, body: JsonObject, code: PhotoUploadErrorCode): Promise<Response> {
    const token = await this.gateway.idToken();
    if (!token) throw new PhotoUploadError('notSignedIn');
    return request(
      () =>
        this.fetch(url, {
          body: JSON.stringify(body),
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          method: 'POST',
        }),
      code
    );
  }
}

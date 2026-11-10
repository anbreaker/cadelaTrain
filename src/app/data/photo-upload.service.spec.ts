import { TestBed } from '@angular/core/testing';

import { AUTH_GATEWAY } from '@core/auth/auth-gateway';
import { Media, PHOTO_MAX_BYTES } from '@domain/media';

import { MediaRepository } from './media.repository';
import {
  CLOUDINARY_CLOUD_NAME,
  FETCH,
  PhotoUploadError,
  PhotoUploadService,
} from './photo-upload.service';

import { vi } from 'vitest';

const SIGNATURE = {
  apiKey: 'key-1',
  cloudName: 'demo-cloud',
  folder: 'dela/h1',
  signature: 'sig-1',
  timestamp: 1_700_000_000,
  uploadPreset: 'dela',
};

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, status });

const photoFile = (type = 'image/jpeg', size = 1024): File => {
  const file = new File(['x'], 'dela.jpg', { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const photo: Media = {
  addedAt: new Date('2026-12-20T08:00:00Z'),
  addedBy: 'alice',
  caption: '',
  date: '2026-12-20',
  height: 600,
  id: 'm1',
  kind: 'photo',
  publicId: 'dela/h1/abc123',
  width: 800,
};

const video: Media = {
  addedAt: new Date('2026-12-20T08:00:00Z'),
  addedBy: 'alice',
  caption: '',
  date: '2026-12-20',
  id: 'm2',
  kind: 'video',
  youtubeId: 'dQw4w9WgXcQ',
};

describe('PhotoUploadService', () => {
  let fetchFn: ReturnType<typeof vi.fn>;
  let idToken: ReturnType<typeof vi.fn>;
  let repository: { remove: ReturnType<typeof vi.fn> };
  let cloudName: string;

  const service = (): PhotoUploadService => {
    TestBed.configureTestingModule({
      providers: [
        { provide: FETCH, useValue: fetchFn },
        { provide: CLOUDINARY_CLOUD_NAME, useValue: cloudName },
        { provide: AUTH_GATEWAY, useValue: { idToken } },
        { provide: MediaRepository, useValue: repository },
      ],
    });
    return TestBed.inject(PhotoUploadService);
  };

  const rejection = async (run: Promise<unknown>): Promise<string> => {
    const error: unknown = await run.then(
      () => null,
      (reason: unknown) => reason
    );
    expect(error).toBeInstanceOf(PhotoUploadError);
    return (error as PhotoUploadError).code;
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    cloudName = 'demo-cloud';
    idToken = vi.fn(async () => 'id-token');
    repository = { remove: vi.fn(async () => undefined) };
    fetchFn = vi.fn(async (url: string) =>
      url === '/api/sign-upload'
        ? jsonResponse(200, SIGNATURE)
        : jsonResponse(200, { height: 600, public_id: 'dela/h1/abc123', width: 800 })
    );
  });

  describe('uploadPhoto (AC7.2)', () => {
    it('should sign with the ID token, upload to Cloudinary and return the public id and size', async () => {
      const file = photoFile();

      await expect(service().uploadPhoto('h1', file)).resolves.toEqual({
        height: 600,
        publicId: 'dela/h1/abc123',
        width: 800,
      });

      expect(fetchFn).toHaveBeenCalledTimes(2);
      const [signUrl, signInit] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(signUrl).toBe('/api/sign-upload');
      expect(signInit.method).toBe('POST');
      expect(signInit.headers).toEqual({
        Authorization: 'Bearer id-token',
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(signInit.body as string)).toEqual({ householdId: 'h1' });

      const [uploadUrl, uploadInit] = fetchFn.mock.calls[1] as [string, RequestInit];
      expect(uploadUrl).toBe('https://api.cloudinary.com/v1_1/demo-cloud/image/upload');
      expect(uploadInit.method).toBe('POST');
      const form = uploadInit.body as FormData;
      expect(form.get('file')).toBeInstanceOf(File);
      expect((form.get('file') as File).name).toBe('dela.jpg');
      expect(form.get('api_key')).toBe('key-1');
      expect(form.get('timestamp')).toBe('1700000000');
      expect(form.get('signature')).toBe('sig-1');
      expect(form.get('folder')).toBe('dela/h1');
      expect(form.get('upload_preset')).toBe('dela');
    });

    it.each([
      ['photoNotImage', photoFile('application/pdf')],
      ['photoTooLarge', photoFile('image/png', PHOTO_MAX_BYTES + 1)],
    ])('should refuse with %s before any request', async (code, file) => {
      expect(await rejection(service().uploadPhoto('h1', file))).toBe(code);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should refuse without a cloud name', async () => {
      cloudName = '';

      expect(await rejection(service().uploadPhoto('h1', photoFile()))).toBe('notConfigured');
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should refuse when signed out', async () => {
      idToken.mockResolvedValueOnce(null);

      expect(await rejection(service().uploadPhoto('h1', photoFile()))).toBe('notSignedIn');
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should report a refused signature and not upload', async () => {
      fetchFn.mockResolvedValueOnce(jsonResponse(403, { error: 'forbidden' }));

      expect(await rejection(service().uploadPhoto('h1', photoFile()))).toBe('signFailed');
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should report an unreachable signature endpoint', async () => {
      fetchFn.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      expect(await rejection(service().uploadPhoto('h1', photoFile()))).toBe('signFailed');
    });

    it('should report a failed upload', async () => {
      fetchFn.mockImplementation(async (url: string) =>
        url === '/api/sign-upload' ? jsonResponse(200, SIGNATURE) : jsonResponse(400, {})
      );

      expect(await rejection(service().uploadPhoto('h1', photoFile()))).toBe('uploadFailed');
    });

    it.each(['abc123', 'dela/h2/abc123', 'dela/h1/sub/abc123'])(
      'should refuse a returned public id %s outside dela/<householdId>/',
      async (publicId) => {
        fetchFn.mockImplementation(async (url: string) =>
          url === '/api/sign-upload'
            ? jsonResponse(200, SIGNATURE)
            : jsonResponse(200, { height: 600, public_id: publicId, width: 800 })
        );

        expect(await rejection(service().uploadPhoto('h1', photoFile()))).toBe(
          'unexpectedPublicId'
        );
      }
    );
  });

  describe('deleteMedia (AC7.6)', () => {
    it('should ask the endpoint to delete the photo with the ID token', async () => {
      fetchFn.mockResolvedValueOnce(new Response(null, { status: 204 }));

      await service().deleteMedia('h1', 'd1', 'm1');

      const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/delete-media');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({
        Authorization: 'Bearer id-token',
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(init.body as string)).toEqual({
        dogId: 'd1',
        householdId: 'h1',
        mediaId: 'm1',
      });
    });

    it('should report a refused deletion', async () => {
      fetchFn.mockResolvedValueOnce(jsonResponse(403, { error: 'forbidden' }));

      expect(await rejection(service().deleteMedia('h1', 'd1', 'm1'))).toBe('deleteFailed');
    });
  });

  describe('removeMedia (AC7.6)', () => {
    it('should delete a photo through the endpoint, not the repository', async () => {
      fetchFn.mockResolvedValueOnce(new Response(null, { status: 204 }));

      await service().removeMedia('h1', 'd1', photo);

      expect(fetchFn.mock.calls[0]?.[0]).toBe('/api/delete-media');
      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('should delete a video document through the repository only', async () => {
      await service().removeMedia('h1', 'd1', video);

      expect(repository.remove).toHaveBeenCalledWith('h1', 'd1', 'm2');
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });
});

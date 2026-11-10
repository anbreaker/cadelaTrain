import { assertFails, RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { MediaRepository } from '@data/media.repository';
import { Media, MediaDraft } from '@domain/media';

import {
  createRulesEnvironment,
  dbAs,
  DOG_ID,
  DOG_PATH,
  HOUSEHOLD_ID,
  MEMBER,
  OUTSIDER,
  OWNER,
  resetFirestore,
  seedHousehold,
} from '../rules/support';
import { firstMatching, repositoryFor } from './support';

import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const YOUTUBE_ID = 'dQw4w9WgXcQ';

const videoDraft = (date: string, caption = ''): MediaDraft => ({
  caption,
  date,
  kind: 'video',
  skillKey: null,
  videoLink: `https://youtu.be/${YOUTUBE_ID}`,
});

const photoRecord = (date: string): Parameters<MediaRepository['addPhoto']>[2] => ({
  caption: 'Barro',
  date,
  height: 1080,
  publicId: `dela/${HOUSEHOLD_ID}/k3j9x0aa1b2c3d4e5f6g`,
  skillKey: 'leash',
  width: 1920,
});

describe('MediaRepository on the emulator (AC7.1–AC7.7)', () => {
  let env: RulesTestEnvironment;

  const repositoryAs = (user = MEMBER): MediaRepository =>
    repositoryFor(MediaRepository, dbAs(env, user));

  const mediaBetween = (
    from: string,
    to: string,
    matches: (media: Media[]) => boolean,
    user = OWNER
  ): Promise<Media[]> =>
    firstMatching(repositoryAs(user).watchRange(HOUSEHOLD_ID, DOG_ID, from, to), matches);

  beforeAll(async () => {
    env = await createRulesEnvironment();
  });

  beforeEach(async () => {
    await resetFirestore(env);
    await seedHousehold(env);
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it('should have no media on a day nobody added any (AC7.1)', async () => {
    expect(await mediaBetween('2026-12-05', '2026-12-11', () => true)).toEqual([]);
  });

  it('should store a video as its id and a photo record by their authors', async () => {
    const videoId = await repositoryAs(MEMBER).addVideo(
      HOUSEHOLD_ID,
      DOG_ID,
      videoDraft('2026-12-05', 'Sentada'),
      MEMBER.uid
    );
    const photoId = await repositoryAs(OWNER).addPhoto(
      HOUSEHOLD_ID,
      DOG_ID,
      photoRecord('2026-12-06'),
      OWNER.uid
    );

    const media = await mediaBetween('2026-12-05', '2026-12-11', (found) => found.length === 2);
    expect(media).toMatchObject([
      {
        addedBy: OWNER.uid,
        caption: 'Barro',
        date: '2026-12-06',
        height: 1080,
        id: photoId,
        kind: 'photo',
        skillKey: 'leash',
        width: 1920,
      },
      {
        addedBy: MEMBER.uid,
        caption: 'Sentada',
        date: '2026-12-05',
        id: videoId,
        kind: 'video',
        youtubeId: YOUTUBE_ID,
      },
    ]);
    expect(media.every(({ addedAt }) => addedAt instanceof Date)).toBe(true);
  });

  it('should list only the dates in range, newest date first and newest added first', async () => {
    const repository = repositoryAs();
    const add = (date: string, caption: string): Promise<string> =>
      repository.addVideo(HOUSEHOLD_ID, DOG_ID, videoDraft(date, caption), MEMBER.uid);
    await add('2026-12-04', 'before');
    await add('2026-12-05', 'first');
    await add('2026-12-05', 'second');
    await add('2026-12-11', 'last day');
    await add('2026-12-12', 'after');

    const media = await mediaBetween('2026-12-05', '2026-12-11', (found) => found.length === 3);
    expect(media.map(({ caption }) => caption)).toEqual(['last day', 'second', 'first']);
  });

  it('should let the author delete their item and nobody else', async () => {
    const id = await repositoryAs(OWNER).addVideo(
      HOUSEHOLD_ID,
      DOG_ID,
      videoDraft('2026-12-05'),
      OWNER.uid
    );

    await assertFails(repositoryAs(MEMBER).remove(HOUSEHOLD_ID, DOG_ID, id));
    await repositoryAs(OWNER).remove(HOUSEHOLD_ID, DOG_ID, id);

    expect((await getDoc(doc(dbAs(env, OWNER), `${DOG_PATH}/media/${id}`))).exists()).toBe(false);
  });

  it('should let only the author change the caption', async () => {
    const id = await repositoryAs(OWNER).addVideo(
      HOUSEHOLD_ID,
      DOG_ID,
      videoDraft('2026-12-05'),
      OWNER.uid
    );
    const path = `${DOG_PATH}/media/${id}`;

    await assertFails(updateDoc(doc(dbAs(env, MEMBER), path), { caption: 'Not mine' }));
    await updateDoc(doc(dbAs(env, OWNER), path), { caption: 'Mine' });
  });

  it('should deny an outsider reading or adding media (AC7.7)', async () => {
    await assertFails(
      repositoryAs(OUTSIDER).addVideo(HOUSEHOLD_ID, DOG_ID, videoDraft('2026-12-05'), OUTSIDER.uid)
    );
    await expect(mediaBetween('2026-12-05', '2026-12-11', () => true, OUTSIDER)).rejects.toThrow();
  });
});

import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';

import {
  createRulesEnvironment,
  dbAs,
  DOG_PATH,
  HOUSEHOLD_ID,
  MEMBER,
  OUTSIDER,
  OWNER,
  resetFirestore,
  seed,
  seedHousehold,
  STRANGER,
} from './support';

import {
  deleteDoc,
  deleteField,
  doc,
  DocumentData,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const NEW_MEDIA_PATH = `${DOG_PATH}/media/new`;
const OWNER_PHOTO_PATH = `${DOG_PATH}/media/ownerPhoto`;

function photo(addedBy: string, overrides: DocumentData = {}): DocumentData {
  return {
    addedAt: serverTimestamp(),
    addedBy,
    caption: 'First walk',
    date: '2026-12-05',
    height: 1080,
    kind: 'photo',
    publicId: `dela/${HOUSEHOLD_ID}/${addedBy}/k3j9x0aa1b2c3d4e5f6g`,
    skillKey: 'leash',
    width: 1920,
    ...overrides,
  };
}

function video(addedBy: string, overrides: DocumentData = {}): DocumentData {
  return {
    addedAt: serverTimestamp(),
    addedBy,
    date: '2026-12-05',
    kind: 'video',
    youtubeId: 'dQw4w9WgXcQ',
    ...overrides,
  };
}

const without = (data: DocumentData, ...fields: string[]): DocumentData =>
  Object.fromEntries(Object.entries(data).filter(([key]) => !fields.includes(key)));

describe('media rules (AC7.4, AC7.6, AC7.7)', () => {
  let env: RulesTestEnvironment;

  const create = (data: DocumentData, user = MEMBER): Promise<void> =>
    setDoc(doc(dbAs(env, user), NEW_MEDIA_PATH), data);

  beforeAll(async () => {
    env = await createRulesEnvironment();
  });

  beforeEach(async () => {
    await resetFirestore(env);
    await seedHousehold(env);
    await seed(env, { [OWNER_PHOTO_PATH]: photo(OWNER.uid, { addedAt: Timestamp.now() }) });
  });

  afterAll(async () => {
    await env.cleanup();
  });

  describe('read', () => {
    it('should let members read media', async () => {
      await assertSucceeds(getDoc(doc(dbAs(env, MEMBER), OWNER_PHOTO_PATH)));
      await assertSucceeds(getDoc(doc(dbAs(env, OWNER), OWNER_PHOTO_PATH)));
    });

    it('should deny an outsider or a user without access reading media', async () => {
      await assertFails(getDoc(doc(dbAs(env, OUTSIDER), OWNER_PHOTO_PATH)));
      await assertFails(getDoc(doc(dbAs(env, STRANGER), OWNER_PHOTO_PATH)));
    });
  });

  describe('create', () => {
    it('should let a member add a photo as themself at server time', async () => {
      await assertSucceeds(create(photo(MEMBER.uid)));
    });

    it('should let a member add a photo in their own folder dela/<hid>/<uid>/<id>', async () => {
      await assertSucceeds(
        create(photo(MEMBER.uid, { publicId: `dela/${HOUSEHOLD_ID}/${MEMBER.uid}/abc_DEF-123` }))
      );
    });

    it('should let a member add a photo without caption or skill', async () => {
      await assertSucceeds(create(without(photo(MEMBER.uid), 'caption', 'skillKey')));
    });

    it('should let a member add a video with a caption and a skill', async () => {
      await assertSucceeds(create(video(MEMBER.uid, { caption: 'Sit!', skillKey: 'sit' })));
    });

    it('should let a member add a video without caption or skill', async () => {
      await assertSucceeds(create(video(MEMBER.uid)));
    });

    it('should deny an outsider adding media', async () => {
      await assertFails(create(video(OUTSIDER.uid), OUTSIDER));
      await assertFails(create(photo(OUTSIDER.uid), OUTSIDER));
    });

    it('should deny media added in the name of someone else', async () => {
      await assertFails(create(video(OWNER.uid)));
    });

    it('should deny a client-chosen addedAt', async () => {
      await assertFails(create(video(MEMBER.uid, { addedAt: Timestamp.now() })));
    });

    it('should deny an unknown kind', async () => {
      await assertFails(create(video(MEMBER.uid, { kind: 'audio' })));
    });

    it('should deny a date that is not YYYY-MM-DD', async () => {
      for (const date of ['05/12/2026', '2026-12-5', 20261205])
        await assertFails(create(video(MEMBER.uid, { date })));
    });

    it('should deny media without date', async () => {
      await assertFails(create(without(video(MEMBER.uid), 'date')));
    });

    it('should deny a caption longer than 280 characters', async () => {
      await assertFails(create(video(MEMBER.uid, { caption: 'a'.repeat(281) })));
    });

    it('should accept a caption of exactly 280 characters', async () => {
      await assertSucceeds(create(video(MEMBER.uid, { caption: 'a'.repeat(280) })));
    });

    it('should deny a caption that is not a string', async () => {
      await assertFails(create(video(MEMBER.uid, { caption: 42 })));
    });

    it('should deny an empty or unknown skillKey', async () => {
      for (const skillKey of ['', 'attack'])
        await assertFails(create(video(MEMBER.uid, { skillKey })));
    });

    it('should deny a photo with a youtubeId', async () => {
      await assertFails(create(photo(MEMBER.uid, { youtubeId: 'dQw4w9WgXcQ' })));
    });

    it('should deny a video with a publicId, width or height', async () => {
      await assertFails(
        create(video(MEMBER.uid, { publicId: `dela/${HOUSEHOLD_ID}/k3j9x0aa1b2c3d4e5f6g` }))
      );
      await assertFails(create(video(MEMBER.uid, { height: 1080, width: 1920 })));
    });

    it('should deny a photo without publicId, width or height', async () => {
      for (const field of ['publicId', 'width', 'height'])
        await assertFails(create(without(photo(MEMBER.uid), field)));
    });

    it('should deny a video without youtubeId', async () => {
      await assertFails(create(without(video(MEMBER.uid), 'youtubeId')));
    });

    it("should deny a publicId under another household's folder", async () => {
      await assertFails(
        create(photo(MEMBER.uid, { publicId: `dela/h2/${MEMBER.uid}/k3j9x0aa1b2c3d4e5f6g` }))
      );
    });

    it("should deny a photo whose publicId is in another member's folder", async () => {
      await assertFails(
        create(
          photo(MEMBER.uid, { publicId: `dela/${HOUSEHOLD_ID}/${OWNER.uid}/k3j9x0aa1b2c3d4e5f6g` })
        )
      );
    });

    it('should deny the old dela/<hid>/<id> shape without the uploader folder', async () => {
      await assertFails(
        create(photo(MEMBER.uid, { publicId: `dela/${HOUSEHOLD_ID}/k3j9x0aa1b2c3d4e5f6g` }))
      );
    });

    it('should deny a publicId outside the dela folder or nested deeper', async () => {
      for (const publicId of [
        `other/${HOUSEHOLD_ID}/${MEMBER.uid}/abc`,
        `dela/${HOUSEHOLD_ID}/${MEMBER.uid}/`,
        `dela/${HOUSEHOLD_ID}/${MEMBER.uid}/a/b`,
        `dela/${HOUSEHOLD_ID}/${MEMBER.uid}/../h2/abc`,
        `dela/${HOUSEHOLD_ID}/${MEMBER.uid}/abc.jpg`,
        `dela/${HOUSEHOLD_ID}/${MEMBER.uid}/${'a'.repeat(101)}`,
        `dela/${HOUSEHOLD_ID}/${MEMBER.uid}`,
        `dela/${HOUSEHOLD_ID}`,
        42,
      ])
        await assertFails(create(photo(MEMBER.uid, { publicId })));
    });

    it('should deny a width or height that is not an integer from 1 to 20000', async () => {
      for (const side of [0, 20001, 10.5, '1080']) {
        await assertFails(create(photo(MEMBER.uid, { width: side })));
        await assertFails(create(photo(MEMBER.uid, { height: side })));
      }
    });

    it('should deny a youtubeId that is not 11 safe characters', async () => {
      for (const youtubeId of [
        'dQw4w9WgXcQx',
        'dQw4w9WgXc',
        'dQw4w9WgX<Q',
        'https://youtu.be/dQw4w9WgXcQ',
        42,
      ])
        await assertFails(create(video(MEMBER.uid, { youtubeId })));
    });

    it('should deny an unknown extra field', async () => {
      await assertFails(create(video(MEMBER.uid, { url: 'https://example.com' })));
    });
  });

  describe('update', () => {
    it('should let the author change the caption', async () => {
      await assertSucceeds(updateDoc(doc(dbAs(env, OWNER), OWNER_PHOTO_PATH), { caption: 'Mud' }));
    });

    it('should let the author remove the caption', async () => {
      await assertSucceeds(
        updateDoc(doc(dbAs(env, OWNER), OWNER_PHOTO_PATH), { caption: deleteField() })
      );
    });

    it('should deny the author a caption longer than 280 characters', async () => {
      await assertFails(
        updateDoc(doc(dbAs(env, OWNER), OWNER_PHOTO_PATH), { caption: 'a'.repeat(281) })
      );
    });

    it('should deny the author changing any field but the caption', async () => {
      const ref = doc(dbAs(env, OWNER), OWNER_PHOTO_PATH);
      for (const change of [
        { date: '2026-12-06' },
        { skillKey: 'sit' },
        { publicId: `dela/${HOUSEHOLD_ID}/${OWNER.uid}/other` },
        { width: 100 },
        { addedBy: MEMBER.uid },
        { addedAt: serverTimestamp() },
        { kind: 'video' },
      ])
        await assertFails(updateDoc(ref, change));
    });

    it("should deny a member changing another member's caption", async () => {
      await assertFails(updateDoc(doc(dbAs(env, MEMBER), OWNER_PHOTO_PATH), { caption: 'Mine' }));
    });

    it('should deny an outsider changing the caption', async () => {
      await assertFails(updateDoc(doc(dbAs(env, OUTSIDER), OWNER_PHOTO_PATH), { caption: 'x' }));
    });
  });

  describe('delete', () => {
    it('should let the author delete their item', async () => {
      await assertSucceeds(deleteDoc(doc(dbAs(env, OWNER), OWNER_PHOTO_PATH)));
    });

    it("should deny a member deleting another member's item", async () => {
      await assertFails(deleteDoc(doc(dbAs(env, MEMBER), OWNER_PHOTO_PATH)));
    });

    it('should deny an outsider deleting an item', async () => {
      await assertFails(deleteDoc(doc(dbAs(env, OUTSIDER), OWNER_PHOTO_PATH)));
    });
  });
});

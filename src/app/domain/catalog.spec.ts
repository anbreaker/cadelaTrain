import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import principlesSeed from '../../../seed/principles.json';
import {
  CARE_ALERTS,
  EXTRA_CUES,
  guideHowTo,
  PLAN_WEEKS,
  planWeek,
  PREPARATION_ITEMS,
  ROUTINE_GUIDES,
  SCHEDULE,
  skillHowTo,
  SKILLS,
  SOCIALIZATION_ITEMS,
} from './catalog';
import { SLOTS, TASK_KINDS } from './guidance';

const es = JSON.parse(
  readFileSync(resolve(process.cwd(), 'public/assets/i18n/es.json'), 'utf8')
) as Record<string, unknown>;

const has = (path: string): boolean =>
  path
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      es
    ) !== undefined;

describe('bundled catalogs', () => {
  it('should type every schedule row with a known slot and kind', () => {
    expect(SCHEDULE.length).toBeGreaterThan(0);
    for (const row of SCHEDULE) {
      expect(SLOTS).toContain(row.slot);
      expect(TASK_KINDS).toContain(row.kind);
      expect(has(`catalog.schedule.${row.id}.title`)).toBe(true);
    }
  });

  it('should have eight plan weeks whose focus skills exist in the skills catalog', () => {
    const skillKeys = SKILLS.map((skill) => skill.key);

    expect(PLAN_WEEKS.map((week) => week.week)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const week of PLAN_WEEKS) {
      for (const skill of week.focusSkills) expect(skillKeys).toContain(skill);
    }
  });

  it('should practise search (busca) in weeks 2 and 3, right after name', () => {
    expect(SKILLS.map((skill) => skill.key).slice(0, 2)).toEqual(['name', 'search']);
    expect(
      PLAN_WEEKS.filter((week) => week.focusSkills.includes('search')).map((week) => week.week)
    ).toEqual([2, 3]);
  });

  it('should teach retrieve (trae) as the last skill, outside the plan weeks', () => {
    const steps = SKILLS.find((skill) => skill.key === 'retrieve')?.howTo.steps ?? [];

    expect(SKILLS.map((skill) => skill.key).at(-1)).toBe('retrieve');
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(steps.length).toBeLessThanOrEqual(5);
    for (const week of PLAN_WEEKS) {
      expect(week.focusSkills).not.toContain('retrieve');
      expect(week.keySkills).not.toContain('retrieve');
    }
  });

  it('should use «trae», «traz» and "fetch" as the retrieve cue', () => {
    const cues = Object.fromEntries(
      ['es', 'pt', 'en'].map((lang) => [
        lang,
        (
          JSON.parse(
            readFileSync(resolve(process.cwd(), `public/assets/i18n/${lang}.json`), 'utf8')
          ) as { catalog: { skills: Record<string, { cue: string }> } }
        ).catalog.skills['retrieve']?.cue,
      ])
    );

    expect(cues).toEqual({ en: 'fetch', es: 'trae', pt: 'traz' });
  });

  it('should translate every word-only cue', () => {
    expect(EXTRA_CUES).toEqual(['drop', 'praise', 'release', 'no']);
    for (const cue of EXTRA_CUES) expect(has(`catalog.cues.${cue}`)).toBe(true);
  });

  it('should never use the same spoken word for two cues in any language', () => {
    for (const lang of ['es', 'pt', 'en']) {
      const catalog = (
        JSON.parse(
          readFileSync(resolve(process.cwd(), `public/assets/i18n/${lang}.json`), 'utf8')
        ) as { catalog: { cues: Record<string, string>; skills: Record<string, { cue: string }> } }
      ).catalog;
      const words = [
        ...SKILLS.map(({ key }) => catalog.skills[key].cue),
        ...EXTRA_CUES.map((key) => catalog.cues[key]),
      ];

      expect({ lang, words: new Set(words).size }).toEqual({ lang, words: words.length });
    }
  });

  it('should translate every skill, socialization item and care alert', () => {
    for (const skill of SKILLS) expect(has(`catalog.skills.${skill.key}.name`)).toBe(true);
    for (const item of SOCIALIZATION_ITEMS)
      expect(has(`catalog.socialization.items.${item.key}.howTo`)).toBe(true);
    for (const alert of CARE_ALERTS)
      expect(has(`catalog.careAlerts.${alert.key}.message`)).toBe(true);
  });

  it('should give every skill a translated how-to guide with at least three steps', () => {
    for (const skill of SKILLS) {
      const guide = skillHowTo(skill.key);
      expect(guide?.stepKeys.length ?? 0).toBeGreaterThanOrEqual(3);
      for (const key of [
        guide?.setupKey,
        ...(guide?.stepKeys ?? []),
        guide?.levelUpKey,
        guide?.troubleshootKey,
        guide?.mistakesKey,
      ])
        expect(has(key ?? 'missing')).toBe(true);
    }
  });

  it('should give every routine guide translated text with at least three steps', () => {
    expect(ROUTINE_GUIDES.map((guide) => guide.key)).toEqual([
      'socialization',
      'handling',
      'brushing',
      'kennel',
      'cats',
      'alone',
    ]);
    for (const routine of ROUTINE_GUIDES) {
      const guide = guideHowTo(routine.key);
      expect(guide?.stepKeys.length ?? 0).toBeGreaterThanOrEqual(3);
      for (const key of [
        guide?.setupKey,
        ...(guide?.stepKeys ?? []),
        guide?.levelUpKey,
        guide?.troubleshootKey,
        guide?.mistakesKey,
      ])
        expect(has(key ?? 'missing')).toBe(true);
    }
  });

  it('should link the routine schedule rows to an existing guide', () => {
    const guides = Object.fromEntries(SCHEDULE.map((row) => [row.id, row.guideKey]));

    expect(guides).toMatchObject({
      afternoonPotty: 'potty',
      aloneTime: 'alone',
      bedtime: 'kennel',
      calmTime: 'brushing',
      catsTime: 'cats',
      farmWalk: 'potty',
      greeting: 'potty',
      socialization: 'socialization',
      visit: 'handling',
    });
    for (const row of SCHEDULE) if (row.guideKey) expect(guideHowTo(row.guideKey)).not.toBeNull();
  });

  it('should schedule the daily fetch and scent games as 5-minute care rows', () => {
    const row = (id: string) => SCHEDULE.find((item) => item.id === id);

    expect(row('fetchPlay')).toMatchObject({
      durationMin: 5,
      isTask: true,
      kind: 'care',
      skillKey: 'retrieve',
      slot: 'afternoon',
    });
    expect(row('sniffGame')).toMatchObject({
      durationMin: 5,
      guideKey: 'search',
      isTask: true,
      kind: 'care',
      slot: 'morning',
    });
  });

  it('should take her out at most every 3 hours while she is awake (2-month-old bladder)', () => {
    const minutes = (time: string): number => {
      const [hours, mins] = time.split(':').map(Number);
      return (hours ?? 0) * 60 + (mins ?? 0);
    };
    // Potty rows plus the rows that also take her out: the midday visit, the walk and the last outing.
    const alsoOutside = ['visit', 'leashWalk', 'calmTime'];
    const outings = SCHEDULE.filter((row) => row.kind === 'potty' || alsoOutside.includes(row.id))
      .map((row) => minutes(row.time))
      .sort((a, b) => a - b);

    for (let index = 1; index < outings.length; index++)
      expect((outings[index] ?? 0) - (outings[index - 1] ?? 0)).toBeLessThanOrEqual(180);
  });

  it('should keep tug play within the 5-minute session limit', () => {
    expect(SCHEDULE.find((row) => row.id === 'tugPlay')?.durationMin).toBe(5);
  });

  it('should desensitize to gunshots of the hunting season', () => {
    expect(SOCIALIZATION_ITEMS.map((item) => item.key)).toContain('noiseGunshots');
  });

  it('should resolve a guide key to a skill guide first, then to a routine guide', () => {
    expect(guideHowTo('potty')).toEqual(skillHowTo('potty'));
    expect(guideHowTo('kennel')?.setupKey).toBe('catalog.routines.kennel.howTo.setup');
    expect(guideHowTo('unknown')).toBeNull();
  });

  it('should name the translation keys of a skill guide in step order', () => {
    const steps = SKILLS.find((skill) => skill.key === 'sit')?.howTo.steps ?? [];

    expect(skillHowTo('sit')).toEqual({
      levelUpKey: 'catalog.skills.sit.howTo.levelUp',
      mistakesKey: 'catalog.skills.sit.howTo.mistakes',
      setupKey: 'catalog.skills.sit.howTo.setup',
      stepKeys: steps.map((_, index) => `catalog.skills.sit.howTo.step${index + 1}`),
      troubleshootKey: 'catalog.skills.sit.howTo.troubleshoot',
    });
    expect(skillHowTo('unknown')).toBeNull();
  });

  it('should translate every training principle', () => {
    expect(principlesSeed.items.length).toBeGreaterThan(0);
    for (const principle of principlesSeed.items)
      expect(has(`catalog.principles.${principle.key}`)).toBe(true);
  });

  it('should list the preparation checklist in order, every item translated (AC2.5)', () => {
    expect(PREPARATION_ITEMS.length).toBeGreaterThan(0);
    expect(PREPARATION_ITEMS.map((item) => item.order)).toEqual(
      PREPARATION_ITEMS.map((_, index) => index + 1)
    );
    for (const item of PREPARATION_ITEMS)
      expect(has(`catalog.preparation.${item.key}.label`)).toBe(true);
  });

  it('should translate the hint of every preparation item that has one', () => {
    const withHint = PREPARATION_ITEMS.filter((item) => item.hint);

    expect(withHint.map((item) => item.key)).toContain('cleaning');
    for (const item of withHint) expect(has(`catalog.preparation.${item.key}.hint`)).toBe(true);
  });

  it('should clamp the plan week to 1–8', () => {
    expect(planWeek(0).week).toBe(1);
    expect(planWeek(3).week).toBe(3);
    expect(planWeek(12).week).toBe(8);
  });
});

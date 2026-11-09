import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import principlesSeed from '../../../seed/principles.json';
import {
  CARE_ALERTS,
  PLAN_WEEKS,
  planWeek,
  PREPARATION_ITEMS,
  SCHEDULE,
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

  it('should translate every skill, socialization item and care alert', () => {
    for (const skill of SKILLS) expect(has(`catalog.skills.${skill.key}.name`)).toBe(true);
    for (const item of SOCIALIZATION_ITEMS)
      expect(has(`catalog.socialization.items.${item.key}.howTo`)).toBe(true);
    for (const alert of CARE_ALERTS)
      expect(has(`catalog.careAlerts.${alert.key}.message`)).toBe(true);
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

  it('should clamp the plan week to 1–8', () => {
    expect(planWeek(0).week).toBe(1);
    expect(planWeek(3).week).toBe(3);
    expect(planWeek(12).week).toBe(8);
  });
});

import { SKILLS, SOCIALIZATION_CATEGORIES, SOCIALIZATION_ITEMS } from '@domain/catalog';
import { SocializationStatus } from '@domain/progress';
import { TaskLog } from '@domain/task-log';

import { nextWeekView, skillCards, socializationGroups } from './progress-view';

const TODAY = '2026-12-20';

const training = (skillKey: string, successCount: number, attempts: number): TaskLog => ({
  attempts,
  doneAt: new Date(`${TODAY}T08:00:00Z`),
  doneBy: 'alice',
  guidanceDate: TODAY,
  id: `${skillKey}-${successCount}`,
  kind: 'training',
  notes: '',
  skillKey,
  successCount,
  taskId: 't1',
});

const formatDate = (date: string): string => `d:${date}`;

type Card = ReturnType<typeof skillCards>[number];

const cardOf = (cards: Card[], key: string): Card => {
  const card = cards.find((candidate) => candidate.key === key);
  if (!card) throw new Error(`${key} card missing`);
  return card;
};

describe('skillCards', () => {
  it('should list every skill of the catalog in teaching order (AC4.1)', () => {
    const cards = skillCards([], TODAY, formatDate);

    expect(cards.map((card) => card.key)).toEqual(SKILLS.map((skill) => skill.key));
    expect(cardOf(cards, 'sit').nameKey).toBe('catalog.skills.sit.name');
  });

  it('should show the rate as a whole percentage and mark mastery (AC4.2, AC4.3)', () => {
    const cards = skillCards([training('sit', 8, 10), training('come', 2, 3)], TODAY, formatDate);
    const sit = cardOf(cards, 'sit');
    const come = cardOf(cards, 'come');

    expect(sit).toEqual(
      expect.objectContaining({
        mastered: true,
        ratePercent: 80,
        rateKey: 'progress.skills.rate',
        sessions: 1,
      })
    );
    expect(come).toEqual(
      expect.objectContaining({
        mastered: false,
        ratePercent: null,
        rateKey: 'progress.skills.noRate',
        sessions: 1,
      })
    );
  });

  it('should label every trend bar with its date, empty days included (AC4.2)', () => {
    const sit = cardOf(skillCards([training('sit', 7, 10)], TODAY, formatDate), 'sit');
    const last = sit.trend[sit.trend.length - 1];

    expect(sit.trend).toHaveLength(14);
    expect(last).toEqual({ date: `d:${TODAY}`, labelKey: 'progress.skills.trendDay', percent: 70 });
    expect(sit.trend[0]).toEqual({
      date: 'd:2026-12-07',
      labelKey: 'progress.skills.trendDayEmpty',
      percent: null,
    });
  });

  it('should leave a skill never trained without sessions (AC4.2 empty state)', () => {
    const [name] = skillCards([], TODAY, formatDate);

    expect(name).toEqual(expect.objectContaining({ empty: true, ratePercent: null, sessions: 0 }));
  });
});

describe('socializationGroups (AC4.4)', () => {
  const status = (
    key: string,
    overrides: Partial<SocializationStatus> = {}
  ): SocializationStatus => ({
    done: false,
    item: SOCIALIZATION_ITEMS.find((item) => item.key === key) ?? SOCIALIZATION_ITEMS[0],
    lastBy: null,
    lastReaction: null,
    repeatGently: false,
    ...overrides,
  });
  const members = { alice: { displayName: 'Jéssica', role: 'owner' as const } };

  it('should group the items by category in checklist order', () => {
    const groups = socializationGroups(
      SOCIALIZATION_ITEMS.map((item) => status(item.key)),
      members
    );

    expect(groups.map((group) => group.category)).toEqual(SOCIALIZATION_CATEGORIES);
    expect(groups[0].labelKey).toBe('catalog.socialization.categories.people');
    expect(groups.flatMap((group) => group.items)).toHaveLength(SOCIALIZATION_ITEMS.length);
  });

  it('should show done or pending, the last reaction and who, and flag fear to repeat gently', () => {
    const key = SOCIALIZATION_ITEMS[0].key;
    const [people] = socializationGroups(
      [status(key, { lastBy: 'alice', lastReaction: 'fear', repeatGently: true })],
      members
    );

    expect(people.items[0]).toEqual({
      by: 'Jéssica',
      key,
      labelKey: `catalog.socialization.items.${key}.label`,
      reactionKey: 'reactions.fear',
      repeatGently: true,
      statusKey: 'progress.socialization.pending',
    });
  });

  it('should leave the reaction and author empty for an item never tried', () => {
    const key = SOCIALIZATION_ITEMS[0].key;
    const [people] = socializationGroups([status(key, { done: true })], members);

    expect(people.items[0]).toEqual(
      expect.objectContaining({
        by: null,
        reactionKey: null,
        statusKey: 'progress.socialization.done',
      })
    );
  });
});

describe('nextWeekView (S2)', () => {
  it('should show each key skill with its rate against 80 % and its attempts against 10', () => {
    const view = nextWeekView({
      ageAllows: true,
      keySkills: [
        { attempts: 12, met: true, rate: 0.834, skillKey: 'come' },
        { attempts: 4, met: false, rate: null, skillKey: 'sit' },
      ],
      minAgeWeeks: 9,
      nextWeek: 2,
    });

    expect(view).toEqual({
      ageKey: null,
      hintKey: 'progress.nextWeek.hint',
      minAgeWeeks: 9,
      skills: [
        {
          attempts: 12,
          attemptsKey: 'progress.nextWeek.attempts',
          key: 'come',
          met: true,
          nameKey: 'catalog.skills.come.name',
          rateKey: 'progress.nextWeek.rate',
          ratePercent: 83,
        },
        {
          attempts: 4,
          attemptsKey: 'progress.nextWeek.attempts',
          key: 'sit',
          met: false,
          nameKey: 'catalog.skills.sit.name',
          rateKey: 'progress.nextWeek.noRate',
          ratePercent: null,
        },
      ],
      titleKey: 'progress.nextWeek.title',
      week: 2,
    });
  });

  it('should say from which age the next week starts while she is too young', () => {
    const view = nextWeekView({ ageAllows: false, keySkills: [], minAgeWeeks: 10, nextWeek: 3 });

    expect(view.ageKey).toBe('progress.nextWeek.age');
  });

  it('should say she is in the last week, with nothing left to meet', () => {
    const view = nextWeekView({
      ageAllows: false,
      keySkills: [],
      minAgeWeeks: null,
      nextWeek: null,
    });

    expect(view).toMatchObject({
      ageKey: null,
      hintKey: null,
      skills: [],
      titleKey: 'progress.nextWeek.lastWeek',
    });
  });
});

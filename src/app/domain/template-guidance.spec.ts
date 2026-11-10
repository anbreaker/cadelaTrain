import { PLAN_WEEKS } from './catalog';
import { Dog } from './dog';
import { GuidanceTask } from './guidance';
import { templateGuidance, TemplateInput, Translate } from './template-guidance';

/** Echoes the key and its params, so tests assert on catalog keys, not copy. */
const translate: Translate = (key, params) =>
  params ? `${key}(${Object.values(params).join(',')})` : key;

const dela: Dog = {
  arrivalDate: '2026-12-10',
  birthDate: '2026-10-15',
  breed: 'Labrador',
  environment: 'rural',
  id: 'd1',
  name: 'Dela',
  notes: '',
  planWeek: 1,
  sleepsOutdoors: true,
};

const input = (overrides: Partial<TemplateInput> = {}): TemplateInput => ({
  date: '2026-12-20',
  dog: dela,
  locale: 'es',
  translate,
  ...overrides,
});

const tasksOf = (kind: GuidanceTask['kind'], tasks: GuidanceTask[]): GuidanceTask[] =>
  tasks.filter((task) => task.kind === kind);

describe('templateGuidance', () => {
  it('should start from the schedule rows that are tasks, with ids t1..tn and day order', () => {
    const { tasks } = templateGuidance(
      input({ date: '2026-10-20', dog: { ...dela, environment: 'urban', sleepsOutdoors: false } })
    );

    expect(tasks.map((task) => task.id)).toEqual(tasks.map((_, index) => `t${index + 1}`));
    expect(tasks.map((task) => task.order)).toEqual(tasks.map((_, index) => index + 1));
    expect(tasks.some((task) => task.title === 'catalog.schedule.morningRest.title')).toBe(false);
    expect(tasks.find((task) => task.kind === 'feeding')?.durationMin).toBeNull();
  });

  it('should fill the training sessions with the week focus skills, easiest first, 5 minutes each', () => {
    const training = tasksOf(
      'training',
      templateGuidance(input({ dog: { ...dela, planWeek: 4 } })).tasks
    );

    expect(training.map((task) => task.skillKey)).toEqual(['sit', 'come', 'leash']);
    expect(training.every((task) => task.durationMin === 5)).toBe(true);
    expect(training[0].title).toBe('guidance.template.trainingTitle(catalog.skills.sit.name)');
  });

  it('should give every key skill of the week a session, replacing the hardest other skill', () => {
    const week = (planWeek: number): (string | undefined)[] =>
      tasksOf('training', templateGuidance(input({ dog: { ...dela, planWeek } })).tasks).map(
        (task) => task.skillKey
      );

    expect(week(5)).toEqual(['come', 'leash', 'leaveIt']);
    expect(week(7)).toEqual(['sit', 'come', 'stay']);
    expect(week(8)).toEqual(['sit', 'come', 'stay']);
    expect(week(6)).toEqual(['come', 'leash', 'down']);
    for (const plan of PLAN_WEEKS)
      for (const key of plan.keySkills) expect(week(plan.week)).toContain(key);
  });

  it('should start search games in weeks 2 and 3 without displacing the key skill', () => {
    const week = (planWeek: number): (string | undefined)[] =>
      tasksOf('training', templateGuidance(input({ dog: { ...dela, planWeek } })).tasks).map(
        (task) => task.skillKey
      );

    expect(week(2)).toEqual(['name', 'search', 'sit']);
    expect(week(3)).toEqual(['search', 'sit', 'come']);
  });

  it('should repeat the only skill of week 1 in every session (potty has its own tasks)', () => {
    const training = tasksOf('training', templateGuidance(input()).tasks);

    expect(training.map((task) => task.skillKey)).toEqual(['name', 'name', 'name']);
  });

  it('should use 3 minutes for struggling skills', () => {
    const training = tasksOf(
      'training',
      templateGuidance(
        input({ dog: { ...dela, planWeek: 4 }, progress: { strugglingSkills: ['come'] } })
      ).tasks
    );

    expect(training.map((task) => task.durationMin)).toEqual([5, 3, 5]);
  });

  it('should close every session with the first mastered skill, or the name', () => {
    const plain = tasksOf('training', templateGuidance(input()).tasks);
    const mastered = tasksOf(
      'training',
      templateGuidance(input({ progress: { masteredSkills: ['sit'] } })).tasks
    );

    expect(plain.every((task) => task.closingSkillKey === 'name')).toBe(true);
    expect(mastered.every((task) => task.closingSkillKey === 'sit')).toBe(true);
  });

  it('should add one socialization: first to repeat gently, else first pending by catalog order', () => {
    const first = tasksOf('socialization', templateGuidance(input()).tasks);
    const pending = tasksOf(
      'socialization',
      templateGuidance(input({ progress: { socializedItems: ['peopleMen'] } })).tasks
    );
    const gently = tasksOf(
      'socialization',
      templateGuidance(input({ progress: { toRepeatGently: ['noiseAngleGrinder'] } })).tasks
    );

    expect(first).toHaveLength(1);
    expect(first[0].socializationItemKey).toBe('peopleMen');
    expect(pending[0].socializationItemKey).not.toBe('peopleMen');
    expect(gently[0].socializationItemKey).toBe('noiseAngleGrinder');
  });

  it('should carry the guide of each routine row, including the socialization of the day', () => {
    const { tasks } = templateGuidance(input());
    const guideOf = (title: string): string | undefined =>
      tasks.find((task) => task.title.startsWith(title))?.guideKey;

    expect(guideOf('catalog.schedule.bedtime')).toBe('kennel');
    expect(guideOf('catalog.schedule.greeting')).toBe('potty');
    expect(guideOf('guidance.template.socializationTitle')).toBe('socialization');
    expect(guideOf('catalog.schedule.lunch')).toBeUndefined();
  });

  it('should add the active care alerts as care tasks with their message only', () => {
    // Rural, sleeps outdoors, December, first week home.
    const care = templateGuidance(input({ date: '2026-12-12' })).tasks.filter((task) =>
      task.title.startsWith('catalog.careAlerts.')
    );
    const keys = care.map((task) => task.title.split('.')[2]);

    expect(keys).toEqual(expect.arrayContaining(['firstWeekVet', 'cold', 'livestockAndHens']));
    expect(keys).not.toContain('grassAwns');
    expect(
      care.every((task) => task.kind === 'care' && task.instructions.endsWith('.message'))
    ).toBe(true);
  });

  it('should leave out alerts that do not apply to the dog, season or arrival week', () => {
    const urbanIndoorsJune = templateGuidance(
      input({ date: '2027-06-20', dog: { ...dela, environment: 'urban', sleepsOutdoors: false } })
    ).tasks.map((task) => task.title);

    expect(urbanIndoorsJune).not.toContain('catalog.careAlerts.cold.title');
    expect(urbanIndoorsJune).not.toContain('catalog.careAlerts.firstWeekVet.title');
    expect(urbanIndoorsJune).not.toContain('catalog.careAlerts.livestockAndHens.title');
    expect(urbanIndoorsJune).toContain('catalog.careAlerts.ticksAndHeat.title');
  });

  it('should summarize with the week objective and add the fixed health phrase only when flagged', () => {
    expect(templateGuidance(input()).summary).toBe('catalog.planWeeks.week1.objective');
    expect(templateGuidance(input({ healthFlag: 'urgent' })).summary).toBe(
      'catalog.planWeeks.week1.objective health.vetEmergency'
    );
  });

  it('should describe itself as template guidance for the date, locale, week and age', () => {
    const guidance = templateGuidance(input());

    expect(guidance).toMatchObject({
      ageWeeks: 9,
      date: '2026-12-20',
      healthFlag: null,
      locale: 'es',
      planWeek: 1,
      source: 'template',
    });
  });

  it('should keep training at 5 minutes or less and never name a dose, for every week and season', () => {
    for (const week of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (const date of ['2027-01-15', '2027-07-15']) {
        const { tasks } = templateGuidance(input({ date, dog: { ...dela, planWeek: week } }));

        expect(tasks.length).toBeGreaterThanOrEqual(8);
        expect(tasksOf('training', tasks).every((task) => (task.durationMin ?? 0) <= 5)).toBe(true);
        expect(tasks.every((task) => task.durationMin === null || task.durationMin <= 30)).toBe(
          true
        );
      }
    }
  });
});

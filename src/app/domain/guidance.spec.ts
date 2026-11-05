import { groupBySlot, GuidanceTask, healthMessageKey, taskKindLabelKey } from './guidance';

const task = (id: string, slot: GuidanceTask['slot'], order: number): GuidanceTask => ({
  durationMin: 5,
  id,
  instructions: 'Instructions',
  kind: 'care',
  order,
  slot,
  title: id,
});

describe('groupBySlot', () => {
  it('should group tasks in morning, midday, afternoon, night order and sort by order (AC2.1)', () => {
    const groups = groupBySlot([
      task('night', 'night', 9),
      task('morning-b', 'morning', 2),
      task('afternoon', 'afternoon', 7),
      task('morning-a', 'morning', 1),
      task('midday', 'midday', 4),
    ]);

    expect(groups.map((group) => group.slot)).toEqual(['morning', 'midday', 'afternoon', 'night']);
    expect(groups[0].tasks.map((item) => item.id)).toEqual(['morning-a', 'morning-b']);
  });

  it('should leave out slots without tasks', () => {
    expect(groupBySlot([task('night', 'night', 1)]).map((group) => group.slot)).toEqual(['night']);
  });

  it('should return no groups for no tasks', () => {
    expect(groupBySlot([])).toEqual([]);
  });
});

describe('healthMessageKey', () => {
  it('should map the health flag to the only allowed health phrases (AC2.6)', () => {
    expect(healthMessageKey('vet')).toBe('health.consultVet');
    expect(healthMessageKey('urgent')).toBe('health.vetEmergency');
    expect(healthMessageKey(null)).toBeNull();
  });
});

describe('taskKindLabelKey', () => {
  it('should name the task kind label key (AC2.2)', () => {
    expect(taskKindLabelKey('training')).toBe('taskKinds.training');
  });
});

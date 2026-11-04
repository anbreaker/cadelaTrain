import { ageInWeeks, isIsoDate, madridToday } from './dates';

describe('isIsoDate', () => {
  it.each(['2026-10-01', '2028-02-29'])('should accept the real calendar date %s', (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each(['2026-02-30', '2026-13-01', '2026-1-01', '01/10/2026', ''])(
    'should reject %j',
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    }
  );
});

describe('madridToday', () => {
  it('should return the Madrid date when UTC is still the previous day (winter, UTC+1)', () => {
    expect(madridToday(new Date('2026-12-14T23:30:00Z'))).toBe('2026-12-15');
  });

  it('should return the Madrid date when UTC is still the previous day (summer, UTC+2)', () => {
    expect(madridToday(new Date('2027-07-01T22:30:00Z'))).toBe('2027-07-02');
  });

  it('should keep the same date when Madrid has not reached midnight', () => {
    expect(madridToday(new Date('2026-12-14T22:30:00Z'))).toBe('2026-12-14');
  });
});

describe('ageInWeeks', () => {
  it('should count whole weeks from the birth date', () => {
    expect(ageInWeeks('2026-10-01', '2026-11-26')).toBe(8);
  });

  it('should not round up a partial week', () => {
    expect(ageInWeeks('2026-10-01', '2026-11-25')).toBe(7);
  });

  it('should be zero on the birth date', () => {
    expect(ageInWeeks('2026-10-01', '2026-10-01')).toBe(0);
  });
});

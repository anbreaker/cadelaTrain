/** Calendar date without time, `YYYY-MM-DD`, always meant in Madrid time. */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

const MADRID_DATE = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Europe/Madrid',
  year: 'numeric',
});

const toUtcMs = (date: IsoDate): number => {
  const [year, month, day] = date.split('-').map(Number);

  return Date.UTC(year, month - 1, day);
};

/** Rejects impossible dates such as 2026-02-30, which `Date` would silently roll over. */
export const isIsoDate = (value: string): boolean => {
  const match = ISO_DATE.exec(value);

  return match ? new Date(toUtcMs(value)).toISOString().startsWith(value) : false;
};

/** `en-CA` formats as `YYYY-MM-DD`, so the Madrid calendar date comes out ready to compare. */
export const madridToday = (now: Date): IsoDate => MADRID_DATE.format(now);

export const ageInWeeks = (birthDate: IsoDate, onDate: IsoDate): number =>
  Math.floor((toUtcMs(onDate) - toUtcMs(birthDate)) / (7 * DAY_MS));

/** Calendar days from `onDate` to `date`; negative once `date` has passed. */
export const daysUntil = (date: IsoDate, onDate: IsoDate): number =>
  Math.round((toUtcMs(date) - toUtcMs(onDate)) / DAY_MS);

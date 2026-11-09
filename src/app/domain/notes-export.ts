import { SCHEDULE, SOCIALIZATION_ITEMS } from './catalog';
import { IsoDate, madridToday } from './dates';
import { HouseholdMember } from './household';
import { SocializationLog, TaskLog } from './task-log';

export interface NotesExportInput {
  dogName: string;
  logs: readonly TaskLog[];
  members: Readonly<Record<string, Pick<HouseholdMember, 'displayName'>>>;
  now: Date;
  socialization: readonly SocializationLog[];
}

interface Entry {
  date: IsoDate;
  doneAt: Date;
  line: string;
}

const MADRID_TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  timeZone: 'Europe/Madrid',
});

const SCHEDULE_TITLES = new Map(SCHEDULE.map((row) => [row.id, row.title]));
const SOCIALIZATION_LABELS = new Map(SOCIALIZATION_ITEMS.map((item) => [item.key, item.label]));

const time = (at: Date): string => MADRID_TIME.format(at);

const withNotes = (parts: readonly (string | undefined)[], notes: string): string => {
  const line = `- ${parts.filter(Boolean).join(' · ')}`;
  return notes.trim() ? `${line} — ${notes.trim()}` : line;
};

const result = (log: TaskLog): string | undefined =>
  log.attempts ? `${log.successCount ?? 0}/${log.attempts}` : log.reaction;

/**
 * Plain-text record of every task log and socialization log, grouped by Madrid day, newest first,
 * so the household can hand its notes to a training review without any extra credential.
 * Labels are canonical English; the trainers' notes are copied verbatim.
 */
export function notesExport({
  dogName,
  logs,
  members,
  now,
  socialization,
}: NotesExportInput): string {
  const who = (uid: string): string => members[uid]?.displayName ?? uid;
  const entries: Entry[] = [
    ...logs.map((log) => ({
      date: log.guidanceDate,
      doneAt: log.doneAt,
      line: withNotes(
        [
          time(log.doneAt),
          who(log.doneBy),
          log.kind,
          log.skillKey,
          SCHEDULE_TITLES.get(log.taskId),
          result(log),
        ],
        log.notes
      ),
    })),
    ...socialization.map((log) => {
      const label = SOCIALIZATION_LABELS.get(log.itemKey);
      return {
        date: madridToday(log.doneAt),
        doneAt: log.doneAt,
        line: withNotes(
          [
            time(log.doneAt),
            who(log.doneBy),
            'socialization',
            label ? `${log.itemKey} (${label})` : log.itemKey,
            log.reaction,
          ],
          log.notes
        ),
      };
    }),
  ];
  const byDay = new Map<IsoDate, Entry[]>();
  for (const entry of entries) byDay.set(entry.date, [...(byDay.get(entry.date) ?? []), entry]);
  const days = [...byDay.keys()].sort().reverse();

  return [
    `# ${dogName} — training notes`,
    '',
    `Exported ${madridToday(now)} ${time(now)} (Europe/Madrid) · ${logs.length} task logs · ${socialization.length} socialization logs`,
    ...days.flatMap((day) => [
      '',
      `## ${day}`,
      '',
      ...(byDay.get(day) ?? [])
        .sort((a, b) => a.doneAt.getTime() - b.doneAt.getTime())
        .map((entry) => entry.line),
    ]),
    '',
  ].join('\n');
}

/** `dela-notes-2027-01-01.md`, dated in Madrid time. */
export const notesExportFileName = (dogName: string, now: Date): string =>
  `${dogName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-notes-${madridToday(now)}.md`;

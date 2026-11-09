import { isIsoDate, IsoDate } from './dates';
import { collectErrors, ValidationRule } from './validation';

export type Environment = 'rural' | 'urban';

export interface DogDraft {
  arrivalDate: IsoDate;
  birthDate: IsoDate;
  breed: string;
  environment: Environment;
  name: string;
  notes: string;
  sleepsOutdoors: boolean;
}

export interface Dog extends DogDraft {
  id: string;
  /** 1–8; members advance it one week at a time when `planWeekFor` allows it. */
  planWeek: number;
}

export type DogError =
  | 'arrivalBeforeBirth'
  | 'arrivalDateInvalid'
  | 'birthDateInFuture'
  | 'birthDateInvalid'
  | 'breedTooLong'
  | 'nameRequired'
  | 'nameTooLong'
  | 'notesTooLong';

export const DOG_LIMITS = { breed: 60, name: 40, notes: 1000 } as const;

interface DogCheck {
  draft: DogDraft;
  today: IsoDate;
}

const bothDatesValid = ({ draft }: DogCheck): boolean =>
  isIsoDate(draft.birthDate) && isIsoDate(draft.arrivalDate);

// ISO dates compare correctly as strings, so no Date parsing is needed here.
const DOG_RULES: readonly ValidationRule<DogCheck, DogError>[] = [
  { code: 'nameRequired', fails: ({ draft }) => draft.name.trim().length === 0 },
  { code: 'nameTooLong', fails: ({ draft }) => draft.name.trim().length > DOG_LIMITS.name },
  { code: 'birthDateInvalid', fails: ({ draft }) => !isIsoDate(draft.birthDate) },
  {
    code: 'birthDateInFuture',
    fails: ({ draft, today }) => isIsoDate(draft.birthDate) && draft.birthDate > today,
  },
  { code: 'arrivalDateInvalid', fails: ({ draft }) => !isIsoDate(draft.arrivalDate) },
  {
    code: 'arrivalBeforeBirth',
    fails: (check) => bothDatesValid(check) && check.draft.arrivalDate < check.draft.birthDate,
  },
  { code: 'breedTooLong', fails: ({ draft }) => draft.breed.trim().length > DOG_LIMITS.breed },
  { code: 'notesTooLong', fails: ({ draft }) => draft.notes.trim().length > DOG_LIMITS.notes },
];

/** The editable details of a stored dog, to change one of them and save the rest unchanged. */
export const dogDraft = ({
  arrivalDate,
  birthDate,
  breed,
  environment,
  name,
  notes,
  sleepsOutdoors,
}: Dog): DogDraft => ({ arrivalDate, birthDate, breed, environment, name, notes, sleepsOutdoors });

export const validateDogDraft = (draft: DogDraft, today: IsoDate): DogError[] =>
  collectErrors({ draft, today }, DOG_RULES);

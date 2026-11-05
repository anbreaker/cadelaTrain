import { collectErrors, ValidationRule } from './validation';

export const LOCALES = ['en', 'es', 'pt'] as const;

/** `en`: US English (en-US); `es`: Castilian Spanish (es-ES); `pt`: European Portuguese (pt-PT). */
export type Locale = (typeof LOCALES)[number];

export type MemberRole = 'member' | 'owner';

export interface HouseholdMember {
  displayName: string;
  role: MemberRole;
}

export interface Household {
  id: string;
  locale: Locale;
  memberIds: string[];
  members: Record<string, HouseholdMember>;
  name: string;
  ownerId: string;
  timezone: 'Europe/Madrid';
}

export interface HouseholdDraft {
  locale: string;
  name: string;
}

export type HouseholdError = 'localeUnsupported' | 'nameRequired' | 'nameTooLong';

export const HOUSEHOLD_NAME_MAX = 60;

export const isLocale = (value: string): value is Locale =>
  LOCALES.some((locale) => locale === value);

const HOUSEHOLD_RULES: readonly ValidationRule<HouseholdDraft, HouseholdError>[] = [
  { code: 'nameRequired', fails: (draft) => draft.name.trim().length === 0 },
  { code: 'nameTooLong', fails: (draft) => draft.name.trim().length > HOUSEHOLD_NAME_MAX },
  { code: 'localeUnsupported', fails: (draft) => !isLocale(draft.locale) },
];

export const validateHouseholdDraft = (draft: HouseholdDraft): HouseholdError[] =>
  collectErrors(draft, HOUSEHOLD_RULES);

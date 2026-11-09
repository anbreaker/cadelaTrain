import { HouseholdError } from '@domain/household';

export const HOUSEHOLD_ERROR_KEYS: Record<HouseholdError, string> = {
  localeUnsupported: 'household.errors.localeUnsupported',
  nameRequired: 'household.errors.nameRequired',
  nameTooLong: 'household.errors.nameTooLong',
};

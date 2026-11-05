import { validateHouseholdDraft } from './household';

describe('validateHouseholdDraft', () => {
  it('should accept a trimmed name of 1 to 60 characters and a supported locale', () => {
    expect(validateHouseholdDraft({ locale: 'pt', name: ' Finca ' })).toEqual([]);
  });

  it('should require a name', () => {
    expect(validateHouseholdDraft({ locale: 'es', name: '   ' })).toEqual(['nameRequired']);
  });

  it('should reject a name longer than 60 characters', () => {
    expect(validateHouseholdDraft({ locale: 'es', name: 'x'.repeat(61) })).toEqual(['nameTooLong']);
  });

  it('should reject an unsupported locale', () => {
    expect(validateHouseholdDraft({ locale: 'en', name: 'Finca' })).toEqual(['localeUnsupported']);
  });
});

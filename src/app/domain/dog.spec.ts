import { DogDraft, validateDogDraft } from './dog';

const TODAY = '2026-11-04';

const validDraft = (overrides: Partial<DogDraft> = {}): DogDraft => ({
  arrivalDate: '2026-12-10',
  birthDate: '2026-10-15',
  breed: 'Labrador',
  environment: 'rural',
  name: 'Dela',
  notes: '',
  sleepsOutdoors: true,
  ...overrides,
});

describe('validateDogDraft', () => {
  it('should accept a complete draft, including an arrival date in the future', () => {
    expect(validateDogDraft(validDraft(), TODAY)).toEqual([]);
  });

  it('should require a name', () => {
    expect(validateDogDraft(validDraft({ name: ' ' }), TODAY)).toEqual(['nameRequired']);
  });

  it('should reject a name longer than 40 characters', () => {
    expect(validateDogDraft(validDraft({ name: 'x'.repeat(41) }), TODAY)).toEqual(['nameTooLong']);
  });

  it('should require a valid birth date', () => {
    expect(validateDogDraft(validDraft({ birthDate: '' }), TODAY)).toEqual(['birthDateInvalid']);
  });

  it('should reject a birth date in the future', () => {
    expect(validateDogDraft(validDraft({ birthDate: '2026-11-05' }), TODAY)).toEqual([
      'birthDateInFuture',
    ]);
  });

  it('should require a valid arrival date', () => {
    expect(validateDogDraft(validDraft({ arrivalDate: '2026-02-30' }), TODAY)).toEqual([
      'arrivalDateInvalid',
    ]);
  });

  it('should reject an arrival date earlier than the birth date', () => {
    expect(validateDogDraft(validDraft({ arrivalDate: '2026-10-14' }), TODAY)).toEqual([
      'arrivalBeforeBirth',
    ]);
  });

  it('should accept every inclusive boundary', () => {
    const draft = validDraft({
      arrivalDate: TODAY,
      birthDate: TODAY,
      breed: 'x'.repeat(60),
      name: 'x'.repeat(40),
      notes: ` ${'x'.repeat(1000)} `,
    });

    expect(validateDogDraft(draft, TODAY)).toEqual([]);
  });

  it('should reject a breed longer than 60 characters and notes longer than 1000', () => {
    expect(
      validateDogDraft(validDraft({ breed: 'x'.repeat(61), notes: 'x'.repeat(1001) }), TODAY)
    ).toEqual(['breedTooLong', 'notesTooLong']);
  });
});

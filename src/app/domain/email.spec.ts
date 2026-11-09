import { isValidEmail, normalizeEmail } from './email';

describe('normalizeEmail', () => {
  it('should trim and lowercase, matching the invitation document id', () => {
    expect(normalizeEmail('  Jessica.Perez@Example.COM ')).toBe('jessica.perez@example.com');
  });
});

describe('isValidEmail', () => {
  it.each(['ana@example.com', 'a.b+dog@finca.es'])('should accept %s', (value) => {
    expect(isValidEmail(value)).toBe(true);
  });

  it.each(['', 'ana', 'ana@', '@example.com', 'ana@example', 'ana @example.com', 'a@b@c.com'])(
    'should reject %j',
    (value) => {
      expect(isValidEmail(value)).toBe(false);
    }
  );
});

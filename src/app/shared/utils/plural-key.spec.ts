import { pluralKey } from './plural-key';

describe('pluralKey', () => {
  it('should pick the singular key for one in Spanish and Portuguese', () => {
    expect(pluralKey('dog.arrivesIn', 1, 'es')).toBe('dog.arrivesIn.one');
    expect(pluralKey('dog.arrivesIn', 1, 'pt')).toBe('dog.arrivesIn.one');
  });

  it('should pick the plural key for any other count, including zero and large numbers', () => {
    expect(pluralKey('dog.arrivesIn', 36, 'es')).toBe('dog.arrivesIn.other');
    expect(pluralKey('dog.arrivesIn', 0, 'pt')).toBe('dog.arrivesIn.other');
    expect(pluralKey('dog.arrivesIn', 1_000_000, 'es')).toBe('dog.arrivesIn.other');
  });
});

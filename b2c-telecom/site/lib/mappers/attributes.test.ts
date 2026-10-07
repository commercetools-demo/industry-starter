import {
  attrBool,
  attrDate,
  attrEnumKey,
  attrEnumKeys,
  attrLocalized,
  attrLocalizedSet,
  attrNumber,
  attrString,
  attrStringSet,
} from './attributes';

const attrs = [
  { name: 'n', value: 5 },
  { name: 's', value: 'text' },
  { name: 'b', value: true },
  { name: 'e', value: { key: 'cable', label: { 'en-US': 'Cable', 'de-DE': 'Kabel' } } },
  { name: 'es', value: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }, 'x'] },
  { name: 'ss', value: ['one', 2, 'two'] },
  { name: 'l', value: { 'en-US': 'None', 'de-DE': 'Keine' } },
  { name: 'ls', value: [{ 'en-US': 'One', 'de-DE': 'Eins' }, { 'en-US': 'Two' }, 'bad'] },
  { name: 'd', value: '2026-11-01T00:00:00.000Z' },
  { name: 'bad-date', value: 'tomorrow' },
];

describe('attribute readers', () => {
  it('read plain values', () => {
    expect(attrNumber(attrs, 'n')).toBe(5);
    expect(attrString(attrs, 's')).toBe('text');
    expect(attrBool(attrs, 'b')).toBe(true);
    expect(attrDate(attrs, 'd')).toBe('2026-11-01T00:00:00.000Z');
  });
  it('read enum keys and ignore the label', () => {
    expect(attrEnumKey(attrs, 'e')).toBe('cable');
    expect(attrEnumKeys(attrs, 'es')).toEqual(['a', 'b']);
  });
  it('read string sets, dropping non-strings', () => {
    expect(attrStringSet(attrs, 'ss')).toEqual(['one', 'two']);
  });
  it('read localized text and sets with the en-US fallback', () => {
    expect(attrLocalized(attrs, 'l', 'de-DE')).toBe('Keine');
    expect(attrLocalizedSet(attrs, 'ls', 'de-DE')).toEqual(['Eins', 'Two']);
  });
  it('return undefined or [] for missing or wrongly typed attributes and never throw', () => {
    expect(attrNumber(attrs, 's')).toBeUndefined();
    expect(attrString(attrs, 'n')).toBeUndefined();
    expect(attrBool(attrs, 'missing')).toBeUndefined();
    expect(attrEnumKey(attrs, 'n')).toBeUndefined();
    expect(attrEnumKeys(attrs, 'n')).toEqual([]);
    expect(attrStringSet(undefined, 'ss')).toEqual([]);
    expect(attrLocalized(attrs, 's', 'en-US')).toBeUndefined();
    expect(attrLocalizedSet(attrs, 'n', 'en-US')).toEqual([]);
    expect(attrDate(attrs, 'bad-date')).toBeUndefined();
  });
});

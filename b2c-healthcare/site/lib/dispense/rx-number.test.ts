import { describe, expect, it } from 'vitest';
import { echoable, escapeHtml, normalizeRx, notFoundMessage } from './rx-number';

describe('design-plp › Lookup: normalisation', () => {
  it.each([
    ['RX-48213', 'RX-48213'],
    ['rx 48213', 'RX-48213'],
    ['RX48213', 'RX-48213'],
    ['rx-48213', 'RX-48213'],
    ['  Rx - 48213  ', 'RX-48213'],
  ])('%s becomes %s', (input, expected) => expect(normalizeRx(input)).toBe(expected));

  it.each(['', 'RX', 'RX-12', 'RX-abc', '48213', 'RX-48213; drop', 'XRX-48213', 'RX-123456789012', "RX-48213'"])('%s is not an RX number', (input) => {
    expect(normalizeRx(input)).toBeNull();
  });
});

describe('design-plp › Unknown or foreign RX: the message', () => {
  it('names the input and tells the patient what to check', () => {
    expect(notFoundMessage('RX-00000')).toBe("We couldn't find “RX-00000”. Check the number printed on your prescription.");
  });

  it('escapes HTML and strips control characters and length', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
    expect(echoable('a\u0000b\nc')).toBe('abc');
    expect(echoable('x'.repeat(100))).toHaveLength(40);
    expect(notFoundMessage('<b>')).toContain('&lt;b&gt;');
  });
});

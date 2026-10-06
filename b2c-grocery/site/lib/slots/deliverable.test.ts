import { describe, expect, it } from 'vitest';
import { isDeliverable, isValidPostalCode } from './deliverable';

describe('isDeliverable', () => {
  it.each([['US', '10001'], ['US', '10001-1234'], ['DE', '10115']])('%s %s is deliverable', (c, p) => {
    expect(isDeliverable(c, p)).toBe(true);
  });
  it.each([['US', '00123'], ['US', '99999'], ['DE', '00100'], ['DE', '99084']])('%s %s starting with 00 or 99 is not deliverable', (c, p) => {
    expect(isDeliverable(c, p)).toBe(false);
  });
  it.each([['US', '1234'], ['US', '12345-12'], ['DE', '12345-1234'], ['DE', 'ABCDE'], ['FR', '75001'], ['US', '']])('%s "%s" has an invalid shape', (c, p) => {
    expect(isValidPostalCode(c, p)).toBe(false);
    expect(isDeliverable(c, p)).toBe(false);
  });
});

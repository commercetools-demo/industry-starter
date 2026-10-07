import { cx } from './cx';

describe('cx', () => {
  it('joins strings and skips false, null, undefined and empty parts', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b');
  });
});

// @vitest-environment node
import 'server-only';

describe('server-only alias', () => {
  it('lets a file that imports server-only run under Vitest', () => {
    expect(true).toBe(true);
  });
});

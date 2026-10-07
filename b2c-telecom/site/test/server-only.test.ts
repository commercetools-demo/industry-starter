// @vitest-environment node
import { SERVER_ONLY_SAMPLE } from './fixtures/server-only-sample';

describe('server-only alias', () => {
  it('a module that starts with import "server-only" can be imported under Vitest', () => {
    expect(SERVER_ONLY_SAMPLE).toBe('ok');
  });
});

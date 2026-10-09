// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { notFoundError, requireOwnership } from './ownership';

describe("malva-client-portal › Another company's document", () => {
  it('passes for the same company', () => { expect(() => requireOwnership({ businessUnitKey: 'a' }, 'a')).not.toThrow(); });
  it('another company, a missing owner and a missing session unit all give the same not-found', () => {
    const expected = notFoundError();
    for (const [session, owner] of [[{ businessUnitKey: 'a' }, 'b'], [{ businessUnitKey: 'a' }, undefined], [{}, 'a']] as const) {
      try { requireOwnership(session, owner); throw new Error('should throw'); } catch (e) {
        expect(e).toMatchObject({ status: 404, message: expected.message });
        expect(JSON.stringify(e)).not.toMatch(/\ba\b|\bb\b/);
      }
    }
  });
});

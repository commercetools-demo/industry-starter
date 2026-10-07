import { ApiError } from '@/lib/api-error';
import { assertSameOrigin } from './origin';

const post = (headers: Record<string, string>, url = 'http://localhost:3000/api/auth/login'): Request => new Request(url, { method: 'POST', headers });

describe('assertSameOrigin', () => {
  it('accepts an Origin whose host equals the request host', () => {
    expect(() => assertSameOrigin(post({ origin: 'http://localhost:3000' }))).not.toThrow();
    expect(() => assertSameOrigin(post({ origin: 'https://shop.example', 'x-forwarded-host': 'shop.example' }))).not.toThrow();
  });

  it('refuses another origin, another port and a missing Origin with 403 FORBIDDEN', () => {
    const refused: Record<string, string>[] = [{ origin: 'https://evil.example' }, { origin: 'http://localhost:3001' }, {}, { origin: 'not a url' }];
    for (const headers of refused) {
      try {
        assertSameOrigin(post(headers));
        throw new Error('expected a refusal');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe('FORBIDDEN');
        expect((error as ApiError).status).toBe(403);
      }
    }
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { resetRateLimits } from '@/lib/rate-limit';
import { RATE_LIMITS, assistantConfigured, assistantEnabled, guardAssistant } from './guard';

const req = () =>
  new Request('https://x.test/api/assistant/turn', {
    method: 'POST',
    headers: { 'x-forwarded-for': '1.2.3.4' },
  });

describe('assistant guard', () => {
  beforeEach(() => resetRateLimits());

  it('is off unless ASSISTANT_ENABLED is true', async () => {
    expect(assistantEnabled({})).toBe(false);
    expect(assistantEnabled({ ASSISTANT_ENABLED: 'yes' })).toBe(false);
    expect(assistantEnabled({ ASSISTANT_ENABLED: 'TRUE' })).toBe(true);
    const res = guardAssistant(req(), 'turn', '', {});
    expect(res?.status).toBe(503);
    expect((await res!.json()).error.code).toBe('assistant_disabled');
  });

  it('limits by class and answers Retry-After', () => {
    const env = { ASSISTANT_ENABLED: 'true' };
    for (let i = 0; i < RATE_LIMITS.turn.limit; i++) expect(guardAssistant(req(), 'turn', 's', env)).toBeNull();
    const res = guardAssistant(req(), 'turn', 's', env);
    expect(res?.status).toBe(429);
    expect(Number(res?.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(guardAssistant(req(), 'card', 's', env)).toBeNull();
  });

  it('checks the model key by name only', () => {
    expect(assistantConfigured({})).toBe(false);
    expect(assistantConfigured({ ANTHROPIC_API_KEY: 'k' })).toBe(true);
  });
});

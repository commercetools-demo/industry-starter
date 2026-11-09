import { describe, expectTypeOf, it } from 'vitest';
import type { EventType } from '@/lib/agent/common/streaming';
import type { AgentEventType } from './protocol';

describe('client protocol mirror', () => {
  it('Event types equal the server union', () => {
    // Compile-time: `tsc` (npm run check) fails when the two unions drift apart.
    expectTypeOf<AgentEventType>().toEqualTypeOf<EventType>();
  });
});

import { describe, expect, it } from 'vitest';
import type { ToolDefinition } from './execution';
import { type Message, buildRequestMessages, buildSystemBlocks, contextClock, withEagerInput, withToolCacheControl } from './prompt-assembly';

describe('session clock', () => {
  it('Clock string byte equality, offset included, hour not minute', () => {
    const t = new Date('2026-09-03T09:47:31Z');
    expect(contextClock(t, 'Europe/Berlin')).toBe('2026-09-03T11:00+02:00');
    expect(contextClock(t, 'America/New_York')).toBe('2026-09-03T05:00-04:00');
    expect(contextClock(t, 'America/Toronto')).toBe('2026-09-03T05:00-04:00');
    expect(contextClock(t)).toBe('2026-09-03T09:00+00:00');
    expect(contextClock(new Date('2026-01-15T00:20:00Z'), 'America/New_York')).toBe('2026-01-14T19:00-05:00');
  });

  it('A half hour zone keeps its offset and truncates minutes', () => {
    expect(contextClock(new Date('2026-09-03T09:47:00Z'), 'Asia/Kolkata')).toBe('2026-09-03T15:00+05:30');
  });

  it('Midnight renders as 00 not 24', () => {
    expect(contextClock(new Date('2026-09-03T04:10:00Z'), 'America/New_York')).toBe('2026-09-03T00:00-04:00');
  });
});

describe('cache layout', () => {
  const tools: ToolDefinition[] = [{ name: 'a' }, { name: 'b' }];

  it('Cache markers sit on the last tool and the static system block only', () => {
    expect(withToolCacheControl(tools).map((t) => 'cache_control' in t)).toEqual([false, true]);
    expect(tools[1]).not.toHaveProperty('cache_control');
    const blocks = buildSystemBlocks('static', 'ctx');
    expect(blocks[0]).toEqual({ type: 'text', text: 'static', cache_control: { type: 'ephemeral' } });
    expect(blocks[1]).toEqual({ type: 'text', text: 'ctx' });
  });

  it('Eager input streaming is added to the request copy only', () => {
    const out = withEagerInput(tools, new Set(['b']));
    expect(out[1]).toHaveProperty('eager_input_streaming', true);
    expect(tools[1]).not.toHaveProperty('eager_input_streaming');
  });

  const msgs: Message[] = [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: [{ type: 'text', text: 'ok' }, { type: 'tool_use', id: '1', name: 'x', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: '1', content: 'r' }] },
  ];

  it('The rolling marker lands on the newest block of an auto round, never in the stored history', () => {
    const copy = JSON.stringify(msgs);
    const req = buildRequestMessages(msgs);
    const last = req[2].content as Record<string, unknown>[];
    expect(last[0]).toHaveProperty('cache_control');
    expect(JSON.stringify(msgs)).toBe(copy);
  });

  it('A forced round and a single message skip the marker', () => {
    expect(JSON.stringify(buildRequestMessages(msgs, { rollingBreakpoint: false }))).not.toContain('cache_control');
    expect(JSON.stringify(buildRequestMessages([msgs[0]]))).not.toContain('cache_control');
  });

  it('A thinking block is never marked: the marker walks back to the newest markable block', () => {
    const m: Message[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: [{ type: 'text', text: 'hello' }, { type: 'thinking', thinking: 't', signature: 's' }] },
    ];
    const req = buildRequestMessages(m);
    const blocks = req[1].content as Record<string, unknown>[];
    expect(blocks[0]).toHaveProperty('cache_control');
    expect(blocks[1]).not.toHaveProperty('cache_control');
  });

  it('A stale marker from an earlier call is stripped and exactly one marker is sent', () => {
    const stale: Message[] = [
      { role: 'user', content: [{ type: 'text', text: 'hi', cache_control: { type: 'ephemeral' } }] },
      { role: 'assistant', content: [{ type: 'text', text: 'yo' }] },
    ];
    const json = JSON.stringify(buildRequestMessages(stale));
    expect(json.match(/cache_control/g)).toHaveLength(1);
    expect(JSON.stringify(stale)).toContain('cache_control');
  });

  it('A tool_result message followed by the next user message goes out as one user message, tool_result first', () => {
    const m: Message[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: [{ type: 'tool_use', id: '1', name: 'x', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: '1', content: 'r' }] },
      { role: 'user', content: 'next question' },
    ];
    const req = buildRequestMessages(m, { rollingBreakpoint: false });
    expect(req).toHaveLength(3);
    const blocks = req[2].content as { type: string }[];
    expect(blocks.map((b) => b.type)).toEqual(['tool_result', 'text']);
  });
});

// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../common/prompt-assembly';
import type { AgentEvent } from '../common/streaming';
import { SHOPPING_CONFIG } from '../deployment';
import { defineShoppingConfig } from '../shopping/config';
import { newSessionState } from '../shopping/types';
import { loadSkillRegistry } from '../skills';
import { FakeBackend, FakeModelClient, type ScriptedRound, product, session } from '../testing';
import { ShoppingAgent } from './orchestrator';

const skills = loadSkillRegistry();

const make = (rounds: ScriptedRound[] | ((r: Record<string, unknown>, n: number) => ScriptedRound), backend = new FakeBackend([product('A', { title: 'Ember pods' }), product('B', { title: 'Casa beans' })]), config = SHOPPING_CONFIG) => {
  const client = new FakeModelClient(rounds);
  const agent = new ShoppingAgent({ backend, skills, config, client });
  return { agent, client, backend };
};

async function run(agent: ShoppingAgent, messages: Message[], opts: Parameters<ShoppingAgent['streamTurn']>[3] = {}, state = newSessionState(), s = session()) {
  const events: AgentEvent[] = [];
  for await (const e of agent.streamTurn(messages, s, state, opts)) events.push(e);
  return events;
}
const user = (text: string): Message[] => [{ role: 'user', content: text }];
const types = (events: AgentEvent[]): string[] => events.map((e) => e.type);

afterEach(() => vi.restoreAllMocks());

describe('turn loop', () => {
  it('A text only turn streams deltas and completes with usage', async () => {
    const { agent } = make([{ blocks: [{ type: 'text', text: 'Hello there, shopper.' }] }]);
    const messages = user('hi');
    const events = await run(agent, messages);
    expect(events.filter((e) => e.type === 'text_delta').map((e) => e.data.text).join('')).toBe('Hello there, shopper.');
    const done = events.at(-1)!;
    expect(done.type).toBe('turn_complete');
    expect(done.data).toMatchObject({ stop_reason: 'end_turn', results_cleared: 0, usage: { input_tokens: 100, output_tokens: 1 } });
    expect(messages).toHaveLength(2);
    expect(messages[1].role).toBe('assistant');
  });

  it('A tool round then a text round: the call is announced, run once, and its result is paired', async () => {
    const { agent, backend } = make([
      { blocks: [{ type: 'tool_use', name: 'search_products', input: { status: 'Looking for pods', query: 'ember' } }] },
      { blocks: [{ type: 'text', text: 'Found one.' }] },
    ]);
    const messages = user('find ember pods');
    const events = await run(agent, messages);
    expect(types(events)).toEqual(['tool_call', 'tool_result', 'text_delta', 'text_delta', 'turn_complete']);
    expect(events[0].data).toMatchObject({ tool: 'search_products', label: 'Looking for pods', input: { query: 'ember' } });
    expect(backend.calls.filter((c) => c === 'searchProducts')).toHaveLength(1);
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect((messages[2].content as unknown as { tool_use_id: string }[])[0].tool_use_id).toBe('toolu_0_1');
  });

  it('A round of clean presentation calls with the chips ends the turn with no closing model call and no prose', async () => {
    const state = newSessionState();
    const { agent, client } = make([
      { blocks: [{ type: 'tool_use', name: 'search_products', input: { query: 'ember' } }] },
      { blocks: [{ type: 'tool_use', name: 'present_products', input: { picks: [{ product_id: 'A' }] } }, { type: 'tool_use', name: 'present_suggestions', input: { suggestions: ['Compare'] } }] },
      { blocks: [{ type: 'text', text: 'SHOULD NOT BE CALLED' }] },
    ]);
    const events = await run(agent, user('pods'), {}, state);
    expect(client.requests).toHaveLength(2);
    expect(events.some((e) => e.type === 'text_delta')).toBe(false);
    expect(events.at(-1)!.data.stop_reason).toBe('end_turn');
    const ui = events.filter((e) => e.type === 'ui');
    expect(ui.map((e) => e.data.component)).toEqual(['products', 'suggestions']);
    expect(ui[0].data.stream_id).toBe('toolu_1_1');
  });

  it('A refused presentation call does not close the turn: the model gets the instruction and tries again', async () => {
    const { agent, client } = make([
      { blocks: [{ type: 'tool_use', name: 'present_products', input: { picks: [{ product_id: 'GHOST' }] } }, { type: 'tool_use', name: 'present_suggestions', input: { suggestions: ['x'] } }] },
      { blocks: [{ type: 'text', text: 'Let me search first.' }] },
    ]);
    const events = await run(agent, user('show me things'));
    expect(client.requests).toHaveLength(2);
    const blocked = events.find((e) => e.type === 'tool_result' && e.data.status === 'blocked')!;
    expect(blocked.data.reason).toBe('provenance');
  });

  it('Partial card frames arrive before the final one and share its stream id', async () => {
    const state = newSessionState();
    state.seenProducts.set('A', product('A'));
    state.seenProducts.set('B', product('B'));
    const { agent } = make([
      { blocks: [{ type: 'tool_use', name: 'present_products', input: { title: 'Pods', picks: [{ product_id: 'A', reason: 'strong' }, { product_id: 'B' }] } }, { type: 'tool_use', name: 'present_suggestions', input: { suggestions: ['ok'] } }] },
    ]);
    const events = await run(agent, user('show'), {}, state);
    const idx = (t: string) => events.findIndex((e) => e.type === t && e.data.component === 'products');
    const partials = events.filter((e) => e.type === 'ui_partial');
    expect(partials.length).toBeGreaterThan(0);
    expect(events.findIndex((e) => e.type === 'ui_partial')).toBeLessThan(idx('ui'));
    expect(new Set(partials.map((e) => e.data.stream_id))).toEqual(new Set(['toolu_0_1']));
    expect(events.find((e) => e.type === 'ui' && e.data.component === 'products')!.data.stream_id).toBe('toolu_0_1');
    // Structural frames only: never a half-written title or id.
    const titles = partials.map((e) => (e.data.payload as { title?: string }).title).filter(Boolean);
    expect(titles.every((t) => t === 'Pods')).toBe(true);
  });

  it('Eager dispatch starts a call when its block closes, before the rest of the round has streamed', async () => {
    const order: string[] = [];
    const backend = new FakeBackend([product('A', { title: 'Ember' })]);
    const original = backend.searchProducts.bind(backend);
    backend.searchProducts = async (...args) => {
      order.push('search-started');
      return original(...args);
    };
    const { agent } = make([{ blocks: [{ type: 'tool_use', name: 'search_products', input: { query: 'ember' } }, { type: 'text', text: 'Trailing text after the call closes.' }] }, { blocks: [{ type: 'text', text: 'done' }] }], backend);
    for await (const e of agent.streamTurn(user('x'), session(), newSessionState())) {
      if (e.type === 'text_delta' && !order.includes('first-text')) order.push('first-text');
    }
    expect(order).toEqual(['search-started', 'first-text']);
  });
});

describe('forced rounds and caching', () => {
  it('An order question forces the order read on the first round only, and the rolling cache marker is skipped on it', async () => {
    const backend = new FakeBackend();
    backend.orders = [];
    // A model that accepts a forced tool_choice (Sonnet 5.5 does not; see the next test).
    const forcing = defineShoppingConfig('claude-sonnet-5', { ...SHOPPING_CONFIG, model: 'claude-sonnet-5' });
    const { agent, client } = make([{ blocks: [{ type: 'tool_use', name: 'get_orders', input: {} }] }, { blocks: [{ type: 'text', text: 'You have none.' }] }], backend, forcing);
    await run(agent, user('where is my order?'));
    expect(client.requests[0].tool_choice).toEqual({ type: 'tool', name: 'get_orders' });
    expect(client.requests[1].tool_choice).toEqual({ type: 'auto' });
    expect(JSON.stringify(client.requests[0].messages)).not.toContain('cache_control');
    expect(JSON.stringify(client.requests[1].messages)).toContain('cache_control');
  });

  it('On the deployment model (no forced tool_choice) an order question never sends tool/any and the context names the tool', async () => {
    // Regression: claude-sonnet-5-5 answers tool_choice {type: "tool"} with a 400, so every grounded turn failed before it started.
    expect(SHOPPING_CONFIG.model).toBe('claude-sonnet-5-5');
    const backend = new FakeBackend();
    backend.orders = [];
    const { agent, client } = make([{ blocks: [{ type: 'tool_use', name: 'get_orders', input: {} }] }, { blocks: [{ type: 'text', text: 'You have none.' }] }], backend);
    await run(agent, user('Where is my last order?'));
    for (const req of client.requests) expect(['auto', 'none']).toContain((req.tool_choice as { type: string }).type);
    const context = (client.requests[0] as { system: { text: string }[] }).system[1].text;
    expect(context).toContain('call the `get_orders` tool');
    // Runtime-authored: after the fenced data, never inside it; same bytes on every round of the turn.
    expect(context.indexOf('# Required first step')).toBeGreaterThan(context.lastIndexOf('# Session context'));
    expect((client.requests[1] as { system: { text: string }[] }).system[1].text).toBe(context);
    expect((client.requests[0] as { system: { text: string }[] }).system[0].text).not.toContain('Required first step');
  });

  it('A grounded turn that skips its read is logged with the tool name only', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { agent } = make([{ blocks: [{ type: 'text', text: 'Your order is fine.' }] }], new FakeBackend());
    await run(agent, user('Where is my last order?'));
    const logged = warn.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('assistant_grounding_skipped'));
    expect(logged).toEqual([JSON.stringify({ event: 'assistant_grounding_skipped', tool: 'get_orders' })]);
    warn.mockRestore();
  });

  it('Cache markers are on the last tool and the static system block; the context block is behind them and carries the cart', async () => {
    const backend = new FakeBackend();
    backend.cart.items = [{ productId: 'A', title: 'a', price: 5, quantity: 2, optionValues: {} }];
    const { agent, client } = make([{ blocks: [{ type: 'text', text: 'hi' }] }], backend);
    await run(agent, user('hello'));
    const req = client.requests[0] as { system: { text: string; cache_control?: unknown }[]; tools: { name: string; cache_control?: unknown }[] };
    expect(req.tools.at(-1)!.cache_control).toEqual({ type: 'ephemeral' });
    expect(req.tools.slice(0, -1).some((t) => 'cache_control' in t)).toBe(false);
    expect(req.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(req.system[1].cache_control).toBeUndefined();
    expect(req.system[1].text).toContain('"item_count":2');
    expect(req.system[0].text).not.toContain('item_count');
  });

  it('The static system block and the tools are byte identical across turns; only the context block moves', async () => {
    const backend = new FakeBackend();
    const { agent, client } = make([{ blocks: [{ type: 'text', text: 'hi' }] }], backend);
    await run(agent, user('one'));
    backend.cart.items = [{ productId: 'A', title: 'a', price: 5, quantity: 1, optionValues: {} }];
    await run(agent, user('two'));
    const [a, b] = client.requests as { system: { text: string }[]; tools: unknown[] }[];
    expect(a.system[0].text).toBe(b.system[0].text);
    expect(JSON.stringify(a.tools)).toBe(JSON.stringify(b.tools));
    expect(a.system[1].text).not.toBe(b.system[1].text);
  });

  it('The request carries adaptive thinking only for a recognised model family', async () => {
    const known = make([{ blocks: [{ type: 'text', text: 'hi' }] }]);
    await run(known.agent, user('x'));
    expect(known.client.requests[0].thinking).toEqual({ type: 'adaptive' });
    const unknown = make([{ blocks: [{ type: 'text', text: 'hi' }] }], undefined, defineShoppingConfig('some-other-model', { ...SHOPPING_CONFIG, model: 'some-other-model' }));
    await run(unknown.agent, user('x'));
    expect(unknown.client.requests[0]).not.toHaveProperty('thinking');
    expect(unknown.client.requests[0]).not.toHaveProperty('output_config');
  });

  it('The iteration cap forces a final round with tools disabled, so a runaway loop ends in prose', async () => {
    const { agent, client } = make((_r, n) => (n < 4 ? { blocks: [{ type: 'tool_use', name: 'get_cart', input: {} }] } : { blocks: [{ type: 'text', text: 'Here is where things stand.' }] }));
    const events = await run(agent, user('loop forever'));
    expect(client.requests).toHaveLength(5);
    expect(client.requests.map((r) => (r.tool_choice as { type: string }).type)).toEqual(['auto', 'auto', 'auto', 'auto', 'none']);
    expect(events.at(-1)!.type).toBe('turn_complete');
  });

  it('Past the wall-clock deadline the next round runs with tools disabled', async () => {
    const config = defineShoppingConfig('claude-sonnet-5-5', { ...SHOPPING_CONFIG, turnDeadlineS: 0.05 });
    const { agent, client } = make((_r, n) => (n === 0 ? { delayMs: 80, blocks: [{ type: 'tool_use', name: 'get_cart', input: {} }] } : { blocks: [{ type: 'text', text: 'Wrapping up.' }] }), undefined, config);
    const events = await run(agent, user('slow'));
    expect(client.requests).toHaveLength(2);
    expect((client.requests[1].tool_choice as { type: string }).type).toBe('none');
    expect(events.at(-1)!.type).toBe('turn_complete');
  });

  it('Usage counters are the stream totals, replaced not added (many delta events do not multiply them)', async () => {
    const { agent } = make([{ blocks: [{ type: 'text', text: 'a long reply that arrives in many deltas' }], usage: { input_tokens: 10, cache_read_input_tokens: 90, output_tokens: 7 } }]);
    const events = await run(agent, user('x'));
    expect(events.at(-1)!.data.usage).toEqual({ input_tokens: 10, output_tokens: 7, cache_read_input_tokens: 90, cache_creation_input_tokens: 0 });
  });
});

describe('malformed, abandoned and cancelled rounds', () => {
  it('A non JSON streamed tool input reaches the salvage path: the call is not run and the model is told to send it again', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { agent, backend } = make([
      { blocks: [{ type: 'tool_use', name: 'add_to_cart', rawInput: '{"product_id": "A", "quantity": SECRET-NOT-JSON' }] },
      { blocks: [{ type: 'text', text: 'Sorry, trying again.' }] },
    ]);
    const messages = user('add A');
    const events = await run(agent, messages);
    expect(backend.calls).not.toContain('addToCart');
    const result = events.find((e) => e.type === 'tool_result')!;
    expect(result.data.is_error).toBe(true);
    expect(String(result.data.summary)).toBe('The arguments for this call did not arrive as valid JSON, so it was not run. Send the call again.');
    expect(JSON.stringify(messages)).not.toContain('SECRET-NOT-JSON');
    const logged = warn.mock.calls.map((c) => String(c[0])).join('');
    expect(logged).toContain('assistant_tool_input_unreadable');
    expect(logged).not.toContain('SECRET-NOT-JSON');
    // The stored assistant message is still valid for the next request: the call is recorded with {} as its input.
    const assistant = messages[1].content as { type: string; input?: unknown }[];
    expect(assistant.find((b) => b.type === 'tool_use')!.input).toEqual({});
  });

  it('Abandoning the generator mid round pairs every open tool call with a result', async () => {
    // Eager dispatch off: the calls are announced after the assistant message is stored, which is exactly the window where a closed
    // connection would leave a tool call with no result (the API rejects that conversation on the NEXT request).
    const config = defineShoppingConfig('claude-sonnet-5-5', { ...SHOPPING_CONFIG, eagerToolDispatch: false });
    const { agent } = make([{ blocks: [{ type: 'tool_use', name: 'get_cart', input: {} }, { type: 'tool_use', name: 'get_preferences', input: {} }] }], undefined, config);
    const messages = user('hello');
    const gen = agent.streamTurn(messages, session(), newSessionState());
    // Take events until the first tool_call was announced, then walk away (the browser closed the tab).
    for await (const e of gen) {
      if (e.type === 'tool_call') break;
    }
    expect(messages.at(-1)!.role).toBe('user');
    const results = messages.at(-1)!.content as unknown as { type: string; tool_use_id: string; content: string }[];
    expect(results.map((r) => r.type)).toEqual(['tool_result', 'tool_result']);
    expect(results.map((r) => r.tool_use_id).sort()).toEqual(['toolu_0_1', 'toolu_0_2']);
    expect(results.every((r) => r.content === 'The turn was interrupted before this call returned; call it again if it is still needed.')).toBe(true);
  });

  it('Closing the generator at the results yield reports the calls that already finished as done, not as interrupted', async () => {
    const { agent } = make([{ blocks: [{ type: 'tool_use', name: 'get_preferences', input: {} }] }]);
    const messages = user('hello');
    for await (const e of agent.streamTurn(messages, session(), newSessionState())) {
      if (e.type === 'tool_result') break;
    }
    const results = messages.at(-1)!.content as unknown as { content: string }[];
    expect(results[0].content).toContain('storefront_data');
    expect(results[0].content).not.toMatch(/interrupted/);
  });

  it('A cancelled round leaves no unhandled rejection and no dangling call', async () => {
    const rejections: unknown[] = [];
    const onRejection = (r: unknown): number => rejections.push(r);
    process.on('unhandledRejection', onRejection);
    const backend = new FakeBackend();
    backend.searchProducts = async () => {
      throw new Error('backend blew up after the caller left');
    };
    const { agent } = make([{ blocks: [{ type: 'tool_use', name: 'search_products', input: { query: 'x' } }, { type: 'text', text: 'trailing text to keep streaming' }] }], backend);
    const messages = user('x');
    for await (const e of agent.streamTurn(messages, session(), newSessionState())) {
      if (e.type === 'tool_call') break;
    }
    await new Promise((r) => setTimeout(r, 30));
    process.off('unhandledRejection', onRejection);
    expect(rejections).toEqual([]);
    expect(messages.at(-1)!.role).not.toBe('assistant');
  });

  it('A stream that dies mid round propagates the error and leaves a conversation the next request can send', async () => {
    const { agent } = make([{ blocks: [{ type: 'text', text: 'partial reply' }], failAfterEvents: 4 }]);
    const messages = user('hello');
    await expect(run(agent, messages)).rejects.toThrow('connection dropped');
    expect(messages).toEqual(user('hello'));
  });

  it('Aborting the outer signal reaches the backend through the session context', async () => {
    const backend = new FakeBackend([product('A')]);
    let seen: AbortSignal | undefined;
    const original = backend.searchProducts.bind(backend);
    backend.searchProducts = async (s, ...rest) => {
      seen = s.signal;
      return original(s, ...rest);
    };
    const outer = new AbortController();
    const { agent } = make([{ blocks: [{ type: 'tool_use', name: 'search_products', input: { query: 'A' } }] }, { blocks: [{ type: 'text', text: 'ok' }] }], backend);
    await run(agent, user('x'), { signal: outer.signal });
    expect(seen).toBeDefined();
    expect(seen!.aborted).toBe(true); // aborted at the turn's end: nothing started may outlive its turn
  });
});

describe('persistence and compaction', () => {
  it('The session is persisted immediately before turn_complete, and a failed write surfaces instead of vanishing', async () => {
    const order: string[] = [];
    const { agent } = make([{ blocks: [{ type: 'text', text: 'hi' }] }]);
    for await (const e of agent.streamTurn(user('x'), session(), newSessionState(), { beforeComplete: async () => void order.push('persist') })) order.push(e.type);
    expect(order.at(-2)).toBe('persist');
    expect(order.at(-1)).toBe('turn_complete');
    const failing = make([{ blocks: [{ type: 'text', text: 'hi' }] }]);
    await expect(run(failing.agent, user('x'), { beforeComplete: async () => { throw new Error('store down'); } })).rejects.toThrow('store down');
  });

  it('A turn that compacts reports how many results it cleared so the host rewrites the transcript whole', async () => {
    const config = defineShoppingConfig('claude-sonnet-5-5', { ...SHOPPING_CONFIG, compactHistoryAboveTokens: 50 });
    const big = 'x'.repeat(3000);
    const messages: Message[] = [
      { role: 'user', content: 'earlier' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'old1', name: 'get_cart', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'old1', content: big, is_error: false }] },
      { role: 'assistant', content: [{ type: 'text', text: 'done' }] },
      { role: 'user', content: 'now' },
    ];
    const { agent } = make([{ blocks: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 500 } }], undefined, config);
    let cleared = -1;
    const events = await run(agent, messages, { beforeComplete: async ({ resultsCleared }) => void (cleared = resultsCleared) });
    expect(cleared).toBe(1);
    expect(events.at(-1)!.data.results_cleared).toBe(1);
    expect((messages[2].content as unknown as { content: string }[])[0].content).toMatch(/^\[result cleared/);
  });

  it('A turn log line carries the session tag, never the session id', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { agent } = make([{ blocks: [{ type: 'text', text: 'hi' }] }]);
    await run(agent, user('x'), {}, newSessionState(), session({ sessionId: 'super-secret-session-id-0123456789' }));
    const logged = info.mock.calls.map((c) => String(c[0])).join('');
    expect(logged).toContain('assistant_model_call');
    expect(logged).not.toContain('super-secret-session-id');
    expect(logged).not.toContain('Bearer');
  });
});

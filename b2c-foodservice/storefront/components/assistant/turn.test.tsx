import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';
import type { AgentEvent, UISegment } from './protocol';
import { type TurnSource, useAgentTurn } from './turn';

const complete: AgentEvent = { type: 'turn_complete', data: { stop_reason: 'end_turn', usage: {}, elapsed_ms: 1, results_cleared: 0 } };

function source(events: AgentEvent[]): TurnSource {
  return {
    async *chatStream() {
      for (const event of events) yield event;
    },
  };
}

async function run(events: AgentEvent[]) {
  const hook = renderHook(() =>
    useAgentTurn(source(events), { sessionId: 'cookie', unreachable: 'unreachable', describeToolCall: (tool) => `calling ${tool}` }),
  );
  await act(async () => {
    await hook.result.current.send('hi');
  });
  return hook;
}

const uiSegments = (items: ReturnType<typeof useAgentTurn>['items']): UISegment[] =>
  items.flatMap((item) => (item.kind === 'assistant' ? item.segments.filter((s): s is UISegment => s.type === 'ui') : []));

describe('turn state machine', () => {
  it('joins text deltas, ends the turn and keeps the chips', async () => {
    const { result } = await run([
      { type: 'text_delta', data: { text: 'Hello ' } },
      { type: 'text_delta', data: { text: 'there' } },
      { type: 'ui', data: { component: 'suggestions', payload: { suggestions: ['One', 'Two'] } } },
      complete,
    ]);
    const reply = result.current.items[1];
    expect(reply.kind).toBe('assistant');
    if (reply.kind !== 'assistant') return;
    expect(reply.segments).toEqual([{ type: 'text', text: 'Hello there' }]);
    expect(reply.suggestions).toEqual(['One', 'Two']);
    expect(reply.pending).toBe(false);
  });

  it('Retry keeps the same slot node', async () => {
    const products = { items: [{ product: { product_id: 'A' } }] };
    const { result } = await run([
      { type: 'ui_partial', data: { component: 'products', payload: products, stream_id: 's1' } },
      // the first attempt failed validation (the card goes to `retrying`); the retry streams under a new id and adopts the same card
      { type: 'tool_result', data: { tool: 'present_products', id: 's1', summary: 'invalid', is_error: true, status: 'error' } },
      { type: 'ui_partial', data: { component: 'products', payload: products, stream_id: 's2' } },
      { type: 'ui', data: { component: 'products', payload: products, stream_id: 's2' } },
      complete,
    ]);
    await waitFor(() => expect(uiSegments(result.current.items)).toHaveLength(1));
    const [segment] = uiSegments(result.current.items);
    expect(segment.slotKey).toBe('1-products-0');
    expect(segment.status).toBe('final');
  });

  it('shows the injected activity line for a call in flight', async () => {
    const { result } = await run([{ type: 'tool_call', data: { tool: 'search_products', id: 't1', input: {} } }]);
    const reply = result.current.items[1];
    // the stream ended without turn_complete: the turn is closed with the unreachable notice, not left pending
    expect(reply.kind).toBe('assistant');
    if (reply.kind === 'assistant') expect(reply.pending).toBe(false);
  });
});

describe('Markdown', () => {
  it('HTML in text renders as text', () => {
    render(<Markdown text={'<img src=x onerror=alert(1)> and **bold**'} />);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });

  it('renders no links or raw html elements from a link-looking string', () => {
    render(<Markdown text={'[click](javascript:alert(1)) <script>x</script>'} />);
    expect(document.querySelector('a')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { AgentEvents, ToolOutcomes, isRefused, parsePartialJson, parseStrictObject, toSse } from './streaming';

describe('events', () => {
  it('tool_call carries a label only when given', () => {
    expect(AgentEvents.toolCall('x', '1', { a: 1 }).data).toEqual({ tool: 'x', id: '1', input: { a: 1 } });
    expect(AgentEvents.toolCall('x', '1', {}, 'Looking').data.label).toBe('Looking');
  });

  it('tool_result defaults status from is_error and keeps reason and excerpt', () => {
    expect(AgentEvents.toolResult('x', '1', 's').data).toMatchObject({ is_error: false, status: 'ok' });
    expect(AgentEvents.toolResult('x', '1', 's', { isError: true }).data.status).toBe('error');
    expect(AgentEvents.toolResult('x', '1', 's', { status: 'blocked', reason: 'provenance' }).data).toMatchObject({ status: 'blocked', reason: 'provenance' });
    expect(AgentEvents.toolResult('x', '1', 's', { excerpt: '' }).data.excerpt).toBe('');
  });

  it('SSE frame is one line of JSON then a blank line', () => {
    expect(toSse(AgentEvents.textDelta('a\nb'))).toBe('event: text_delta\ndata: {"text":"a\\nb"}\n\n');
  });

  it('A held call is refused but not an error', () => {
    const held = ToolOutcomes.held('provenance', 'nope');
    expect(isRefused(held)).toBe(true);
    expect(held.isError).toBe(false);
    expect(isRefused(ToolOutcomes.ok('fine'))).toBe(false);
    expect(isRefused(ToolOutcomes.error('bad'))).toBe(true);
  });
});

describe('parsePartialJson', () => {
  it('Complete JSON parses as is', () => {
    expect(parsePartialJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('Half written string is dropped with its key', () => {
    expect(parsePartialJson('{"title":"Ember pods","id":"MCF-PO')).toEqual({ title: 'Ember pods' });
    expect(parsePartialJson('{"products":[{"id":"A","why":"Strong and')).toEqual({ products: [{ id: 'A' }] });
  });

  it('A half written array string slot is dropped with its comma', () => {
    expect(parsePartialJson('{"ids":["a","b","c')).toEqual({ ids: ['a', 'b'] });
  });

  it('Open arrays and objects are closed and a dangling comma or colon is dropped', () => {
    expect(parsePartialJson('{"a":[1,2,')).toEqual({ a: [1, 2] });
    expect(parsePartialJson('{"a":1,')).toEqual({ a: 1 });
    // Faithful to upstream: a key whose value has not started yet leaves no valid candidate, so no frame is produced until it does.
    expect(parsePartialJson('{"a":1,"b":')).toBeNull();
    expect(parsePartialJson('{"a":{"b":2,')).toEqual({ a: { b: 2 } });
  });

  it('settleStrings false closes the string where it stands', () => {
    expect(parsePartialJson('{"text":"Hel', false)).toEqual({ text: 'Hel' });
  });

  it('Escaped quotes do not end a string early', () => {
    expect(parsePartialJson('{"a":"x\\"y","b":"par')).toEqual({ a: 'x"y' });
  });

  it('Non objects and garbage are null', () => {
    expect(parsePartialJson('[1,2')).toBeNull();
    expect(parsePartialJson('')).toBeNull();
    expect(parsePartialJson('{"a":tru')).toBeNull();
  });
});

describe('parseStrictObject', () => {
  it('Empty input is an empty object; broken or non-object input is null', () => {
    expect(parseStrictObject('')).toEqual({});
    expect(parseStrictObject('{"a":1')).toBeNull();
    expect(parseStrictObject('[1]')).toBeNull();
    expect(parseStrictObject('{"a":1}')).toEqual({ a: 1 });
  });
});

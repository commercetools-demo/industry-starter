import { describe, expect, it } from 'vitest';
import { describe as words, evaluate, parseRule, selectRecipients, type CustomerFact, type Rule } from './audience';

const NOW = Date.parse('2026-10-12T12:00:00Z');
const fact = (over: Partial<CustomerFact>): CustomerFact => ({ customerId: 'c', consent: true, categoryKeys: [], skus: [], lastOrderAt: null, ...over });

const rule: Rule = { all: [{ type: 'bought-category', categoryKey: 'discs' }, { type: 'not-bought-category', categoryKey: 'pads' }] };

describe('audience excludes non-consented', () => {
  it('never selects a customer who has not consented, even when the rule matches', () => {
    const facts = [fact({ customerId: 'a', categoryKeys: ['discs'] }), fact({ customerId: 'b', categoryKeys: ['discs'], consent: false }), fact({ customerId: 'c', categoryKeys: ['discs', 'pads'] })];
    expect(selectRecipients(rule, facts, NOW).map((f) => f.customerId)).toEqual(['a']);
    expect(selectRecipients({ all: [{ type: 'registered' }] }, [fact({ consent: false })], NOW)).toEqual([]);
  });
  it('evaluates idle periods against now; a customer who never ordered counts as idle', () => {
    const idle: Rule = { all: [{ type: 'no-order-since', days: 90 }] };
    expect(evaluate(idle, fact({ lastOrderAt: '2026-01-01T00:00:00Z' }), NOW)).toBe(true);
    expect(evaluate(idle, fact({ lastOrderAt: '2026-10-01T00:00:00Z' }), NOW)).toBe(false);
    expect(evaluate(idle, fact({}), NOW)).toBe(true);
  });
  it('describes a rule in words with the category names', () => {
    expect(words(rule, { discs: 'Brake discs', pads: 'Pads' })).toBe('bought Brake discs and did not buy Pads');
  });
  it('parses stored rules strictly', () => {
    expect(parseRule({ all: [{ type: 'registered' }] })).toEqual({ all: [{ type: 'registered' }] });
    expect(parseRule({ all: [{ type: 'bought-category', categoryKey: 'a b' }] })).toBeNull();
    expect(parseRule({ all: [{ type: 'no-order-since', days: 0 }] })).toBeNull();
    expect(parseRule({ all: [{ type: 'sql', q: 'x' }] })).toBeNull();
    expect(parseRule('x')).toBeNull();
  });
});

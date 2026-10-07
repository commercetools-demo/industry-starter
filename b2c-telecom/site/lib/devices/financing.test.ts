import type { FinancingLine, FinancingRequest } from '@/lib/types';
import { usd } from './__fixtures__/devices';
import { createStubProvider, decisionIdOf, financedTotalOf, fnv1a32, getFinancingProvider } from './financing';

const NOW = new Date('2026-10-07T12:00:00Z');
const provider = createStubProvider(() => NOW);
const line = (lineId: string, monthly: number, termMonths: number, quantity = 1, mode: FinancingLine['mode'] = 'installments'): FinancingLine => ({ lineId, mode, termMonths, quantity, monthly: usd(monthly) });
const request = (patch: Partial<FinancingRequest> = {}): FinancingRequest => ({ customerId: 'c-1', creditFlag: 'approve', currency: 'USD', lines: [line('l1', 3300, 36)], ...patch });

describe('the financing stub, rules in order', () => {
  it('(a) nothing financed: approved, even for a guest and even for a declined customer', async () => {
    expect(await provider.decide(request({ lines: [], customerId: null, creditFlag: null }))).toMatchObject({ outcome: 'approved', reason: 'no-financed-lines', financedTotal: usd(0) });
    expect(await provider.decide(request({ lines: [], creditFlag: 'decline' }))).toMatchObject({ outcome: 'approved', reason: 'no-financed-lines' });
  });

  it('(b) a financed line and no customer: sign in first', async () => {
    expect(await provider.decide(request({ customerId: null, creditFlag: null }))).toMatchObject({ outcome: 'sign-in-required', reason: 'sign-in-required' });
    // it comes before the customer flag and the limit
    expect(await provider.decide(request({ customerId: null, creditFlag: 'decline', lines: [line('l1', 99999, 36, 3)] }))).toMatchObject({ outcome: 'sign-in-required' });
  });

  it('(c) the customer flag says decline: declined before the amount is looked at', async () => {
    expect(await provider.decide(request({ creditFlag: 'decline', lines: [line('l1', 100, 12)] }))).toMatchObject({ outcome: 'declined', reason: 'customer-declined' });
  });

  it('(d) over the limit: declined; at the limit: approved', async () => {
    // 2 x Nova Pro 512 GB installments 36 = 2 x 3300 x 36 = 237600, below 250000
    expect(await provider.decide(request({ lines: [line('l1', 3300, 36, 2)] }))).toMatchObject({ outcome: 'approved', reason: 'ok', financedTotal: usd(237600), limit: usd(250000) });
    // 3 x = 356400
    expect(await provider.decide(request({ lines: [line('l1', 3300, 36, 3)] }))).toMatchObject({ outcome: 'declined', reason: 'amount-over-limit', financedTotal: usd(356400) });
    // exactly the limit: 250000 = 5000 x 50 x 1
    expect((await provider.decide(request({ lines: [line('l1', 5000, 50)] }))).outcome).toBe('approved');
    expect((await provider.decide(request({ lines: [line('l1', 5001, 50)] }))).outcome).toBe('declined');
  });

  it('the total adds every financed line, lease included', async () => {
    const lines = [line('a', 4200, 24), line('b', 3300, 24, 1, 'lease')];
    expect(financedTotalOf(request({ lines }))).toEqual(usd(4200 * 24 + 3300 * 24));
  });

  it('EUR has its own limit of 2,300', async () => {
    const eur = (monthly: number, term: number): FinancingRequest => ({ customerId: 'c-1', creditFlag: 'approve', currency: 'EUR', lines: [{ lineId: 'l', mode: 'installments', termMonths: term, quantity: 1, monthly: { centAmount: monthly, currencyCode: 'EUR' } }] });
    expect(await provider.decide(eur(6388, 36))).toMatchObject({ outcome: 'approved', limit: { centAmount: 230000, currencyCode: 'EUR' } });
    expect(await provider.decide(eur(6389, 36))).toMatchObject({ outcome: 'declined', reason: 'amount-over-limit' });
  });

  it('records when the decision was made', async () => {
    expect((await provider.decide(request())).decidedAt).toBe('2026-10-07T12:00:00.000Z');
  });
});

describe('the decision id', () => {
  it('is deterministic: the same request always gives the same id, whatever the order of the lines', () => {
    const a = request({ lines: [line('l1', 3300, 36), line('l2', 4200, 24)] });
    const b = request({ lines: [line('l2', 4200, 24), line('l1', 3300, 36)] });
    expect(decisionIdOf(a)).toBe(decisionIdOf(b));
    expect(decisionIdOf(a)).toMatch(/^stub-[0-9a-f]{8}$/);
  });
  it('changes with the customer, the currency, the lines and their amounts', () => {
    const base = decisionIdOf(request());
    expect(decisionIdOf(request({ customerId: 'c-2' }))).not.toBe(base);
    expect(decisionIdOf(request({ currency: 'EUR' }))).not.toBe(base);
    expect(decisionIdOf(request({ lines: [line('l1', 3301, 36)] }))).not.toBe(base);
    expect(decisionIdOf(request({ lines: [line('l1', 3300, 36, 2)] }))).not.toBe(base);
  });
  it('fnv1a32 matches the published test vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });
  it('the provider in use is the stub and answers', async () => {
    expect((await getFinancingProvider().decide(request({ lines: [] }))).outcome).toBe('approved');
  });
});

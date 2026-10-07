import { buildSchedule, serializeSchedules } from '../../lib/pricing/schedule';
import type { Money, PriceSchedule } from '../../lib/types';

const get = vi.fn();
const post = vi.fn();
vi.mock('@/lib/ct/client', () => ({
  getApiRoot: () => ({ orders: () => ({ get: (args: unknown) => ({ execute: () => get(args) }), post }) }),
}));

import { runSweep, SWEEP_WHERE } from './schedule-sweep';

const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });

function schedule(offerKey: string, sku: string, termMonths: number, standing: number, m2m: number, introApplied: boolean): PriceSchedule {
  const result = buildSchedule({ offerKey, sku, termMonths, quantity: 1, standing: usd(standing), introApplied, monthToMonth: usd(m2m), oneTimeDueNow: usd(0), orderDate: '2026-10-07' });
  if (!result.ok) throw new Error('schedule expected');
  return result.value;
}

const stepped = schedule('malva-offer-phone-unlimited', 'MLV-PHN-UNL-24M', 24, 4500, 5000, false);
const intro = schedule('malva-offer-cable-100', 'MLV-CBL-100-24M', 24, 3999, 4999, true);

const order = (orderNumber: string, schedules: PriceSchedule[] | string) => ({
  id: `id-${orderNumber}`,
  orderNumber,
  custom: { fields: { priceSchedule: typeof schedules === 'string' ? schedules : serializeSchedules(schedules) } },
});

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('schedule sweep', () => {
  it('prints the due transitions on their boundaries and performs no write call', async () => {
    get.mockResolvedValue({ body: { results: [order('MLV-1', [stepped]), order('MLV-2', [intro])] } });
    const lines: string[] = [];
    expect(await runSweep('2027-10-07', (l) => lines.push(l))).toBe(0);
    expect(lines).toContain('2027-10-07 step order=MLV-1 sku=MLV-PHN-UNL-24M new amount=50.00 USD');
    expect(lines.some((l) => l.includes('MLV-2'))).toBe(false);
    expect(lines.at(-1)).toBe('0 writes');
    lines.length = 0;
    await runSweep('2027-04-07', (l) => lines.push(l));
    expect(lines).toContain('2027-04-07 intro-ends order=MLV-2 sku=MLV-CBL-100-24M new amount=39.99 USD');
    lines.length = 0;
    await runSweep('2028-10-07', (l) => lines.push(l));
    expect(lines.filter((l) => l.includes('term-ends'))).toHaveLength(2);
    expect(post).not.toHaveBeenCalled();
    for (const call of get.mock.calls) expect((call[0] as { queryArgs: { where: string } }).queryArgs.where).toBe(SWEEP_WHERE);
  });

  it('prints "no schedules found" when no order has a schedule', async () => {
    get.mockResolvedValue({ body: { results: [{ id: 'x', orderNumber: 'MLV-X', custom: { fields: {} } }] } });
    const lines: string[] = [];
    expect(await runSweep('2027-10-07', (l) => lines.push(l))).toBe(0);
    expect(lines).toEqual(['no schedules found', '0 writes']);
  });

  it('reports an unreadable schedule and keeps going', async () => {
    get.mockResolvedValue({ body: { results: [order('MLV-BAD', '{"v":2}'), order('MLV-1', [stepped])] } });
    const lines: string[] = [];
    await runSweep('2027-10-07', (l) => lines.push(l));
    expect(lines[0]).toBe('warning: MLV-BAD has an unreadable price schedule (BAD_VERSION)');
    expect(lines.some((l) => l.includes('MLV-1'))).toBe(true);
  });

  it('reads every page', async () => {
    const page = Array.from({ length: 100 }, (_, i) => order(`MLV-${i}`, [stepped]));
    get.mockResolvedValueOnce({ body: { results: page } }).mockResolvedValueOnce({ body: { results: [order('MLV-LAST', [intro])] } });
    const lines: string[] = [];
    await runSweep('2026-10-07', (l) => lines.push(l));
    expect(get).toHaveBeenCalledTimes(2);
    expect((get.mock.calls[1]?.[0] as { queryArgs: { offset: number } }).queryArgs.offset).toBe(100);
    expect(lines[0]).toBe('schedules checked: 101, date: 2026-10-07');
  });
});

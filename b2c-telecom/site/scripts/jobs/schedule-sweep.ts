// npm run job:schedule-sweep -- [--today=YYYY-MM-DD]
// Dry run only: lists the price-schedule boundaries (intro ends, step, term ends) that fall due on a day. Billing is out of scope
// (D-059), so a future billing integration or an operator acts on this report. It never writes to commercetools.
import { getApiRoot } from '@/lib/ct/client';
import { parseDateOnly, toDateOnly } from '@/lib/pricing/dates';
import { dueTransitions, parseSchedules } from '@/lib/pricing/schedule';
import type { PriceSchedule } from '@/lib/types';

const PAGE = 100;
export const SWEEP_WHERE = 'custom(fields(priceSchedule is defined)) and orderState in ("Open","Confirmed")';

export type SweepLog = (line: string) => void;

const formatMoney = (m: { centAmount: number; currencyCode: string }): string => `${(m.centAmount / 100).toFixed(2)} ${m.currencyCode}`;

export async function runSweep(today: string, log: SweepLog = console.log): Promise<number> {
  const entries: { orderNumber: string; schedule: PriceSchedule }[] = [];
  let offset = 0;
  for (;;) {
    const { body } = await getApiRoot()
      .orders()
      .get({ queryArgs: { where: SWEEP_WHERE, limit: PAGE, offset, sort: ['createdAt asc'] } })
      .execute();
    for (const order of body.results) {
      const raw = order.custom?.fields?.priceSchedule;
      const label = order.orderNumber ?? order.id;
      if (typeof raw !== 'string') continue;
      const parsed = parseSchedules(raw);
      if (!parsed.ok) {
        log(`warning: ${label} has an unreadable price schedule (${parsed.error})`);
        continue;
      }
      for (const schedule of parsed.value) entries.push({ orderNumber: label, schedule });
    }
    offset += body.results.length;
    if (body.results.length < PAGE) break;
  }
  if (entries.length === 0) {
    log('no schedules found');
    log('0 writes');
    return 0;
  }
  const due = dueTransitions(entries, today);
  log(`schedules checked: ${entries.length}, date: ${today}`);
  for (const t of due) log(`${t.on} ${t.kind} order=${t.orderNumber} sku=${t.sku} new amount=${formatMoney(t.newAmount)}`);
  if (due.length === 0) log('nothing falls due on this date');
  log('0 writes');
  return 0;
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // the process environment alone is used
  }
  const arg = process.argv.slice(2).find((a) => a.startsWith('--today='))?.slice('--today='.length);
  if (arg !== undefined && parseDateOnly(arg) === null) {
    console.error(`--today must be YYYY-MM-DD, got "${arg}"`);
    process.exitCode = 2;
    return;
  }
  process.exitCode = await runSweep(arg ?? toDateOnly(new Date()));
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : 'sweep failed');
    process.exitCode = 1;
  });
}

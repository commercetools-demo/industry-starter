/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// npm run job:recurring-reconcile
// Read-only report: for every active recurring order, the generated orders whose line total differs from the standing amount stored on the
// first order's price schedule (promotions apply to the first order only, so there should be none). It never writes to commercetools.
// The `recurringOrder` reference on generated orders and `originOrder` on recurring orders are the platform's own links; confirm the query on
// the project with spike 3.1 of the dtv-experience-parity change before relying on an empty report.
import { getApiRoot } from '@/lib/ct/client';
import { findMismatches, type GeneratedOrder } from '@/lib/pricing/reconcile';
import { parseSchedules } from '@/lib/pricing/schedule';

const PAGE = 100;
export type ReconcileLog = (line: string) => void;
const formatMoney = (m: { centAmount: number; currencyCode: string }): string => `${(m.centAmount / 100).toFixed(2)} ${m.currencyCode}`;

export async function runReconcile(log: ReconcileLog = console.log): Promise<number> {
  const api = getApiRoot();
  let checked = 0;
  let mismatched = 0;
  for (let offset = 0; ; ) {
    const { body } = await api.recurringOrders().get({ queryArgs: { where: 'recurringOrderState(type="Active")', limit: PAGE, offset, expand: ['originOrder'] } }).execute();
    for (const recurring of body.results) {
      const origin = recurring.originOrder.obj;
      const raw = origin?.custom?.fields?.priceSchedule;
      if (typeof raw !== 'string') continue;
      const parsed = parseSchedules(raw);
      if (!parsed.ok) {
        log(`warning: ${origin?.orderNumber ?? recurring.id} has an unreadable price schedule (${parsed.error})`);
        continue;
      }
      const generated = await api.orders().get({ queryArgs: { where: `recurringOrder(id="${recurring.id}")`, limit: PAGE, sort: ['createdAt asc'] } }).execute();
      const orders: GeneratedOrder[] = generated.body.results.map((order) => ({
        orderNumber: order.orderNumber ?? order.id,
        createdAt: order.createdAt,
        lines: order.lineItems.map((line) => ({ sku: line.variant.sku ?? '', quantity: line.quantity, total: { centAmount: line.totalPrice.centAmount, currencyCode: line.totalPrice.currencyCode } })),
      }));
      checked += orders.length;
      for (const found of findMismatches(parsed.value, orders)) {
        mismatched += 1;
        log(`mismatch order=${found.orderNumber} sku=${found.sku} expected=${formatMoney(found.expected)} actual=${formatMoney(found.actual)} difference=${(found.difference / 100).toFixed(2)}`);
      }
    }
    offset += body.results.length;
    if (body.results.length < PAGE) break;
  }
  log(`generated orders checked: ${checked}, mismatches: ${mismatched}`);
  log('0 writes');
  return mismatched > 0 ? 1 : 0;
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // the process environment alone is used
  }
  process.exitCode = await runReconcile();
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : 'reconcile failed');
    process.exitCode = 2;
  });
}

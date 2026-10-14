// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Returns of the store (S-02): one orders request, return items flattened. Status words come from the seed type
// `malva-return-item` (`seed/src/data/custom-types.ts` RETURN_STATUSES); without the type the native `shipmentState` stands in.
import 'server-only';
import type { Order, ReturnItem } from '@commercetools/platform-sdk';
import { adminRoot } from '@/lib/ct/admin-client';
import { EXCLUDE_TEST_ORDERS, shortName } from './names';
import { withTimeout } from './timeout';
import type { ReturnRow, ReturnStatus } from '@/lib/dashboard/types';

/** Counted by the Open returns KPI: requested to inspected. */
export const OPEN_RETURN_STATUSES: readonly ReturnStatus[] = ['requested', 'in-transit', 'received', 'inspected'];
/** The two states that wait for the reseller. */
export const TO_HANDLE_STATUSES: readonly ReturnStatus[] = ['requested', 'received'];

const KNOWN: readonly string[] = ['requested', 'in-transit', 'received', 'inspected', 'refunded', 'rejected'];

/** The custom `status`, else the native shipment state (Advised is requested, Returned is received); null when neither says anything. */
export function returnStatus(item: Pick<ReturnItem, 'custom' | 'shipmentState'>): ReturnStatus | null {
  const custom = item.custom?.fields?.status;
  if (typeof custom === 'string' && KNOWN.includes(custom)) return custom as ReturnStatus;
  if (item.shipmentState === 'Advised') return 'requested';
  if (item.shipmentState === 'Returned') return 'received';
  return null;
}

const PAGE = 100;

async function loadReturnRows(storeKey: string): Promise<ReturnRow[]> {
  const { body } = await adminRoot
    .inStoreKeyWithStoreKeyValue({ storeKey })
    .orders()
    .get({ queryArgs: { where: `returnInfo is not empty and ${EXCLUDE_TEST_ORDERS}`, sort: 'lastModifiedAt desc', limit: PAGE } })
    .execute();
  return body.results.flatMap((order: Order) =>
    (order.returnInfo ?? []).flatMap((info) =>
      info.items.flatMap((item) => {
        const status = returnStatus(item);
        if (!status) return [];
        const line = 'lineItemId' in item ? order.lineItems.find((l) => l.id === item.lineItemId) : undefined;
        const number = item.custom?.fields?.returnNumber;
        return [
          {
            id: `${order.id}:${item.id}`,
            returnNumber: typeof number === 'string' && number ? number : (info.returnTrackingId ?? item.id),
            orderNumber: order.orderNumber ?? order.id,
            customer: shortName(order.shippingAddress ?? order.billingAddress),
            items: line ? [{ quantity: item.quantity, name: line.name }] : [],
            status,
          } satisfies ReturnRow,
        ];
      }),
    ),
  );
}

/** Return items that wait for the reseller (requested or received), at most `limit`. One orders request. */
export function listReturnsToHandle(storeKey: string, limit = 5): Promise<ReturnRow[]> {
  return withTimeout(loadReturnRows(storeKey).then((rows) => rows.filter((r) => TO_HANDLE_STATUSES.includes(r.status)).slice(0, limit)));
}

/** Return items in an open status (requested, in transit, received, inspected). One orders request. */
export function countOpenReturns(storeKey: string): Promise<number> {
  return withTimeout(loadReturnRows(storeKey).then((rows) => rows.filter((r) => OPEN_RETURN_STATUSES.includes(r.status)).length));
}

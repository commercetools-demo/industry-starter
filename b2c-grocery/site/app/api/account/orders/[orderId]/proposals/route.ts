/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { privateJson, unauthenticated } from '@/lib/api/private-json';
import { proposalFailure } from '@/lib/api/proposal-failure';
import { getProposalsForOrder } from '@/lib/ct/order-edits';
import { getMarket, getSession } from '@/lib/session';

type Context = { params: Promise<{ orderId: string }> };

/** Pending substitution proposals of the signed-in customer's order, plus the lines whose proposal was declined. */
export async function GET(_request: Request, { params }: Context) {
  const { customerId } = await getSession();
  if (!customerId) return unauthenticated();
  const { orderId } = await params;
  try {
    const { locale } = await getMarket();
    return privateJson(await getProposalsForOrder(orderId, customerId, locale));
  } catch (e) {
    return proposalFailure(e);
  }
}

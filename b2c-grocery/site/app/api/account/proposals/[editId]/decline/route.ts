/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { privateJson, unauthenticated } from '@/lib/api/private-json';
import { proposalFailure } from '@/lib/api/proposal-failure';
import { declineProposal } from '@/lib/ct/order-edits';
import { getSession } from '@/lib/session';

type Context = { params: Promise<{ editId: string }> };

/** Records a removal request: the proposal is marked declined and the Order Edit is NOT applied. */
export async function POST(_request: Request, { params }: Context) {
  const { customerId } = await getSession();
  if (!customerId) return unauthenticated();
  const { editId } = await params;
  try {
    await declineProposal(editId, customerId);
    return privateJson({ ok: true });
  } catch (e) {
    return proposalFailure(e);
  }
}

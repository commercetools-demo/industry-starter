import { privateJson, unauthenticated } from '@/lib/api/private-json';
import { proposalFailure } from '@/lib/api/proposal-failure';
import { acceptProposal } from '@/lib/ct/order-edits';
import { getSession } from '@/lib/session';

type Context = { params: Promise<{ editId: string }> };

/** Applies the Order Edit of a pending proposal. 404 not theirs, 422 `NOT_EDITABLE`, 409 `STALE` (order changed meanwhile). */
export async function POST(_request: Request, { params }: Context) {
  const { customerId } = await getSession();
  if (!customerId) return unauthenticated();
  const { editId } = await params;
  try {
    await acceptProposal(editId, customerId);
    return privateJson({ ok: true });
  } catch (e) {
    return proposalFailure(e);
  }
}

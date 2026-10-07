import { accountRoute } from '@/lib/api/account-api';
import { withListErrors } from '@/lib/api/lists-api';
import { moveListToBundle, type MoveOutcome } from '@/lib/ct/list-to-bundle';
import { updateSession } from '@/lib/ct/session';
import { getMarket } from '@/lib/market/server';
import type { BundleMoveResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * "Add all to My bundle": every saved line goes through the same rules as the offer cards; refused and unavailable lines are listed
 * with their reasons. The list is never changed. The bundle is the SESSION's (no cart id from the client).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let outcome: MoveOutcome | undefined;
  return accountRoute<BundleMoveResult>(
    request,
    {
      mutating: true,
      after: async (response, _data, { session }) => {
        if (outcome && outcome.cartId && outcome.cartId !== session.cartId) await updateSession({ cartId: outcome.cartId }, response);
      },
    },
    ({ session }) =>
      withListErrors(async () => {
        const { id } = await params;
        outcome = await moveListToBundle(session, await getMarket(), id);
        return outcome.result;
      }),
  );
}

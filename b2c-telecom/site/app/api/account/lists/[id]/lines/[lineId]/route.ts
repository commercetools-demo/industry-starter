import { accountRoute } from '@/lib/api/account-api';
import { withListErrors } from '@/lib/api/lists-api';
import { removeLine, toDetail } from '@/lib/ct/lists';
import { getMarket } from '@/lib/market/server';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  return accountRoute(request, { mutating: true }, ({ session }) =>
    withListErrors(async () => {
      const { id, lineId } = await params;
      return { list: await toDetail(await removeLine(session.customerId, id, lineId), await getMarket()) };
    }),
  );
}

import { accountRoute } from '@/lib/api/account-api';
import { paymentMethodViews, withPaymentErrors } from '@/lib/api/payment-methods-api';
import { removePaymentMethod } from '@/lib/ct/payment-methods';

export const dynamic = 'force-dynamic';

/** Removes (makes Inactive) one of THIS customer's methods; a foreign or unknown id is the same 404. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return accountRoute(request, { mutating: true }, ({ session }) =>
    withPaymentErrors(async () => {
      const { id } = await params;
      await removePaymentMethod(session.customerId, id);
      return paymentMethodViews(session.customerId);
    }),
  );
}

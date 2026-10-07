import { accountRoute } from '@/lib/api/account-api';
import { paymentMethodViews, withPaymentErrors } from '@/lib/api/payment-methods-api';
import { setDefaultPaymentMethod } from '@/lib/ct/payment-methods';

export const dynamic = 'force-dynamic';

/** Makes one of THIS customer's methods the default (the previous default is cleared first). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return accountRoute(request, { mutating: true }, ({ session }) =>
    withPaymentErrors(async () => {
      const { id } = await params;
      await setDefaultPaymentMethod(session.customerId, id);
      return paymentMethodViews(session.customerId);
    }),
  );
}

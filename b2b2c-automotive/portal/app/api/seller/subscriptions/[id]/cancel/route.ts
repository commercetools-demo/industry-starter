// POST /api/seller/subscriptions/[id]/cancel { storeKey, confirm: true } (V-09). Cancelling is final and needs the confirmation.
import { subscriptionActionRoute } from '@/lib/portal/v-route';

export const POST = subscriptionActionRoute('cancel');

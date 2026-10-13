// POST /api/seller/subscriptions/[id]/skip { storeKey } : skips the next renewal of an Active subscription (V-09).
import { subscriptionActionRoute } from '@/lib/portal/v-route';

export const POST = subscriptionActionRoute('skip');

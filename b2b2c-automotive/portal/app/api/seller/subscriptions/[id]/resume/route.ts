// POST /api/seller/subscriptions/[id]/resume { storeKey } (V-09). The target state is the action word, never a client value.
import { subscriptionActionRoute } from '@/lib/portal/v-route';

export const POST = subscriptionActionRoute('resume');

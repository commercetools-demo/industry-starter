import { handle } from '@/lib/api';
import { handleContact } from '@/lib/contact/handle';

export const dynamic = 'force-dynamic';

/** POST /api/contact. See lib/contact/handle.ts for the contract. */
export const POST = handle('/api/contact', (req) => handleContact(req));

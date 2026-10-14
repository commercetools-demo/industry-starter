// POST /api/seller/store/logo (workstream U-05, decision 7): multipart `storeKey` + `file`, uploaded through the server to the
// Contentools object store; the clean URL is saved on the store custom field `logoUrl`.
import { storeHandle } from '@/lib/portal/store-route';
import { handleBrandingUpload } from '@/lib/store/branding-upload';

export const POST = storeHandle((request: Request) => handleBrandingUpload(request, 'logo'));

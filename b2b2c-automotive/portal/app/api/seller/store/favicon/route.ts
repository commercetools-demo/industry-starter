/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/seller/store/favicon (workstream U-05, decision 7): multipart `storeKey` + `file`, uploaded through the server to the
// Contentools object store; the clean URL is saved on the store custom field `faviconUrl`.
import { storeHandle } from '@/lib/portal/store-route';
import { handleBrandingUpload } from '@/lib/store/branding-upload';

export const POST = storeHandle((request: Request) => handleBrandingUpload(request, 'favicon'));

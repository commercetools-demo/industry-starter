/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/seller/tailoring/[productId]/image (multipart: storeKey, file) : validates the bytes (JPG, PNG or WebP, at least
// 600 x 600 px, at most 10 MB; never the Content-Type), uploads through the image store and returns `{ url, width, height }`.
// It does not save: the editor's Save sends the `images` array through PUT, which publishes at once.
import { CatalogError } from '@/lib/catalog/errors';
import { IMAGE_LIMIT_MESSAGE, MAX_IMAGE_BYTES, validateImage } from '@/lib/catalog/image-rules';
import { getImageStore } from '@/lib/ct/seller/image-store';
import { ApiError, json } from '@/lib/portal/route-kit';
import { authorizeSeller, sellerHandle } from '@/lib/portal/seller-route';

export const POST = sellerHandle(async (request: Request) => {
  const declared = Number(request.headers.get('content-length'));
  if (declared > MAX_IMAGE_BYTES + 100_000) throw new CatalogError(400, 'IMAGE_INVALID', IMAGE_LIMIT_MESSAGE);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, 'Invalid upload');
  }
  const storeKey = form.get('storeKey');
  if (typeof storeKey !== 'string' || !storeKey) throw new ApiError(400, 'storeKey is required');
  await authorizeSeller(storeKey, 'tailoring.edit');
  const file = form.get('file');
  if (!(file instanceof File)) throw new ApiError(400, 'No file');
  if (file.size > MAX_IMAGE_BYTES) throw new CatalogError(400, 'IMAGE_INVALID', IMAGE_LIMIT_MESSAGE);
  const check = validateImage(new Uint8Array(await file.arrayBuffer()), file.type);
  if (!check.ok) throw new CatalogError(400, 'IMAGE_INVALID', check.message);
  const url = await getImageStore().upload(storeKey, file);
  return json({ url, width: check.width, height: check.height });
});

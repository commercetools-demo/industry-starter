// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Shared body of `POST /api/seller/store/logo` and `.../favicon` (workstream U-05, decision 7): multipart with `storeKey` and
// `file`; authorize first (403 before the file is read), check the bytes (magic bytes, size, dimensions), upload through the
// image store to the Contentools object store under the store key, then save the clean URL on the store's custom field.
import 'server-only';
import { ApiError, errorResponse, requireCustomer } from '@/lib/api';
import { CONTENTOOLS_ORIGIN } from '@/lib/contentools/origin';
import { setStoreAsset } from '@/lib/ct/seller/store-settings';
import { ContentoolsImageStore, type ImageStore } from '@/lib/images/image-store';
import { MAX_BRANDING_BYTES, validateBrandingImage, type BrandingKind } from '@/lib/images/validate';
import { readSession } from '@/lib/portal/seam';
import { authorizeRequest } from '@/lib/portal/store-route';
import { isAllowedAssetUrl } from '@/lib/store/schemas';

/** Headroom for the multipart envelope around a file of at most MAX_BRANDING_BYTES. */
const MAX_REQUEST_BYTES = MAX_BRANDING_BYTES + 64 * 1024;

export async function handleBrandingUpload(request: Request, kind: BrandingKind, store: ImageStore = ContentoolsImageStore): Promise<Response> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  const contentType = request.headers.get('content-type') ?? '';
  // Authorization needs the store key, which is in the form; read the form, but never the file bytes, before the check.
  if (declared > MAX_REQUEST_BYTES) {
    requireCustomer(await readSession());
    return errorResponse(413, 'The file is too large');
  }
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) throw new ApiError(400, 'Send the image as multipart/form-data');
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, 'Invalid form');
  }
  const { storeKey } = await authorizeRequest(form.get('storeKey'), 'store.edit');
  const file = form.get('file');
  if (!(file instanceof File)) throw new ApiError(400, 'Choose an image');
  const bytes = await file.arrayBuffer();
  const check = validateBrandingImage(new Uint8Array(bytes), kind);
  if (!check.ok) return errorResponse(400, check.message, 'IMAGE_REJECTED');
  // The stored name is ours, never the client's.
  const url = await store.upload(storeKey, { bytes, type: check.mime, name: `${kind}-${Date.now()}.${check.extension}` });
  if (!isAllowedAssetUrl(url, CONTENTOOLS_ORIGIN)) throw new Error('upload returned an unusable address');
  const settings = await setStoreAsset(storeKey, kind === 'logo' ? 'logoUrl' : 'faviconUrl', url);
  return Response.json(settings);
}

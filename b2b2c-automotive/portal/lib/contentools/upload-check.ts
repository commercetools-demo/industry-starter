// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Intake check for the proxied Contentools `upload-file` route (workstream X-07, attack D14): the editors may upload PNG, JPEG,
// WebP or GIF images only, judged by the bytes (never by the declared type or the file name), at most 5 MB. HTML, scripts,
// executables and SVG (it can carry script) are refused before anything is forwarded. Pure.
import 'server-only';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Headroom for the multipart envelope around a file of at most MAX_UPLOAD_BYTES. */
export const MAX_UPLOAD_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

export type UploadVerdict = { ok: true } | { ok: false; status: 400 | 413 | 415; code: 'INVALID_BODY' | 'PAYLOAD_TOO_LARGE' | 'UNSUPPORTED_MEDIA_TYPE' };

const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.slice(o, o + n));

/** The image type of the leading bytes, or null. */
export function sniffImage(b: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'image/webp';
  if (ascii(b, 0, 4) === 'GIF8' && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return 'image/gif';
  return null;
}

/** The multipart body must hold a `file` part that is an image by its bytes and whose declared type is the same image type. */
export async function checkUploadBody(body: ArrayBuffer, contentType: string): Promise<UploadVerdict> {
  if (body.byteLength > MAX_UPLOAD_REQUEST_BYTES) return { ok: false, status: 413, code: 'PAYLOAD_TOO_LARGE' };
  let form: FormData;
  try {
    form = await new Response(body, { headers: { 'content-type': contentType } }).formData();
  } catch {
    return { ok: false, status: 400, code: 'INVALID_BODY' };
  }
  const file = form.get('file');
  if (!(file instanceof File)) return { ok: false, status: 400, code: 'INVALID_BODY' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, status: 413, code: 'PAYLOAD_TOO_LARGE' };
  const sniffed = sniffImage(new Uint8Array(await file.arrayBuffer()));
  if (!sniffed) return { ok: false, status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' };
  if (file.type.toLowerCase() !== sniffed) return { ok: false, status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' };
  return { ok: true };
}

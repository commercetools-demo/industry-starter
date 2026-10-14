// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface MultipartResult {
  fields: Record<string, string>;
  files: UploadedFile[];
}

/** Minimal multipart/form-data parser (enough for the `upload-file` route: one `file` part and text fields). */
export function parseMultipart(body: Buffer, contentType: string): MultipartResult | null {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = m?.[1] ?? m?.[2];
  if (!boundary) return null;
  const delimiter = Buffer.from(`--${boundary.trim()}`);
  const result: MultipartResult = { fields: {}, files: [] };

  let pos = body.indexOf(delimiter);
  while (pos !== -1) {
    const start = pos + delimiter.length;
    if (body.subarray(start, start + 2).toString() === '--') break; // closing delimiter
    const next = body.indexOf(delimiter, start);
    if (next === -1) break;
    // part = CRLF headers CRLFCRLF content CRLF
    const part = body.subarray(start + 2, next - 2);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headers = part.subarray(0, headerEnd).toString('utf8');
      const content = part.subarray(headerEnd + 4);
      const disposition = /content-disposition:[^\r\n]*/i.exec(headers)?.[0] ?? '';
      const name = /\bname="([^"]*)"/i.exec(disposition)?.[1] ?? '';
      const filename = /\bfilename="([^"]*)"/i.exec(disposition)?.[1];
      if (filename !== undefined) {
        const mimetype = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim() ?? 'application/octet-stream';
        result.files.push({ fieldname: name, originalname: filename, mimetype, buffer: Buffer.from(content), size: content.length });
      } else {
        result.fields[name] = content.toString('utf8');
      }
    }
    pos = next;
  }
  return result;
}

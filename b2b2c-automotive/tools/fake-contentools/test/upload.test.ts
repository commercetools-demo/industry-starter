// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
//
// Mirrors routes/file.route.ts: POST /:bu/upload-file (JWT, multer single('file'), answers { url }) and
// GET /:bu/media-library.
import { describe, expect, it } from 'vitest';
import { bearer, NORTH, PROJECT, projectHeader, useFake } from './helpers.ts';

const api = useFake();
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

function form(fields: Record<string, string | { name: string; type: string; data: Buffer; field?: string }>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') fd.append(k, v);
    else fd.append(v.field ?? k, new Blob([new Uint8Array(v.data)], { type: v.type }), v.name);
  }
  return fd;
}

describe('POST /service/:bu/upload-file', () => {
  it('stores the file and answers 200 { url }; the URL serves the same bytes', async () => {
    const r = await api.call('POST', `/service/${NORTH}/upload-file`, {
      headers: bearer(),
      body: form({ file: { name: 'logo.png', type: 'image/png', data: PNG }, title: 'Logo', description: 'Store logo' }),
    });
    expect(r.status).toBe(200);
    expect(Object.keys(r.body)).toEqual(['url']);
    expect(r.body.url).toContain(`/__files/${PROJECT}/${NORTH}/`);
    const file = await fetch(r.body.url);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await file.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it('needs a JWT: 401 and nothing stored', async () => {
    const r = await api.call('POST', `/service/${NORTH}/upload-file`, { body: form({ file: { name: 'logo.png', type: 'image/png', data: PNG } }) });
    expect(r.status).toBe(401);
    expect(api.fake().state.files.size).toBe(0);
  });

  it('no file part: 400 { error: "No file uploaded" } (note: key is error, not message)', async () => {
    const r = await api.call('POST', `/service/${NORTH}/upload-file`, { headers: bearer(), body: form({ title: 'only text' }) });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: 'No file uploaded' });
  });

  it('a JSON body is also "No file uploaded"', async () => {
    const r = await api.call('POST', `/service/${NORTH}/upload-file`, { headers: bearer(), json: {} });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: 'No file uploaded' });
  });

  it('a file under another field name is rejected by multer: 500', async () => {
    const r = await api.call('POST', `/service/${NORTH}/upload-file`, {
      headers: bearer(),
      body: form({ other: { name: 'logo.png', type: 'image/png', data: PNG, field: 'other' } }),
    });
    expect(r.status).toBe(500);
  });

  it('the file name is sanitised in the URL path', async () => {
    const r = await api.call('POST', `/service/${NORTH}/upload-file`, {
      headers: bearer(),
      body: form({ file: { name: '../../evil name.png', type: 'image/png', data: PNG } }),
    });
    expect(r.body.url).not.toContain('..');
    expect(decodeURIComponent(r.body.url)).not.toMatch(/\.\.|\s/);
  });

  it('uses publicBaseUrl for the returned URL when configured', async () => {
    const f = await import('../src/server.ts').then((m) => m.startFakeContentools({ port: 0, publicBaseUrl: 'http://cdn.test' }));
    try {
      const res = await fetch(`${f.url}/service/${NORTH}/upload-file`, { method: 'POST', headers: bearer(), body: form({ file: { name: 'a.png', type: 'image/png', data: PNG } }) });
      expect((await res.json()).url).toMatch(/^http:\/\/cdn\.test\/__files\//);
    } finally {
      await f.close();
    }
  });
});

describe('GET /service/:bu/media-library', () => {
  it('lists uploads with the real response shape and filters by extension', async () => {
    await api.call('POST', `/service/${NORTH}/upload-file`, { headers: bearer(), body: form({ file: { name: 'a.png', type: 'image/png', data: PNG }, title: 'A' }) });
    await api.call('POST', `/service/${NORTH}/upload-file`, { headers: bearer(), body: form({ file: { name: 'b.txt', type: 'text/plain', data: Buffer.from('hi') } }) });
    const all = await api.call('GET', `/service/${NORTH}/media-library`, { headers: projectHeader });
    expect(all.status).toBe(200);
    expect(all.body.pagination).toEqual({ totalItems: 2, totalPages: 1, currentPage: 1, limit: 20 });
    expect(all.body.files[0]).toEqual(expect.objectContaining({ url: expect.any(String), name: expect.any(String), isImage: expect.any(Boolean), size: expect.any(Number) }));
    const png = await api.call('GET', `/service/${NORTH}/media-library?extensions=png`, { headers: projectHeader });
    expect(png.body.files.map((f: { name: string }) => f.name)).toEqual(['a.png']);
  });

  it('needs x-project-key', async () => {
    expect((await api.call('GET', `/service/${NORTH}/media-library`)).status).toBe(400);
  });

  it('unknown stored file is 404', async () => {
    const r = await api.call('GET', '/__files/nope/nope/nope.png');
    expect(r.status).toBe(404);
  });
});

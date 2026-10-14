// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getJwt = vi.fn(async (): Promise<string | null> => 'jwt-value');
vi.mock('./jwt', () => ({ getValidContentoolsJwt: () => getJwt() }));

import { deleteStoreTheme, hasPublishedPage, uploadStoreFile } from './service';

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  getJwt.mockResolvedValue('jwt-value');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

describe('deleteStoreTheme', () => {
  it('sends DELETE with the server JWT and the project key', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await deleteStoreTheme('store-a');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://contentools.example.test/service/store-a/configuration/theme');
    expect(init.method).toBe('DELETE');
    expect(init.headers).toMatchObject({ authorization: 'Bearer jwt-value', 'x-project-key': 'test-project' });
  });

  it('upstream 404 is success, other failures throw, no JWT is a 503', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(deleteStoreTheme('store-a')).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(deleteStoreTheme('store-a')).rejects.toThrow();
    getJwt.mockResolvedValue(null);
    await expect(deleteStoreTheme('store-a')).rejects.toMatchObject({ status: 503 });
  });

  it('refuses a store key that is not a key', async () => {
    await expect(deleteStoreTheme('../x')).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('uploadStoreFile', () => {
  it('posts multipart field file and returns a clean url without query or fragment', async () => {
    fetchMock.mockResolvedValue(Response.json({ url: 'https://files.example.test/p/store-a/logo.png?sig=abc#x' }));
    const url = await uploadStoreFile('store-a', { bytes: new Uint8Array([1, 2, 3]).buffer, type: 'image/png', name: 'logo.png' });
    expect(url).toBe('https://files.example.test/p/store-a/logo.png');
    const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit & { body: FormData }];
    expect(target).toBe('https://contentools.example.test/service/store-a/upload-file');
    expect(init.body.get('file')).toBeInstanceOf(Blob);
    expect(init.headers).toMatchObject({ authorization: 'Bearer jwt-value' });
  });

  it('fails when the upload answers an error or no url', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }));
    await expect(uploadStoreFile('store-a', { bytes: new ArrayBuffer(1), type: 'image/png', name: 'a.png' })).rejects.toThrow();
    fetchMock.mockResolvedValueOnce(Response.json({}));
    await expect(uploadStoreFile('store-a', { bytes: new ArrayBuffer(1), type: 'image/png', name: 'a.png' })).rejects.toThrow();
    fetchMock.mockResolvedValueOnce(Response.json({ url: 'javascript:alert(1)' }));
    await expect(uploadStoreFile('store-a', { bytes: new ArrayBuffer(1), type: 'image/png', name: 'a.png' })).rejects.toThrow();
  });
});

describe('hasPublishedPage', () => {
  it('true for a 200, false for 404 and for failures, no token sent', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ name: 'x' }));
    expect(await hasPublishedPage('store-a', '/link-in-bio')).toBe(true);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ query: 'slug = "/link-in-bio"' });
    expect(init.headers).not.toHaveProperty('authorization');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 }));
    expect(await hasPublishedPage('store-a', '/link-in-bio')).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error('down'));
    expect(await hasPublishedPage('store-a', '/link-in-bio')).toBe(false);
  });
});

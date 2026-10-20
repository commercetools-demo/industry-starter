/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callIntake, intakeBody, resetIntakeToken } from './intake';

const config = { projectKey: 'p', authUrl: 'https://auth.example', apiUrl: 'https://api.example', clientId: 'id', clientSecret: 's', scopes: 'manage_intake_agent:p' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fetchMock = vi.fn();
const token = () => json({ access_token: 'tok', expires_in: 3600 });

beforeEach(() => { resetIntakeToken(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe('intake-submission › raw HTTP client', () => {
  it('sends JSON for text only, with the bearer token', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ entityType: 'Cart', entity: { id: 'c1', version: 1 }, threadId: 't1' }, 201));
    const result = await callIntake({ outputType: 'Cart', locale: 'en-US', prompt: 'x', files: [] }, config);
    expect(result).toEqual({ ok: true, entity: { type: 'Cart', id: 'c1' }, warnings: [] });
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('https://api.example/p/agents/intake/v1/responses');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ outputType: 'Cart', locale: 'en-US', prompt: 'x' });
  });

  it('sends multipart with a payload part that has no filename, and files under "files"', async () => {
    const { body, headers } = await intakeBody({ outputType: 'QuoteRequest', locale: 'en-US', prompt: 'p', files: [{ name: 'po.pdf', data: new Blob(['a']) }, { name: 'l.csv', data: new Blob(['b']) }] });
    const text = await (body as Blob).text();
    expect(headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=/);
    expect(text).toContain('Content-Disposition: form-data; name="payload"\r\nContent-Type: application/json\r\n\r\n{"outputType":"QuoteRequest","locale":"en-US","prompt":"p"}');
    expect(text).not.toMatch(/name="payload"; filename/);
    expect(text).toContain('name="files"; filename="po.pdf"\r\nContent-Type: application/pdf\r\n\r\na');
    expect(text).toContain('name="files"; filename="l.csv"\r\nContent-Type: text/csv\r\n\r\nb');
    expect(text.trimEnd().endsWith(`--${headers['Content-Type'].split('boundary=')[1]}--`)).toBe(true);
  });

  it('keeps cartId and warning codes of a quote request', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ entityType: 'QuoteRequest', entity: { id: 'q1', cart: { typeId: 'cart', id: 'c9' } }, warnings: [{ code: 'ProductsNotFound' }] }, 201));
    expect(await callIntake({ outputType: 'QuoteRequest', locale: 'en-US', prompt: 'x', files: [] }, config)).toEqual({ ok: true, entity: { type: 'QuoteRequest', id: 'q1', cartId: 'c9' }, warnings: ['ProductsNotFound'] });
  });

  it('reports Intake\'s own error code and message, not a generic sentence', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ statusCode: 400, message: 'top', errors: [{ code: 'InvalidField', message: "Unexpected file field 'payload'." }] }, 400));
    expect(await callIntake({ outputType: 'Cart', locale: 'en-US', prompt: 'x', files: [] }, config)).toEqual({ ok: false, code: 'InvalidField', message: "Unexpected file field 'payload'." });
  });

  it('falls back to the top-level message, then to the raw text', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ statusCode: 500, message: 'boom' }, 500));
    expect(await callIntake({ outputType: 'Cart', locale: 'en-US', prompt: 'x', files: [] }, config)).toMatchObject({ code: 'IntakeFailed', message: 'boom' });
    fetchMock.mockResolvedValueOnce(new Response('upstream down', { status: 502 }));
    expect(await callIntake({ outputType: 'Cart', locale: 'en-US', prompt: 'x', files: [] }, config)).toMatchObject({ code: 'IntakeFailed', message: 'upstream down' });
  });

  it('says what is wrong with a 201 body it cannot read', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ entityType: 'Cart' }, 201));
    expect(await callIntake({ outputType: 'Cart', locale: 'en-US', prompt: 'x', files: [] }, config)).toMatchObject({ ok: false, code: 'UnexpectedResponse', message: expect.stringContaining('entity') });
  });

  it('reuses the token', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockImplementation(async () => json({ entity: { id: 'c1' } }, 201));
    await callIntake({ outputType: 'Cart', locale: 'en-US', prompt: 'x', files: [] }, config);
    await callIntake({ outputType: 'Cart', locale: 'en-US', prompt: 'x', files: [] }, config);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/oauth/token'))).toHaveLength(1);
  });

  it('logs the raw payload and response without the token or secret', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ statusCode: 400, errors: [{ code: 'NoLineItemsExtracted', message: 'raw detail' }] }, 400));
    await callIntake({ outputType: 'Cart', locale: 'en-US', prompt: 'Customer email: a@b.co', files: [{ name: 'po.pdf', data: new Blob(['abc']) }] }, config);
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).toContain('"prompt": "Customer email: a@b.co"');
    expect(out).toContain('"size": 3');
    expect(out).toContain('raw detail');
    expect(out).not.toMatch(/tok\b|"s"|Bearer tok/);
    log.mockRestore();
  });
});

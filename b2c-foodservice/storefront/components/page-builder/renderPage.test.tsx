import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPage } from './renderPage';

const env = { PB_SERVICE_URL: 'https://pb.example.test/service', PB_RENDER_KEY: 'key-for-tests-only', PB_ORIGIN: 'https://shop.example.test' };
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

beforeEach(() => {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('renderPage', () => {
  it('an authored page is a page', async () => {
    const out = await renderPage({ locale: 'en-US', fetchImpl: reply(200, { wireVersion: 1, preview: false, editMode: false, sections: [] }) });
    expect(out.kind).toBe('page');
  });
  it('page_not_found is none', async () => {
    expect(await renderPage({ locale: 'en-US', fetchImpl: reply(404, { error: { code: 'page_not_found', message: 'x' } }) })).toEqual({ kind: 'none' });
  });
  it('any failure is failed, and is logged', async () => {
    expect(await renderPage({ locale: 'en-US', fetchImpl: reply(500, { error: { code: 'internal', message: 'x' } }) })).toEqual({ kind: 'failed' });
    expect(console.error).toHaveBeenCalled();
  });
  it('a wrong service URL (404 with another code) is failed, not none', async () => {
    expect(await renderPage({ locale: 'en-US', fetchImpl: reply(404, { error: { code: 'not_found', message: 'Route not found' } }) })).toEqual({ kind: 'failed' });
  });
});

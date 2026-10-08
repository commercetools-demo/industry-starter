// @vitest-environment node
import { inflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LabDetailView } from '@/lib/account-types';
import { expectUnauthenticated } from '@/test/api';
import { makeRequest } from '@/test/request';

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
const detail = vi.fn();
vi.mock('@/lib/ct/account-labs', () => ({ getLabDetail: (...a: unknown[]) => detail(...a) }));

import { GET } from './route';

const lipid: LabDetailView = {
  id: 'LAB-50302', name: 'Lipid panel', status: 'ready', collectedAt: '2026-09-24', laboratory: 'Quest Diagnostics · Midtown',
  note: 'LDL cholesterol is above the target. Your cardiologist has adjusted your atorvastatin and will recheck in 12 weeks.',
  orderedByDoctorKey: 'mlv-doc-sofia-marchetti', orderedByName: 'Dr. Sofia Marchetti',
  results: [
    { name: 'LDL cholesterol', value: 148, unit: 'mg/dL', low: 0, high: 100, flag: 'high' },
    { name: 'White blood cells', value: 6.8, unit: '×10³/µL', low: 4, high: 11, flag: 'normal' },
  ],
};
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const hex = (text: string) => Buffer.from(text, 'latin1').toString('hex').toUpperCase();

/** The text of all page content streams as the PDF hex-encodes it (pdf-lib deflates content streams). */
function contentText(bytes: Buffer): string {
  const raw = bytes.toString('latin1');
  let out = '';
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      out += inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
    } catch {
      // not a deflate stream (font data etc.)
    }
  }
  return out;
}

beforeEach(() => {
  getSession.mockReset().mockResolvedValue({ customerId: 'c1' });
  detail.mockReset().mockResolvedValue(lipid);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('design-account-area: Lab tests, Actions (PDF)', () => {
  it('delivers a PDF that starts with %PDF and contains the test name, the results and the flag text', async () => {
    const response = await GET(makeRequest('/api/account/labs/LAB-50302/pdf'), ctx('LAB-50302'));
    expect(response.status).toBe(200);
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe('Lipid panel');
    const text = contentText(bytes);
    expect(text).toContain(hex('Lipid panel'));
    expect(text).toContain(hex('LDL cholesterol'));
    expect(text).toContain(hex('148 mg/dL'));
    expect(text).toContain(hex('High'));
    expect(text).toContain(hex('Normal'));
  });

  it('is an attachment, not cacheable, and the URL and file name carry the lab id only', async () => {
    const response = await GET(makeRequest('/api/account/labs/LAB-50302/pdf'), ctx('LAB-50302'));
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="lab-results-LAB-50302.pdf"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-disposition')).not.toMatch(/Lipid|148/);
  });

  it('Cross-patient access: a foreign or unknown test answers the same 404 as one that is still processing', async () => {
    detail.mockResolvedValue(null);
    const foreign = await GET(makeRequest('/x'), ctx('LAB-50301'));
    detail.mockResolvedValue({ ...lipid, status: 'processing', results: [] });
    const processing = await GET(makeRequest('/x'), ctx('LAB-50305'));
    for (const response of [foreign, processing]) {
      expect(response.status).toBe(404);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({ error: 'Not found.' });
    }
  });

  it('signed out: 401 and no lab read', async () => {
    getSession.mockResolvedValue({});
    await expectUnauthenticated((r) => GET(r, ctx('LAB-50302')), [detail]);
  });

  it('a character the standard font cannot encode does not break the download', async () => {
    detail.mockResolvedValue({ ...lipid, note: 'Takes 日本 supplements', results: [{ name: 'Ω-3 index', value: 5, unit: '%', low: 8, high: 12, flag: 'low' }] });
    const response = await GET(makeRequest('/x'), ctx('LAB-50302'));
    expect(response.status).toBe(200);
  });
});

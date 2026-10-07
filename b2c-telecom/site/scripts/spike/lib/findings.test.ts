import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { decide } from './decide';
import { fallbackParagraph, redact, renderFindings, SPIKE_BEGIN, SPIKE_END, writeBetweenMarkers } from './findings';
import { formatError, runProbe, summarizeError, type ProbeResult } from './probe';

const results: ProbeResult[] = [
  { id: 'P0', title: 'Policy exists', status: 'PASS', evidence: 'standard 1 Months' },
  { id: 'P3', title: 'Config | action', status: 'PASS', evidence: 'accepted' },
  { id: 'P4', title: 'Session', status: 'BLOCKED', evidence: 'OA-05' },
];

describe('renderFindings', () => {
  it('renders the table, the result line and the fallback', () => {
    const text = renderFindings(results, decide(results), '2026-10-07T10:00:00.000Z', { acceptedAction: 'setRecurringPaymentConfiguration', mixAccepted: 'yes', grouping: '1 recurring order', openItems: [] });
    expect(text).toContain('## L - Checkout spike (recurring + one-time) - run 2026-10-07T10:00:00.000Z');
    expect(text).toContain('Result: PENDING (OA-05)  |  Gate 2: owner review required');
    expect(text).toContain('| P0 | Policy exists | PASS | standard 1 Months |');
    expect(text).toContain('| P3 | Config / action | PASS | accepted |');
    expect(text).toContain('Accepted action field names: setRecurringPaymentConfiguration');
    expect(text).toContain('Open items: P4 (OA-05)');
    expect(text).toContain('Fallback plan:');
  });

  it('never prints a bearer token or the value of an env var', () => {
    const secret = 'sUp3r-s3cret-value-123';
    process.env.TEST_SPIKE_CLIENT_SECRET = secret;
    try {
      const leaky: ProbeResult[] = [{ id: 'P4', title: 'Session', status: 'FAIL', evidence: `HTTP 401 Bearer abc.def.ghi and ${secret}` }];
      const text = renderFindings(leaky, decide(leaky), 'now');
      expect(text).not.toContain('Bearer ');
      expect(text).not.toContain(secret);
      expect(redact(`x ${secret} Bearer zzz`, { SOME_TOKEN: secret })).toBe('x [redacted] [redacted]');
    } finally {
      delete process.env.TEST_SPIKE_CLIENT_SECRET;
    }
  });

  it('every architecture has a fallback paragraph that lists the others', () => {
    for (const a of ['A', 'A-prime', 'F1', 'F2', 'F3']) expect(fallbackParagraph(a)).toContain('Other options');
    expect(fallbackParagraph('BLOCKED-DATA')).toContain('owner decision');
  });
});

describe('writeBetweenMarkers', () => {
  const file = (): string => path.join(mkdtempSync(path.join(tmpdir(), 'spike-')), 'FINDINGS.md');

  it('appends the marked block when the markers are absent', () => {
    const f = file();
    writeFileSync(f, '# Findings\n\ntext');
    writeBetweenMarkers(f, SPIKE_BEGIN, SPIKE_END, 'one');
    expect(readFileSync(f, 'utf8')).toBe(`# Findings\n\ntext\n\n${SPIKE_BEGIN}\none\n${SPIKE_END}\n`);
  });

  it('replaces an existing block without touching other text', () => {
    const f = file();
    writeFileSync(f, `before\n\n${SPIKE_BEGIN}\nold\n${SPIKE_END}\n\nafter\n`);
    writeBetweenMarkers(f, SPIKE_BEGIN, SPIKE_END, 'new');
    expect(readFileSync(f, 'utf8')).toBe(`before\n\n${SPIKE_BEGIN}\nnew\n${SPIKE_END}\n\nafter\n`);
  });
});

describe('probe wrapper', () => {
  it('maps an SDK error to status, code and a message of at most 200 characters', async () => {
    const result = await runProbe('P9', 'x', async () => {
      throw { statusCode: 400, body: { errors: [{ code: 'InvalidOperation', message: 'm'.repeat(500) }] } };
    });
    expect(result.status).toBe('FAIL');
    expect(result.evidence.startsWith('HTTP 400 InvalidOperation ')).toBe(true);
    expect(result.evidence.length).toBeLessThanOrEqual('HTTP 400 InvalidOperation '.length + 200);
  });
  it('passes a returned outcome through', async () => {
    expect(await runProbe('P7', 't', async () => ({ status: 'INFO', evidence: 'e' }))).toEqual({ id: 'P7', title: 't', status: 'INFO', evidence: 'e' });
  });
  it('summarizes plain errors', () => {
    expect(summarizeError(new Error('boom'))).toEqual({ message: 'boom' });
    expect(formatError({ status: 404, code: 'ResourceNotFound', message: 'gone' })).toBe('HTTP 404 ResourceNotFound gone');
  });
});

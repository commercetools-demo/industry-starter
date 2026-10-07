import { decide } from './decide';
import type { ProbeResult, ProbeStatus } from './probe';

const ALL = ['P0', 'P1', 'P1b', 'P1c', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];

/** Everything PASS, with overrides (a string value is `status` or `status:evidence`). */
function run(overrides: Record<string, string> = {}): ProbeResult[] {
  return ALL.map((id) => {
    const [status, ...rest] = (overrides[id] ?? 'PASS').split(':');
    return { id, title: id, status: status as ProbeStatus, evidence: rest.join(':') };
  });
}

describe('decide', () => {
  it('P2 FAIL is BLOCKED-DATA', () => {
    expect(decide(run({ P2: 'FAIL', P6: 'FAIL' })).architecture).toBe('BLOCKED-DATA');
  });
  it('P6 FAIL with P1b PASS and P1c FAIL is F1', () => {
    expect(decide(run({ P6: 'FAIL', P1b: 'PASS', P1c: 'FAIL' })).architecture).toBe('F1');
    expect(decide(run({ P1: 'FAIL', P1c: 'FAIL' })).architecture).toBe('F1');
  });
  it('P6 FAIL or P1 FAIL otherwise is F2', () => {
    expect(decide(run({ P6: 'FAIL' })).architecture).toBe('F2');
    expect(decide(run({ P1: 'FAIL', P1b: 'FAIL', P1c: 'FAIL' })).architecture).toBe('F2');
  });
  it('P4 FAIL naming recurring, mixed or payment strategy is F3', () => {
    expect(decide(run({ P4: 'FAIL:HTTP 400 Mixed carts are not supported' })).architecture).toBe('F3');
    expect(decide(run({ P4: 'FAIL:recurring lines need a payment strategy' })).architecture).toBe('F3');
  });
  it('P4 FAIL for another reason is BLOCKED-CHECKOUT', () => {
    expect(decide(run({ P4: 'FAIL:HTTP 403 forbidden' })).architecture).toBe('BLOCKED-CHECKOUT');
  });
  it('P8 FAIL and P9 FAIL is BLOCKED-RECURRING-PAYMENT', () => {
    expect(decide(run({ P8: 'FAIL', P9: 'FAIL' })).architecture).toBe('BLOCKED-RECURRING-PAYMENT');
  });
  it('P3 PASS and P8 PASS is A', () => {
    expect(decide(run()).architecture).toBe('A');
  });
  it('P3 FAIL or P8 FAIL with P9 PASS is A-prime', () => {
    expect(decide(run({ P3: 'FAIL' })).architecture).toBe('A-prime');
    expect(decide(run({ P8: 'FAIL' })).architecture).toBe('A-prime');
  });
  it('a BLOCKED P3 or P4 gives PENDING (OA-05) with the best guess', () => {
    const d = decide(run({ P4: 'BLOCKED', P5: 'BLOCKED' }));
    expect(d.architecture).toBe('PENDING (OA-05)');
    expect(d.rationale).toContain('guess from the other probes: A.');
    const e = decide(run({ P3: 'BLOCKED', P4: 'BLOCKED', P8: 'FAIL' }));
    expect(e.architecture).toBe('PENDING (OA-05)');
    expect(e.rationale).toContain('guess from the other probes: A-prime.');
  });
  it('unusable combinations are INCONCLUSIVE', () => {
    expect(decide(run({ P3: 'FAIL', P9: 'UNKNOWN' })).architecture).toBe('INCONCLUSIVE');
  });
  it('the first matching row wins', () => {
    expect(decide(run({ P2: 'FAIL', P4: 'FAIL', P8: 'FAIL', P9: 'FAIL' })).architecture).toBe('BLOCKED-DATA');
    expect(decide(run({ P6: 'FAIL', P4: 'FAIL:recurring' })).architecture).toBe('F2');
  });
});

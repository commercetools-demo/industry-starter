import { describe, expect, it } from 'vitest';
import { INITIAL_SCAN_STATE, REPEAT_WINDOW_MS, scanReducer, shouldAccept, type ScanEvent, type ScanState } from '@/lib/instore/scan-state';
import { SKU_PATTERN, normaliseScan } from '@/lib/instore/scan';

describe('normaliseScan', () => {
  it.each([
    ['MCF-POD-EMBER-50', 'MCF-POD-EMBER-50'],
    ['  MCF-POD-EMBER-50\n', 'MCF-POD-EMBER-50'],
    ['MCF-POD-EMBER-50\r', 'MCF-POD-EMBER-50'],
    ['​MCF-POD-EMBER-50﻿', 'MCF-POD-EMBER-50'],
    [']C1MCF-POD-EMBER-50', 'MCF-POD-EMBER-50'],
    [']Q1MCF-1', 'MCF-1'],
    ['mcf.pod_1-x', 'mcf.pod_1-x'],
    ['A', 'A'],
    ['x'.repeat(64), 'x'.repeat(64)],
  ])('a SKU-shaped scan %j becomes %j', (raw, sku) => {
    expect(normaliseScan(raw)).toEqual({ ok: true, sku });
  });

  it('keeps the case of a scan: the catalogue lookup is exact', () => {
    expect(normaliseScan('Mcf-Pod-1')).toEqual({ ok: true, sku: 'Mcf-Pod-1' });
  });

  it.each(['', '   ', '\n\t', ']C1', '​'])('nothing to read in %j is empty', (raw) => {
    expect(normaliseScan(raw)).toEqual({ ok: false, reason: 'empty' });
  });

  it.each([
    'https://example.com/p/1',
    'MCF POD 1',
    '4006381333931 extra',
    'x'.repeat(65),
    'a/b',
    'a;drop table',
    '<script>',
    'MCF-é-1',
    '😀',
  ])('text that is not a SKU (%j) is invalid and never leaves the browser', (raw) => {
    expect(normaliseScan(raw)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('non-strings are empty', () => {
    for (const v of [null, undefined, 42, {}, []]) expect(normaliseScan(v)).toEqual({ ok: false, reason: 'empty' });
  });

  it('matches the pattern the cart and inventory routes use', () => {
    expect(SKU_PATTERN.source).toBe('^[A-Za-z0-9._-]{1,64}$');
  });
});

const run = (events: ScanEvent[], from: ScanState = INITIAL_SCAN_STATE): ScanState => events.reduce(scanReducer, from);
const cam = (raw: string, now: number): ScanEvent => ({ type: 'decoded', raw, now, source: 'camera' });
const typed = (raw: string, now: number): ScanEvent => ({ type: 'decoded', raw, now, source: 'manual' });

describe('scan state machine', () => {
  it('opens with the camera off and no result', () => {
    expect(run([{ type: 'open' }])).toEqual({ camera: 'off', result: 'none' });
  });

  it('the camera states are independent of the result', () => {
    for (const state of ['starting', 'on', 'denied', 'none', 'error'] as const) {
      expect(run([{ type: 'open' }, { type: 'camera', state }]).camera).toBe(state);
    }
  });

  it('a decoded SKU starts a lookup and the outcome decides the result', () => {
    const looking = run([{ type: 'open' }, { type: 'camera', state: 'on' }, cam('MCF-POD-EMBER-50', 1000)]);
    expect(looking).toMatchObject({ result: 'looking-up', sku: 'MCF-POD-EMBER-50' });
    expect(run([{ type: 'lookup', outcome: 'found' }], looking).result).toBe('found');
    expect(run([{ type: 'lookup', outcome: 'unknown' }], looking).result).toBe('unknown');
    expect(run([{ type: 'lookup', outcome: 'failed' }], looking).result).toBe('lookup-failed');
  });

  it('a lookup answer without a lookup in progress is ignored', () => {
    expect(run([{ type: 'open' }, { type: 'lookup', outcome: 'found' }]).result).toBe('none');
  });

  it('text that is not a SKU becomes invalid and keeps what was read (trimmed)', () => {
    const s = run([{ type: 'open' }, typed('https://example.com/' + 'x'.repeat(80), 1)]);
    expect(s.result).toBe('invalid');
    expect(s.rejected).toHaveLength(40);
  });

  it('the camera reading nothing at all changes nothing', () => {
    const before = run([{ type: 'open' }, { type: 'camera', state: 'on' }]);
    expect(scanReducer(before, cam('   ', 5))).toBe(before);
  });

  it('Same code twice in the window is one lookup (shouldAccept)', () => {
    const s = run([{ type: 'open' }, cam('MCF-1', 1000), { type: 'lookup', outcome: 'found' }, { type: 'again' }]);
    expect(shouldAccept(s, 'MCF-1', 1000 + REPEAT_WINDOW_MS - 1)).toBe(false);
    expect(shouldAccept(s, 'MCF-1', 1000 + REPEAT_WINDOW_MS)).toBe(true);
    expect(shouldAccept(s, 'MCF-2', 1100)).toBe(true);
  });

  it('while a result is on screen the camera is ignored, manual entry is not', () => {
    const shown = run([{ type: 'open' }, cam('MCF-1', 1000), { type: 'lookup', outcome: 'found' }]);
    expect(scanReducer(shown, cam('MCF-2', 9000))).toBe(shown);
    expect(scanReducer(shown, typed('MCF-2', 9000))).toMatchObject({ result: 'looking-up', sku: 'MCF-2' });
  });

  it('nothing starts while a lookup is running', () => {
    const looking = run([{ type: 'open' }, cam('MCF-1', 1000)]);
    expect(scanReducer(looking, typed('MCF-2', 1001))).toBe(looking);
    expect(scanReducer(looking, cam('MCF-2', 9999))).toBe(looking);
  });

  it('again clears the result but keeps the repeat window, so holding still does not show it twice', () => {
    const s = run([{ type: 'open' }, cam('MCF-1', 1000), { type: 'lookup', outcome: 'found' }, { type: 'again' }]);
    expect(s.result).toBe('none');
    expect(scanReducer(s, cam('MCF-1', 1500))).toBe(s);
    expect(scanReducer(s, cam('MCF-1', 4000)).result).toBe('looking-up');
  });

  it('a manual entry of the same code is always accepted', () => {
    const s = run([{ type: 'open' }, cam('MCF-1', 1000), { type: 'lookup', outcome: 'unknown' }, { type: 'again' }]);
    expect(scanReducer(s, typed('MCF-1', 1100)).result).toBe('looking-up');
  });

  it('close resets everything', () => {
    expect(run([{ type: 'open' }, { type: 'camera', state: 'on' }, cam('MCF-1', 1), { type: 'close' }])).toEqual({ camera: 'off', result: 'none' });
  });

  it('opening again forgets the previous code, so the same product can be scanned in a new session', () => {
    const s = run([{ type: 'open' }, cam('MCF-1', 1000), { type: 'lookup', outcome: 'found' }, { type: 'close' }, { type: 'open' }]);
    expect(scanReducer(s, cam('MCF-1', 1200)).result).toBe('looking-up');
  });
});

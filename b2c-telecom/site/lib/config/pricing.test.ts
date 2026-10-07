import { INTRO_DEFS, STEP_DEFS } from './pricing';

describe('pricing config', () => {
  it('no offer+term is in both lists', () => {
    const intro = new Set(INTRO_DEFS.map((d) => `${d.offerKey}|${d.term}`));
    for (const d of STEP_DEFS) expect(intro.has(`${d.offerKey}|${d.term}`)).toBe(false);
  });
  it('an offer+term appears at most once per list', () => {
    const keys = INTRO_DEFS.map((d) => `${d.offerKey}|${d.term}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('every amountCents value is an integer > 0', () => {
    for (const d of INTRO_DEFS) for (const v of Object.values(d.amountCents)) expect(Number.isInteger(v) && v > 0).toBe(true);
    for (const d of STEP_DEFS) for (const s of d.steps) for (const v of Object.values(s.deltaCents)) expect(Number.isInteger(v) && v > 0).toBe(true);
  });
  it('every STEP_DEFS.coversMonths >= term', () => {
    for (const d of STEP_DEFS) expect(d.coversMonths).toBeGreaterThanOrEqual(d.term);
  });
  it('offer keys match the malva-offer pattern', () => {
    for (const d of [...INTRO_DEFS, ...STEP_DEFS]) expect(d.offerKey).toMatch(/^malva-offer-[a-z0-9-]+$/);
  });
});

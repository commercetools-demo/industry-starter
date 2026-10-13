// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkDemoReset } from './check-demo-reset.mjs';

describe('on-screen reset production gate (portal)', () => {
  it('on in a production build without the acknowledgement fails and names the setting', () => {
    expect(checkDemoReset({ NODE_ENV: 'production', DEMO_ONSCREEN_RESET: 'on' }).problems.join('\n')).toMatch(/DEMO_RESET_ACKNOWLEDGED/);
    expect(checkDemoReset({ RELEASE: '1', DEMO_ONSCREEN_RESET: 'on' }).problems).toHaveLength(1);
  });
  it('on with the acknowledgement passes with a notice', () => {
    const r = checkDemoReset({ NODE_ENV: 'production', DEMO_ONSCREEN_RESET: 'on', DEMO_RESET_ACKNOWLEDGED: 'true' });
    expect(r.problems).toEqual([]);
    expect(r.notices[0]).toMatch(/demos only/);
  });
  it('off, or development, passes silently', () => {
    expect(checkDemoReset({ NODE_ENV: 'production' })).toEqual({ problems: [], notices: [] });
    expect(checkDemoReset({ NODE_ENV: 'development', DEMO_ONSCREEN_RESET: 'on' })).toEqual({ problems: [], notices: [] });
  });
});

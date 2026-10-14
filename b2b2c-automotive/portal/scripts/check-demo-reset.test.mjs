/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkDemoReset } from './check-demo-reset.mjs';

describe('on-screen reset production gate (portal)', () => {
  it('true in a production build without the acknowledgement fails and names the setting', () => {
    expect(checkDemoReset({ NODE_ENV: 'production', DEMO_ONSCREEN_RESET: 'true' }).problems.join('\n')).toMatch(/DEMO_RESET_ACKNOWLEDGED/);
    expect(checkDemoReset({ RELEASE: '1', DEMO_ONSCREEN_RESET: 'true' }).problems).toHaveLength(1);
  });
  it('true with the acknowledgement passes with a notice', () => {
    const r = checkDemoReset({ NODE_ENV: 'production', DEMO_ONSCREEN_RESET: 'true', DEMO_RESET_ACKNOWLEDGED: 'true' });
    expect(r.problems).toEqual([]);
    expect(r.notices[0]).toMatch(/demos only/);
  });
  it('off, or development, passes silently', () => {
    expect(checkDemoReset({ NODE_ENV: 'production' })).toEqual({ problems: [], notices: [] });
    expect(checkDemoReset({ NODE_ENV: 'production', DEMO_ONSCREEN_RESET: 'false' })).toEqual({ problems: [], notices: [] });
    expect(checkDemoReset({ NODE_ENV: 'development', DEMO_ONSCREEN_RESET: 'true' })).toEqual({ problems: [], notices: [] });
  });
  it('Q-X10: the old spelling "on" (or any value other than true and false) is a problem, because it would silently do nothing', () => {
    expect(checkDemoReset({ NODE_ENV: 'development', DEMO_ONSCREEN_RESET: 'on' }).problems.join('\n')).toMatch(/DEMO_ONSCREEN_RESET=true/);
    expect(checkDemoReset({ NODE_ENV: 'production', DEMO_ONSCREEN_RESET: 'yes' }).problems).toHaveLength(1);
  });
});

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { checkDemoReset } from './check-demo-reset.mjs';

describe('Gates and tests: on-screen reset in production', () => {
  it('production with the flag and no acknowledgement fails', () => {
    const { problems } = checkDemoReset({ NODE_ENV: 'production', DEMO_ONSCREEN_RESET: 'true' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('DEMO_RESET_ACKNOWLEDGED');
    expect(checkDemoReset({ CONTEXT: 'production', DEMO_ONSCREEN_RESET: 'true', DEMO_RESET_ACKNOWLEDGED: 'yes' }).problems).toHaveLength(1);
  });
  it('production with both passes and prints a notice', () => {
    const { problems, notices } = checkDemoReset({ NODE_ENV: 'production', DEMO_ONSCREEN_RESET: 'true', DEMO_RESET_ACKNOWLEDGED: 'true' });
    expect(problems).toEqual([]);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain('anyone who knows an email address');
  });
  it('development passes, with or without the flag', () => {
    expect(checkDemoReset({ NODE_ENV: 'development', DEMO_ONSCREEN_RESET: 'true' })).toEqual({ problems: [], notices: [] });
    expect(checkDemoReset({})).toEqual({ problems: [], notices: [] });
  });
  it('production without the flag passes silently', () => {
    expect(checkDemoReset({ NODE_ENV: 'production' })).toEqual({ problems: [], notices: [] });
    expect(checkDemoReset({ NODE_ENV: 'production', DEMO_ONSCREEN_RESET: 'false' })).toEqual({ problems: [], notices: [] });
  });
});

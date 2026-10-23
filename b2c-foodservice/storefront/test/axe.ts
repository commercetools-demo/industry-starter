import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * Runs axe-core on a rendered container. Colour contrast needs a real layout engine, so that rule is off here;
 * contrast of the token pairs is checked by `app/tokens.test.ts` and in the browser.
 * axe-core is a transitive dependency (eslint-config-next); see Q-F-13 about declaring it.
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(summary).toEqual([]);
}

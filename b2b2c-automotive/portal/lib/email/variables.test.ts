/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { findUnknownVariables, hasUnbalancedBraces, templateProblem } from './variables';

describe('unknown variable refused', () => {
  it('names the unknown variable', () => {
    expect(findUnknownVariables('Hi {{ foo }}, order {{order_number}}')).toEqual(['foo']);
    expect(templateProblem('Hi {{ foo }}')).toEqual({ code: 'UNKNOWN_VARIABLE', variable: 'foo' });
  });
  it('accepts the supported variables with spaces', () => {
    expect(templateProblem('{{ order_number }} {{customer_name}}')).toBeNull();
  });
  it('refuses unbalanced braces', () => {
    expect(hasUnbalancedBraces('Hello {{order_number')).toBe(true);
    expect(hasUnbalancedBraces('Hello order_number}}')).toBe(true);
    expect(templateProblem('{{ {{order_number}}')).toEqual({ code: 'UNBALANCED_BRACES' });
    expect(hasUnbalancedBraces('plain {text}')).toBe(false);
  });
});

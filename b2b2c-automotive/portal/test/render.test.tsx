/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from './render';

describe('test helpers', () => {
  it('renders a child inside providers', () => {
    renderWithProviders(<p>hello</p>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});

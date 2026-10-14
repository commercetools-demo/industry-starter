// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { homeData } from '@/test/home';
import { HomeDataProvider, useHomeData } from './HomeDataContext';

function Probe() {
  return <p>{useHomeData().storeName}</p>;
}

describe('HomeDataContext', () => {
  it('provides the data', () => {
    render(
      <HomeDataProvider value={homeData()}>
        <Probe />
      </HomeDataProvider>,
    );
    expect(screen.getByText('Küstenwerk Autoteile')).toBeInTheDocument();
  });

  it('throws a clear error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/inside a HomeDataProvider/);
  });
});

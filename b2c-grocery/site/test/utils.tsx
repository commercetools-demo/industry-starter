import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { SWRConfig } from 'swr';

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>,
    options,
  );
}

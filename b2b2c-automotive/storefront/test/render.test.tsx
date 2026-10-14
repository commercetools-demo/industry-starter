// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import { useTranslations } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from './render';

function Child() {
  const t = useTranslations('x');
  return <p>{t('hello')}</p>;
}

describe('test helpers', () => {
  it('renders a child inside providers', () => {
    renderWithProviders(<Child />, { messages: { x: { hello: 'Hallo' } } });
    expect(screen.getByText('Hallo')).toBeInTheDocument();
  });
});

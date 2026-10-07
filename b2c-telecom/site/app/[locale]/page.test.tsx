import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import enMessages from '@/messages/en-US.json';

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async () => createTranslator({ locale: 'en-US', messages: enMessages }),
}));

import HomePage from './page';

describe('[locale] home page', () => {
  it('renders the brand heading and the placeholder text', async () => {
    render(await HomePage({ params: Promise.resolve({ locale: 'en-US' }) }));
    expect(screen.getByRole('heading', { level: 1, name: 'Malva' })).toBeInTheDocument();
    expect(screen.getByText('Malva Telecom storefront')).toBeInTheDocument();
  });
});

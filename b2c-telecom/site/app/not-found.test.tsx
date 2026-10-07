import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import RootNotFound from './not-found';

describe('root not-found', () => {
  it('shows static bilingual copy and a plain link home', () => {
    render(<RootNotFound />);
    expect(screen.getByRole('heading', { name: 'Page not found · Seite nicht gefunden' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Malva Telecom' })).toHaveAttribute('href', '/');
  });

  it('has no data calls: it imports nothing from lib/ct, next-intl or the session', () => {
    const source = readFileSync(path.join(__dirname, 'not-found.tsx'), 'utf8');
    expect(source).not.toMatch(/^import /m);
  });
});

import { describe, expect, it } from 'vitest';
import CatchAll from '@/app/[locale]/[...rest]/page';
import LocaleNotFound from '@/app/[locale]/not-found';
import { renderWithProviders, screen } from '@/test/utils';
import { NotFoundView } from './NotFoundView';

describe('error-pages › Address resolves to nothing', () => {
  it('an unmatched address raises Next not-found (HTTP 404, rendered inside the shell by not-found.tsx)', () => {
    let thrown: unknown;
    try {
      CatchAll();
    } catch (error) {
      thrown = error;
    }
    expect((thrown as { digest?: string }).digest).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
  });

  it('the page 404 states the condition and links Home, Find a doctor and Prescriptions', () => {
    renderWithProviders(<LocaleNotFound />);
    expect(screen.getByRole('heading', { name: 'We could not find that page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/en-US');
    expect(screen.getByRole('link', { name: 'Find a doctor' })).toHaveAttribute('href', '/en-US/doctors/remote');
    expect(screen.getByRole('link', { name: 'Prescriptions' })).toHaveAttribute('href', '/en-US/prescriptions');
  });

  it('an unknown doctor says "Doctor not found." and links back to search', () => {
    renderWithProviders(<NotFoundView kind="doctor" />);
    expect(screen.getByRole('heading', { name: 'Doctor not found.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to search' })).toHaveAttribute('href', '/en-US/doctors/remote');
  });

  it('another patient order and a missing order share the same copy', () => {
    renderWithProviders(<NotFoundView kind="order" />);
    expect(screen.getByRole('heading', { name: 'Order not found.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toBeInTheDocument();
  });

  it('a generic resource says "Not found."', () => {
    renderWithProviders(<NotFoundView kind="generic" />);
    expect(screen.getByRole('heading', { name: 'Not found.' })).toBeInTheDocument();
  });
});

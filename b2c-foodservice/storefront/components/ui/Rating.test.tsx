import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithIntl } from '@/test/render';
import Rating from './Rating';

describe('Rating', () => {
  it('Rating shows 4.6 and 12 reviews for 4.58333 and 12', () => {
    renderWithIntl(<Rating value={4.58333} count={12} />);
    expect(screen.getByText('4.6')).toBeInTheDocument();
    expect(screen.getByText('(12)')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '4.6 out of 5, 12 reviews' })).toBeInTheDocument();
  });

  it('Rating renders nothing for no rating', () => {
    const { container } = renderWithIntl(<Rating value={0} count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Rating label is announced with a plural', () => {
    const { unmount } = renderWithIntl(<Rating value={5} count={1} />, { locale: 'en-US' });
    expect(screen.getByRole('img', { name: '5.0 out of 5, 1 review' })).toBeInTheDocument();
    unmount();
    renderWithIntl(<Rating value={4} count={2} />, { locale: 'en-CA' });
    expect(screen.getByRole('img', { name: '4.0 out of 5, 2 reviews' })).toBeInTheDocument();
  });

  it('Rating formats large counts by locale', () => {
    renderWithIntl(<Rating value={4.2} count={1234} small />);
    expect(screen.getByText('(1,234)')).toBeInTheDocument();
  });
});

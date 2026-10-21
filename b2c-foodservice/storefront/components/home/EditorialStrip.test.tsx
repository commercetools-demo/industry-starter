import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { renderShell } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('@/content/home', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/content/home')>();
  return {
    ...original,
    HOME_CONTENT: {
      ...original.HOME_CONTENT,
      editorial: { ...original.HOME_CONTENT.editorial, imageUrl: 'https://img.example.com/roast.jpg', href: '/journal' },
    },
  };
});
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import EditorialStrip from '@/components/home/EditorialStrip';

describe('EditorialStrip', () => {
  it('Editorial content: strip text and image come from content', () => {
    renderShell(<EditorialStrip locale="en-US" />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Sourced with care.Roasted for flavour.');
    expect(screen.getByText(/We work with growers we know/)).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'Coffee beans being roasted in a small batch');
    expect(screen.getByRole('link', { name: 'Read about our coffee' })).toHaveAttribute('href', '/journal');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderShell(<EditorialStrip locale="en-CA" />, { locale: 'en-CA' });
    await expectNoAxeViolations(container);
  });
});

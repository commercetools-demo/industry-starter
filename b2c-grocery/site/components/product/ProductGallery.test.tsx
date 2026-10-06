import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { ProductGallery } from './ProductGallery';

const urls = ['https://images.example.com/1.jpg', 'https://images.example.com/2.jpg', 'https://images.example.com/3.jpg', 'https://images.example.com/4.jpg'];

describe('ProductGallery', () => {
  it('shows at most three images, the primary one with priority', () => {
    renderWithProviders(<ProductGallery images={urls} name="Bananas" />);
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(3);
    expect(images[0]).not.toHaveAttribute('loading', 'lazy'); // next/image drops lazy loading for `priority`
    expect(images[1]).toHaveAttribute('loading', 'lazy');
    expect(images[2]).toHaveAttribute('loading', 'lazy');
  });

  it('alt text comes from the product name', () => {
    renderWithProviders(<ProductGallery images={urls} name="Bananas" />);
    const images = screen.getAllByRole('img');
    expect(images[0]).toHaveAttribute('alt', 'Bananas');
    expect(images[1]).toHaveAttribute('alt', 'Bananas, photo 2');
    expect(images[2]).toHaveAttribute('alt', 'Bananas, photo 3');
  });

  it('primary spans two columns; fewer images omit the secondary tiles', () => {
    const { container } = renderWithProviders(<ProductGallery images={urls.slice(0, 1)} name="Bananas" />);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(container.querySelector('.col-span-2')).not.toBeNull();
  });

  it('no images: a neutral placeholder named after the product', () => {
    const { container } = renderWithProviders(<ProductGallery images={[]} name="Bananas" />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Bananas' })).toHaveAttribute('data-placeholder', 'true');
  });
});

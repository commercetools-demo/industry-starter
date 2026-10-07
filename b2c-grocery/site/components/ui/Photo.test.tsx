import { render, screen } from '@testing-library/react';
import { Photo } from './Photo';

describe('Photo', () => {
  it('Product photo: wrapper is washed and rounded, image fills it', () => {
    const { container } = render(<Photo src="/bananas.jpg" alt="Bananas" sizes="(min-width: 75rem) 33vw, 100vw" aspectRatio="4 / 5" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass('washed', 'overflow-hidden');
    expect(wrapper.className).toContain('rounded-[calc(var(--radius-lg)*1.15)]');
    expect(wrapper.style.aspectRatio).toBe('4 / 5');
    const img = screen.getByRole('img', { name: 'Bananas' });
    expect(img).toHaveAttribute('alt', 'Bananas');
    expect(img.getAttribute('style')).toContain('position: absolute');
  });

  it('passes sizes to the image', () => {
    render(<Photo src="/a.jpg" alt="A" sizes="50vw" />);
    expect(screen.getByRole('img', { name: 'A' })).toHaveAttribute('sizes', '50vw');
  });

  it('empty src: renders a neutral placeholder block and no <img>', () => {
    const { container } = render(<Photo src="" alt="Missing photo" sizes="50vw" />);
    expect(container.querySelector('img')).toBeNull();
    const block = screen.getByRole('img', { name: 'Missing photo' });
    expect(block).toHaveAttribute('data-placeholder', 'true');
    expect(block).toHaveClass('washed', 'bg-neutral-200');
  });

  it('alt and sizes are required by the type', () => {
    const typeOnly = () => (
      <>
        {/* @ts-expect-error alt is required */}
        <Photo src="/a.jpg" sizes="50vw" />
        {/* @ts-expect-error sizes is required */}
        <Photo src="/a.jpg" alt="A" />
      </>
    );
    expect(typeof typeOnly).toBe('function');
  });

  it('decorative empty alt on a placeholder is hidden from assistive technology', () => {
    const { container } = render(<Photo src="" alt="" sizes="50vw" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});

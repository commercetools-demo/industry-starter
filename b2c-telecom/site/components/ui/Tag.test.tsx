import { render, screen } from '@testing-library/react';
import { Skeleton } from './Skeleton';
import { Tag } from './Tag';

describe('Tag and Skeleton', () => {
  it('maps tones to classes', () => {
    render(
      <>
        <Tag>brand</Tag>
        <Tag tone="pink">pink</Tag>
        <Tag tone="neutral">neutral</Tag>
        <Tag tone="danger">danger</Tag>
      </>,
    );
    expect(screen.getByText('brand')).toHaveClass('bg-brand-100');
    expect(screen.getByText('pink')).toHaveClass('bg-pink-50');
    expect(screen.getByText('neutral')).toHaveClass('bg-neutral-100');
    expect(screen.getByText('danger')).toHaveClass('bg-danger');
  });

  it('Skeleton is hidden from assistive technology and takes its size from className', () => {
    const { container } = render(<Skeleton className="h-5 w-20" />);
    const el = container.firstElementChild;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).toHaveClass('h-5', 'w-20', 'motion-safe:animate-pulse');
  });
});

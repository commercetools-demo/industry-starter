import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '@/test/utils';
import { EmptyState } from './EmptyState';
import { Pagination, pageItems } from './Pagination';
import { SegmentedControl } from './SegmentedControl';
import { Skeleton } from './Skeleton';
import { StatusTimeline } from './StatusTimeline';
import { Button } from './Button';

const ITEMS = [
  { value: 'remote', label: 'Video' },
  { value: 'office', label: 'In office' },
];

function Controlled() {
  const [value, setValue] = useState('remote');
  return <SegmentedControl label="Visit type" items={ITEMS} value={value} onChange={setValue} />;
}

describe('SegmentedControl', () => {
  it('buttons: the selected one is pressed and styled with the action fill', () => {
    renderWithProviders(<Controlled />);
    expect(screen.getByRole('group', { name: 'Visit type' })).toBeInTheDocument();
    const video = screen.getByRole('button', { name: 'Video' });
    expect(video).toHaveAttribute('aria-pressed', 'true');
    expect(video).toHaveClass('bg-action', 'text-action-label');
    expect(screen.getByRole('button', { name: 'In office' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('keyboard: Tab reaches each item, Enter and Space switch', async () => {
    renderWithProviders(<Controlled />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Video' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'In office' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'In office' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.tab({ shift: true });
    await userEvent.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Video' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('links: renders real links with aria-current for the active one', () => {
    renderWithProviders(
      <SegmentedControl
        label="Visit type"
        value="office"
        items={[
          { value: 'remote', label: 'Video', href: '/doctors/remote' },
          { value: 'office', label: 'In office', href: '/doctors/office' },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'In office' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Video' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Video' })).toHaveAttribute('href', '/en-US/doctors/remote');
  });
});

describe('Pagination', () => {
  it('pageItems: first, last and neighbours with gaps', () => {
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
    expect(pageItems(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(pageItems(2, 10)).toEqual([1, 2, 3, 'gap', 10]);
  });

  it('renders nothing for a single page', () => {
    const { container } = renderWithProviders(<Pagination page={1} pageCount={1} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('buttons: current page is marked, previous is disabled on page 1, keyboard moves on', async () => {
    const onChange = vi.fn();
    renderWithProviders(<Pagination page={1} pageCount={3} onChange={onChange} />);
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveFocus();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(2);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it('links: hrefFor builds real links; Next is disabled on the last page', () => {
    renderWithProviders(<Pagination page={3} pageCount={3} hrefFor={(p) => `/search?page=${p}`} />);
    expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute('href', '/en-US/search?page=2');
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/en-US/search?page=2');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});

describe('Skeleton, EmptyState, StatusTimeline', () => {
  it('Skeleton is hidden from assistive technology', () => {
    const { container } = renderWithProviders(<Skeleton className="h-8" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('EmptyState: title, description and an action that is reachable by keyboard', async () => {
    renderWithProviders(<EmptyState title="No orders yet" description="Your orders show up here." action={<Button>Browse</Button>} />);
    expect(screen.getByRole('heading', { name: 'No orders yet' })).toBeInTheDocument();
    expect(screen.getByText('Your orders show up here.')).toBeInTheDocument();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Browse' })).toHaveFocus();
  });

  it('StatusTimeline: done steps are green and stated in text, not only by colour', () => {
    renderWithProviders(
      <StatusTimeline
        label="Order progress"
        steps={[
          { label: 'Placed', done: true },
          { label: 'Packed', done: true },
          { label: 'Shipped', done: false },
        ]}
      />,
    );
    const list = screen.getByRole('list', { name: 'Order progress' });
    expect(list.querySelectorAll('li')).toHaveLength(3);
    expect(list.querySelector('li[data-done="true"] span')).toHaveClass('bg-success-500');
    expect(screen.getAllByText('(completed)')).toHaveLength(2);
    expect(screen.getByText('(not yet)')).toBeInTheDocument();
  });
});

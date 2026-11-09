import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { nav } from '@/test/shell';
import { useShellUi } from '@/context/shell-ui-context';
import {
  checkoutPayload,
  comparisonPayload,
  familyVariants,
  guidePayload,
  orderStatusPayload,
  planPayload,
  productFixtures,
  productsPayload,
} from '../fixtures';
import type { CheckoutPayload, ProductsPayload } from '../payloads';
import AssistantBlock from './index';
import { renderCard } from './test-utils';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

const cardProduct = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/assistantApi', () => ({ assistantApi: { cardProduct } }));

beforeEach(() => {
  nav.push.mockClear();
  cardProduct.mockReset();
  cardProduct.mockResolvedValue(null);
});

const block = (component: string, payload: unknown) => ({ component, payload });

describe('Comparison', () => {
  it('Comparison is one column in a 480 px dock', () => {
    const { container } = renderCard(<AssistantBlock block={block('comparison', comparisonPayload('en-US'))} status="final" />);
    const grid = container.querySelector('[data-comparison-grid]') as HTMLElement;
    const classes = grid.className.split(/\s+/);
    // jsdom has no layout: the structure is what is asserted. One column by default, two only from the card's own width (container query).
    expect(classes).toContain('grid-cols-1');
    expect(classes).not.toContain('grid-cols-2');
    expect(classes).toContain('@lg:grid-cols-2');
    expect(container.querySelector('section')?.className).toContain('@container');
    for (const card of Array.from(grid.children) as HTMLElement[]) {
      expect(card.className).toContain('@lg:grid-rows-subgrid');
      expect(card.className).not.toMatch(/(^|\s)(sm|md|lg):/);
    }
  });
});

describe('Checkout', () => {
  it('Checkout has no shipping or tax rows', () => {
    const { container } = renderCard(<AssistantBlock block={block('checkout', checkoutPayload('en-US'))} status="final" />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/shipping|tax|estimated|calculated at checkout/i);
    expect(screen.getByText('Discount')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue in my bag' })).toBeInTheDocument();
  });

  it('has no discount row when the platform sent none, and renders nothing while partial', () => {
    const { container, unmount } = renderCard(
      <AssistantBlock block={block('checkout', checkoutPayload('en-US', { discount: false }))} status="final" />,
    );
    expect(screen.queryByText('Discount')).toBeNull();
    expect(screen.queryByText('Subtotal')).toBeNull();
    unmount();
    const partial = renderCard(<AssistantBlock block={block('checkout', checkoutPayload('en-US'))} status="partial" />);
    expect(partial.container).toBeEmptyDOMElement();
    expect(container).toBeDefined();
  });

  it('the "not charged" pill is described by the explanatory sentence', () => {
    renderCard(<AssistantBlock block={block('checkout', checkoutPayload('en-US'))} status="final" />);
    const pill = screen.getByText('Not charged');
    const note = document.getElementById(pill.getAttribute('aria-describedby') ?? '');
    expect(note?.textContent).toMatch(/Nothing is charged/);
  });

  it('Continue in my bag is a link to the bag', () => {
    renderCard(<AssistantBlock block={block('checkout', checkoutPayload('en-US'))} status="final" />);
    expect(screen.getByRole('link', { name: 'Continue in my bag' })).toHaveAttribute('href', '/cart');
  });

  it('says the items are already in the bag and nothing is charged', () => {
    renderCard(<AssistantBlock block={block('checkout', checkoutPayload('en-US'))} status="final" />);
    expect(screen.getByText('These items are already in your bag. Nothing is charged here.')).toBeInTheDocument();
  });
});

describe('Product tiles', () => {
  it('Family tile does not write the cart', () => {
    const onAdd = vi.fn(async () => true);
    const p = productFixtures('en-US');
    const payload: ProductsPayload = { layout: 'carousel', items: [{ product: p.family }] };
    renderCard(<AssistantBlock block={block('products', payload)} status="final" onAdd={onAdd} />);
    expect(screen.queryByRole('button', { name: /^Add / })).toBeNull();
    expect(screen.getByText('Ask the assistant to pick an option.')).toBeInTheDocument();
    expect(screen.getByText('From $15.00')).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('a plain product adds by id through onAdd; an out-of-stock one has no add control', async () => {
    const onAdd = vi.fn(async () => true);
    const p = productFixtures('en-US');
    renderCard(
      <AssistantBlock
        block={block('products', { items: [{ product: p.espresso }, { product: p.soldOut }] })}
        status="final"
        onAdd={onAdd}
      />,
    );
    expect(screen.getAllByRole('button', { name: /^Add / })).toHaveLength(1);
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Add Malva Espresso/ }));
    });
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('mcf-espresso-1kg');
    expect(await screen.findByRole('button', { name: 'Added to cart' })).toBeInTheDocument();
  });

  it('shows the failed phase when the server held the add', async () => {
    const onAdd = vi.fn(async () => false);
    renderCard(
      <AssistantBlock
        block={block('products', { items: [{ product: productFixtures('en-US').espresso }] })}
        status="final"
        onAdd={onAdd}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Add / }));
    });
    expect(await screen.findByRole('button', { name: 'Could not add to cart' })).toBeInTheDocument();
  });

  it('Card add does not open the mini cart', async () => {
    const onAdd = vi.fn(async () => true);
    function Probe() {
      const { cartOpen } = useShellUi();
      return <output data-testid="cart-open">{String(cartOpen)}</output>;
    }
    renderCard(
      <>
        <Probe />
        <AssistantBlock block={block('products', productsPayload('en-US'))} status="final" onAdd={onAdd} />
      </>,
    );
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /^Add Malva/ })[0]);
    });
    expect(onAdd).toHaveBeenCalled();
    expect(screen.getByTestId('cart-open')).toHaveTextContent('false');
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('uses a neutral placeholder without image_url and the server image when present', () => {
    const p = productFixtures('en-US');
    const { container } = renderCard(
      <AssistantBlock
        block={block('products', {
          items: [{ product: p.espresso }, { product: { ...p.filter, image_url: 'https://img.example.com/f.jpg' } }],
        })}
        status="final"
      />,
    );
    expect(container.querySelectorAll('[data-image-placeholder]')).toHaveLength(1);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://img.example.com/f.jpg');
  });

  it('expands a detail panel and lists the variants as text', async () => {
    cardProduct.mockResolvedValue({ product: productFixtures('en-US').family, variants: familyVariants('en-US') });
    renderCard(
      <AssistantBlock
        block={block('products', { items: [{ product: productFixtures('en-US').family }] })}
        status="final"
        onAdd={async () => true}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Details for Malva House Blend' }));
    expect(await screen.findByText(/250 g · whole bean/)).toBeInTheDocument();
    expect(cardProduct).toHaveBeenCalledWith('mcf-house-blend');
    expect(screen.queryByRole('button', { name: /^Add / })).toBeNull();
  });

  it('renders grid and list layouts', () => {
    const { container, rerender } = renderCard(
      <AssistantBlock block={block('products', productsPayload('en-US', 'grid'))} status="final" />,
    );
    expect(container.querySelector('[data-layout="grid"]')?.className).toContain('grid-cols-2');
    expect(container.querySelector('[data-layout="grid"]')?.className).toContain('@lg:grid-cols-3');
    expect(rerender).toBeDefined();
  });
});

describe('Money', () => {
  it('renders 349.00 in USD for a major-unit price', () => {
    renderCard(<AssistantBlock block={block('comparison', comparisonPayload('en-US'))} status="final" />);
    expect(screen.getByText('$349.00')).toBeInTheDocument();
  });

  it('renders CAD in en-CA', () => {
    renderCard(<AssistantBlock block={block('comparison', comparisonPayload('en-CA'))} status="final" />, { locale: 'en-CA' });
    expect(screen.getAllByText(/\$471\.15/).length).toBeGreaterThan(0);
  });

  it('renders 42.97 for a cent-exact total', () => {
    const payload: CheckoutPayload = {
      lines: [{ product_id: 'a', title: 'A', price: 42.97, quantity: 1 }],
      totals: { currency: 'USD', total_minor: 4297 },
    };
    renderCard(<AssistantBlock block={block('checkout', payload)} status="final" />);
    // The line (major units) and the total (minor units) agree: neither path scaled the other.
    expect(screen.getAllByText('$42.97')).toHaveLength(2);
  });

  it('shows the discount from minor units', () => {
    renderCard(<AssistantBlock block={block('checkout', checkoutPayload('en-US'))} status="final" />);
    expect(screen.getByText('−$5.00')).toBeInTheDocument();
    expect(screen.getByText('$156.00')).toBeInTheDocument();
  });
});

describe('Model text', () => {
  it('HTML in model text renders as text', () => {
    const evil = '<img src=x onerror=alert(1)><b>bold</b>';
    const payload = guidePayload('en-US');
    payload.sections[0].body = evil;
    payload.title = evil;
    const { container } = renderCard(<AssistantBlock block={block('guide', payload)} status="final" />);
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.textContent).toContain(evil);
  });
});

describe('Plan and order', () => {
  it('the budget bar says it sums the cheapest option per step', () => {
    renderCard(<AssistantBlock block={block('plan', planPayload('en-US'))} status="final" />);
    // 349 + 129 + 17.50 (cheapest of two bean options)
    expect(screen.getByText(/Planned picks \$495\.50, the cheapest option in each step/)).toBeInTheDocument();
    expect(screen.getByText('1 step with no items to show')).toBeInTheDocument();
  });

  it('order status shows dates as sent and a view link only for https or same-origin paths', () => {
    const payload = orderStatusPayload('en-US');
    const { container, unmount } = renderCard(<AssistantBlock block={block('order_status', payload)} status="final" />);
    expect(screen.getByText('2026-11-06')).toBeInTheDocument();
    expect(screen.getByText('2026-10-28T09:12:00Z')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View order' })).toHaveAttribute('href', '/account/orders/MC-10482');
    unmount();
    for (const bad of ['javascript:alert(1)', 'http://x.example.com/o', '//evil.example.com/o', 'data:text/html,hi', 'orders/1']) {
      const view = renderCard(
        <AssistantBlock block={block('order_status', { ...payload, order: { ...payload.order, view_url: bad } })} status="final" />,
      );
      expect(screen.queryByRole('link', { name: 'View order' })).toBeNull();
      view.unmount();
    }
    const https = renderCard(
      <AssistantBlock
        block={block('order_status', { ...payload, order: { ...payload.order, view_url: 'https://shop.example.com/o/1' } })}
        status="final"
      />,
    );
    expect(screen.getByRole('link', { name: 'View order' })).toHaveAttribute('href', 'https://shop.example.com/o/1');
    https.unmount();
    expect(container).toBeDefined();
  });

  it('order status renders nothing while partial, and an unknown component a translated notice', () => {
    const partial = renderCard(<AssistantBlock block={block('order_status', orderStatusPayload('en-US'))} status="partial" />);
    expect(partial.container).toBeEmptyDOMElement();
    partial.unmount();
    renderCard(<AssistantBlock block={block('nope', {})} status="final" />);
    expect(screen.getByText('The assistant sent something this chat cannot show.')).toBeInTheDocument();
  });
});

describe('Accessibility', () => {
  const cases: [string, unknown][] = [
    ['products', productsPayload('en-US')],
    ['comparison', comparisonPayload('en-US')],
    ['plan', planPayload('en-US')],
    ['guide', guidePayload('en-US')],
    ['order_status', orderStatusPayload('en-US', 'delayed')],
    ['checkout', checkoutPayload('en-US')],
  ];
  it.each(cases)('%s card has no axe violations', async (component, payload) => {
    const { container } = renderCard(<AssistantBlock block={block(component, payload)} status="final" onAdd={async () => true} />);
    await expectNoAxeViolations(container);
  });
});

import { CartView } from '@/components/cart/CartView';
import CartPage, { generateMetadata } from './page';

const setRequestLocale = vi.fn();
vi.mock('next-intl/server', () => ({
  setRequestLocale: (...args: unknown[]) => setRequestLocale(...args),
  getTranslations: vi.fn(async () => (key: string) => (key === 'title' ? 'Your bag' : key)),
}));

describe('CartPage', () => {
  it('server page renders the client cart island for the locale', async () => {
    const el = await CartPage({ params: Promise.resolve({ locale: 'de-DE' }) });
    expect(el.type).toBe(CartView);
    expect(setRequestLocale).toHaveBeenCalledWith('de-DE');
  });

  it('title is "Your bag"', async () => {
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'en-US' }) })).toEqual({ title: 'Your bag' });
  });
});

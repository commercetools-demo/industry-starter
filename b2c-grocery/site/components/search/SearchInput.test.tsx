import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { SearchInput } from './SearchInput';

const replace = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/search',
}));

beforeEach(() => {
  replace.mockClear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

const type = (box: HTMLElement, text: string) => fireEvent.change(box, { target: { value: text } });

describe('SearchInput', () => {
  it('has an accessible name and is a search field', () => {
    renderWithProviders(<SearchInput />);
    expect(screen.getByRole('searchbox', { name: 'Search the shop' })).toBeInTheDocument();
  });

  it('shows the query from the URL', () => {
    renderWithProviders(<SearchInput initialQuery="milk" />);
    expect(screen.getByRole('searchbox')).toHaveValue('milk');
  });

  it('typing updates the URL once, 300 ms after the last keystroke', () => {
    renderWithProviders(<SearchInput />);
    const box = screen.getByRole('searchbox');
    type(box, 'm');
    act(() => void vi.advanceTimersByTime(200));
    type(box, 'mi');
    type(box, 'milk');
    act(() => void vi.advanceTimersByTime(299));
    expect(replace).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/search?q=milk');
  });

  it('Enter updates immediately and the pending debounce does not fire again', () => {
    renderWithProviders(<SearchInput />);
    const box = screen.getByRole('searchbox');
    type(box, 'oat drink');
    fireEvent.submit(box);
    expect(replace).toHaveBeenCalledWith('/search?q=oat+drink');
    act(() => void vi.advanceTimersByTime(1000));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('clearing the field removes q (page is dropped as well)', () => {
    renderWithProviders(<SearchInput initialQuery="milk" />);
    type(screen.getByRole('searchbox'), '  ');
    act(() => void vi.advanceTimersByTime(300));
    expect(replace).toHaveBeenCalledWith('/search');
  });
});

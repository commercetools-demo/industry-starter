import { render } from '@testing-library/react';
import { vi } from 'vitest';
import GlobalError from './global-error';

describe('GlobalError', () => {
  it('renders its own html and body with a reload button, without the raw error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // React warns about <html> inside a div container in jsdom; render into the document element.
    const { container } = render(<GlobalError error={new Error('boom detail')} reset={() => {}} />, {
      container: document.documentElement,
    });
    expect(container.querySelector('body')).not.toBeNull();
    expect(container.textContent).toContain('Something went wrong');
    expect(container.textContent).not.toContain('boom detail');
    expect(container.querySelector('button')?.textContent).toBe('Reload');
    vi.restoreAllMocks();
  });
});

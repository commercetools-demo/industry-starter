import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/test/render';
import FaqFeedback, { FEEDBACK_TIMEOUT_MS } from './FaqFeedback';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const stub = (impl: (url: string, init?: RequestInit) => Promise<Response>) => {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
};

describe('FaqFeedback', () => {
  it('acknowledgement only after recorded true', async () => {
    const fn = stub(async () => Response.json({ recorded: true }, { status: 202 }));
    renderWithIntl(<FaqFeedback questionId="ordering-shipping-cost" locale="en-US" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'No' }));
    });
    expect(screen.getByText('Thanks for your feedback.')).toBeInTheDocument();
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe('/api/faq-feedback');
    expect(JSON.parse(String(init?.body))).toEqual({ questionId: 'ordering-shipping-cost', helpful: false, locale: 'en-US' });
  });

  it('Feedback collector unreachable: vote is discarded and nothing is shown', async () => {
    stub(async () => {
      throw new TypeError('network down');
    });
    renderWithIntl(<FaqFeedback questionId="ordering-shipping-cost" locale="en-US" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    });
    expect(screen.queryByText('Thanks for your feedback.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('an error status shows nothing', async () => {
    stub(async () => Response.json({ error: { code: 'upstream_unavailable' } }, { status: 502 }));
    renderWithIntl(<FaqFeedback questionId="ordering-shipping-cost" locale="en-US" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    });
    expect(screen.queryByText('Thanks for your feedback.')).toBeNull();
  });

  it('request times out after 3 seconds on the client', async () => {
    vi.useFakeTimers();
    let aborted = false;
    stub(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );
    renderWithIntl(<FaqFeedback questionId="ordering-shipping-cost" locale="en-US" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    });
    expect(aborted).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEEDBACK_TIMEOUT_MS + 1);
    });
    expect(aborted).toBe(true);
    expect(screen.queryByText('Thanks for your feedback.')).toBeNull();
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
  });
});

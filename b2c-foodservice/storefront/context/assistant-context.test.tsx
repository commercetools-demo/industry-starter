import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantLauncher from '@/components/assistant/AssistantLauncher';
import { AssistantProvider, useAssistant } from '@/context/assistant-context';
import enUS from '@/messages/en-US.json';

const startSession = vi.fn();
const chatStream = vi.fn();
vi.mock('@/hooks/assistantApi', () => ({
  assistantApi: {
    startSession: (...a: unknown[]) => startSession(...a),
    chatStream: (...a: unknown[]) => chatStream(...a),
    cardAdd: vi.fn(),
  },
}));

function Probe() {
  const a = useAssistant();
  return (
    <div>
      <span data-testid="state">{`${a.enabled}|${a.isOpen}|${a.status}|${a.openedCount}`}</span>
      <button onClick={a.open}>open</button>
      <button onClick={a.toggle}>toggle</button>
      <button onClick={() => a.send('hello')}>send</button>
    </div>
  );
}

const wrap = (ui: React.ReactNode, enabled = true) => (
  <NextIntlClientProvider locale="en-US" messages={enUS}>
    <AssistantProvider enabled={enabled}>{ui}</AssistantProvider>
  </NextIntlClientProvider>
);

beforeEach(() => {
  startSession.mockReset();
  chatStream.mockReset();
  startSession.mockResolvedValue(true);
  chatStream.mockImplementation(async function* () {
    yield { type: 'text_delta', data: { text: 'hi' } };
    yield { type: 'turn_complete', data: { stop_reason: 'end_turn', usage: {}, elapsed_ms: 1, results_cleared: 0 } };
  });
});

describe('assistant provider', () => {
  it('Provider absent gives a no-op', () => {
    render(
      <NextIntlClientProvider locale="en-US" messages={enUS}>
        <Probe />
        <AssistantLauncher />
      </NextIntlClientProvider>,
    );
    expect(screen.getByTestId('state').textContent).toBe('false|false|idle|0');
    expect(screen.queryByRole('button', { name: /ask malva/i })).toBeNull();
  });

  it('Session starts on first open only', async () => {
    render(wrap(<Probe />));
    expect(startSession).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText('open'));
    await userEvent.click(screen.getByText('open'));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toContain('ready'));
    expect(startSession).toHaveBeenCalledTimes(1);
  });

  it('Typing before ready is queued and sent', async () => {
    let release: (ok: boolean) => void = () => {};
    startSession.mockReturnValue(new Promise<boolean>((resolve) => (release = resolve)));
    render(wrap(<Probe />));
    await userEvent.click(screen.getByText('send'));
    expect(chatStream).not.toHaveBeenCalled();
    await act(async () => release(true));
    await waitFor(() => expect(chatStream).toHaveBeenCalledWith('hello'));
  });

  it('StrictMode records one open', async () => {
    render(
      <StrictMode>
        <NextIntlClientProvider locale="en-US" messages={enUS}>
          <AssistantProvider enabled>
            <Probe />
          </AssistantProvider>
        </NextIntlClientProvider>
      </StrictMode>,
    );
    await userEvent.click(screen.getByText('toggle'));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toContain('ready'));
    expect(screen.getByTestId('state').textContent?.endsWith('|1')).toBe(true);
    expect(startSession).toHaveBeenCalledTimes(1);
  });

  it('A failed start reads as unavailable', async () => {
    startSession.mockResolvedValue(false);
    render(wrap(<Probe />));
    await userEvent.click(screen.getByText('open'));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toContain('unavailable'));
  });

  it('Launcher label is visible', () => {
    render(wrap(<AssistantLauncher />));
    const button = screen.getByRole('button', { name: /ask malva/i });
    expect(button).toHaveTextContent('Ask Malva');
    expect(button.className).toContain('assistant-scope');
    expect(button.className).toContain('text-ink');
  });

  it('A disabled provider renders no launcher', () => {
    render(wrap(<AssistantLauncher />, false));
    expect(screen.queryByRole('button')).toBeNull();
  });
});

const mutateSpy = vi.hoisted(() => vi.fn());
vi.mock('swr', async (importOriginal) => {
  const real = await importOriginal<typeof import('swr')>();
  return { ...real, useSWRConfig: () => ({ mutate: mutateSpy }) };
});

describe('assistant cart updates', () => {
  it('A cart update revalidates the bag and the badge', async () => {
    mutateSpy.mockReset();
    chatStream.mockImplementation(async function* () {
      yield { type: 'cart_update', data: { cart: { item_count: 3 } } };
      yield { type: 'turn_complete', data: { stop_reason: 'end_turn', usage: {}, elapsed_ms: 1, results_cleared: 0 } };
    });
    render(wrap(<Probe />));
    await userEvent.click(screen.getByText('open'));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toContain('ready'));
    await userEvent.click(screen.getByText('send'));
    await waitFor(() => expect(mutateSpy).toHaveBeenCalledWith('cart'));
    expect(mutateSpy).toHaveBeenCalledWith('cart-count');
  });
});

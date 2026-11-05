'use client';

import { useLocale, useTranslations } from 'next-intl';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDescribeToolCall } from '@/components/assistant/activity';
import type { AgentEvent, ChatItem } from '@/components/assistant/protocol';
import { type TurnSource, useAgentTurn } from '@/components/assistant/turn';
import { assistantApi } from '@/hooks/assistantApi';
import { KEY_CART, KEY_CART_COUNT } from '@/lib/cache-keys';
import { useSWRConfig } from 'swr';

/**
 * The shopping assistant's state for the shell (workstream T). Mounted once in the locale layout. Without a provider every consumer gets the
 * no-op default (`enabled: false`), so the header never crashes when the surface is off.
 *  - The session starts on the FIRST OPEN, never on mount; text typed before it is ready is queued and sent when it is.
 *  - "Opened" is recorded on the edge from a ref, outside any state updater, through the one path `open()` and `toggle()` share.
 *  - A market (locale) change ends the conversation: the server ends the session when the cookie's market no longer matches.
 */
export type AssistantStatus = 'idle' | 'starting' | 'ready' | 'unavailable';

export interface AssistantValue {
  enabled: boolean;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  status: AssistantStatus;
  items: ChatItem[];
  busy: boolean;
  ready: boolean;
  send: (text: string) => void;
  /** Adds a seen product to the ASSISTANT's cart from a card. Resolves true when the server confirmed. */
  addFromCard: (productId: string, quantity?: number) => Promise<boolean>;
  /** Units in the assistant's cart as last reported by the server. */
  cartCount: number;
  /** How many times the panel was opened (analytics, StrictMode-safe). */
  openedCount: number;
  /** Where the launcher lives, so Escape can return focus to it. */
  launcherRef: { current: HTMLElement | null };
}

const NOOP: AssistantValue = {
  enabled: false,
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
  status: 'idle',
  items: [],
  busy: false,
  ready: false,
  send: () => {},
  addFromCard: async () => false,
  cartCount: 0,
  openedCount: 0,
  launcherRef: { current: null },
};

const AssistantContext = createContext<AssistantValue>(NOOP);

export function useAssistant(): AssistantValue {
  return useContext(AssistantContext);
}

export function AssistantProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const t = useTranslations('assistant');
  const locale = useLocale();
  const describeToolCall = useDescribeToolCall();
  const [isOpen, setOpen] = useState(false);
  const [status, setStatus] = useState<AssistantStatus>('idle');
  const [cartCount, setCartCount] = useState(0);
  const [openedCount, setOpenedCount] = useState(0);
  const openedRef = useRef(false);
  const startingRef = useRef(false);
  const queueRef = useRef<string | null>(null);
  const launcherRef = useRef<HTMLElement | null>(null);

  const { mutate } = useSWRConfig();
  const source = useMemo<TurnSource>(() => ({ chatStream: (message) => assistantApi.chatStream(message) }), []);
  const onEvent = useCallback((event: AgentEvent) => {
    if (event.type !== 'cart_update') return;
    const cart = event.data.cart as { item_count?: unknown } | undefined;
    setCartCount(typeof cart?.item_count === 'number' ? cart.item_count : 0);
    // The assistant changed the shopper's bag: refresh the bag and the header badge. The mini cart is NOT opened (T-36).
    void mutate(KEY_CART);
    void mutate(KEY_CART_COUNT);
  }, [mutate]);
  const turn = useAgentTurn(source, {
    sessionId: status === 'ready' ? 'cookie' : null,
    unreachable: t('errors.unreachable'),
    describeToolCall,
    onEvent,
  });
  const { send: turnSend, setItems } = turn;

  const startSession = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStatus('starting');
    const started = await assistantApi.startSession();
    startingRef.current = false;
    setStatus(started ? 'ready' : 'unavailable');
  }, []);

  const open = useCallback(() => {
    setOpen(true);
    // The edge is read from a ref, never from inside a state updater (a StrictMode double-invoke would record twice).
    if (!openedRef.current) {
      openedRef.current = true;
      setOpenedCount((n) => n + 1);
      void startSession();
    }
  }, [startSession]);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => (isOpen ? close() : open()), [isOpen, close, open]);

  // Typing before the session is ready is queued (one slot: the latest) and flushed once ready.
  const send = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      if (status !== 'ready') {
        queueRef.current = text;
        if (status === 'idle') open();
        return;
      }
      void turnSend(text);
    },
    [status, open, turnSend],
  );
  useEffect(() => {
    if (status === 'ready' && queueRef.current) {
      const queued = queueRef.current;
      queueRef.current = null;
      void turnSend(queued);
    }
  }, [status, turnSend]);

  // A market change ends the conversation; the next open starts a fresh server session.
  const localeRef = useRef(locale);
  useEffect(() => {
    if (localeRef.current === locale) return;
    localeRef.current = locale;
    openedRef.current = false;
    queueRef.current = null;
    setItems([]);
    setCartCount(0);
    setStatus('idle');
    setOpen(false);
  }, [locale, setItems]);

  const addFromCard = useCallback(async (productId: string, quantity = 1) => {
    const cart = await assistantApi.cardAdd(productId, quantity);
    if (!cart) return false;
    setCartCount(typeof cart.item_count === 'number' ? cart.item_count : 0);
    return true;
  }, []);

  const value = useMemo<AssistantValue>(
    () => ({
      enabled,
      isOpen,
      open,
      close,
      toggle,
      status,
      items: turn.items,
      busy: turn.busy,
      ready: turn.ready,
      send,
      addFromCard,
      cartCount,
      openedCount,
      launcherRef,
    }),
    [enabled, isOpen, open, close, toggle, status, turn.items, turn.busy, turn.ready, send, addFromCard, cartCount, openedCount],
  );
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

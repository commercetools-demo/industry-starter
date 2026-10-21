'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useCollectionStore } from '@/hooks/useCollectionStore';
import { useRouter } from '@/i18n/routing';
import { maxQuantity, minQuantity, type Fulfilment } from '@/lib/product/add-state';
import { firstMissing, resolveVariant, type Selection } from '@/lib/product/resolve-variant';
import { previewVariant, serializeSelection } from '@/lib/product/selection';
import { PDP_MAX_QUANTITY } from '@/lib/shop-config';
import type { ProductPageData } from '@/lib/types';
import type { RecurrencePolicyView, SelectorDef, Store, VariantView } from '@/lib/types';

export interface PdpState {
  data: ProductPageData;
  selection: Selection;
  select: (attr: string, value: string) => void;
  /** The variant the selection resolves to; null while a required choice is missing. */
  variant: VariantView | null;
  /** The variant to show (imagery, price range) while the selection is incomplete. */
  preview: VariantView;
  missing: SelectorDef | undefined;
  /** Selector attribute highlighted by `?choose=`. */
  choose: string | undefined;
  fulfilment: Fulfilment;
  setFulfilment: (value: Fulfilment) => void;
  quantity: number;
  minQty: number;
  maxQty: number;
  setQuantity: (value: number) => void;
  /** Recurrence policies the shopper can choose for the resolved (or preview) variant, with their price. */
  policies: { policy: RecurrencePolicyView; price: VariantView['recurring'][number] }[];
  subscribeAvailable: boolean;
  policyId: string | undefined;
  setPolicyId: (id: string) => void;
  store: Store | null;
  /** Collection is offered here (US market and at least the picker exists). */
  collectionEnabled: boolean;
  /** A store change is being re-read from the server. */
  refreshing: boolean;
}

const PdpContext = createContext<PdpState | null>(null);

export function usePdp(): PdpState {
  const ctx = useContext(PdpContext);
  if (!ctx) throw new Error('usePdp must be used inside <PdpProvider>');
  return ctx;
}

interface Props {
  data: ProductPageData;
  initialSelection: Selection;
  choose?: string;
  children: ReactNode;
}

/**
 * State owner of the product page (workstream H, 3.8): selection, fulfilment, quantity and subscription interval. The
 * gallery and the buy box read it from here. Selecting an option updates state at once (every variant is in the page
 * payload) and mirrors the selection into the URL with `history.replaceState` (Q-H-10), so nothing re-renders on the server.
 */
export function PdpProvider({ data, initialSelection, choose, children }: Props) {
  const { product } = data;
  const router = useRouter();
  const { store, stores, isLoading, preferShip } = useCollectionStore();
  const collectionEnabled = data.collection && (isLoading || stores.length > 0);

  const [selection, setSelection] = useState<Selection>(initialSelection);
  const required = useMemo(() => product.selectors.filter((s) => s.required).map((s) => s.attr), [product.selectors]);
  const variant = useMemo(() => resolveVariant(product.variants, selection, required), [product.variants, selection, required]);
  const preview = useMemo(
    () => (variant ?? previewVariant(product.variants, selection, product.defaultSku)) as VariantView,
    [variant, product.variants, product.defaultSku, selection],
  );
  const missing = useMemo(() => firstMissing(product.selectors, selection), [product.selectors, selection]);

  // Default fulfilment on load (Q-H-01): collect when a store is chosen and the landing variant is in stock there.
  const [fulfilmentRaw, setFulfilment] = useState<Fulfilment>(() => {
    if (!data.collection || preferShip || !store) return 'delivery';
    const landing = product.variants.find((v) => v.sku === product.defaultSku);
    return (landing?.stock.stores[store.id] ?? 0) > 0 ? 'collect' : 'delivery';
  });

  const policies = useMemo(() => {
    const out: PdpState['policies'] = [];
    for (const policy of data.policies) {
      const price = preview.recurring.find((r) => r.policyId === policy.id);
      if (price) out.push({ policy, price });
    }
    return out;
  }, [data.policies, preview.recurring]);
  const subscribeAvailable =
    product.subscribable && product.shape !== 'machine' && policies.length > 0 && preview.price !== null;

  let fulfilment = fulfilmentRaw;
  if (fulfilment === 'collect' && !collectionEnabled) fulfilment = 'delivery';
  if (fulfilment === 'subscribe' && !subscribeAvailable) fulfilment = 'delivery';

  const [policyChoice, setPolicyChoice] = useState<string | undefined>();
  const policyId = policies.some((p) => p.policy.id === policyChoice) ? policyChoice : policies[0]?.policy.id;

  const [quantityRaw, setQuantity] = useState(1);
  const storeChannelId = store?.id;
  const minQty = minQuantity(variant ?? preview);
  const maxQty = Math.max(minQty, maxQuantity(variant ?? preview, fulfilment, storeChannelId, PDP_MAX_QUANTITY));
  const quantity = Math.min(maxQty, Math.max(minQty, quantityRaw));

  const select = useCallback((attr: string, value: string) => setSelection((s) => ({ ...s, [attr]: value })), []);

  // Mirror the selection in the address bar without a server round trip or a history entry (Q-H-10).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const url = `${window.location.pathname}${serializeSelection(selection, product.selectors)}`;
    window.history.replaceState(window.history.state, '', url);
  }, [selection, product.selectors]);

  // A store change re-reads inventory on the server; the old values stay until the new ones arrive.
  // Remember which payload was on screen when the store changed; the refresh is over when new data arrives (or after 4 s).
  const [refreshFrom, setRefreshFrom] = useState<ProductPageData | null>(null);
  const refreshing = refreshFrom !== null && refreshFrom === data;
  const lastStore = useRef(store?.key ?? null);
  useEffect(() => {
    const key = store?.key ?? null;
    if (key === lastStore.current) return;
    lastStore.current = key;
    setRefreshFrom(data);
    router.refresh();
    const timer = window.setTimeout(() => setRefreshFrom(null), 4000);
    return () => window.clearTimeout(timer);
  }, [store?.key, router, data]);

  const value: PdpState = {
    data, selection, select, variant, preview, missing, choose, fulfilment, setFulfilment, quantity, minQty, maxQty, setQuantity,
    policies, subscribeAvailable, policyId, setPolicyId: setPolicyChoice, store, collectionEnabled, refreshing,
  };
  return <PdpContext.Provider value={value}>{children}</PdpContext.Provider>;
}

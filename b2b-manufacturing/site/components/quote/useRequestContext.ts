'use client';
import useSWR from 'swr';
import { useAccount } from '@/hooks/useAccount';
import { buKey, KEY_QUOTE_CONTEXT } from '@/lib/cache-keys';
import { readJson } from '@/lib/fetcher';

export interface SiteOption { id: string; label: string; addressLine1: string; addressLine2?: string; city: string; postalCode: string; country: string }
export interface RequestContext {
  signedIn: boolean; canSubmit: boolean; adminName?: string; company?: string; sector?: string; sites: SiteOption[];
  contact?: { name: string; email: string; jobTitle: string; phone: string };
}
const ANONYMOUS: RequestContext = { signedIn: false, canSubmit: true, sites: [] };

/** Prefill data for a signed-in client (company, sites, contact, permission). Anonymous visitors get an empty context. */
export function useRequestContext() {
  const { account, isLoading: accountLoading } = useAccount();
  const { data, isLoading } = useSWR(buKey(KEY_QUOTE_CONTEXT, account?.businessUnitKey), () => readJson<RequestContext>('/api/quote-requests/context'), { revalidateOnFocus: false });
  return { context: data ?? ANONYMOUS, isLoading: isLoading || accountLoading };
}

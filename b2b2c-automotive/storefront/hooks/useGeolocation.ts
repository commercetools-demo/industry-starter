// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useCallback, useState } from 'react';

export type GeolocationStatus = 'idle' | 'pending' | 'granted' | 'denied' | 'unavailable';
export interface GeolocationState {
  status: GeolocationStatus;
  position: { lat: number; lng: number } | null;
}

/** Wraps `navigator.geolocation.getCurrentPosition`. It is never called on mount: only `request()` (a button press) asks for permission. */
export function useGeolocation(): GeolocationState & { request: () => void } {
  const [state, setState] = useState<GeolocationState>({ status: 'idle', position: null });
  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ status: 'unavailable', position: null });
      return;
    }
    setState((s) => ({ ...s, status: 'pending' }));
    navigator.geolocation.getCurrentPosition(
      (p) => setState({ status: 'granted', position: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      (error) => setState({ status: error.code === 1 ? 'denied' : 'unavailable', position: null }),
      { maximumAge: 300_000, timeout: 10_000 },
    );
  }, []);
  return { ...state, request };
}

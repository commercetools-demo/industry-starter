// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { createContext, useContext } from 'react';

export interface StorePickerApi {
  /** Opens the picker; the focused element at that moment gets focus back when it closes. A no-op for a single-branch store. */
  open: () => void;
  isOpen: boolean;
}

const NOOP: StorePickerApi = { open: () => {}, isOpen: false };

export const StorePickerContext = createContext<StorePickerApi>(NOOP);

/** `open()` from anywhere below `StorePickerHost` (the header chip, the "Change store" link on the product page). */
export function useStorePicker(): StorePickerApi {
  return useContext(StorePickerContext);
}

/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

export const THEME_STORAGE_KEY = 'malva-portal-theme';

/** Runs before first paint (inline script in the root layout) so there is no flash of the wrong theme. */
export const themeInitScript = `(()=>{try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}})()`;

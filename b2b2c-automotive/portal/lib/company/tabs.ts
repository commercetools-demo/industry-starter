// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Tab ids of Company & team and Account settings (workstream U-09, U-10). A plain module: the pages (server) and the tab strips
// (client) both import it; a constant exported from a 'use client' file is not usable on the server.
export const COMPANY_TABS = ['users', 'addresses', 'profile'] as const;
export type CompanyTabId = (typeof COMPANY_TABS)[number];

export const ACCOUNT_TABS = ['general', 'security', 'addresses', 'business-units'] as const;
export type AccountTabId = (typeof ACCOUNT_TABS)[number];

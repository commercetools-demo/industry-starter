/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { vi } from 'vitest';

vi.mock('@/lib/portal/seam', async () => (await import('@/lib/ct/seller/dashboard/route-harness')).seamMock);
vi.mock('@/lib/ct/associate', async () => (await import('@/lib/ct/seller/dashboard/route-harness')).associateMock);
vi.mock('@/lib/ct/seller/dashboard/ports', async () => (await import('@/lib/ct/seller/dashboard/route-harness')).portsMock);

import { describeDashboardRoute } from '@/lib/ct/seller/dashboard/route-harness';
import { GET } from './route';

describeDashboardRoute('renewals', GET, 'renewals', ['renewals']);

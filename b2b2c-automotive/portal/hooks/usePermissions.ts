/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { can as canDo, type LogicalRole, type PortalAction } from '@/lib/authz/permissions';
import { useViewer } from '@/context/ViewerContext';
import type { CurrentUnitResponse } from '@/lib/portal/types';
import { swrFetcher } from './http';

export interface UsePermissions {
  roles: LogicalRole[];
  can: (action: PortalAction) => boolean;
  isLoading: boolean;
}

/**
 * Roles and permissions of the active business unit. The server layout already resolved them (`fallbackData`); the SWR key
 * includes the business unit so a switch refreshes them (R-04). Never trusted by the server: every route re-checks.
 */
export function usePermissions(): UsePermissions {
  const viewer = useViewer();
  const fallback: CurrentUnitResponse = { businessUnitKey: viewer.businessUnitKey, storeKey: viewer.storeKey, roles: viewer.roles, ctPermissions: viewer.ctPermissions };
  const { data, isLoading } = useSWR<CurrentUnitResponse>(
    ['permissions', viewer.businessUnitKey],
    () => swrFetcher<CurrentUnitResponse>('/api/business-units/current'),
    { fallbackData: fallback, revalidateOnMount: false, revalidateOnFocus: false },
  );
  const roles = data?.roles ?? viewer.roles;
  const ctPermissions = data?.ctPermissions ?? viewer.ctPermissions;
  const can = useMemo(() => (action: PortalAction) => canDo({ roles, ctPermissions }, action), [roles, ctPermissions]);
  return { roles, can, isLoading };
}

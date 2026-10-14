/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ChannelDraft } from '../types';

// Sales channels with their own prices. `online` is the default and has no channel prices, so it is not a channel resource.
export const channels: ChannelDraft[] = [{ key: 'call-center', name: { 'en-US': 'Call center', 'de-DE': 'Callcenter' } }];

/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ProductTypeDraft } from '../../types';
import { addonType } from './addon';
import { deviceType } from './device';
import { equipmentType } from './equipment';
import { internetPlanType } from './internet-plan';
import { offerType } from './offer';
import { phonePlanType } from './phone-plan';

// Product types first: Product Search reindexes fully when a type changes.
export const productTypes: ProductTypeDraft[] = [internetPlanType, phonePlanType, addonType, equipmentType, deviceType, offerType];
export { addonType, deviceType, equipmentType, internetPlanType, offerType, phonePlanType };

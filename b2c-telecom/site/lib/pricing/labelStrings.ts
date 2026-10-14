/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import en from '@/messages/en-US.json';
import type { LabelStrings } from './label';

/** The label text is English in both locales (see lib/config/label.ts), so the en-US texts are the source of truth. */
export const LABEL_STRINGS: LabelStrings = {
  kind: en.label.kind,
  activationFee: en.label.activationFee,
  lock: en.label.lock,
  noLock: en.label.noLock,
  intro: en.label.intro,
  introOne: en.label.introOne,
  step: en.label.step,
  perMonth: en.label.perMonth,
  unlimited: en.label.unlimited,
  gb: en.label.gb,
  mbps: en.label.mbps,
  ms: en.label.ms,
  download: en.label.download,
  upload: en.label.upload,
  latency: en.label.latency,
  discounts: en.label.discounts,
};

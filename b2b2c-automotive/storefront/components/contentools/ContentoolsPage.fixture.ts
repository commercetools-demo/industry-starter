// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Test fixture: a one-block page using TextBlock (field `content`), a block of the installed defaultRenderConfig.
import type { PuckData } from '@commercetools-demo/puck-types';

export const textPage = { content: [{ type: 'TextBlock', props: { id: 'TextBlock-1', content: '<p>Puck says hello</p>' } }], root: { props: {} } } as unknown as PuckData;

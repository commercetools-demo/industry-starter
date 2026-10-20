/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { OutputType } from './validation';

/**
 * The prompt Intake receives. Intake resolves the customer, Business Unit and country from the input, so the signed-in identity is
 * written in from the session (never from the request body).
 */
export function buildPrompt(input: { outputType: OutputType; email: string; businessUnitKey: string; country: string; listName?: string; text?: string }): string {
  const lines = [
    `Customer email: ${input.email}`,
    `Business unit key: ${input.businessUnitKey}`,
    ...(input.outputType === 'ShoppingList' ? [`Shopping list name: "${input.listName?.trim().replace(/"/g, "'") ?? ''}"`] : [`Shipping country: ${input.country}`]),
  ];
  const text = input.text?.trim();
  return text ? `${lines.join('\n')}\n\n${text}` : lines.join('\n');
}

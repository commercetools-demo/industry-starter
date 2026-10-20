/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

/** The output the client chooses; sent to Intake as `outputType`. Intake never infers it. */
export const OUTPUT_TYPES = ['Cart', 'ShoppingList', 'QuoteRequest'] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_TEXT = 10_000;
export const MAX_LIST_NAME = 100;

/** Content types Intake accepts, by file extension (browsers often send an empty type, so the extension decides). */
export const FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  eml: 'message/rfc822',
  md: 'text/markdown',
  html: 'text/html',
};
export const ACCEPT_ATTRIBUTE = Object.keys(FILE_TYPES).map((e) => `.${e}`).join(',');

export type IntakeProblem =
  | { code: 'NothingToSubmit' }
  | { code: 'InvalidOutputType' }
  | { code: 'MissingListName' }
  | { code: 'TooManyFiles' }
  | { code: 'UnsupportedFile'; fileName: string }
  | { code: 'FileTooLarge'; fileName: string };

export const extensionOf = (fileName: string): string => fileName.split('.').pop()?.toLowerCase() ?? '';
export const contentTypeOf = (fileName: string): string | undefined => FILE_TYPES[extensionOf(fileName)];

export interface IntakeInput { outputType: string; listName?: string; text?: string; files: { name: string; size: number }[] }

/** The same rules run in the form and on the server; returns the first problem, or null. */
export function validateIntake(input: IntakeInput): IntakeProblem | null {
  if (!(OUTPUT_TYPES as readonly string[]).includes(input.outputType)) return { code: 'InvalidOutputType' };
  if (input.files.length > MAX_FILES) return { code: 'TooManyFiles' };
  for (const file of input.files) {
    if (!contentTypeOf(file.name)) return { code: 'UnsupportedFile', fileName: file.name };
    if (file.size > MAX_FILE_BYTES) return { code: 'FileTooLarge', fileName: file.name };
  }
  if (input.files.length === 0 && !input.text?.trim()) return { code: 'NothingToSubmit' };
  if (input.outputType === 'ShoppingList' && !input.listName?.trim()) return { code: 'MissingListName' };
  return null;
}

/** A sentence for the browser; `limits` come from the constants so they cannot drift from the rules. */
export function describeProblem(problem: IntakeProblem): string {
  switch (problem.code) {
    case 'NothingToSubmit': return 'Add a file or describe your order.';
    case 'InvalidOutputType': return 'Choose what to create.';
    case 'MissingListName': return 'Give the shopping list a name.';
    case 'TooManyFiles': return `You can upload up to ${MAX_FILES} files.`;
    case 'UnsupportedFile': return `${problem.fileName}: this file type is not supported.`;
    case 'FileTooLarge': return `${problem.fileName}: files can be up to ${MAX_FILE_BYTES / 1024 / 1024} MB.`;
  }
}

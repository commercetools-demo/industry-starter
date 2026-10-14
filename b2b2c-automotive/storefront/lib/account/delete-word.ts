// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The word a shopper types to confirm "Delete account" (workstream Q-11). The catalogs show the same word (`account.delete.confirmWord`); a test keeps
// the two in step. The server accepts either language's word, whatever the page language, because the check is a guard against a slip, not a secret.
export const DELETE_WORDS: readonly string[] = ['DELETE', 'LÖSCHEN'];

export const isDeleteWord = (value: string): boolean => DELETE_WORDS.includes(value.trim().toLocaleUpperCase('en-US'));

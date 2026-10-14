// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
/** A Request for calling a Route Handler or the proxy directly. Relative URLs resolve against localhost:3000. */
export function makeRequest(url: string, init?: RequestInit): Request {
  return new Request(new URL(url, 'http://localhost:3000'), init);
}

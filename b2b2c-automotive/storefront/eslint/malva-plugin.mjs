// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import noPuckInServer from './rules/no-puck-in-server.mjs';

const plugin = { rules: { 'no-puck-in-server': noPuckInServer } };
export default plugin;

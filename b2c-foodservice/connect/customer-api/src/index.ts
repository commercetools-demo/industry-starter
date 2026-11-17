import * as dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { readConfiguration } from './config';
import { createCtApi } from './ct-api';

// Fail at start-up, naming the offending keys, rather than on the first request.
const config = readConfiguration();
const port = process.env.PORT || 8080;

const server = createApp(createCtApi(config), { corsOrigin: config.corsOrigin }).listen(port, () => {
  console.log(JSON.stringify({ message: `customer-api listening on port ${port}` }));
});

server.on('error', (error: Error & { code?: string }) => {
  console.error(JSON.stringify({ error: 'listen_failed', code: error.code, message: error.message }));
  process.exit(1);
});

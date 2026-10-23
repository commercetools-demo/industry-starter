import { createTrackerProxyRoute } from '@ct-demos/demotools/tracker/server';

const handler = createTrackerProxyRoute({ mode: 'gated' });

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;

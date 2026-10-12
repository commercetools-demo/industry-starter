import path from 'node:path';
import { scanBundle } from './check-bundle-secrets.mjs';

/** Scans `.next/static` of an app root with no secrets; a missing directory is a pass. */
export const checkBundleSecretsDir = (root) => scanBundle(path.join(root, '.next', 'static'), []);

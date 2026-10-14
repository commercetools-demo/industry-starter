// Registers the bundle reconciliation in T's `onAssortmentChanged` hooks (W-09), so a withdraw, a reinstate or a reconcile in the
// assortment hides or restores the store's bundles. `assortment-write.ts` loads this module (dynamic import at its end). A failure
// here never fails the assortment change that triggered it: the bundle list reconciles again every time it loads.
import 'server-only';
import { onAssortmentChanged } from './assortment-write';
import { reconcileBundles } from './bundles';

const hook = async (storeKey: string): Promise<void> => {
  try {
    await reconcileBundles(storeKey);
  } catch (error) {
    console.error('bundle reconcile failed', error instanceof Error ? error.message : 'unknown error');
  }
};

if (!onAssortmentChanged.includes(hook)) onAssortmentChanged.push(hook);

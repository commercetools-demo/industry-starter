import type { ProductDraft } from '../../types';
import { addonProducts } from './addons';
import { deviceProducts } from './devices';
import { equipmentProducts } from './equipment';
import { cablePlanProducts } from './plans-cable';
import { phonePlanProducts } from './plans-phone';
import { wirelessPlanProducts } from './plans-wireless';

/** The 25 descriptive products. */
export const descriptiveProducts: ProductDraft[] = [
  ...cablePlanProducts,
  ...wirelessPlanProducts,
  ...phonePlanProducts,
  ...addonProducts,
  ...equipmentProducts,
  ...deviceProducts,
];

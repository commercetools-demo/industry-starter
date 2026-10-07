import type { TypeDraft } from '../../types';
import { cartType } from './cart';
import { customerType } from './customer';
import { lineItemType } from './line-item';
import { orderType } from './order';

export const customTypes: TypeDraft[] = [lineItemType, cartType, orderType, customerType];
export { cartType, customerType, lineItemType, orderType };

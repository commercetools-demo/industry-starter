import type { TypeDraft } from '../../types';
import { cartType } from './cart';
import { customerType } from './customer';
import { lineItemType } from './line-item';
import { listLineType } from './list-line';
import { orderType } from './order';
import { paymentMethodType } from './payment-method';

export const customTypes: TypeDraft[] = [lineItemType, cartType, orderType, customerType, paymentMethodType, listLineType];
export { cartType, customerType, lineItemType, listLineType, orderType, paymentMethodType };

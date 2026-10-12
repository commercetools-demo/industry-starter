import { useTranslations } from 'next-intl';
import { codeStatus, type DiscountCodeState } from '@/lib/discounts/code-status';

/**
 * Status of one promo code on a cart: "Applied", or "Not applied: ..." with the reason, and the named savings. The storefront cart
 * (workstream N) reuses it: the savings come from `discountOnTotalPrice.includedDiscounts` and `lineItem.discountedPricePerQuantity`.
 */
export function DiscountCodeStatus({ code, state, savings = [] }: { code: string; state: DiscountCodeState; savings?: string[] }) {
  const t = useTranslations('catalog.codeStatus');
  const status = codeStatus(state);
  return (
    <div data-testid={`code-status-${code}`} className="flex flex-col gap-050">
      <p className={`text-body-2 font-semibold ${status.applied ? 'text-text-success' : 'text-text-critical'}`}>
        <span className="font-mono">{code}</span>: {t(status.key)}
      </p>
      {status.applied && savings.length ? (
        <ul className="text-caption-1 text-text-subdued">
          {savings.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

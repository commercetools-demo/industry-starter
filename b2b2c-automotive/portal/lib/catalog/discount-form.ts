// Form state of the discount editor and its conversion to and from the structured rule (lib/catalog/discount-rule.ts). Pure.
import type { CartRule, ProductRule } from './discount-rule';
import { formatPriceInput, parsePriceInput } from './price-input';
import type { DiscountKind } from './types';

export interface DiscountForm {
  nameDe: string;
  nameEn: string;
  scopeKind: 'all' | 'category' | 'skus';
  conditionKind: 'always' | 'cartTotalAtLeast' | 'category';
  categoryId: string;
  categoryLabel: string;
  skus: string;
  /** Major units, as typed ("2000,00"). */
  amount: string;
  effectKind: 'relative' | 'absolute' | 'freeShipping';
  /** Percent, or major units for an absolute amount. */
  value: string;
  /** yyyy-mm-dd or ''. */
  validFrom: string;
  validUntil: string;
  stacking: 'Stacking' | 'StopAfterThisDiscount';
  code: string;
}

export const EMPTY_FORM: DiscountForm = {
  nameDe: '', nameEn: '', scopeKind: 'all', conditionKind: 'always', categoryId: '', categoryLabel: '', skus: '', amount: '', effectKind: 'relative', value: '', validFrom: '', validUntil: '', stacking: 'Stacking', code: '',
};

const day = (iso: string | undefined) => (iso ? iso.slice(0, 10) : '');
const percentText = (n: number, locale: string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(n);

export function formFromRule(rule: ProductRule | CartRule, locale = 'en-US'): DiscountForm {
  const base: DiscountForm = {
    ...EMPTY_FORM,
    nameDe: rule.name['de-DE'] ?? '',
    nameEn: rule.name['en-US'] ?? '',
    validFrom: day(rule.validFrom),
    validUntil: day(rule.validUntil),
  };
  const effect =
    rule.effect.kind === 'relative'
      ? { effectKind: 'relative' as const, value: percentText(rule.effect.percent, locale) }
      : rule.effect.kind === 'absolute'
        ? { effectKind: 'absolute' as const, value: formatPriceInput(rule.effect.centAmount, locale) }
        : { effectKind: 'freeShipping' as const, value: '' };
  if ('condition' in rule) {
    const c = rule.condition;
    return {
      ...base,
      ...effect,
      conditionKind: c.kind,
      categoryId: c.kind === 'category' ? c.categoryId : '',
      amount: c.kind === 'cartTotalAtLeast' ? formatPriceInput(c.centAmount, locale) : '',
      stacking: rule.stacking,
      code: rule.code ?? '',
    };
  }
  const s = rule.scope;
  return {
    ...base,
    ...effect,
    scopeKind: s.kind,
    categoryId: s.kind === 'category' ? s.categoryId : '',
    categoryLabel: s.kind === 'category' ? s.label : '',
    skus: s.kind === 'skus' ? s.skus.join(', ') : '',
  };
}

const number = (text: string): number => {
  const n = Number(text.trim().replace(',', '.'));
  return Number.isFinite(n) && text.trim() !== '' ? n : 0;
};
const cents = (text: string): number => {
  const p = parsePriceInput(text);
  return p.kind === 'ok' ? p.centAmount : 0;
};
const isoStart = (d: string) => (d ? `${d}T00:00:00.000Z` : undefined);
const isoEnd = (d: string) => (d ? `${d}T23:59:59.000Z` : undefined);

export function ruleFromForm(form: DiscountForm, kind: DiscountKind): ProductRule | CartRule {
  const name: Record<string, string> = {};
  if (form.nameDe.trim()) name['de-DE'] = form.nameDe.trim();
  if (form.nameEn.trim()) name['en-US'] = form.nameEn.trim();
  const schedule = { ...(isoStart(form.validFrom) ? { validFrom: isoStart(form.validFrom) } : {}), ...(isoEnd(form.validUntil) ? { validUntil: isoEnd(form.validUntil) } : {}) };
  if (kind === 'product') {
    const effect = form.effectKind === 'absolute' ? ({ kind: 'absolute', centAmount: cents(form.value) } as const) : ({ kind: 'relative', percent: number(form.value) } as const);
    const skus = form.skus.split(/[\s,;]+/).filter(Boolean);
    const scope = form.scopeKind === 'category' ? ({ kind: 'category', categoryId: form.categoryId, label: form.categoryLabel || form.categoryId } as const) : form.scopeKind === 'skus' ? ({ kind: 'skus', skus } as const) : ({ kind: 'all' } as const);
    return { name, scope, effect, ...schedule };
  }
  const effect = form.effectKind === 'freeShipping' ? ({ kind: 'freeShipping' } as const) : form.effectKind === 'absolute' ? ({ kind: 'absolute', centAmount: cents(form.value) } as const) : ({ kind: 'relative', percent: number(form.value) } as const);
  const condition =
    form.conditionKind === 'cartTotalAtLeast' ? ({ kind: 'cartTotalAtLeast', centAmount: cents(form.amount) } as const) : form.conditionKind === 'category' ? ({ kind: 'category', categoryId: form.categoryId } as const) : ({ kind: 'always' } as const);
  return { name, condition, effect, stacking: form.stacking, ...(form.code.trim() ? { code: form.code.trim().toUpperCase() } : {}), ...schedule };
}

import { COLLECTION, asReconciler, type AttributeDefinitionDraft, type AttributeType, type ProductTypeDraft } from '../types';
import { deepEqual, field, getByKey, postUpdate, removeByKey, type UpdateAction, type UpdatePlan, type Versioned } from './util';

const COLL = COLLECTION.productType;

type ExistingType = Versioned & { name: string; description?: string; attributes: AttributeDefinitionDraft[] };

const DEFAULTS = { level: 'Variant', attributeConstraint: 'None', inputHint: 'SingleLine', isSearchable: true, savedToLineItem: false } as const;

/** Applies the platform defaults so a draft and a stored definition compare equal. */
export function normalizeAttribute(a: AttributeDefinitionDraft): Required<Omit<AttributeDefinitionDraft, 'inputTip'>> & { inputTip?: AttributeDefinitionDraft['inputTip'] } {
  return {
    ...a,
    level: a.level ?? DEFAULTS.level,
    attributeConstraint: a.attributeConstraint ?? DEFAULTS.attributeConstraint,
    inputHint: a.inputHint ?? DEFAULTS.inputHint,
    isSearchable: a.isSearchable ?? DEFAULTS.isSearchable,
    savedToLineItem: a.savedToLineItem ?? DEFAULTS.savedToLineItem,
  };
}

/** Attribute type without enum values (values are reconciled separately, additions only). */
function shape(type: AttributeType): unknown {
  if (type.name === 'enum' || type.name === 'lenum') return { name: type.name };
  if (type.name === 'set') return { name: 'set', elementType: shape(type.elementType) };
  if (type.name === 'nested') return { name: 'nested', typeReference: type.typeReference };
  return type;
}

function enumInfo(type: AttributeType): { values: { key: string; label: unknown }[]; localized: boolean } | undefined {
  if (type.name === 'enum') return { values: type.values, localized: false };
  if (type.name === 'lenum') return { values: type.values, localized: true };
  if (type.name === 'set') return enumInfo(type.elementType);
  return undefined;
}

export const warnings: string[] = [];

export function planProductType(existing: ExistingType, draft: ProductTypeDraft): UpdatePlan {
  const changes: UpdatePlan['changes'] = [];
  const actions: UpdateAction[] = [];
  const fieldActions: UpdateAction[] = [];
  if (field(changes, 'name', existing.name, draft.name)) actions.push({ action: 'changeName', name: draft.name });
  if (field(changes, 'description', existing.description, draft.description)) actions.push({ action: 'changeDescription', description: draft.description });

  const have = existing.attributes.map(normalizeAttribute);
  for (const raw of draft.attributes) {
    const wanted = normalizeAttribute(raw);
    const current = have.find((a) => a.name === wanted.name);
    if (!current) {
      changes.push({ path: `attributes.${wanted.name}`, from: undefined, to: 'added' });
      actions.push({ action: 'addAttributeDefinition', attribute: raw });
      continue;
    }
    const at = (p: string): string => `attributes.${wanted.name}.${p}`;
    if (!deepEqual(shape(current.type), shape(wanted.type))) {
      return { changes, actions, conflict: `attribute "${wanted.name}" changed type (existing attribute types cannot change)` };
    }
    if (current.level !== wanted.level) return { changes, actions, conflict: `attribute "${wanted.name}" changed level (${current.level} -> ${wanted.level})` };
    if (current.isRequired !== wanted.isRequired) return { changes, actions, conflict: `attribute "${wanted.name}" changed isRequired` };
    if (current.attributeConstraint !== wanted.attributeConstraint) {
      if (wanted.attributeConstraint !== 'None') {
        return { changes, actions, conflict: `attribute "${wanted.name}" changed attributeConstraint (${current.attributeConstraint} -> ${wanted.attributeConstraint}); only None is possible` };
      }
      changes.push({ path: at('attributeConstraint'), from: current.attributeConstraint, to: 'None' });
      fieldActions.push({ action: 'changeAttributeConstraint', attributeName: wanted.name, newValue: 'None' });
    }
    if (field(changes, at('label'), current.label, wanted.label)) fieldActions.push({ action: 'changeLabel', attributeName: wanted.name, label: wanted.label });
    if (wanted.inputTip && field(changes, at('inputTip'), current.inputTip, wanted.inputTip)) {
      fieldActions.push({ action: 'setInputTip', attributeName: wanted.name, inputTip: wanted.inputTip });
    }
    if (field(changes, at('inputHint'), current.inputHint, wanted.inputHint)) fieldActions.push({ action: 'changeInputHint', attributeName: wanted.name, newValue: wanted.inputHint });
    if (field(changes, at('isSearchable'), current.isSearchable, wanted.isSearchable)) fieldActions.push({ action: 'changeIsSearchable', attributeName: wanted.name, isSearchable: wanted.isSearchable });
    if (field(changes, at('savedToLineItem'), current.savedToLineItem, wanted.savedToLineItem)) {
      fieldActions.push({ action: 'changeSavedToLineItem', attributeName: wanted.name, savedToLineItem: wanted.savedToLineItem });
    }
    const wantedEnum = enumInfo(wanted.type);
    const haveEnum = enumInfo(current.type);
    if (wantedEnum && haveEnum) {
      for (const value of wantedEnum.values) {
        const found = haveEnum.values.find((v) => v.key === value.key);
        if (!found) {
          changes.push({ path: at(`values.${value.key}`), from: undefined, to: 'added' });
          fieldActions.push({ action: wantedEnum.localized ? 'addLocalizedEnumValue' : 'addPlainEnumValue', attributeName: wanted.name, value });
        } else if (!deepEqual(found.label, value.label)) {
          changes.push({ path: at(`values.${value.key}.label`), from: found.label, to: value.label });
          fieldActions.push({ action: wantedEnum.localized ? 'changeLocalizedEnumValueLabel' : 'changePlainEnumValueLabel', attributeName: wanted.name, newValue: value });
        }
      }
    }
  }

  const extras = have.filter((a) => !draft.attributes.some((d) => d.name === a.name)).map((a) => a.name);
  if (extras.length > 0) warnings.push(`extra attribute on product type "${draft.key}": ${extras.join(', ')} (not in the manifest, left untouched)`);
  const currentOrder = [...have.map((a) => a.name), ...draft.attributes.map((a) => a.name).filter((n) => !have.some((a) => a.name === n))];
  const wantedOrder = [...draft.attributes.map((a) => a.name), ...extras];
  if (!deepEqual(currentOrder, wantedOrder)) {
    changes.push({ path: 'attributes.order', from: currentOrder, to: wantedOrder });
    fieldActions.push({ action: 'changeAttributeOrderByName', attributeNames: wantedOrder });
  }
  return { changes, actions: [...actions, ...fieldActions] };
}

export const productTypeReconciler = asReconciler<ProductTypeDraft, ExistingType>({
  kind: 'productType',
  order: 50,
  refs: () => [],
  fetch: (api, key) => getByKey<ExistingType>(api, COLL, key),
  create: async (api, draft) => void (await api.post(COLL, draft)),
  diff: (existing, draft) => {
    const { changes, conflict } = planProductType(existing, draft);
    return { changes, ...(conflict ? { conflict } : {}) };
  },
  update: async (api, existing, _changes, draft) => postUpdate(api, COLL, existing, planProductType(existing, draft).actions),
  remove: (api, existing) => removeByKey(api, COLL, existing),
});

import { COLLECTION, asReconciler, type FieldDefinitionDraft, type FieldType, type TypeDraft } from '../types';
import { deepEqual, field, getByKey, postUpdate, removeByKey, type Obj, type UpdateAction, type UpdatePlan, type Versioned } from './util';

const COLL = COLLECTION.type;

type ExistingType = Versioned & {
  name: Record<string, string>;
  description?: Record<string, string>;
  resourceTypeIds: string[];
  fieldDefinitions: (FieldDefinitionDraft & Obj)[];
};

/** The type with enum values removed: enum values are reconciled separately (add only). */
function shape(type: FieldType): unknown {
  if (type.name === 'Enum' || type.name === 'LocalizedEnum') return { name: type.name };
  if (type.name === 'Set') return { name: 'Set', elementType: shape(type.elementType) };
  return type;
}

function enumValues(type: FieldType): { key: string; label: unknown }[] | undefined {
  if (type.name === 'Enum' || type.name === 'LocalizedEnum') return type.values;
  if (type.name === 'Set') return enumValues(type.elementType);
  return undefined;
}

export function planType(existing: ExistingType, draft: TypeDraft): UpdatePlan {
  const changes: UpdatePlan['changes'] = [];
  const actions: UpdateAction[] = [];
  if (field(changes, 'name', existing.name, draft.name)) actions.push({ action: 'changeName', name: draft.name });
  if (!sameSet(existing.resourceTypeIds, draft.resourceTypeIds)) {
    return { changes, actions, conflict: `resourceTypeIds changed (${existing.resourceTypeIds.join(',')} -> ${draft.resourceTypeIds.join(',')})` };
  }
  const draftNames = new Set(draft.fieldDefinitions.map((f) => f.name));
  for (const f of existing.fieldDefinitions) {
    if (!draftNames.has(f.name)) return { changes, actions, conflict: `field "${f.name}" is not in the manifest (fields cannot be removed)` };
  }
  for (const wanted of draft.fieldDefinitions) {
    const current = existing.fieldDefinitions.find((f) => f.name === wanted.name);
    if (!current) {
      changes.push({ path: `fieldDefinitions.${wanted.name}`, from: undefined, to: 'added' });
      actions.push({ action: 'addFieldDefinition', fieldDefinition: wanted });
      continue;
    }
    if (!deepEqual(shape(current.type), shape(wanted.type))) {
      return { changes, actions, conflict: `field "${wanted.name}" changed type` };
    }
    if (current.required !== wanted.required) return { changes, actions, conflict: `field "${wanted.name}" changed required` };
    if (field(changes, `fieldDefinitions.${wanted.name}.label`, current.label, wanted.label)) {
      actions.push({ action: 'changeLabel', fieldName: wanted.name, label: wanted.label });
    }
    const have = enumValues(current.type) ?? [];
    for (const value of enumValues(wanted.type) ?? []) {
      const found = have.find((v) => v.key === value.key);
      const localized = wanted.type.name === 'LocalizedEnum' || (wanted.type.name === 'Set' && wanted.type.elementType.name === 'LocalizedEnum');
      if (!found) {
        changes.push({ path: `fieldDefinitions.${wanted.name}.values.${value.key}`, from: undefined, to: 'added' });
        actions.push({ action: localized ? 'addLocalizedEnumValue' : 'addEnumValue', fieldName: wanted.name, value });
      } else if (!deepEqual(found.label, value.label)) {
        changes.push({ path: `fieldDefinitions.${wanted.name}.values.${value.key}.label`, from: found.label, to: value.label });
        actions.push({ action: localized ? 'changeLocalizedEnumValueLabel' : 'changeEnumValueLabel', fieldName: wanted.name, value });
      }
    }
  }
  // order: only when every existing field is kept (checked above) and the order differs
  const merged = [...existing.fieldDefinitions.map((f) => f.name), ...draft.fieldDefinitions.map((f) => f.name).filter((n) => !existing.fieldDefinitions.some((f) => f.name === n))];
  const wantedOrder = draft.fieldDefinitions.map((f) => f.name);
  if (!deepEqual(merged, wantedOrder)) {
    changes.push({ path: 'fieldDefinitions.order', from: merged, to: wantedOrder });
    actions.push({ action: 'changeFieldDefinitionOrder', fieldNames: wantedOrder });
  }
  return { changes, actions };
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export const typeReconciler = asReconciler<TypeDraft, ExistingType>({
  kind: 'type',
  order: 10,
  refs: () => [],
  fetch: (api, key) => getByKey<ExistingType>(api, COLL, key),
  create: async (api, draft) => void (await api.post(COLL, draft)),
  diff: (existing, draft) => {
    const { changes, conflict } = planType(existing, draft);
    return { changes, ...(conflict ? { conflict } : {}) };
  },
  update: async (api, existing, _changes, draft) => postUpdate(api, COLL, existing, planType(existing, draft).actions),
  remove: (api, existing) => removeByKey(api, COLL, existing),
});

'use client';

import { useCallback, useId, useState, type ChangeEvent } from 'react';

type Errors<F extends string> = Partial<Record<F, string>>;

/**
 * State of one auth form: field values, field errors, a form-level error, the pending flag and focus handling. Validation and the
 * request stay in the form component. `order` is the visual order of the fields (the first invalid one gets focus on submit).
 * Every input gets the id `idOf(name)` (pass it as `id` to the control and as `htmlFor` to its `Field`).
 */
export function useAuthForm<F extends string>(order: readonly F[]) {
  const prefix = useId();
  const [values, setValues] = useState<Record<F, string>>(() => Object.fromEntries(order.map((name) => [name, ''])) as Record<F, string>);
  const [errors, setErrors] = useState<Errors<F>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const idOf = useCallback((name: F) => `${prefix}-${name}`, [prefix]);

  const onChange = useCallback(
    (name: F) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [name]: value }));
      setErrors((current) => {
        if (!(name in current)) return current;
        const next = { ...current };
        delete next[name];
        return next;
      });
    },
    [],
  );

  /** Focus the first field (in visual order) that has an error. */
  const focusFirstError = useCallback(
    (next: Errors<F>) => {
      const first = order.find((name) => next[name]);
      if (first) document.getElementById(idOf(first))?.focus();
    },
    [order, idOf],
  );

  return { values, errors, setErrors, formError, setFormError, pending, setPending, onChange, idOf, focusFirstError };
}

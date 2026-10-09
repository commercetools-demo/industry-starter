import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

/** Label above the control, optional hint and error; the error is announced (role alert) and wired with aria-describedby / aria-invalid. */
export function Field({ label, hint, error, as = 'input', children, ...props }: { label: string; hint?: string; error?: string; as?: 'input' | 'textarea' | 'select'; children?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const hintId = `${id}-hint`; const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;
  const common = { id, className: error ? 'err' : undefined, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy };
  return (
    <div className="f" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={{ fontWeight: 500, fontSize: 14 }}>{label}{props.required ? <span aria-hidden="true"> *</span> : null}</label>
      {as === 'textarea' ? <textarea {...common} {...(props as object)} /> : as === 'select' ? <select {...common} {...(props as object)}>{children}</select> : <input {...common} {...props} />}
      {hint ? <span id={hintId} className="hint">{hint}</span> : null}
      {error ? <span id={errorId} role="alert" className="em">{error}</span> : null}
    </div>
  );
}

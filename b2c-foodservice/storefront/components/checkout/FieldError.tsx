import Icon from '@/components/ui/Icon';

/** Message under a field: icon plus text (never colour alone), announced when it appears, tied to the field by `id` / `aria-describedby`. */
export default function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} role="alert" className="m-0 mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-danger-text">
      <Icon name="x" size={14} />
      {children}
    </p>
  );
}

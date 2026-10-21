import Icon from './Icon';

/** The toast region: always mounted so screen readers announce changes; the pill appears with a message. */
export default function Toast({ message }: { message: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-120 -translate-x-1/2"
    >
      {message ? (
        <div className="fade-up flex items-center gap-2.5 rounded-pill bg-ink px-[22px] py-3.5 text-[13.5px] font-medium text-surface shadow-lg">
          <Icon name="check" size={18} className="text-teal" />
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  );
}

/** A polite live region; render it always and change its text so assistive technology announces the change. */
export function LiveRegion({ children, assertive }: { children?: React.ReactNode; assertive?: boolean }) {
  return <div role={assertive ? 'alert' : 'status'} aria-live={assertive ? 'assertive' : 'polite'} aria-atomic="true" className="sr-only">{children}</div>;
}

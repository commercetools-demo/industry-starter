import type { ComponentMap, PageBuilderComponent } from '@commercetools-labs/page-builder';

/**
 * The shim draws a visible "Unknown block type" box for a type that has no component. A shopper must never see that (spec:
 * unknown types are skipped and logged), so the map answers every unknown type with a component that renders nothing.
 * The log is once per type per process, so a published page cannot flood the server log.
 */
export function withSoftFail(map: ComponentMap, log: (message: string) => void = defaultLog): ComponentMap {
  const reported = new Set<string>();
  const skipped = new Map<string, PageBuilderComponent>();
  return new Proxy(map, {
    get(target, prop, receiver) {
      if (typeof prop !== 'string') return Reflect.get(target, prop, receiver);
      const known = Object.prototype.hasOwnProperty.call(target, prop) ? target[prop] : undefined;
      if (known) return known;
      let skip = skipped.get(prop);
      if (!skip) {
        skip = () => {
          if (!reported.has(prop)) {
            reported.add(prop);
            log(`[page-builder] no component for type "${prop}"; skipped`);
          }
          return null;
        };
        skipped.set(prop, skip);
      }
      return skip;
    },
  });
}

function defaultLog(message: string): void {
  console.error(message);
}

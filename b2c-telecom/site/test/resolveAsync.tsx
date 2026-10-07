import { Children, cloneElement, isValidElement, Suspense, type ReactElement, type ReactNode } from 'react';

// Testing Library renders on the client, which cannot render async Server Components. This walks a React tree, calls every async
// function component (the ones inside <Suspense> included), awaits it and substitutes the result; sync components stay untouched so
// they render normally with their hooks. Elements passed as props (slots such as `bill={...}`) are resolved too.

const isAsyncComponent = (type: unknown): type is (props: unknown) => Promise<ReactNode> => typeof type === 'function' && type.constructor.name === 'AsyncFunction';

export async function resolveAsync(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map((child) => resolveAsync(child)));
  if (!isValidElement(node)) return node;
  const { type } = node;
  const props = node.props as Record<string, unknown>;
  if (isAsyncComponent(type)) return resolveAsync(await type(props));
  if (type === Suspense) return resolveAsync(props.children as ReactNode);

  const next: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(props)) {
    if (name === 'children') {
      const resolved = await Promise.all(Children.toArray(value as ReactNode).map((child) => resolveAsync(child)));
      next.children = resolved;
    } else if (isValidElement(value) || (Array.isArray(value) && value.some(isValidElement))) {
      next[name] = await resolveAsync(value as ReactNode);
    }
  }
  return Object.keys(next).length > 0 ? cloneElement(node, next) : node;
}

/** `resolveAsync` for a tree whose root is an element (what `renderWithProviders` takes). */
export async function resolveElement(node: ReactNode): Promise<ReactElement> {
  return (await resolveAsync(node)) as ReactElement;
}

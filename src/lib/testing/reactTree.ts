import { isValidElement, type ReactNode } from "react";

/*
 * Finding one element inside what a component returned, without a DOM.
 *
 * `renderToStaticMarkup` is how almost everything here is checked, and it
 * answers one question it cannot: whether a handler is wired to what the markup
 * implies. Static markup carries no `onClick`, so a button wired to nothing
 * renders exactly like a button wired to the right thing.
 *
 * A component with no hooks is a plain function of its arguments, so calling it
 * yields the element tree itself and the props are right there. That is the only
 * reason the error screen is separate from the boundary that renders it — and it
 * is worth saying that this is a test helper for a gap, not a second way to
 * assert what a page says. What a reader sees is still checked against markup.
 */

/** The props of an element, as far as anything here is concerned. */
type ElementProps = { readonly children?: ReactNode } & Record<string, unknown>;

/**
 * The first element of `tag` in tree order, or `null`.
 *
 * Walks `children` only. Props that happen to hold elements — a `controls` or an
 * `icon` — are not searched, because an element passed as data belongs to
 * whoever renders it and finding it here would report a handler that this tree
 * never attaches to anything.
 */
export const findElement = (node: ReactNode, tag: string): ElementProps | null => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, tag);
      if (found !== null) return found;
    }
    return null;
  }

  if (!isValidElement(node)) return null;

  const props = node.props as ElementProps;
  if (node.type === tag) return props;

  return findElement(props.children ?? null, tag);
};

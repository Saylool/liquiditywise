import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n/requestLocale", async () => {
  const { getDictionary } = await import("@/lib/i18n/dictionaries");
  return {
    getRequestDictionary: async () => ({ locale: state.locale, t: getDictionary(state.locale as "en") }),
    getOpenPageAlternates: async (path: string) => ({ canonical: path, languages: {} }),
  };
});
vi.mock("@/components/WorkspaceShell", () => ({ WorkspaceShell: () => null }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not-found");
  },
}));

const state = vi.hoisted(() => ({ locale: "en" as string }));

import LearnTopicPage from "./page";

/** Every element in a returned tree that carries the props given, however deep. */
const find = (node: ReactNode, prop: string): ReactElement<Record<string, unknown>>[] => {
  if (Array.isArray(node)) return node.flatMap((child) => find(child, prop));
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [...(prop in node.props ? [node] : []), ...find(node.props.children as ReactNode, prop)];
};

const onward = async (topic: string, locale = "en") => {
  state.locale = locale;
  const tree = await LearnTopicPage({ params: Promise.resolve({ topic }) });
  return find(tree, "onward")[0]?.props.onward;
};

describe("where a guide topic leads on", () => {
  it("takes the smart-money topic to the smart-money page, in the reader's language", async () => {
    expect(await onward("smart-money")).toEqual({ href: "/en/smart-money", label: "Where smart liquidity sits" });
    expect(await onward("smart-money", "tr")).toEqual({ href: "/tr/smart-money", label: "Akıllı likidite nerede" });
  });

  it("keeps the other topics going where they went", async () => {
    expect(await onward("hooks")).toMatchObject({ href: "/en/hooks" });
    expect(await onward("width")).toMatchObject({ href: "/pool" });
  });

  it("lists the six other topics, and refuses a topic that is not one", async () => {
    state.locale = "en";
    const tree = await LearnTopicPage({ params: Promise.resolve({ topic: "smart-money" }) });
    const others = find(tree, "others")[0]?.props.others as { href: string }[];

    expect(others).toHaveLength(6);
    expect(others.map(({ href }) => href)).not.toContain("/learn/smart-money");
    await expect(LearnTopicPage({ params: Promise.resolve({ topic: "nope" }) })).rejects.toThrow("not-found");
  });
});

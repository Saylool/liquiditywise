import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BRIEF_IDS, getLearnCopy } from "../lib/learn/briefs";
import { QuickGuide } from "./QuickGuide";

const render = () =>
  renderToStaticMarkup(
    <QuickGuide
      copy={getLearnCopy("tr")}
      pools={{ href: "/pool", label: "Havuzları keşfet" }}
      hooks={{ href: "/tr/hooks", label: "Tüm hook'ları gör" }}
    />,
  );

describe("the quick guide page", () => {
  it("gives every brief a heading and an anchor of its own, in order", () => {
    const markup = render();
    const ids = [...markup.matchAll(/<article id="([^"]+)"/g)].map(([, id]) => id);

    expect(ids).toEqual([...BRIEF_IDS]);
    expect(markup.match(/<h2/g)).toHaveLength(BRIEF_IDS.length);
    expect(markup.match(/<li>/g)).toHaveLength(BRIEF_IDS.length * 3);
  });

  it("opens with the language's own introduction", () => {
    expect(render()).toContain(getLearnCopy("tr").intro.replace(/'/g, "&#x27;"));
  });

  it("leads on to a real pool and to the hook directory at the language's address", () => {
    const markup = render();

    expect(markup).toContain('href="/pool"');
    expect(markup).toContain('href="/tr/hooks"');
  });
});

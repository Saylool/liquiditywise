import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getLearnCopy } from "../lib/learn/briefs";
import { getTopicCopy } from "../lib/learn/topics";
import { LearnTopic } from "./LearnTopic";

const brief = getLearnCopy("tr").briefs.find(({ id }) => id === "divergence")!;
const render = () =>
  renderToStaticMarkup(
    <LearnTopic
      brief={brief}
      more={getTopicCopy("tr").more.divergence}
      others={[{ href: "/tr/learn/width", title: "Dar mı, geniş mi" }]}
      otherTopics="Diğer konular"
      onward={{ href: "/pool", label: "Havuzları keşfet" }}
    />,
  );

describe("a topic's page", () => {
  it("says the guide's three sentences and three more, in order", () => {
    const markup = render();
    const sentences = [...brief.points, ...getTopicCopy("tr").more.divergence];
    const at = sentences.map((sentence) => markup.indexOf(sentence));

    expect(at.every((index) => index >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("leads on to where it shows on real data, and to the other topics", () => {
    const markup = render();

    expect(markup).toContain('href="/pool"');
    expect(markup).toContain("Havuzları keşfet");
    expect(markup).toContain('aria-label="Diğer konular"');
    expect(markup).toContain('href="/tr/learn/width"');
  });
});

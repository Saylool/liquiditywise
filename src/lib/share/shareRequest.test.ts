import { describe, expect, it } from "vitest";

import { CHAINS, ETHEREUM } from "../chains/chains";
import { readShareRequest, SHARE_PARAMETERS } from "./shareRequest";

const query = (entries: Record<string, string | readonly string[]>): URLSearchParams => {
  const parameters = new URLSearchParams();
  for (const [name, value] of Object.entries(entries)) {
    for (const one of typeof value === "string" ? [value] : value) parameters.append(name, one);
  }
  return parameters;
};

describe("what a share card is asked for", () => {
  it("names a v3 position by its token id, on mainnet when the address names no chain", () => {
    expect(readShareRequest(query({ id: "998651" }))).toEqual({ chain: ETHEREUM, chainId: 1, tokenId: "998651" });
  });

  it("names it on the chain the address names", () => {
    const asked = readShareRequest(query({ chain: "base", id: "12345" }));

    expect(asked?.chain.slug).toBe("base");
    expect(asked?.chainId).toBe(8453);
    expect(asked?.tokenId).toBe("12345");
  });

  /* A chain whose positions are not kept verifies no record, so no card is drawn there. */
  it("is refused on every chain whose positions this site keeps no history of, and read on every other", () => {
    for (const chain of CHAINS) {
      expect(readShareRequest(query({ chain: chain.slug, id: "1" })) !== null, chain.slug).toBe(chain.v3Positions);
    }
  });

  it.each([
    ["no id", {}],
    ["a hex id", { id: "0x12" }],
    ["a negative id", { id: "-1" }],
    ["an id with a leading zero", { id: "007" }],
    ["a decimal fraction", { id: "1.5" }],
    ["an empty id", { id: "" }],
    ["an id given twice", { id: ["1", "2"] }],
    ["a chain given twice", { chain: ["base", "base"], id: "1" }],
    ["a chain the site does not read", { chain: "solana", id: "1" }],
    ["a pool address where an id should be", { address: `0x${"a".repeat(40)}` }],
  ])("refuses %s", (_label, entries) => {
    expect(readShareRequest(query(entries))).toBeNull();
  });

  it("reads exactly the parameters the developers page lists, and nothing else", () => {
    const asked = new Set<string>();
    const watched = new Proxy(query({ chain: "base", id: "1", lang: "tr" }), {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property !== "getAll" && property !== "get") return typeof value === "function" ? value.bind(target) : value;
        return (name: string) => {
          asked.add(name);
          return (target[property] as (name: string) => unknown)(name);
        };
      },
    });
    readShareRequest(watched);

    /* The language is read beside it by the embed card's own reader, under `lang`. */
    expect([...asked, "lang"].sort()).toEqual([...SHARE_PARAMETERS].sort());
  });
});

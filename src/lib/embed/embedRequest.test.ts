import { describe, expect, it } from "vitest";

import { readEmbedLocale, readEmbedRequest } from "./embedRequest";

const ADDRESS = `0x${"ab".repeat(20)}`;
const ID = `0x${"cd".repeat(32)}`;
const read = (query: string) => readEmbedRequest(new URLSearchParams(query));

describe("what a card's address asks for", () => {
  it("names a v3 pool by its address and a v4 pool by its id, on mainnet when it names no chain", () => {
    expect(read(`address=${ADDRESS}`)).toMatchObject({ protocol: "v3", chain: { slug: "ethereum" }, poolId: ADDRESS });
    expect(read(`chain=unichain&id=${ID}`)).toMatchObject({ protocol: "v4", chain: { id: 130 }, poolId: ID });
    expect(read(`chain=base&address=${ADDRESS}`)).toMatchObject({ protocol: "v3", chain: { id: 8453 } });
  });

  it("names every pool in lower case, whatever case it arrived in", () => {
    expect(read(`address=${ADDRESS.toUpperCase().replace("0X", "0x")}`)?.poolId).toBe(ADDRESS);
    expect(read(`id=${ID.toUpperCase().replace("0X", "0x")}`)?.poolId).toBe(ID);
  });

  it("refuses a missing, malformed or mismatched pool name", () => {
    expect(read("")).toBeNull();
    expect(read("chain=base")).toBeNull();
    expect(read("address=0x1234")).toBeNull();
    expect(read(`address=${ADDRESS}zz`)).toBeNull();
    expect(read(`address=${ID}`)).toBeNull();
    expect(read(`id=${ADDRESS}`)).toBeNull();
    expect(read(`address=<script>`)).toBeNull();
  });

  it("refuses two pools at once, and a parameter given twice", () => {
    expect(read(`address=${ADDRESS}&id=${ID}`)).toBeNull();
    expect(read(`address=${ADDRESS}&address=${ADDRESS}`)).toBeNull();
    expect(read(`id=${ID}&id=${ID}`)).toBeNull();
    expect(read(`chain=base&chain=base&address=${ADDRESS}`)).toBeNull();
  });

  /* The same address on the wrong chain is a different pool or none: never read as mainnet. */
  it("refuses a chain it does not read, and a protocol the chain is not read for", () => {
    expect(read(`chain=solana&address=${ADDRESS}`)).toBeNull();
    expect(read(`chain=&address=${ADDRESS}`)).toBeNull();
    expect(read(`chain=unichain&address=${ADDRESS}`)).toBeNull();
  });
});

describe("the language a card speaks", () => {
  it("is the one its address names, when the site is published in it", () => {
    expect(readEmbedLocale(new URLSearchParams("lang=tr"))).toBe("tr");
    expect(readEmbedLocale(new URLSearchParams("lang=zh-Hant"))).toBe("zh-Hant");
  });

  it("is English otherwise: none named, one not published, or two", () => {
    expect(readEmbedLocale(new URLSearchParams(""))).toBe("en");
    expect(readEmbedLocale(new URLSearchParams("lang=fr"))).toBe("en");
    expect(readEmbedLocale(new URLSearchParams("lang=TR"))).toBe("en");
    expect(readEmbedLocale(new URLSearchParams("lang=tr&lang=de"))).toBe("en");
  });
});

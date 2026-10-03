import { describe, expect, it } from "vitest";

import { fetchNativeUsdPrice, NATIVE_USD_PRICE_QUERY, readNativeUsdPrice } from "./nativeUsdPrice";

const answer = (ethPriceUSD: string | null, meta: { hasIndexingErrors: boolean } | null = { hasIndexingErrors: false }) => ({
  data: { bundles: ethPriceUSD === null ? [] : [{ ethPriceUSD }], _meta: meta },
});

describe("the chain currency's dollar price", () => {
  it("is read from the subgraph's bundle", () => {
    expect(readNativeUsdPrice(answer("4012.5"))).toEqual({ status: "success", data: 4012.5 });
  });

  it("is no price when missing, zero, malformed, sent with errors or flagged by the indexer", () => {
    for (const payload of [
      answer(null),
      answer("0"),
      answer("-1"),
      answer("four thousand"),
      { data: null, errors: [{ message: "bad indexers" }] },
      { nonsense: true },
    ]) {
      expect(readNativeUsdPrice(payload), JSON.stringify(payload)).toMatchObject({ status: "unavailable", notice: "market-data-malformed" });
    }
    expect(readNativeUsdPrice(answer("4000", { hasIndexingErrors: true }))).toMatchObject({
      status: "unavailable",
      notice: "market-data-indexing-errors",
    });
  });

  it("asks nothing without a key or a subgraph", async () => {
    let asked = 0;
    const fetchImpl = async () => {
      asked += 1;
      return new Response("{}");
    };

    for (const [apiKey, subgraphId] of [[undefined, "s"], ["k", undefined], [" ", "s"]] as const) {
      expect(await fetchNativeUsdPrice({ apiKey, subgraphId, fetchImpl })).toMatchObject({
        status: "unavailable",
        notice: "market-data-not-configured",
      });
    }
    expect(asked).toBe(0);
  });

  it("sends the one query, with the key in a header and never in the address", async () => {
    const sent: { url: string; init: RequestInit }[] = [];
    const result = await fetchNativeUsdPrice({
      apiKey: "secret-key",
      subgraphId: "subgraph-id",
      fetchImpl: async (url, init) => {
        sent.push({ url, init });
        return new Response(JSON.stringify(answer("3999")), { status: 200 });
      },
    });

    expect(result).toEqual({ status: "success", data: 3999 });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).not.toContain("secret-key");
    expect(JSON.parse(String(sent[0]?.init.body))).toEqual({ query: NATIVE_USD_PRICE_QUERY, variables: {} });
  });
});

import { z } from "zod";

import type { DataResult } from "../../schemas";
import { convertNonNegativeDecimal } from "./v3SubgraphRawResponse";
import { DEFAULT_SUBGRAPH_TIMEOUT_MS, type FetchLike, postV3SubgraphQuery } from "./v3SubgraphTransport";

/*
 * What one of the chain's own currency is worth in dollars, as the subgraph
 * derives it.
 *
 * The one figure that turns a list's ether values into dollars. Every list
 * here values a pool in the chain's own currency — what its token contracts
 * hold, or its depth at the current price, each priced by the token's
 * `derivedETH` — and that is enough to order pools of one chain. Pools of six
 * chains set beside each other, and beside fees the source reports in dollars,
 * need the last step too.
 *
 * `ethPriceUSD` is the subgraph's own name and its own figure: on Polygon,
 * where every `derivedETH` is a price in POL, it is POL's price, which is what
 * makes the product a dollar figure there too. It comes out of a stablecoin
 * pool's price, which is chain state — the same reason `derivedETH` is
 * trusted where the source's balances are not — and the smart-money read
 * already asks for it beside each pool it measures.
 */

export const NATIVE_USD_PRICE_QUERY = `query NativeUsdPrice {
  bundles(first: 1) {
    ethPriceUSD
  }
  _meta {
    hasIndexingErrors
  }
}`;

export const NativeUsdPriceResponseSchema = z.object({
  data: z
    .object({
      bundles: z.array(z.object({ ethPriceUSD: z.string() })),
      _meta: z.object({ hasIndexingErrors: z.boolean() }).nullable(),
    })
    .nullish(),
  /** Read only for presence; provider error text is never inspected or forwarded. */
  errors: z.array(z.unknown()).nullish(),
});

const MALFORMED = "market-data-malformed";

/**
 * The price out of one answer, or why there is none.
 *
 * Zero is refused rather than kept: a currency worth nothing would value every
 * pool at nothing, and a pool valued at nothing is one the page could not rank
 * — which is true of a price that was never written, and false of the chain.
 */
export const readNativeUsdPrice = (payload: unknown): DataResult<number> => {
  const parsed = NativeUsdPriceResponseSchema.safeParse(payload);
  if (!parsed.success) return { status: "unavailable", reason: "invalid-response", notice: MALFORMED };
  const { data, errors } = parsed.data;
  if ((errors != null && errors.length > 0) || data == null) {
    return { status: "unavailable", reason: "invalid-response", notice: MALFORMED };
  }
  if (data._meta?.hasIndexingErrors === true) {
    return { status: "unavailable", reason: "invalid-response", notice: "market-data-indexing-errors" };
  }

  const bundle = data.bundles[0];
  const price = bundle === undefined ? null : convertNonNegativeDecimal(bundle.ethPriceUSD, { allowZero: false });
  if (price === null || !price.ok) return { status: "unavailable", reason: "invalid-response", notice: MALFORMED };

  return { status: "success", data: price.value };
};

export type NativeUsdPriceRequest = {
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

/** Asks one subgraph for its native currency's dollar price. */
export const fetchNativeUsdPrice = async (request: NativeUsdPriceRequest): Promise<DataResult<number>> => {
  const apiKey = request.apiKey?.trim();
  const subgraphId = request.subgraphId?.trim();
  if (apiKey === undefined || apiKey === "" || subgraphId === undefined || subgraphId === "") {
    return { status: "unavailable", reason: "configuration-error", notice: "market-data-not-configured" };
  }

  const transport = await postV3SubgraphQuery({
    apiKey,
    subgraphId,
    query: NATIVE_USD_PRICE_QUERY,
    variables: {},
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? DEFAULT_SUBGRAPH_TIMEOUT_MS,
  });
  if (!transport.ok) return { status: "unavailable", reason: transport.reason, notice: transport.notice };

  return readNativeUsdPrice(transport.payload);
};

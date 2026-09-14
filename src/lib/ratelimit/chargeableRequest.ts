import { EvmAddressSchema } from "../../schemas/primitives";
import { readPoolSearchInput } from "../search/poolSearchInput";

/*
 * Which requests are charged against a visitor's allowance.
 *
 * Apart from the proxy that applies it, because this is the rule and that is the
 * plumbing: the proxy imports `next/server` and answers with headers, while what
 * counts as a request worth counting is a decision with no framework in it, and
 * one worth being able to test on its own.
 *
 * Imports reach past the schema barrel on purpose. The barrel pulls in every
 * domain contract, and this runs on every matched request.
 */

/**
 * True when a request will actually reach the subgraphs.
 *
 * Only those are counted. A missing or malformed address, and a search term the
 * page refuses, are answered without a single upstream call — charging them
 * would mean a typo costs someone an analysis.
 *
 * A search *is* counted. It spends a query like an analysis does, and it is the
 * cheaper of the two to send in a loop: a box that takes ordinary words is a
 * larger invitation to do that than one that took a 40-character address.
 *
 * An address typed into the search box is not counted here. It is answered with
 * a redirect to the canonical `?address=` form, and that request is counted when
 * it arrives — counting both would charge one visitor twice for one analysis.
 */
export const spendsUpstreamQuota = (parameters: URLSearchParams): boolean => {
  const address = parameters.get("address");
  if (address !== null) return EvmAddressSchema.safeParse(address).success;

  const query = parameters.get("q");
  if (query === null) return false;

  return readPoolSearchInput(query).kind === "terms";
};

import { Bytes32HexSchema, EvmAddressSchema } from "../../schemas/primitives";
import { readEmbedRequest } from "../embed/embedRequest";
import { readPoolCardRequest } from "../og/poolCardRequest";
import { readPoolSearchInput } from "../search/poolSearchInput";
import { readShareRequest } from "../share/shareRequest";
import { CARD_PAGES, EMBED_PAGES, SHARE_PAGES } from "../site/indexing";

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

/*
 * What each page reads, judged by the parameter that page reads.
 *
 * Only a request that will reach the subgraphs or a chain is counted. A
 * missing or malformed pool, and a search term the page refuses, are answered
 * without a single upstream call — charging them would mean a typo costs
 * someone an analysis.
 *
 * Per page, because the pages do not read the same parameters. This was once
 * one rule for every page that returned on the first parameter it found:
 * `address`, then `id`, then `q`. The v4 page reads only `id` and the pair page
 * only `q`, so a malformed `address` added beside a good one decided the
 * request — uncharged — while the page went on to read the good one. Whatever
 * else arrives beside it, a page is now judged by what it will read.
 *
 * Each rule is the page's own reading or wider than it, never narrower: a page
 * that would refuse a request may still be charged for it, but a page that
 * reads must be charged. So a repeated parameter, which the pages refuse, is
 * charged when any of its values would have been read, and the chain is not
 * checked at all — the pages refuse an unread chain before reading, and the
 * charge for that is the cheaper mistake.
 *
 *   - The pool page reads an `address` when one arrives, and only then; it
 *     searches its `q` only when no `address` came at all. So a broken address
 *     beside a good search charges nothing: the page shows the address refused
 *     and never runs the search.
 *   - A search *is* counted. It spends a query like an analysis does, and a box
 *     that takes ordinary words is a larger invitation to send in a loop than one
 *     that took a 40-character address. An address or a v4 id typed into the box
 *     is not: it is answered with a redirect to its own page, and that request is
 *     counted when it arrives — counting both would charge one visitor twice.
 *   - The holdings sweep and the comparison read an `address`, the v4 page an
 *     `id` (a 32-byte PoolId), and the pair page its `q` like a search, on every
 *     network at once.
 *   - The embeddable card and its JSON, the share card and the pool card each
 *     have a reader of their own, stricter than the pages (embed/embedRequest.ts,
 *     share/shareRequest.ts, og/poolCardRequest.ts), and are judged by the very
 *     reader the route uses — so a request the route refuses before reading is
 *     never charged, and one it reads always is. The share card's `id` is a
 *     position's decimal token id, not a pool's; that is why no rule here is
 *     shared between pages by parameter name.
 */
type Rule = (parameters: URLSearchParams) => boolean;

/** Whether any value a parameter arrived with passes. Wider than a page, which reads only a single one. */
const anyOf = (parameters: URLSearchParams, name: string, passes: (value: string) => boolean): boolean =>
  parameters.getAll(name).some(passes);

const isAddress = (value: string): boolean => EvmAddressSchema.safeParse(value).success;
const isPoolId = (value: string): boolean => Bytes32HexSchema.safeParse(value).success;
const isSearch = (value: string): boolean => readPoolSearchInput(value).kind === "terms";

const analysedByAddress: Rule = (parameters) => anyOf(parameters, "address", isAddress);

const RULES: ReadonlyMap<string, Rule> = new Map<string, Rule>([
  ["/pool", (parameters) => (parameters.has("address") ? analysedByAddress(parameters) : anyOf(parameters, "q", isSearch))],
  ["/v4", (parameters) => anyOf(parameters, "id", isPoolId)],
  ["/compare", analysedByAddress],
  ["/holdings", analysedByAddress],
  ["/pair", (parameters) => anyOf(parameters, "q", isSearch)],
  ...EMBED_PAGES.map((page): [string, Rule] => [page, (parameters) => readEmbedRequest(parameters) !== null]),
  ...SHARE_PAGES.map((page): [string, Rule] => [page, (parameters) => readShareRequest(parameters) !== null]),
  ...CARD_PAGES.map((page): [string, Rule] => [page, (parameters) => readPoolCardRequest(parameters) !== null]),
]);

/*
 * A page with no rule of its own — the front page, the directories — reads no
 * pool from its address. It is charged anyway when any parameter a pool page
 * reads would have been read there: every one is tried, and any that passes is
 * enough. Wider than needed on purpose. A page added later that reads a pool
 * before it is given a rule here is charged from its first day, rather than
 * free until somebody notices.
 */
const anyPoolRead: Rule = (parameters) =>
  analysedByAddress(parameters) || anyOf(parameters, "id", isPoolId) || anyOf(parameters, "q", isSearch);

/** True when a request to `page` will actually reach a source upstream. */
export const spendsUpstreamQuota = (parameters: URLSearchParams, page?: string): boolean => {
  const rule = page === undefined ? undefined : RULES.get(page);
  return (rule ?? anyPoolRead)(parameters);
};

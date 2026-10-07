/*
 * The week's use of the site, in one message for the operator.
 *
 * Built from the lines in usageLines.ts and nothing else: counts of pages,
 * pools, languages and explanations, never who. English, like every other
 * message Server Watch sends — see problems.ts for why the operator's
 * messages are.
 *
 * Pure, with the prices handed in: deploy/usage-report.mts runs it under plain
 * Node, and a test can hold every line of the message to what went in.
 */

import type { ModelPrice } from "../ai/modelPrices";
import type { Page, UsageLine } from "./usageLines";

export type WeekInput = {
  readonly lines: readonly UsageLine[];
  /** The first and last day the lines cover, as YYYY-MM-DD. */
  readonly from: string;
  readonly to: string;
  /** Chats following an address right now, or `null` when the store could not be asked. */
  readonly telegramLinks: number | null;
  readonly priceOf: (model: string) => ModelPrice | null;
};

const PAGE_NAMES: Readonly<Record<Page, string>> = {
  "/": "home",
  "/pool": "v3 pool",
  "/v4": "v4 pool",
  "/compare": "tiers side by side",
  "/pair": "one pair, every network",
  "/holdings": "holdings",
  "/hooks": "hooks",
  "/learn": "quick guide",
  "/most-traded": "most traded",
  "/smart-money": "smart liquidity",
  "/weekly": "weekly digest",
  "/about": "about",
  "/method": "how it works",
  "/developers": "for developers",
  "/learn/concentrated": "guide: ranges",
  "/learn/in-range": "guide: in and out of range",
  "/learn/divergence": "guide: impermanent loss",
  "/learn/width": "guide: narrow or wide",
  "/learn/fee-tiers": "guide: fee tiers",
  "/learn/hooks": "guide: hooks",
  "/learn/smart-money": "guide: smart liquidity",
  "/embed/pool": "pool card on another site",
  "/api/embed/pool": "pool card as JSON",
  "/api/share/position": "position card shared",
};

const number = (value: number): string => value.toLocaleString("en-US");

/**
 * Dollars to the cent once there are any, and to a hundredth of a cent before
 * that: one explanation costs about $0.001, and "$0.00" would read as free.
 */
const dollars = (value: number): string => `$${value >= 1 ? value.toFixed(2) : value.toFixed(4)}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Spelled out here rather than by the runtime's locale data, which says "Sep" on one machine and "Sept" on another. */
const day = (iso: string, withWeekday = false): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  const text = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  return withWeekday ? `${WEEKDAYS[date.getUTCDay()]} ${text}` : text;
};

/** Most first, ties by name so the same week always reads the same. */
const ranked = (counts: ReadonlyMap<string, number>): [string, number][] =>
  [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));

const tally = (keys: readonly string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
};

const shortId = (pool: string): string => {
  const id = pool.split(":")[1] ?? "";
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
};

const protocolOf = (pool: string): string => pool.split(":")[0] ?? "";

/** The limit a reader has in a minute (poolAnalysisRateLimiter.ts); fewer refusals than that in one are not a burst. */
const BURST_MINIMUM = 10;

/**
 * Whether the week's refusals were one burst: most of them inside a single
 * minute, which is a client going faster than any reader, not readers being
 * turned away. The first week's 227 were all one minute's.
 */
const burst = (refused: readonly { readonly minute: string | null }[], total: number): string => {
  const [busiest] = ranked(tally(refused.flatMap(({ minute }) => (minute === null ? [] : [minute]))));
  if (busiest === undefined || busiest[1] < BURST_MINIMUM || busiest[1] * 2 <= total) return "";
  const [date, time] = busiest[0].split("T");

  return ` — ${busiest[1] === total ? "all" : number(busiest[1])} of them within one minute (${day(date ?? "", true)}, ${time} UTC), a burst rather than readers`;
};

export const weeklyReport = (input: WeekInput): string => {
  const visits = input.lines.flatMap((line) =>
    line.kind === "visit" ? [{ ...line.visit, at: line.at, minute: line.minute ?? null }] : [],
  );
  const spends = input.lines.flatMap((line) => (line.kind === "spend" ? [line.spend] : []));
  const rejected = input.lines.filter((line) => line.kind === "rejected").length;

  const people = visits.filter((visit) => !visit.bot);
  const refusedVisits = people.filter((visit) => visit.outcome === "refused");
  const refused = refusedVisits.length;
  const bots = visits.length - people.length;
  /*
   * A minute in which the rate limit turned a reader's whole allowance away
   * is a client going faster than any reader, whatever its user agent says;
   * the pages it was served in that minute are its too, and counted apart
   * rather than as people's — the first week's burst came with 32 of them.
   */
  const burstMinutes = new Set(
    ranked(tally(refusedVisits.flatMap(({ minute }) => (minute === null ? [] : [minute]))))
      .filter(([, n]) => n >= BURST_MINIMUM)
      .map(([minute]) => minute),
  );
  /* A visit with no minute is in no burst: no burst minute is the empty string. */
  const inBurst = (visit: { readonly minute: string | null }) => burstMinutes.has(visit.minute ?? "");
  const servedAll = people.filter((visit) => visit.outcome === "served");
  const served = servedAll.filter((visit) => !inBurst(visit));
  const burstServed = servedAll.length - served.length;

  const out: string[] = [`📊 LiquidityWise · the week of ${day(input.from)} – ${day(input.to)}`];

  if (visits.length === 0) {
    out.push("No page was opened this week, by people or by bots.");
  } else {
    const aside = [
      ...(bots > 0 ? [`${number(bots)} by bots`] : []),
      ...(burstServed > 0 ? [`${number(burstServed)} in a burst the rate limit cut short`] : []),
    ];
    out.push(`Pages opened by people: ${number(served.length)}${aside.length > 0 ? ` (and ${aside.join(", and ")})` : ""}`);
    const byPage = ranked(tally(served.map((visit) => PAGE_NAMES[visit.page])));
    if (byPage.length > 0) out.push(`  ${byPage.map(([name, n]) => `${name} ${number(n)}`).join(" · ")}`);
    if (refused > 0) out.push(`Turned away by the rate limit: ${number(refused)}${burst(refusedVisits, refused)}`);
  }

  // Pair names are known for every pool an explanation was written for.
  const pairs = new Map(spends.map((spend) => [spend.pool, spend.pair] as const));
  const pools = ranked(
    tally(served.flatMap((visit) => (visit.pool !== null && visit.pool !== "search" ? [visit.pool] : []))),
  );
  if (pools.length > 0) {
    const shown = pools.slice(0, 5);
    /*
     * One pair is often several pools — a fee tier each, and v3 beside v4 —
     * and two lines both reading "USDC/WETH (v3)" would say nothing. Where a
     * name repeats, the pool's own address tells them apart.
     */
    const repeated = tally(shown.flatMap(([pool]) => {
      const pair = pairs.get(pool);
      return pair === undefined ? [] : [`${pair}|${protocolOf(pool)}`];
    }));
    const named = shown
      .map(([pool, n]) => {
        const pair = pairs.get(pool);
        const label =
          pair === undefined
            ? `${shortId(pool)} (${protocolOf(pool)})`
            : (repeated.get(`${pair}|${protocolOf(pool)}`) ?? 0) > 1
              ? `${pair} (${protocolOf(pool)}, ${shortId(pool)})`
              : `${pair} (${protocolOf(pool)})`;
        return `${label} ${number(n)}`;
      })
      .join(", ");
    out.push(`Pools opened: ${number(pools.length)} different. Most: ${named}`);
  }
  /*
   * Which chain the pages that read one were opened on. Lines written before
   * the chain was kept carry none and are left out rather than counted as
   * mainnet, so the first weeks undercount and never misattribute.
   */
  const chains = ranked(tally(served.flatMap((visit) => (visit.chain == null ? [] : [visit.chain]))));
  if (chains.length > 0) out.push(`Chains: ${chains.map(([chain, n]) => `${chain} ${number(n)}`).join(" · ")}`);

  const searches = served.filter((visit) => visit.pool === "search").length;
  if (searches > 0) out.push(`Searches: ${number(searches)}`);

  const locales = ranked(tally(served.map((visit) => visit.locale)));
  if (locales.length > 0) out.push(`Languages: ${locales.map(([locale, n]) => `${locale} ${number(n)}`).join(" · ")}`);

  if (spends.length === 0) {
    out.push("Explanations written: none — every one shown was already in the cache, or nobody opened a pool.");
  } else {
    const input_ = spends.reduce((sum, spend) => sum + spend.inputTokens, 0);
    const output = spends.reduce((sum, spend) => sum + spend.outputTokens, 0);
    const priced = spends.map((spend) => ({ spend, price: input.priceOf(spend.model) }));
    const unpriced = priced.filter(({ price }) => price === null).length;
    const cost = priced.reduce(
      (sum, { spend, price }) =>
        price === null
          ? sum
          : sum + (spend.inputTokens * price.inputPerMillion + spend.outputTokens * price.outputPerMillion) / 1_000_000,
      0,
    );
    const models = [...new Set(spends.map((spend) => spend.model))].sort().join(", ");
    out.push(
      `Explanations written: ${number(spends.length)} (${models}) — ${number(input_)} tokens in, ${number(output)} out, about ${dollars(cost)}${
        unpriced > 0 ? ` plus ${number(unpriced)} on a model with no price on file` : ""
      }`,
    );
  }
  if (rejected > 0) out.push(`Answers the checks turned down: ${number(rejected)}`);
  const reused = input.lines.filter((line) => line.kind === "reused").length;
  const warmed = input.lines.filter((line) => line.kind === "warmed").length;
  /* Whether writing ahead pays: how many were written before any reader, and how many readers were served one already kept. */
  if (reused > 0 || warmed > 0) {
    out.push(`Explanations served from the cache: ${number(reused)}${warmed > 0 ? ` · written ahead of readers: ${number(warmed)}` : ""}`);
  }
  const capped = input.lines.filter((line) => line.kind === "capped").length;
  if (capped > 0) out.push(`Explanations held back by the hourly ceiling: ${number(capped)}`);

  out.push(`Telegram: ${input.telegramLinks === null ? "the store could not be asked" : `${number(input.telegramLinks)} chats following an address`}`);

  const byDay = ranked(tally(served.flatMap((visit) => (visit.at === null ? [] : [visit.at]))));
  const busiest = byDay[0];
  if (busiest !== undefined) out.push(`Busiest day: ${day(busiest[0], true)}, ${number(busiest[1])} pages`);

  return out.join("\n");
};

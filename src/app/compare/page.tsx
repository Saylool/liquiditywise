import type { Metadata } from "next";

import { GuardedLink } from "@/components/GuardedLink";
import { PoolComparison, type ComparedTier, type ComparedV4 } from "@/components/PoolComparison";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getPoolRangeAnalysis } from "@/lib/advisor/getPoolRangeAnalysis";
import { getRangePreferences } from "@/lib/advisor/requestRangePreferences";
import {
  DEPOSIT_PARAMETER,
  HORIZON_PARAMETER,
  MULTIPLIER_PARAMETER,
  CHAIN_PARAMETER,
  poolAnalysisHref,
  readRequestedChain,
  readRequestedParameters,
} from "@/lib/advisor/requestedParameters";
import { chainLabel } from "@/lib/chains/chainLabel";
import { ETHEREUM } from "@/lib/chains/chains";
import { getChainCopy } from "@/lib/i18n/chainCopy";
import { getRequestDictionary } from "@/lib/i18n/requestLocale";
import { getEthereumV3PairFeeTiers } from "@/lib/uniswap/getEthereumV3PairFeeTiers";
import { getEthereumV4PairPools } from "@/lib/uniswap/getEthereumV4PairPools";
import { alterSwapEconomics } from "@/schemas";
import { EvmAddressSchema } from "@/schemas/primitives";

/*
 * Every v3 fee tier of one pool's pair, each analysed in full under the same
 * band and deposit, side by side. Reached from the fee-tier panel on a pool's
 * page, which carries the reader's settings with it.
 *
 * The pool named in the URL is analysed first, because the pair comes from a
 * pool this application verified; the other v3 tiers, and the deepest v4 pools
 * of the same two contracts, are read from that pair and analysed together. No explanation is written here: a model paragraph per
 * tier would be four for one question, and each pool's page has its own.
 *
 * Counted by the proxy like the pool page, since it reads the same sources —
 * up to eight times over.
 */

/**
 * How many v4 pools are read beside the v3 tiers: the deepest four. A v4 pair
 * can be dozens of pools, most of them opened and left, and each read here is
 * a full analysis.
 */
const V4_COMPARED = 4;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: t.metadata.compareTitle,
    description: t.metadata.compareDescription,
    // Spends third-party quota on every render, and is only true for the moment it was read.
    robots: { index: false, follow: false },
  };
}

const single = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale, t } = await getRequestDictionary();
  const params = await searchParams;
  const address = EvmAddressSchema.safeParse(single(params.address));
  const chain = readRequestedChain(params[CHAIN_PARAMETER]);

  const page = (children: React.ReactNode) => (
    <WorkspaceShell locale={locale} t={t} section="pools" network={chainLabel((chain ?? ETHEREUM).id, locale)}>
      {children}
    </WorkspaceShell>
  );

  /* A chain nobody reads is refused, never read as mainnet: the same address there is another pool. */
  if (chain === null) {
    return page(<p className="text-sm leading-relaxed text-muted">{getChainCopy(locale).unknown}</p>);
  }

  if (!address.success) {
    return page(
      <>
        <p className="text-sm leading-relaxed text-muted">{t.pool.invalidAddress}</p>
        <GuardedLink className="text-link text-sm" href="/pool">
          {t.notFound.search}
        </GuardedLink>
      </>,
    );
  }

  const requested = readRequestedParameters(
    params[HORIZON_PARAMETER],
    params[MULTIPLIER_PARAMETER],
    params[DEPOSIT_PARAMETER],
    await getRangePreferences(),
  );
  const { parameters, depositUsd } = requested;
  const first = await getPoolRangeAnalysis("v3", address.data, parameters, depositUsd, undefined, chain.id);

  // Without the pool itself there is no pair to find the other tiers of.
  if (first.status === "unavailable" || first.data.pool.protocolVersion !== "v3") {
    return page(
      <>
        <h2 className="text-2xl font-semibold">{t.compare.heading}</h2>
        <p className="text-sm leading-relaxed">{t.compare.unavailable}</p>
        {first.status === "unavailable" ? (
          <p className="text-sm leading-relaxed text-muted">{t.notices.failure[first.notice]}</p>
        ) : null}
        <GuardedLink className="text-link text-sm" href={poolAnalysisHref(address.data, parameters, depositUsd, chain)}>
          {t.compare.open}
        </GuardedLink>
      </>,
    );
  }

  const pool = first.data.pool;
  const pair = `${pool.token0.symbol} / ${pool.token1.symbol}`;
  const current = address.data.toLowerCase();
  /* v4 is read on mainnet alone; off it the same token addresses would name other tokens there. */
  const [listed, v4Listed] = await Promise.all([
    getEthereumV3PairFeeTiers(pool),
    chain.id !== ETHEREUM.id
      ? null
      : getEthereumV4PairPools({
          analysedPoolId: null,
          token0Address: pool.token0.address,
          token1Address: pool.token1.address,
        }),
  ]);

  if (listed.status === "unavailable") {
    return page(
      <>
        <h2 className="text-2xl font-semibold">{t.compare.heading}</h2>
        <p className="text-sm leading-relaxed">{t.feeTiers.unavailableHeading}</p>
        <p className="text-sm leading-relaxed text-muted">{t.notices.failure[listed.notice]}</p>
      </>,
    );
  }

  // In the order the panel lists them — by fee — and the pool already read is not read twice.
  const v4Pools = v4Listed === null || v4Listed.status === "unavailable" ? [] : v4Listed.data.pools.slice(0, V4_COMPARED);
  const [v3, v4Tiers] = await Promise.all([
    Promise.all(
      listed.data.tiers.map(async (tier): Promise<ComparedTier> => {
        const id = tier.pool.id.toLowerCase();
        return {
          protocol: "v3",
          id,
          fee: { kind: "static", feePpm: tier.pool.feePpm },
          tickSpacing: null,
          hookAltersSwaps: false,
          current: id === current,
          result:
            id === current ? first : await getPoolRangeAnalysis("v3", id, parameters, depositUsd, undefined, chain.id),
        };
      }),
    ),
    // Deepest first, as the source orders them.
    Promise.all(
      v4Pools.map(
        async ({ pool: entry }): Promise<ComparedTier> => ({
          protocol: "v4",
          id: entry.id,
          fee: entry.fee,
          tickSpacing: entry.tickSpacing,
          hookAltersSwaps: alterSwapEconomics(entry.hookAddress),
          current: false,
          result: await getPoolRangeAnalysis("v4", entry.id, parameters, depositUsd),
        }),
      ),
    ),
  ]);

  const v4: ComparedV4 =
    v4Listed === null
      ? { status: "not-read" }
      : v4Listed.status === "unavailable"
      ? { status: "unavailable", notice: v4Listed.notice }
      : v4Tiers.length === 0
        ? { status: "none" }
        : { status: "listed", tiers: v4Tiers, notShown: Math.max(0, v4Listed.data.pools.length - V4_COMPARED) };

  return page(
    <PoolComparison
      pair={pair}
      v3={v3}
      v4={v4}
      parameters={parameters}
      depositUsd={depositUsd}
      chain={chain}
      t={t}
      locale={locale}
    />,
  );
}

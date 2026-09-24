import type { Metadata } from "next";

import { GuardedLink } from "@/components/GuardedLink";
import { PoolComparison, type ComparedTier } from "@/components/PoolComparison";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getPoolRangeAnalysis } from "@/lib/advisor/getPoolRangeAnalysis";
import { getRangePreferences } from "@/lib/advisor/requestRangePreferences";
import {
  DEPOSIT_PARAMETER,
  HORIZON_PARAMETER,
  MULTIPLIER_PARAMETER,
  poolAnalysisHref,
  readRequestedParameters,
} from "@/lib/advisor/requestedParameters";
import { getRequestDictionary } from "@/lib/i18n/requestLocale";
import { getEthereumV3PairFeeTiers } from "@/lib/uniswap/getEthereumV3PairFeeTiers";
import { EvmAddressSchema } from "@/schemas/primitives";

/*
 * Every v3 fee tier of one pool's pair, each analysed in full under the same
 * band and deposit, side by side. Reached from the fee-tier panel on a pool's
 * page, which carries the reader's settings with it.
 *
 * The pool named in the URL is analysed first, because the pair comes from a
 * pool this application verified; the other tiers are read from that pair and
 * analysed together. No explanation is written here: a model paragraph per
 * tier would be four for one question, and each pool's page has its own.
 *
 * Counted by the proxy like the pool page, since it reads the same sources —
 * four times over.
 */

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

  const page = (children: React.ReactNode) => (
    <WorkspaceShell locale={locale} t={t} section="pools">
      {children}
    </WorkspaceShell>
  );

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
  const first = await getPoolRangeAnalysis("v3", address.data, parameters, depositUsd);

  // Without the pool itself there is no pair to find the other tiers of.
  if (first.status === "unavailable" || first.data.pool.protocolVersion !== "v3") {
    return page(
      <>
        <h1 className="text-2xl font-semibold">{t.compare.heading}</h1>
        <p className="text-sm leading-relaxed">{t.compare.unavailable}</p>
        {first.status === "unavailable" ? (
          <p className="text-sm leading-relaxed text-muted">{t.notices.failure[first.notice]}</p>
        ) : null}
        <GuardedLink className="text-link text-sm" href={poolAnalysisHref(address.data, parameters, depositUsd)}>
          {t.compare.open}
        </GuardedLink>
      </>,
    );
  }

  const pool = first.data.pool;
  const pair = `${pool.token0.symbol} / ${pool.token1.symbol}`;
  const current = address.data.toLowerCase();
  const listed = await getEthereumV3PairFeeTiers(pool);

  if (listed.status === "unavailable") {
    return page(
      <>
        <h1 className="text-2xl font-semibold">{t.compare.heading}</h1>
        <p className="text-sm leading-relaxed">{t.feeTiers.unavailableHeading}</p>
        <p className="text-sm leading-relaxed text-muted">{t.notices.failure[listed.notice]}</p>
      </>,
    );
  }

  // In the order the panel lists them — by fee — and the pool already read is not read twice.
  const tiers: ComparedTier[] = await Promise.all(
    listed.data.tiers.map(async (tier) => {
      const id = tier.pool.id.toLowerCase();
      return {
        address: id,
        feePpm: tier.pool.feePpm,
        current: id === current,
        result: id === current ? first : await getPoolRangeAnalysis("v3", id, parameters, depositUsd),
      };
    }),
  );

  return page(
    <PoolComparison pair={pair} tiers={tiers} parameters={parameters} depositUsd={depositUsd} t={t} locale={locale} />,
  );
}

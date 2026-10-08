import Link from "next/link";

import { ArrowIcon } from "@/components/BrandMark";
import { MostTradedPreview } from "@/components/MostTradedPools";
import { FRONT_PAGE_POOLS } from "@/lib/advisor/mostTraded";
import { getMostTraded } from "@/lib/advisor/getMostTraded";
import { DEFAULT_PRICE_BAND_PARAMETERS } from "@/lib/advisor/poolRangeAnalysis";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localePath } from "@/lib/i18n/localePath";
import type { Locale } from "@/lib/i18n/locales";
import { getCasesCopy } from "@/lib/i18n/casesCopy";
import { getMostTradedCopy } from "@/lib/i18n/mostTradedCopy";


/**
 * This week's busiest mainnet pools, on the front page.
 *
 * The same read as the most-traded page, which the warmer keeps fresh, so it
 * costs the front page nothing but a lookup; streamed in its own boundary all
 * the same, so a cold read after a restart never holds the page back. Lives
 * in the route because it reads data.
 */
export async function HomeMostTraded({ locale, t }: { locale: Locale; t: Dictionary }) {
  const data = await getMostTraded(1);
  const copy = getMostTradedCopy(locale);
  const nothing = [data.v3, data.v4].every((list) => list === null || list.status !== "listed" || list.pools.length === 0);
  if (nothing) return null;

  return (
    <div className="flex flex-col gap-6">
      <MostTradedPreview
        data={data}
        count={FRONT_PAGE_POOLS}
        copy={copy}
        parameters={DEFAULT_PRICE_BAND_PARAMETERS}
        t={t}
        locale={locale}
      />
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <Link href={localePath(locale, "/most-traded")} prefetch={false} className="text-link">
          {copy.link}
          <ArrowIcon />
        </Link>
        {/* The same pools' month, replayed and written up: beyond one pool, as the list above is. */}
        <Link href={localePath(locale, "/cases")} prefetch={false} className="text-link">
          {getCasesCopy(locale).link}
          <ArrowIcon />
        </Link>
      </div>
    </div>
  );
}

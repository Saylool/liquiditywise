import type { Metadata } from "next";

import { PairPools, PairPoolsForm } from "@/components/PairPools";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getPairPools } from "@/lib/advisor/getPairPools";
import { PAIR_PARAMETER, readPairInput } from "@/lib/advisor/pairPools";
import { CHAINS } from "@/lib/chains/chains";
import type { Locale } from "@/lib/i18n/locales";
import { getMostTradedCopy } from "@/lib/i18n/mostTradedCopy";
import { getPairPoolsCopy } from "@/lib/i18n/pairPoolsCopy";
import { getRequestDictionary } from "@/lib/i18n/requestLocale";

/*
 * One pair, every pool: where the pair a reader typed trades, on every
 * network this application reads, v3 and v4, with each pool's last week of
 * fees set against what is in it.
 *
 * Its own route rather than a mode of /compare. The comparison starts from
 * one verified pool and runs the full analysis on each of its siblings on one
 * chain; this starts from two typed symbols and runs no analysis at all — the
 * name searches and the week's day tables, on six chains — so the two share
 * neither their input, their reads nor their output, and a mode would have
 * been two pages behind one name.
 *
 * Closed to crawlers, like every page that reads live data per request, and
 * counted by the proxy like a search: its `q` is the search box's own, and a
 * valid pair spends upstream quota on every network at once.
 */

/** How a list of names is punctuated, where it is not with a comma and a space. */
const LIST_SEPARATOR: Partial<Record<Locale, string>> = { ar: "، ", zh: "、", "zh-Hant": "、" };

const single = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const { locale } = await getRequestDictionary();
  const copy = getPairPoolsCopy(locale);
  const raw = single((await searchParams)[PAIR_PARAMETER]);
  const input = raw === undefined ? null : readPairInput(raw);

  return {
    title: `${input?.kind === "pair" ? copy.titleFor(`${input.terms[0]}/${input.terms[1]}`) : copy.title} · LiquidityWise`,
    description: copy.description,
    // Spends third-party quota on every render, and is only true for the moment it was read.
    robots: { index: false, follow: false },
  };
}

export default async function PairPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale, t } = await getRequestDictionary();
  const copy = getPairPoolsCopy(locale);
  const raw = single((await searchParams)[PAIR_PARAMETER]);

  const page = (children: React.ReactNode) => (
    <WorkspaceShell locale={locale} t={t} heading={copy.heading} network={copy.network}>
      <p className="max-w-3xl text-sm leading-relaxed text-muted">
        {copy.intro(CHAINS.map(({ name }) => name).join(LIST_SEPARATOR[locale] ?? ", "))}
      </p>
      {children}
    </WorkspaceShell>
  );

  if (raw === undefined) return page(<PairPoolsForm copy={copy} t={t} />);

  const input = readPairInput(raw);
  /* Deliberately does not echo what was typed: it did not pass. */
  if (input.kind === "unusable") return page(<PairPoolsForm copy={copy} t={t} rejection={input.reason} />);
  if (input.kind === "not-a-pair") return page(<PairPoolsForm copy={copy} t={t} notAPair />);

  const data = await getPairPools(input.terms);

  return page(
    <>
      {/* The validated terms, not the raw string — which may have held a third. */}
      <PairPoolsForm copy={copy} t={t} value={`${input.terms[0]}/${input.terms[1]}`} />
      <PairPools data={data} copy={copy} week={getMostTradedCopy(locale)} t={t} locale={locale} />
    </>,
  );
}

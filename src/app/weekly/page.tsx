import type { Metadata } from "next";

import { WeeklyDigestPage } from "@/components/WeeklyDigestPage";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getWeeklyReading } from "@/lib/advisor/getWeeklyDigest";
import { CHAIN_PARAMETER, readRequestedChain } from "@/lib/advisor/requestedParameters";
import { chainLabel } from "@/lib/chains/chainLabel";
import { readsV3Positions, V3_POSITION_CHAINS } from "@/lib/chains/chains";
import { emailDigestOffered } from "@/lib/email/environment";
import { EMAIL_STATUS_PARAMETER, readEmailStatus } from "@/lib/email/formStatus";
import { subscribeToDigest } from "@/lib/email/subscribeAction";
import { getChainCopy } from "@/lib/i18n/chainCopy";
import { getEmailDigestCopy } from "@/lib/i18n/emailDigestCopy";
import { localePath } from "@/lib/i18n/localePath";
import { getOpenPageAlternates, getRequestDictionary } from "@/lib/i18n/requestLocale";
import { getWeeklyCopy } from "@/lib/i18n/weeklyCopy";
import { poolShareMetadata } from "@/lib/og/poolCard";
import { smartCardPath } from "@/lib/og/smartCard";
import { publicBot } from "@/lib/telegram/environment";

/*
 * The Monday digest as a page: where the smart money moved over the week,
 * per network, read off the series the smart-money measurement keeps and
 * composed exactly as the bot composes the message it sends (see
 * telegram/weeklyDigest.ts).
 *
 * Like the smart-money page it takes no input beyond the chain, so it is the
 * same page for everybody and open to search engines — and it reads only what
 * is kept, never measuring anything, so a crawler's visit costs the store one
 * read and the chain nothing. The card a shared link unfurls into is the
 * smart-money card for the same chain: the digest is a week of that page.
 *
 * Under the digest, the form that asks for it by e-mail. The one word the
 * form's action sends back (`?email=`) is read here and shown over the form;
 * it is not part of the page's identity — the canonical and the alternates
 * name the page without it — and never reaches the store.
 */

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const { locale } = await getRequestDictionary();
  const copy = getWeeklyCopy(locale);
  const chain = readRequestedChain((await searchParams)[CHAIN_PARAMETER]);
  /* A chain's own title only where its positions are read; elsewhere the page says it cannot. */
  const named = chain !== null && chain.id !== 1 && readsV3Positions(chain.id);

  const title = `${named ? copy.titleOn(chain.name) : copy.title} · LiquidityWise`;

  return {
    title,
    description: copy.description,
    alternates: await getOpenPageAlternates("/weekly"),
    ...(chain !== null && readsV3Positions(chain.id) ? poolShareMetadata(smartCardPath(chain.slug), title, copy.description) : {}),
  };
}

export default async function WeeklyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale, t } = await getRequestDictionary();
  const copy = getWeeklyCopy(locale);
  const parameters = await searchParams;
  const chain = readRequestedChain(parameters[CHAIN_PARAMETER]);

  /* A chain nobody reads is said so, not quietly shown as mainnet's week. */
  if (chain === null) {
    return (
      <WorkspaceShell locale={locale} t={t} heading={copy.heading}>
        <p className="text-sm leading-relaxed text-muted">{getChainCopy(locale).unknown}</p>
      </WorkspaceShell>
    );
  }

  const reading = await getWeeklyReading(chain.id);

  return (
    <WorkspaceShell locale={locale} t={t} heading={copy.heading} network={chainLabel(chain.id, locale)}>
      <WeeklyDigestPage
        reading={reading}
        chain={chain}
        chains={V3_POSITION_CHAINS}
        pageHref={localePath(locale, "/weekly")}
        networkLabel={getChainCopy(locale).network}
        copy={copy}
        t={t}
        locale={locale}
        bot={publicBot()}
        email={{
          offered: emailDigestOffered(),
          status: readEmailStatus(parameters[EMAIL_STATUS_PARAMETER]),
          copy: getEmailDigestCopy(locale),
          action: subscribeToDigest,
        }}
      />
    </WorkspaceShell>
  );
}

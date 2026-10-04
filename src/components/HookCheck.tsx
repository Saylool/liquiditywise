import type { ReactNode } from "react";

import type { HookCheck, VerificationSource } from "../lib/advisor/hookCheck";
import { HOOK_POOL_COUNT_CAP } from "../lib/uniswap/ethereumV4HookPools";
import { formatUtcDate, formatWhole } from "../lib/format/displayFormats";
import { getHookCheckCopy } from "../lib/i18n/hookCheckCopy";
import type { Locale } from "../lib/i18n/locales";
import { blockscoutPage } from "../lib/verification/blockscout";
import { sourcifyPage } from "../lib/verification/sourcify";

/*
 * What can be checked about a hook from outside, under what it is permitted
 * to do: whether its source code is verified, and how many v4 pools name it.
 *
 * Presentational only, like the permissions above it. The answers are asked
 * and kept in advisor/getHookChecks.ts, and arrive here already combined.
 *
 * Below the permissions, never above them. The permissions are what the
 * protocol enforces, and their warnings are what a reader who stops early
 * must have read; "verified" placed first would be read by that same reader
 * as a verdict on the hook, which it is not.
 */

const SOURCE_NAMES: Record<VerificationSource, string> = { sourcify: "Sourcify", blockscout: "Blockscout" };

/** The verifiers' names in the reader's own list: "Sourcify and Blockscout", "Sourcify ve Blockscout". */
const listed = (locale: Locale, names: readonly string[]): string =>
  new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(names);

/**
 * A figure beside its label, as the pool's own figures are shown. Isolated,
 * so "1,000+" and a date keep their order inside an Arabic line.
 */
const Figure = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <dt className="text-xs uppercase tracking-widest text-muted">{label}</dt>
    <dd className="font-mono text-sm">
      <bdi>{value}</bdi>
    </dd>
    {note === undefined ? null : <p className="text-xs leading-relaxed text-muted">{note}</p>}
  </div>
);

/** The block's frame: its heading, and on a page that says "verified" nowhere else, what that means. */
export function HookCheckFrame({
  locale,
  explain,
  children,
}: {
  locale: Locale;
  /** Whether to say here what verified source does and does not mean. The directory says it once, at the top. */
  explain: boolean;
  children: ReactNode;
}) {
  const copy = getHookCheckCopy(locale);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <h3 className="text-xs uppercase tracking-widest text-muted">{copy.heading}</h3>
      {children}
      {explain ? <p className="text-xs leading-relaxed text-muted">{copy.meaning}</p> : null}
    </div>
  );
}

/** While the answers are still being asked; a line, not a skeleton, because it may be a few seconds. */
export function HookCheckPending({ locale }: { locale: Locale }) {
  return <p className="text-sm leading-relaxed text-muted">{getHookCheckCopy(locale).pending}</p>;
}

export function HookCheckLines({ check, locale }: { check: HookCheck; locale: Locale }) {
  const copy = getHookCheckCopy(locale);
  const { verification, usage, chainId, address } = check;
  const proxy = verification.status === "unchecked" ? null : verification.proxy;

  return (
    <>
      {verification.status === "verified" ? (
        <>
          <p className="text-sm leading-relaxed">
            {copy.verified(listed(locale, verification.sources.map((source) => SOURCE_NAMES[source])))}
          </p>
          {verification.name === null ? null : (
            <p className="break-words text-sm leading-relaxed">{copy.named(verification.name)}</p>
          )}
        </>
      ) : (
        <p className="text-sm leading-relaxed">
          {verification.status === "unverified" ? copy.unverified : copy.unchecked}
        </p>
      )}

      {proxy === null ? null : (
        <p className="break-words text-sm leading-relaxed text-muted">{copy.proxy(proxy.implementation)}</p>
      )}

      {/* Each verifier's own page for it, so "verified" can be checked by the reader too. */}
      {verification.status === "verified" ? (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs leading-relaxed text-muted">
          <span>{copy.readOn}</span>
          {verification.sources.map((source) => (
            <a
              key={source}
              href={source === "sourcify" ? sourcifyPage(chainId, address) : blockscoutPage(chainId, address)}
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              {SOURCE_NAMES[source]}
            </a>
          ))}
        </p>
      ) : null}

      {usage.status === "counted" ? (
        <dl className="grid gap-4 sm:grid-cols-2">
          <Figure
            label={copy.poolsLabel}
            value={usage.capped ? `${formatWhole(usage.pools, locale)}+` : formatWhole(usage.pools, locale)}
            note={copy.poolsNote(formatWhole(HOOK_POOL_COUNT_CAP, locale))}
          />
          {usage.firstCreatedAt === null ? null : (
            <Figure label={copy.firstLabel} value={formatUtcDate(usage.firstCreatedAt)} />
          )}
        </dl>
      ) : (
        <p className="text-sm leading-relaxed text-muted">{copy.poolsUnchecked}</p>
      )}
    </>
  );
}

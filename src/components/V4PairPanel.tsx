import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import {
  type DataResult,
  type PairFeeTiers,
  type PriceBandParameters,
  type V4PairPools,
  ZERO_ADDRESS,
} from "../schemas";
import { V3PairPoolList } from "./PoolFeeTiers";
import { V4PairPoolList } from "./V4PairPoolList";

/**
 * Where else a v4 pool's pair trades: its v4 siblings, with the reader's own
 * pool marked, and then the same two token contracts on v3.
 *
 * The v3 list is missing for one reason only, and the panel says it: a pool
 * holding the chain's own ether has no v3 counterpart, because every v3
 * currency is a token contract. `v3Result` is then `null` — not unread, not
 * empty, but a question v3 cannot be asked.
 */
export function V4PairPanel({
  v4Result,
  v3Result,
  pair,
  token0Address,
  parameters,
  t,
  locale,
}: {
  v4Result: DataResult<V4PairPools>;
  /** `null` when the pair holds native ether and the question has no v3 form. */
  v3Result: DataResult<PairFeeTiers> | null;
  pair: string;
  token0Address: string;
  parameters: PriceBandParameters;
  t: Dictionary;
  locale: Locale;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.feeTiers.heading}
      </h2>

      <h3 className="text-xs uppercase tracking-widest text-muted">{t.feeTiers.onV4}</h3>
      <V4PairPoolList result={v4Result} pair={pair} parameters={parameters} t={t} locale={locale} />

      <h3 className="border-t border-border pt-4 text-xs uppercase tracking-widest text-muted">
        {t.feeTiers.onV3}
      </h3>
      {v3Result === null || token0Address === ZERO_ADDRESS ? (
        <p className="text-sm leading-relaxed text-muted">{t.feeTiers.v3NoNative}</p>
      ) : (
        <V3PairPoolList result={v3Result} pair={pair} parameters={parameters} t={t} locale={locale} />
      )}
    </section>
  );
}

/** The panel's shape while both reads are in flight. */
export function V4PairPanelPending({ t }: { t: Dictionary }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.feeTiers.heading}
      </h2>
      <div className="h-16 animate-pulse rounded-md border border-border" aria-hidden="true" />
    </section>
  );
}

/*
 * Keeps the most-traded page's reads fresh, so no reader pays for one.
 *
 * Cold, the page waits on a week of pool-days per chain and, on mainnet, on
 * the chain for the v4 fees: eight seconds and more, paid by whoever opens it
 * first after the kept read runs out — often a crawler, which counts that
 * wait against the page. The warmer reads each chain anew before then, one
 * chain at a time so they do not queue at the same gateway together.
 *
 * It reads from inside the process rather than opening the page, so the
 * weekly report's visit count is only people (see usageLines.ts).
 *
 * Pure but for the timer it is handed.
 */

/**
 * How long the page keeps a read (getMostTraded.ts): thirty minutes. A week's
 * totals barely move in half an hour, and a crawler walking every language's
 * address of the page should cost one read, not eleven.
 */
export const MOST_TRADED_TTL_MS = 30 * 60 * 1000;

/** Every twenty-five minutes: inside the page's thirty, with room for a slow read. */
export const WARM_EVERY_MS = 25 * 60 * 1000;

/** The first round waits a moment, so a restart is not slowed by it. */
export const FIRST_WARM_AFTER_MS = 5 * 1000;

type Timer = { unref?: () => unknown };

export type WarmerRequest<Chain> = {
  readonly chains: readonly Chain[];
  /** Reads one chain anew. Its failures are its own to log; the warmer goes on to the next. */
  readonly warm: (chain: Chain) => Promise<unknown>;
  readonly setTimer?: (run: () => void, afterMs: number) => Timer;
  readonly clearTimer?: (timer: Timer) => void;
};

/** Starts the rounds; the function it returns stops them. */
export const startWarming = <Chain>({
  chains,
  warm,
  setTimer = setTimeout,
  clearTimer = (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
}: WarmerRequest<Chain>): (() => void) => {
  let stopped = false;
  let timer: Timer;

  const schedule = (afterMs: number) => {
    timer = setTimer(() => void round(), afterMs);
    /* A timer that holds the process open would keep a stopping server from stopping. */
    timer.unref?.();
  };

  const round = async () => {
    for (const chain of chains) {
      if (stopped) return;
      try {
        await warm(chain);
      } catch {
        /* Logged by the reader, which alone knows what is safe to write down. */
      }
    }
    if (!stopped) schedule(WARM_EVERY_MS);
  };

  schedule(FIRST_WARM_AFTER_MS);

  return () => {
    stopped = true;
    clearTimer(timer);
  };
};

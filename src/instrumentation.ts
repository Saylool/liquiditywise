/*
 * Runs once when the server starts.
 *
 * It starts the most-traded warmer (see warmMostTraded.ts) — on the Node.js
 * server of a production build, and nowhere else: not in the proxy's edge
 * runtime, not while `next build` prerenders, and not under `next dev`, where
 * every restart would spend a round of the gateway's queries.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") return;

  const { startMostTradedWarmer } = await import("./lib/advisor/startMostTradedWarmer");
  startMostTradedWarmer();
}

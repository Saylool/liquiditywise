import "server-only";

import { CHAINS } from "../chains/chains";
import { getMostTraded } from "./getMostTraded";
import { startWarming } from "./warmMostTraded";

/** Started once per server, from instrumentation.ts. */
export const startMostTradedWarmer = (): (() => void) =>
  startWarming({ chains: CHAINS, warm: (chain) => getMostTraded(chain.id, { refresh: true }) });

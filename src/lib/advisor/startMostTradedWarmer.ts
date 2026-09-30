import "server-only";

import { CHAINS, V3_POSITION_CHAINS } from "../chains/chains";
import {
  getSmartLiquidity,
  SMART_LIQUIDITY_FIRST_WARM_AFTER_MS,
  SMART_LIQUIDITY_WARM_EVERY_MS,
} from "./getSmartLiquidity";
import { getMostTraded } from "./getMostTraded";
import { startWarming } from "./warmMostTraded";
import {
  EXPLANATION_FIRST_WARM_AFTER_MS,
  EXPLANATION_WARM_EVERY_MS,
  warmFrontPageExplanations,
} from "./warmExplanations";

/** Started once per server, from instrumentation.ts: the most-traded reads, the front page's explanations, and the smart-money figures. */
export const startMostTradedWarmer = (): (() => void) => {
  const stopLists = startWarming({ chains: CHAINS, warm: (chain) => getMostTraded(chain.id, { refresh: true }) });
  const stopExplanations = startWarming({
    chains: ["front page"],
    warm: warmFrontPageExplanations,
    everyMs: EXPLANATION_WARM_EVERY_MS,
    firstAfterMs: EXPLANATION_FIRST_WARM_AFTER_MS,
  });

  const stopSmart = startWarming({
    chains: V3_POSITION_CHAINS,
    warm: (chain) => getSmartLiquidity(chain.id, { refresh: true }),
    everyMs: SMART_LIQUIDITY_WARM_EVERY_MS,
    firstAfterMs: SMART_LIQUIDITY_FIRST_WARM_AFTER_MS,
  });

  return () => {
    stopLists();
    stopExplanations();
    stopSmart();
  };
};

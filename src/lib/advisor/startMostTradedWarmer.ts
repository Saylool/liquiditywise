import "server-only";

import { CHAINS } from "../chains/chains";
import { getMostTraded } from "./getMostTraded";
import { startWarming } from "./warmMostTraded";
import {
  EXPLANATION_FIRST_WARM_AFTER_MS,
  EXPLANATION_WARM_EVERY_MS,
  warmFrontPageExplanations,
} from "./warmExplanations";

/** Started once per server, from instrumentation.ts: the most-traded reads, and the front page's explanations. */
export const startMostTradedWarmer = (): (() => void) => {
  const stopLists = startWarming({ chains: CHAINS, warm: (chain) => getMostTraded(chain.id, { refresh: true }) });
  const stopExplanations = startWarming({
    chains: ["front page"],
    warm: warmFrontPageExplanations,
    everyMs: EXPLANATION_WARM_EVERY_MS,
    firstAfterMs: EXPLANATION_FIRST_WARM_AFTER_MS,
  });

  return () => {
    stopLists();
    stopExplanations();
  };
};

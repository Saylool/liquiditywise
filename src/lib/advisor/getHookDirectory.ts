import "server-only";

import type { V4ChainId } from "../chains/chains";
import { getEthereumV4TradedPools } from "../uniswap/getEthereumV4TradedPools";
import { composeHookDirectory, type HookDirectoryResult } from "./hookDirectory";

/*
 * The server-only boundary for the hook directory.
 *
 * There is nothing here but the read, and the read is one this application was
 * already making: the same candidate list the v4 search and a holdings lookup
 * are built from, behind the same ten-minute cache. A visitor to this page
 * costs the sources nothing that the next v4 search would not have cost anyway.
 *
 * One chain's hooks at a time: a hook is a contract, and the same address on
 * another chain is another contract or none.
 *
 * `import "server-only"` keeps `THE_GRAPH_API_KEY` out of a browser bundle, as
 * everywhere else. Deliberately absent from every barrel file.
 */
export const getHookDirectory = async (chainId: V4ChainId = 1): Promise<HookDirectoryResult> => {
  const list = await getEthereumV4TradedPools(chainId);
  if (list.status === "unavailable") return { status: "unavailable", notice: list.notice };

  return composeHookDirectory(list.data);
};

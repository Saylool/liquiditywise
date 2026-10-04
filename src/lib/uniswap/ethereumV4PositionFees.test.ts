import { describe, expect, it } from "vitest";

import { fetchEthereumV4PositionFees, v4FeeSlots } from "./ethereumV4PositionFees";
import type { Aggregate3Call } from "./multicall3";
import { rpcEndpoint } from "./testing/multicall3Endpoint";
import { extsloadCalldata } from "./v4PoolStateSlots";
import { V4_POSITION_MANAGER_ADDRESS, V4_POSITION_MANAGERS, type RawV4Position } from "./v4PositionManager";

const POOL_MANAGER = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
const POSITION: RawV4Position = {
  tokenId: "7",
  key: {
    currency0: `0x${"0".repeat(40)}`,
    currency1: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    fee: 500,
    tickSpacing: 10,
    hooks: `0x${"0".repeat(40)}`,
  },
  poolId: `0x${"e5".repeat(32)}`,
  tickLower: -200_000,
  tickUpper: -190_000,
  liquidity: "1000",
};

describe("the slots a position's fees are read from", () => {
  it("name the position under the manager that owns it, which differs from chain to chain", () => {
    const mainnet = v4FeeSlots(POSITION);
    const arbitrum = v4FeeSlots(POSITION, V4_POSITION_MANAGERS[42161].address);

    expect(mainnet).toEqual(v4FeeSlots(POSITION, V4_POSITION_MANAGER_ADDRESS));
    /* The tick slots are the pool's and the same; the position's own slots are the manager's. */
    expect(arbitrum?.slice(0, 4)).toEqual(mainnet?.slice(0, 4));
    expect(arbitrum?.slice(4)).not.toEqual(mainnet?.slice(4));
  });
});

describe("reading the fees on a chain", () => {
  const asked = async (chainId?: 1 | 42161) => {
    const calls: Aggregate3Call[] = [];
    await fetchEthereumV4PositionFees({
      positions: [POSITION],
      poolManager: POOL_MANAGER,
      rpcUrl: "https://node.example.invalid/key",
      fetchImpl: rpcEndpoint({
        call: (call) => {
          calls.push(call);
          return { success: true, data: `0x${"0".repeat(64)}` };
        },
      }),
      timeoutMs: 1_000,
      ...(chainId === undefined ? {} : { chainId }),
    });
    return calls.map(({ data }) => data);
  };

  it("asks for the slots of the position the chain's own manager owns", async () => {
    const slots = (manager: string) => (v4FeeSlots(POSITION, manager) ?? []).map(extsloadCalldata);

    expect(await asked(42161)).toEqual(expect.arrayContaining(slots(V4_POSITION_MANAGERS[42161].address)));
    expect(await asked(42161)).not.toEqual(expect.arrayContaining(slots(V4_POSITION_MANAGER_ADDRESS).slice(4)));
    expect(await asked()).toEqual(expect.arrayContaining(slots(V4_POSITION_MANAGER_ADDRESS)));
  });
});

describe("the protocol's cut, read with the fees", () => {
  /** A `slot0` word: price, tick zero, the protocol's cut each way, and the LP fee. */
  const slot0 = (sqrtPriceX96: bigint, zeroForOnePpm: number, oneForZeroPpm: number): string =>
    `0x${(sqrtPriceX96 | (BigInt(zeroForOnePpm | (oneForZeroPpm << 12)) << 184n) | (500n << 208n)).toString(16).padStart(64, "0")}`;

  const read = async (word: string) => {
    const result = await fetchEthereumV4PositionFees({
      positions: [POSITION],
      poolManager: POOL_MANAGER,
      rpcUrl: "https://node.example.invalid/key",
      fetchImpl: rpcEndpoint({
        /* The pool's three words come first, `slot0` the first of them; every other slot holds nothing. */
        call: (_call, index) => ({ success: true, data: index === 0 ? word : `0x${"0".repeat(64)}` }),
      }),
      timeoutMs: 1_000,
    });
    if (result.status !== "success") throw new Error("the read failed");
    return result.data.protocolFees;
  };

  it("is the pool's own, per direction, from the word the tick came from", async () => {
    expect((await read(slot0(1n << 96n, 100, 125))).get(POSITION.poolId)).toEqual({ zeroForOnePpm: 100, oneForZeroPpm: 125 });
    expect((await read(slot0(1n << 96n, 0, 0))).get(POSITION.poolId)).toEqual({ zeroForOnePpm: 0, oneForZeroPpm: 0 });
  });

  it("is not read from a slot nobody wrote, or from one past the protocol's cap", async () => {
    expect((await read(slot0(0n, 100, 125))).has(POSITION.poolId)).toBe(false);
    expect((await read(slot0(1n << 96n, 4_000, 125))).has(POSITION.poolId)).toBe(false);
  });
});

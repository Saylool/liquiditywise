import { describe, expect, it } from "vitest";

import {
  EMPTY_RECENT,
  isEmptyRecent,
  MAX_RECENT_ADDRESSES,
  MAX_RECENT_POOLS,
  type PoolVisit,
  readRecentlyViewed,
  recentAddressHref,
  recentPoolHref,
  shortAddress,
  withAddress,
  withPool,
  writeRecentlyViewed,
} from "./recentlyViewed";

const ADDRESS = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
const V4_ID = "0x21c67e77068de97969ba93d4aab21826d33ca12bb9f565d8496e8fda8a82ca27";
const OWNER = "0x1111111111111111111111111111111111111111";

const v3 = (id: string, chain: PoolVisit["chain"] = "ethereum"): PoolVisit => ({
  protocol: "v3",
  chain,
  id,
  pair: "WETH / USDC",
  feePpm: 500,
});

/** Five distinct v3 pools, by their last digit. */
const pools = Array.from({ length: 6 }, (_, index) => v3(`0x${String(index).repeat(40)}`));

describe("the empty list", () => {
  it("is what nothing stored reads as, and the one object every time, so a snapshot of it is stable", () => {
    expect(readRecentlyViewed(null)).toBe(EMPTY_RECENT);
    expect(isEmptyRecent(EMPTY_RECENT)).toBe(true);
  });
});

describe("adding a pool", () => {
  it("puts it first, with when", () => {
    const recent = withPool(EMPTY_RECENT, pools[0]!, 1_000);

    expect(recent.pools).toEqual([{ ...pools[0], at: 1_000 }]);
    expect(recent.addresses).toEqual([]);
    expect(isEmptyRecent(recent)).toBe(false);
  });

  it("keeps the newest first", () => {
    const recent = withPool(withPool(EMPTY_RECENT, pools[0]!, 1_000), pools[1]!, 2_000);

    expect(recent.pools.map((pool) => pool.id)).toEqual([pools[1]!.id, pools[0]!.id]);
  });

  it("lists the same pool once, moved to the front with its newer time, whatever case its id was written in", () => {
    const first = withPool(withPool(EMPTY_RECENT, pools[0]!, 1_000), pools[1]!, 2_000);
    const again = withPool(first, { ...pools[0]!, id: pools[0]!.id.toUpperCase().replace("0X", "0x"), pair: "WETH / USDC" }, 3_000);

    expect(again.pools).toHaveLength(2);
    expect(again.pools[0]!.id.toLowerCase()).toBe(pools[0]!.id);
    expect(again.pools[0]!.at).toBe(3_000);
    expect(again.pools[1]!.id).toBe(pools[1]!.id);
  });

  it("tells the same id on another chain, or under the other protocol, apart", () => {
    const onBase = withPool(withPool(EMPTY_RECENT, pools[0]!, 1_000), v3(pools[0]!.id, "base"), 2_000);
    expect(onBase.pools).toHaveLength(2);

    const asV4 = withPool(
      withPool(EMPTY_RECENT, { protocol: "v4", chain: "ethereum", id: V4_ID, pair: "ETH / USDC", feePpm: null }, 1_000),
      { protocol: "v4", chain: "base", id: V4_ID, pair: "ETH / USDC", feePpm: null },
      2_000,
    );
    expect(asV4.pools).toHaveLength(2);
  });

  it(`keeps the last ${MAX_RECENT_POOLS} and drops the oldest beyond them`, () => {
    const recent = pools.reduce((kept, pool, index) => withPool(kept, pool, (index + 1) * 1_000), EMPTY_RECENT);

    expect(MAX_RECENT_POOLS).toBe(5);
    expect(recent.pools).toHaveLength(MAX_RECENT_POOLS);
    expect(recent.pools.map((pool) => pool.id)).toEqual(pools.slice(1).reverse().map((pool) => pool.id));
    expect(recent.pools.some((pool) => pool.id === pools[0]!.id)).toBe(false);
  });

  it("leaves the addresses as they were", () => {
    const withOne = withAddress(EMPTY_RECENT, { chain: "ethereum", address: OWNER }, 500);
    const recent = withPool(withOne, pools[0]!, 1_000);

    expect(recent.addresses).toEqual(withOne.addresses);
  });
});

describe("adding an address", () => {
  it("puts it first, once, and keeps the last two only", () => {
    const owners = ["0x" + "a".repeat(40), "0x" + "b".repeat(40), "0x" + "c".repeat(40)];
    let recent = EMPTY_RECENT;
    owners.forEach((address, index) => {
      recent = withAddress(recent, { chain: "ethereum", address }, (index + 1) * 1_000);
    });

    expect(MAX_RECENT_ADDRESSES).toBe(2);
    expect(recent.addresses.map((entry) => entry.address)).toEqual([owners[2], owners[1]]);

    const again = withAddress(recent, { chain: "ethereum", address: owners[1]!.toUpperCase().replace("0X", "0x") }, 4_000);
    expect(again.addresses).toHaveLength(2);
    expect(again.addresses[0]!.address.toLowerCase()).toBe(owners[1]);
    expect(again.addresses[0]!.at).toBe(4_000);
  });

  it("tells the same address on another chain apart, because it holds different things there", () => {
    const recent = withAddress(withAddress(EMPTY_RECENT, { chain: "ethereum", address: OWNER }, 1_000), { chain: "base", address: OWNER }, 2_000);

    expect(recent.addresses).toHaveLength(2);
  });
});

describe("what is stored", () => {
  it("reads back as the same list", () => {
    const recent = withAddress(withPool(EMPTY_RECENT, pools[0]!, 1_000), { chain: "arbitrum", address: OWNER }, 2_000);

    expect(readRecentlyViewed(writeRecentlyViewed(recent))).toEqual(recent);
  });

  it("is JSON a reader can see for themselves, holding exactly the entries and nothing else", () => {
    const stored = JSON.parse(writeRecentlyViewed(withPool(EMPTY_RECENT, pools[0]!, 1_000))) as Record<string, unknown>;

    expect(Object.keys(stored).sort()).toEqual(["addresses", "pools"]);
    expect(stored.pools).toEqual([{ protocol: "v3", chain: "ethereum", id: pools[0]!.id, pair: "WETH / USDC", feePpm: 500, at: 1_000 }]);
  });

  it("keeps a v4 pool's hook-set fee as no figure", () => {
    const recent = withPool(EMPTY_RECENT, { protocol: "v4", chain: "unichain", id: V4_ID, pair: "ETH / USDC", feePpm: null }, 1_000);

    expect(readRecentlyViewed(writeRecentlyViewed(recent)).pools[0]!.feePpm).toBeNull();
  });
});

describe("reading what storage holds", () => {
  it("reads anything that is not JSON, not an object, or not the shape as the empty list", () => {
    for (const stored of ["", "not json", "[]", "42", "null", '"text"', "{}", '{"pools":"x","addresses":5}']) {
      expect(readRecentlyViewed(stored), stored).toBe(EMPTY_RECENT);
    }
  });

  it("keeps the lines it can read and drops the ones it cannot, one by one", () => {
    const stored = JSON.stringify({
      pools: [
        { protocol: "v3", chain: "ethereum", id: ADDRESS, pair: "WETH / USDC", feePpm: 500, at: 2_000 },
        { protocol: "v3", chain: "mars", id: ADDRESS, pair: "WETH / USDC", feePpm: 500, at: 3_000 },
        { protocol: "v3", chain: "ethereum", id: "0xnot-an-address", pair: "WETH / USDC", feePpm: 500, at: 3_000 },
        { protocol: "v4", chain: "ethereum", id: ADDRESS, pair: "too short an id", feePpm: null, at: 3_000 },
        { protocol: "v3", chain: "ethereum", id: ADDRESS, pair: "", feePpm: 500, at: 3_000 },
        { protocol: "v3", chain: "ethereum", id: ADDRESS, pair: "WETH / USDC", feePpm: -1, at: 3_000 },
        { protocol: "v3", chain: "ethereum", id: ADDRESS, pair: "WETH / USDC", feePpm: 500, at: "yesterday" },
        { protocol: "v3", chain: "ethereum", id: ADDRESS, pair: "WETH / USDC", feePpm: 500, at: 3_000, extra: true },
        "a string",
        null,
      ],
      addresses: [
        { chain: "base", address: OWNER, at: 1_000 },
        { chain: "base", address: "0x123", at: 1_000 },
        { chain: "base", address: OWNER },
      ],
    });

    const recent = readRecentlyViewed(stored);

    expect(recent.pools).toEqual([{ protocol: "v3", chain: "ethereum", id: ADDRESS, pair: "WETH / USDC", feePpm: 500, at: 2_000 }]);
    expect(recent.addresses).toEqual([{ chain: "base", address: OWNER, at: 1_000 }]);
  });

  it("orders, deduplicates and caps what an older copy or a hand edit left over", () => {
    const stored = JSON.stringify({
      pools: [
        ...pools.map((pool, index) => ({ ...pool, at: (index + 1) * 1_000 })),
        { ...pools[2], at: 10_000 },
      ],
      addresses: [],
    });

    const recent = readRecentlyViewed(stored);

    expect(recent.pools).toHaveLength(MAX_RECENT_POOLS);
    expect(recent.pools[0]).toEqual({ ...pools[2], at: 10_000 });
    expect(recent.pools.filter((pool) => pool.id === pools[2]!.id)).toHaveLength(1);
    expect(recent.pools.map((pool) => pool.at)).toEqual([10_000, 6_000, 5_000, 4_000, 2_000]);
  });

  it("reads a stored list with nothing readable in it as the empty list itself", () => {
    expect(readRecentlyViewed('{"pools":[{"bad":true}],"addresses":[]}')).toBe(EMPTY_RECENT);
  });

  it("lower-cases an id or address written in any case, as the pages do", () => {
    const stored = JSON.stringify({
      pools: [{ protocol: "v3", chain: "ethereum", id: ADDRESS.toUpperCase().replace("0X", "0x"), pair: "WETH / USDC", feePpm: 500, at: 2_000 }],
      addresses: [{ chain: "ethereum", address: OWNER.toUpperCase().replace("0X", "0x"), at: 1_000 }],
    });

    const recent = readRecentlyViewed(stored);
    expect(recent.pools[0]!.id).toBe(ADDRESS);
    expect(recent.addresses[0]!.address).toBe(OWNER);
  });
});

describe("where an entry leads", () => {
  it("is the page's canonical address, with mainnet unsaid as every link on the site leaves it", () => {
    expect(recentPoolHref(v3(ADDRESS))).toBe(`/pool?address=${ADDRESS}`);
    expect(recentPoolHref(v3(ADDRESS, "base"))).toBe(`/pool?chain=base&address=${ADDRESS}`);
    expect(recentPoolHref({ protocol: "v4", chain: "ethereum", id: V4_ID, pair: "ETH / USDC", feePpm: null })).toBe(`/v4?id=${V4_ID}`);
    expect(recentPoolHref({ protocol: "v4", chain: "unichain", id: V4_ID, pair: "ETH / USDC", feePpm: null })).toBe(`/v4?chain=unichain&id=${V4_ID}`);
    expect(recentAddressHref({ chain: "ethereum", address: OWNER })).toBe(`/holdings?address=${OWNER}`);
    expect(recentAddressHref({ chain: "polygon", address: OWNER })).toBe(`/holdings?chain=polygon&address=${OWNER}`);
  });

  it("carries none of the band's parameters, so the reader's preferences fill them in", () => {
    expect(recentPoolHref(v3(ADDRESS))).not.toMatch(/horizon|multiplier|deposit/);
  });
});

describe("a short address", () => {
  it("is the first and last four hex digits", () => {
    expect(shortAddress(ADDRESS)).toBe("0x88e6…5640");
  });
});

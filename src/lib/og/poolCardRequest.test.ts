import { describe, expect, it } from "vitest";

import { poolCardKey, readPoolCardRequest } from "./poolCardRequest";

const ADDRESS = `0x${"ab".repeat(20)}`;
const ID = `0x${"cd".repeat(32)}`;
const read = (search: string) => readPoolCardRequest(new URLSearchParams(search));

describe("what a pool's card was asked for", () => {
  it("reads a v3 pool on mainnet when no chain is named, and a v4 pool on the chain that is", () => {
    expect(read(`protocol=v3&id=${ADDRESS}`)).toMatchObject({ protocol: "v3", chain: { slug: "ethereum" }, poolId: ADDRESS });
    expect(read(`protocol=v4&id=${ID}&chain=unichain`)).toMatchObject({ protocol: "v4", chain: { slug: "unichain" }, poolId: ID });
  });

  /* The address poolCard.ts writes is what is read back, mainnet's chain unsaid. */
  it("reads back the address a pool page's metadata writes", async () => {
    const { poolCardPath } = await import("./poolCard");
    const written = new URL(poolCardPath("v3", ADDRESS, "base"), "https://liquiditywise.com");

    expect(written.pathname).toBe("/og/pool");
    expect(readPoolCardRequest(written.searchParams)).toMatchObject({ protocol: "v3", chain: { slug: "base" }, poolId: ADDRESS });
  });

  it.each([
    ["nothing", ""],
    ["no protocol", `id=${ADDRESS}`],
    ["an unknown protocol", `protocol=v5&id=${ADDRESS}`],
    ["a malformed id", "protocol=v3&id=nope"],
    ["an address under v4", `protocol=v4&id=${ADDRESS}`],
    ["a v4 id under v3", `protocol=v3&id=${ID}`],
    ["a chain nobody reads", `protocol=v3&id=${ADDRESS}&chain=solana`],
    ["v3 on a chain whose v3 is not read", `protocol=v3&id=${ADDRESS}&chain=unichain`],
    ["v4 on a chain whose v4 is not read", `protocol=v4&id=${ID}&chain=celo`],
    ["a repeated id", `protocol=v3&id=${ADDRESS}&id=${ADDRESS}`],
    ["a repeated protocol", `protocol=v3&protocol=v4&id=${ADDRESS}`],
    ["a repeated chain", `protocol=v3&id=${ADDRESS}&chain=base&chain=base`],
  ])("names no pool for %s", (_label, search) => {
    expect(read(search)).toBeNull();
  });

  /* One key per pool, so a pool spelled in capitals is not a second read. */
  it("keys a pool the same however its address was spelled, and apart on another chain", () => {
    const key = (search: string) => {
      const asked = read(search);
      if (asked === null) throw new Error(search);
      return poolCardKey(asked);
    };

    expect(key(`protocol=v3&id=${ADDRESS.toUpperCase().replace("0X", "0x")}`)).toBe(key(`protocol=v3&id=${ADDRESS}`));
    expect(key(`protocol=v3&id=${ADDRESS}&chain=ethereum`)).toBe(key(`protocol=v3&id=${ADDRESS}`));
    expect(key(`protocol=v3&id=${ADDRESS}&chain=base`)).not.toBe(key(`protocol=v3&id=${ADDRESS}`));
  });
});

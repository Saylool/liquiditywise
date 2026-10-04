import { describe, expect, it } from "vitest";

import { contractNameOf, isAnswered, unanswered, unansweredStatus } from "./sourceAnswer";

describe("a contract's name, from somebody else's source", () => {
  it("is shown when it is a Solidity identifier", () => {
    for (const name of ["LaunchHook", "PoolManager", "STEER_UNIV4_HOOK_6", "_Hook", "$hook", "x"]) {
      expect(contractNameOf(name), name).toBe(name);
    }
  });

  it("is not shown when it could not be one: spaced, punctuated, non-ASCII, leading digit, empty or long", () => {
    for (const name of ["Uniswap Labs: Official", "Hook.sol", "Ηook", "1Hook", "", "H".repeat(65), null, undefined, 7]) {
      expect(contractNameOf(name), String(name)).toBeNull();
    }
    expect(contractNameOf("H".repeat(64))).toBe("H".repeat(64));
  });
});

describe("a status that is not a verifier's answer", () => {
  it("is a service having a moment when it is a rate limit or a server error", () => {
    expect(unansweredStatus(429)).toBe("busy");
    expect(unansweredStatus(500)).toBe("busy");
    expect(unansweredStatus(504)).toBe("busy");
  });

  it("is a refusal of this server when it is 401 or 403", () => {
    expect(unansweredStatus(401)).toBe("refused");
    expect(unansweredStatus(403)).toBe("refused");
  });

  it("is an answer nobody can read when it is anything else", () => {
    for (const status of [301, 400, 404, 410, 422]) expect(unansweredStatus(status), String(status)).toBe("unreadable");
  });
});

describe("an answer", () => {
  it("counts as answered when the verifier gave a verdict either way, and only then", () => {
    expect(isAnswered({ kind: "verified", name: null, proxy: null })).toBe(true);
    expect(isAnswered({ kind: "unverified", proxy: null })).toBe(true);
    expect(isAnswered(unanswered("timeout"))).toBe(false);
    expect(isAnswered(unanswered("unreadable"))).toBe(false);
  });
});

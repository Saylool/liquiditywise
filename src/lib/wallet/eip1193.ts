import { type EvmAddress, EvmAddressSchema } from "../../schemas";

/*
 * The browser wallet, reduced to the one thing this application wants from it.
 *
 * A wallet can sign messages, send transactions, and switch chains. None of that
 * is reachable from here: this module knows how to ask for an address and how to
 * be told when it changes, and there is no code path in the repository that
 * requests a signature or builds a transaction.
 *
 * What comes back from a wallet is untrusted input, exactly like a subgraph
 * payload. An injected provider is whatever extension got there first, and
 * `eth_requestAccounts` is specified to return an array of addresses but is not
 * obliged by anything in the browser to do so. So the response is parsed rather
 * than read.
 */

/** The slice of EIP-1193 used here. Narrower than the standard on purpose. */
export type Eip1193Provider = {
  readonly request: (args: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
  readonly on?: (event: string, handler: (payload: unknown) => void) => void;
  readonly removeListener?: (event: string, handler: (payload: unknown) => void) => void;
};

/**
 * What can go wrong, as codes rather than sentences.
 *
 * Same rule as every other notice in this application: an adapter says what
 * happened, and the interface decides what a reader is told, in their language.
 * Nothing the wallet wrote reaches the page.
 */
export type WalletNotice =
  | "wallet-not-found"
  | "wallet-request-declined"
  | "wallet-request-failed"
  | "wallet-no-account";

export type ConnectResult =
  | { readonly status: "connected"; readonly address: EvmAddress }
  | { readonly status: "unavailable"; readonly notice: WalletNotice };

/**
 * The address a provider reports, or `null`.
 *
 * Takes the first entry and checks it against the same address schema every
 * other address in this application passes, which also lowercases it. An array
 * of something else, an empty array, or a string that is not an address all mean
 * the same thing here: no account.
 */
export const readFirstAccount = (accounts: unknown): EvmAddress | null => {
  if (!Array.isArray(accounts)) return null;

  const parsed = EvmAddressSchema.safeParse(accounts[0]);

  return parsed.success ? parsed.data : null;
};

/**
 * EIP-1193 gives a user's refusal its own code, and it is worth keeping apart
 * from a failure: one is an answer and the other is a fault. A reader who
 * changed their mind should not be shown an error.
 */
const USER_REJECTED_REQUEST = 4001;

const wasDeclined = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === USER_REJECTED_REQUEST;

/**
 * Asks a provider which account it will speak for.
 *
 * `eth_requestAccounts` is the only method this application ever calls on a
 * wallet. It prompts on first use and returns silently afterwards, and it grants
 * nothing beyond the address — a wallet cannot be made to sign by being asked
 * who it is.
 */
export const requestAccount = async (provider: Eip1193Provider): Promise<ConnectResult> => {
  let accounts: unknown;
  try {
    accounts = await provider.request({ method: "eth_requestAccounts" });
  } catch (error) {
    return {
      status: "unavailable",
      notice: wasDeclined(error) ? "wallet-request-declined" : "wallet-request-failed",
    };
  }

  const address = readFirstAccount(accounts);
  if (address === null) return { status: "unavailable", notice: "wallet-no-account" };

  return { status: "connected", address };
};

/**
 * The wallet the browser happens to have, or `null`.
 *
 * Deliberately undemanding about what it finds: an object with a `request`
 * function is all this application uses, and insisting on a particular
 * extension's marker would turn "a wallet I have not heard of" into "no wallet".
 *
 * Returns `null` on the server, where there is no window — which is also what
 * makes the control render the same on the first frame either way.
 */
export const readInjectedProvider = (): Eip1193Provider | null => {
  if (typeof window === "undefined") return null;

  const injected = (window as { ethereum?: unknown }).ethereum;
  if (typeof injected !== "object" || injected === null) return null;

  return typeof (injected as { request?: unknown }).request === "function"
    ? (injected as Eip1193Provider)
    : null;
};

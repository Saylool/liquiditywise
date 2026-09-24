/*
 * Reads what an answer cost as it streams past, without touching the stream.
 *
 * The provider reports token counts on the finished response that arrives
 * with the last event. Rather than thread them through every layer between
 * the transport and the page, the stream is watched on its way in and the
 * counts handed to whoever wants them — once, when the stream ends, whether
 * the answer that came with them passed its checks or not: the tokens were
 * spent either way.
 */

export type TokenUsage = { readonly inputTokens: number; readonly outputTokens: number };

type WithUsage = {
  readonly response?: {
    readonly usage?: { readonly input_tokens?: unknown; readonly output_tokens?: unknown } | null;
  } | null;
};

const tokens = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

export const usageOf = (event: WithUsage): TokenUsage | null => {
  const usage = event.response?.usage;
  const inputTokens = tokens(usage?.input_tokens);
  const outputTokens = tokens(usage?.output_tokens);
  return inputTokens === null || outputTokens === null ? null : { inputTokens, outputTokens };
};

/**
 * The same events, in the same order, with `onUsage` told the last counts seen
 * once iteration stops — at the end, or early if the reader of the stream
 * stops early. Nothing is reported for a stream that never carried any.
 */
export async function* observeUsage<Event extends object>(
  stream: AsyncIterable<Event>,
  onUsage: (usage: TokenUsage) => void,
): AsyncIterable<Event> {
  let last: TokenUsage | null = null;
  try {
    for await (const event of stream) {
      // Read structurally: the caller's own event type need not declare `usage`.
      last = usageOf(event as WithUsage) ?? last;
      yield event;
    }
  } finally {
    if (last !== null) onUsage(last);
  }
}

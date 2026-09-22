/*
 * Whether to spend 3.2MB of somebody's connection on a decoration.
 *
 * The hero's scroll effect is a video, and it is exactly that: an effect. The
 * page says everything it has to say without it, and the still image behind
 * it is what a reader actually sees first. So the question is not whether the
 * video is nice — it is whether this visitor should be made to pay for it.
 *
 * Phones and reduced-motion are already excluded by media queries in the
 * component. This is the other half: a connection that has said it is slow,
 * or a reader who has asked their browser to save data. Both are things the
 * browser will tell us if we ask, and neither is a guess about them.
 *
 * Pure, and it takes the reading rather than the navigator, so the decision
 * is a test rather than a thing that only happens on someone else's phone.
 */

/** The part of `navigator.connection` this decision uses. Absent in Safari. */
export type ConnectionReading = {
  /** True when the reader has turned on their browser's data saver. */
  readonly saveData?: boolean | undefined;
  /** The browser's own estimate: "slow-2g" | "2g" | "3g" | "4g". */
  readonly effectiveType?: string | undefined;
};

/**
 * Connections too slow to spend three megabytes on.
 *
 * "3g" is included deliberately. The browser reports it for anything it
 * estimates under about 700kbps, where 3.2MB is the better part of a minute
 * — long enough that the effect would arrive after the reader had scrolled
 * past the thing it decorates.
 */
const TOO_SLOW = new Set(["slow-2g", "2g", "3g"]);

/**
 * `undefined` is a browser that does not answer — Safari and every Firefox.
 * That is not a slow connection and must not be read as one: refusing the
 * video for everyone who cannot be measured would turn a courtesy into a
 * silent downgrade for a third of the web.
 */
export const shouldLoadHeroVideo = (connection: ConnectionReading | undefined): boolean => {
  if (connection === undefined) return true;
  if (connection.saveData === true) return false;

  return !TOO_SLOW.has(connection.effectiveType ?? "");
};

/**
 * Reads `navigator.connection` without claiming it exists.
 *
 * It is not in the DOM types and not in every browser, so this takes an
 * `unknown` and proves what it finds rather than asserting it. A value of the
 * wrong shape becomes `undefined` — the same answer as a browser that does
 * not implement it, which is the answer that keeps the video.
 */
export const readConnection = (navigatorLike: unknown): ConnectionReading | undefined => {
  const candidate = (navigatorLike as { connection?: unknown } | null | undefined)?.connection;
  if (typeof candidate !== "object" || candidate === null) return undefined;

  const { saveData, effectiveType } = candidate as ConnectionReading;

  return {
    saveData: typeof saveData === "boolean" ? saveData : undefined,
    effectiveType: typeof effectiveType === "string" ? effectiveType : undefined,
  };
};

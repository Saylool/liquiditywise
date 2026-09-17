"use client";

import { ErrorScreen } from "../components/ErrorScreen";
import { useErrorCopy } from "../components/ErrorCopyProvider";

/**
 * The boundary the framework renders when something below the layout throws.
 *
 * Its own answer is an English screen with no way back, which on a site
 * published in two languages is the same failure the missing-page screen had
 * until this week — and a worse moment to have it, because this one only appears
 * when something has already gone wrong.
 *
 * All this file does is find the reader's language and hand it on. Nothing is
 * logged from here: the framework already records the failure on the server
 * under the identifier the screen shows, the browser already reports it to the
 * console, and a third copy written by hand would only be a third place for a
 * message this page is not allowed to publish to escape from.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  /** Re-fetches and re-renders what threw. This is `retry`, not the older `reset`. */
  retry: () => void;
}) {
  return (
    <ErrorScreen copy={useErrorCopy()} digest={error.digest ?? null} onRetry={retry} />
  );
}

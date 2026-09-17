"use client";

import { createContext, useContext } from "react";

import { ERROR_COPY, type ErrorCopy } from "../lib/i18n/errorCopy";
import { DEFAULT_LOCALE } from "../lib/i18n/locales";

/*
 * How the reader's language reaches the error boundary.
 *
 * Every other page in this application asks the request which language to
 * render in. An error boundary cannot: the framework requires it to be a Client
 * Component, and a Client Component has no request to ask. The three ways out
 * are all worse than this one — reading the cookie in the browser shows a
 * Turkish reader a flash of English while the effect runs, importing the
 * dictionary ships both languages of every string to every visitor, and giving
 * up means the one screen that appears when something has gone wrong is the one
 * screen that forgets who it is talking to.
 *
 * So the layout, which *is* a Server Component and already knows the language,
 * renders this provider around everything and hands the boundary its sentences
 * as ordinary data. Ten strings travel; nothing is read in the browser; there is
 * no second render to correct the first.
 *
 * The default is English rather than `null` on purpose. A context with no
 * provider is unreachable here — the root layout renders one around every
 * route — and a branch for it would be a branch no test could ever enter.
 */
const ErrorCopyContext = createContext<ErrorCopy>(ERROR_COPY[DEFAULT_LOCALE]);

export function ErrorCopyProvider({
  copy,
  children,
}: {
  copy: ErrorCopy;
  children: React.ReactNode;
}) {
  return <ErrorCopyContext value={copy}>{children}</ErrorCopyContext>;
}

/** The error screen's sentences, in the language the server chose. */
export const useErrorCopy = (): ErrorCopy => useContext(ErrorCopyContext);

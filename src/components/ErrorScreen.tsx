"use client";

import Link from "next/link";

import type { ErrorCopy } from "../lib/i18n/errorCopy";

/**
 * The screen itself, with nothing of the framework in it.
 *
 * Separate from the boundary next door for the same reason a section that reads
 * data is separate from the component that draws it: the boundary's job is to
 * be a Client Component the framework recognises and to fetch the reader's
 * language out of context, and this one's is to say something. The split also
 * makes the screen a plain function of its arguments — no hooks — which is what
 * lets a test call it and check that the button is wired to the thing it says
 * it is wired to.
 *
 * It says three things, in this order, because that is the order they are
 * wanted in: what happened, that it is worth trying again, and that nothing of
 * the reader's was involved. The last is not reassurance for its own sake. This
 * application holds no account and stores nothing anybody looks up, and a screen
 * that says "something went wrong" without saying so invites a reader to wonder
 * what it lost.
 */
export function ErrorScreen({
  copy,
  digest,
  onRetry,
}: {
  copy: ErrorCopy;
  /**
   * The framework's hash of the failure, when it produced one. Never the error's
   * message: in production that is replaced before it reaches the browser
   * precisely so a server's internals cannot be read off an error page, and this
   * screen does not render it in development either.
   */
  digest: string | null;
  onRetry: () => void;
}) {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12 sm:py-16">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed">{copy.body}</p>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">{copy.nothingKept}</p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium"
          >
            {copy.retry}
          </button>
          <Link
            href="/"
            prefetch={false}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium"
          >
            {copy.home}
          </Link>
        </div>

        {/*
         * Only when the framework produced one. It is a hash of the failure, so
         * it distinguishes the same fault happening twice from two different
         * faults, and it carries nothing about the reader or the server.
         */}
        {digest === null ? null : (
          <p className="flex flex-col gap-1 text-xs leading-relaxed text-muted">
            <span className="font-mono">
              {copy.referenceLabel}: {digest}
            </span>
            <span>{copy.referenceNote}</span>
          </p>
        )}
      </section>
    </main>
  );
}

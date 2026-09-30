import Link from "next/link";

import type { BriefId, LearnCopy } from "../lib/learn/briefs";
import { ArrowIcon } from "./BrandMark";

/**
 * The quick guide's seven briefs, each a card with its three sentences, and the
 * two ways on from it: a real pool, where every brief can be seen on data, and
 * the hook directory.
 *
 * Each card is an anchor, so a brief can be linked to on its own, and its
 * title leads to the brief's own page.
 */
export function QuickGuide({
  copy,
  pools,
  hooks,
  topicHref,
}: {
  copy: LearnCopy;
  /** Each brief's own page, in the reader's language. */
  topicHref: (id: BriefId) => string;
  pools: { readonly href: string; readonly label: string };
  hooks: { readonly href: string; readonly label: string };
}) {
  return (
    <>
      <p className="max-w-2xl text-sm leading-relaxed text-muted">{copy.intro}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {copy.briefs.map(({ id, title, points }) => (
          <article key={id} id={id} className="scroll-mt-24 rounded-xl border border-border bg-surface p-5">
            <h2 className="text-base font-semibold">
              <Link href={topicHref(id)} prefetch={false} className="hover:text-accent">
                {title}
              </Link>
            </h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 ps-5 text-sm leading-relaxed text-muted">
              {points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <p className="flex flex-wrap gap-x-8 gap-y-3">
        <Link href={pools.href} prefetch={false} className="text-link">
          {pools.label}
          <ArrowIcon />
        </Link>
        <Link href={hooks.href} prefetch={false} className="text-link">
          {hooks.label}
        </Link>
      </p>
    </>
  );
}

import Link from "next/link";

import type { Brief } from "../lib/learn/briefs";
import { ArrowIcon } from "./BrandMark";

/**
 * One quick-guide topic: the guide's three sentences, three more, the way on
 * to where the site shows it on real data, and the other six topics.
 */
export function LearnTopic({
  brief,
  more,
  others,
  otherTopics,
  onward,
}: {
  brief: Brief;
  more: readonly [string, string, string];
  others: readonly { readonly href: string; readonly title: string }[];
  otherTopics: string;
  onward: { readonly href: string; readonly label: string };
}) {
  return (
    <>
      <article className="flex max-w-2xl flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        {[...brief.points, ...more].map((sentence) => (
          <p key={sentence} className="text-sm leading-relaxed">
            {sentence}
          </p>
        ))}
        <p>
          <Link href={onward.href} prefetch={false} className="text-link text-sm">
            {onward.label}
            <ArrowIcon />
          </Link>
        </p>
      </article>

      <nav aria-label={otherTopics} className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">{otherTopics}</h2>
        <ul className="flex flex-wrap gap-2">
          {others.map(({ href, title }) => (
            <li key={href}>
              <Link
                href={href}
                prefetch={false}
                className="inline-block rounded-full border border-border px-3 py-1 text-xs text-muted hover:text-foreground"
              >
                {title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

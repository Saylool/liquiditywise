import Link from "next/link";

import type { AboutCopy } from "../lib/i18n/aboutCopy";
import { ArrowIcon } from "./BrandMark";

/**
 * What the project is, what it will not do, and the plain facts in one place.
 * Static: it reads nothing, so it is the same page for everybody.
 */
export function AboutPage({
  copy,
  links,
}: {
  copy: AboutCopy;
  links: {
    readonly pools: string;
    readonly smart: string;
    readonly guide: string;
    /** How every figure is made, under the words that page is linked by everywhere. */
    readonly method: { readonly href: string; readonly label: string };
  };
}) {
  return (
    <>
      <p className="max-w-2xl text-base leading-relaxed text-muted">{copy.lead}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {copy.points.map(({ title, body }) => (
          <article key={title} className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          </article>
        ))}
      </div>

      <section className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-base font-semibold">{copy.limitsHeading}</h2>
        <ul className="flex list-disc flex-col gap-2 ps-5 text-sm leading-relaxed text-muted">
          {copy.limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </section>

      <section className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-base font-semibold">{copy.factsHeading}</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm leading-relaxed sm:grid-cols-[10rem_1fr]">
          {copy.facts.map(({ label, value }) => (
            <div key={label} className="contents">
              <dt className="font-medium">{label}</dt>
              <dd className="min-w-0 text-muted">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{copy.tryHeading}</h2>
        <p className="flex flex-wrap gap-x-8 gap-y-3">
          <Link href={links.pools} prefetch={false} className="text-link">
            {copy.tryLinks.pools}
            <ArrowIcon />
          </Link>
          <Link href={links.smart} prefetch={false} className="text-link">
            {copy.tryLinks.smart}
          </Link>
          <Link href={links.guide} prefetch={false} className="text-link">
            {copy.tryLinks.guide}
          </Link>
          <Link href={links.method.href} prefetch={false} className="text-link">
            {links.method.label}
          </Link>
        </p>
      </section>
    </>
  );
}

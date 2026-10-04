import Link from "next/link";
import type { ReactNode } from "react";

import { DEFAULT_PRICE_BAND_PARAMETERS } from "../lib/advisor/poolRangeAnalysis";
import { CHAINS } from "../lib/chains/chains";
import {
  CARD_HEADERS,
  DATA_HEADERS,
  EMBED_FIELDS,
  EMBED_PARAMETERS,
  EMBED_STATUSES,
  EXAMPLE_CURL,
  EXAMPLE_FETCH,
  EXAMPLE_RESPONSE,
  EXAMPLE_SNIPPET,
  headerLines,
} from "../lib/embed/embedDocs";
import { EMBED_FRAME_WIDTH, embedFrameHeight } from "../lib/embed/embedLinks";
import { EMBED_TTL_SECONDS, NOT_A_POOL_TTL_SECONDS, UNREADABLE_TTL_SECONDS } from "../lib/embed/embedResponses";
import { MEASURED_DAYS } from "../lib/embed/poolEmbed";
import { formatMultiplier, formatWhole } from "../lib/format/displayFormats";
import { DEVELOPERS_SECTION_IDS, type DevelopersCopy, type DevelopersFigures } from "../lib/i18n/developersCopy";
import { getEmbedCopy } from "../lib/i18n/embedCopy";
import { LOCALE_DETAILS, LOCALES, type Locale } from "../lib/i18n/locales";
import { getMethodCopy } from "../lib/i18n/methodCopy";
import { POOL_ANALYSIS_REQUEST_LIMIT, POOL_ANALYSIS_WINDOW_MS } from "../lib/ratelimit/poolAnalysisRateLimiter";
import { LICENSE_URL, REPOSITORY_URL } from "../lib/site/repository";

/**
 * What another site can build on — the embeddable pool card and its JSON —
 * for the person writing the code. Static: it reads nothing, so it is the
 * same page for everybody and costs nothing to render.
 *
 * Nothing on it is written beside the code. The figures in the prose come
 * from the constants the routes and the proxy use; the field list, the
 * parameters, the statuses, the headers and every code sample come from
 * embed/embedDocs.ts, which builds them from the same modules or is held to
 * them by a test. Only the sentences around them are translated.
 *
 * Code is set in monospace, left to right in every language, and is never
 * translated by a browser. A block of it scrolls inside itself rather than
 * widening the page — the document clips what overflows it, so a line too
 * long for a phone would otherwise simply vanish — and one click selects the
 * whole block, which is how it is copied without a script.
 */

/** A list in the reader's own words: "Unichain", or "A and B" in whatever language. */
const list = (locale: Locale, items: readonly string[]): string =>
  new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items);

export const developerFigures = (locale: Locale): DevelopersFigures => ({
  limit: formatWhole(POOL_ANALYSIS_REQUEST_LIMIT, locale),
  windowSeconds: formatWhole(POOL_ANALYSIS_WINDOW_MS / 1000, locale),
  keptSeconds: formatWhole(EMBED_TTL_SECONDS, locale),
  unreadableSeconds: formatWhole(UNREADABLE_TTL_SECONDS, locale),
  notAPoolSeconds: formatWhole(NOT_A_POOL_TTL_SECONDS, locale),
  frameWidth: formatWhole(EMBED_FRAME_WIDTH, locale),
  frameHeight: formatWhole(embedFrameHeight(false), locale),
  frameHeightHook: formatWhole(embedFrameHeight(true), locale),
  defaultHorizon: formatWhole(DEFAULT_PRICE_BAND_PARAMETERS.horizonDays, locale),
  defaultMultiplier: `${formatMultiplier(DEFAULT_PRICE_BAND_PARAMETERS.standardDeviationMultiplier, locale)}σ`,
  measuredDays: formatWhole(MEASURED_DAYS, locale),
  languages: formatWhole(LOCALES.length, locale),
  v4OnlyChains: list(locale, CHAINS.filter(({ v3 }) => !v3).map(({ name }) => name)),
  embedSummary: getEmbedCopy(locale).summary,
  analysedBy: getEmbedCopy(locale).analysedBy,
  methodLink: getMethodCopy(locale).link,
});

/** Inline code, wherever it sits in a sentence: left to right, and free to break where a phone needs it to. */
const INLINE_CODE = "rounded bg-surface-sunken px-1 font-mono text-[0.92em] text-foreground [overflow-wrap:anywhere]";

/** A sentence with its `code` set as code. Every backtick pair in the copy is one piece of code. */
const prose = (text: string): ReactNode[] =>
  text.split("`").map((part, index) =>
    index % 2 === 1 ? (
      <code key={index} dir="ltr" translate="no" className={INLINE_CODE}>
        {part}
      </code>
    ) : (
      part
    ),
  );

/** A block of code: scrolls inside itself, and one click selects all of it. */
function CodeBlock({ code, caption }: { code: string; caption?: string }) {
  return (
    <figure className="flex min-w-0 max-w-full flex-col gap-2">
      {caption === undefined ? null : <figcaption className="text-sm leading-relaxed text-muted">{prose(caption)}</figcaption>}
      <pre
        tabIndex={0}
        dir="ltr"
        translate="no"
        className="scroll-hint min-w-0 max-w-full select-all overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-xs leading-relaxed text-foreground"
      >
        <code>{code}</code>
      </pre>
    </figure>
  );
}

function Paragraphs({ texts }: { texts: readonly string[] }) {
  return (
    <>
      {texts.map((text) => (
        <p key={text} className="text-sm leading-relaxed text-muted">
          {prose(text)}
        </p>
      ))}
    </>
  );
}

const SECTION = "flex min-w-0 max-w-2xl scroll-mt-24 flex-col gap-3";
const LABEL = "text-xs font-semibold uppercase tracking-widest text-muted";

type PageLink = { readonly href: string; readonly label: string };

export function DevelopersPage({
  copy,
  locale,
  links,
}: {
  copy: DevelopersCopy;
  locale: Locale;
  /** How every figure is made, under the words that page is linked by everywhere. */
  links: { readonly method: PageLink };
}) {
  const figures = developerFigures(locale);
  const parameters = copy.parameters(figures);
  const fields = copy.fields(figures);
  const statuses = copy.statuses(figures);
  const heading = (id: (typeof DEVELOPERS_SECTION_IDS)[number]) => (
    <h2 className="text-base font-semibold">{copy.sections[id]}</h2>
  );

  return (
    <>
      <p className="max-w-2xl text-base leading-relaxed text-muted">{copy.lead}</p>

      <nav aria-labelledby="developers-contents" className="flex max-w-2xl flex-col gap-3">
        <h2 id="developers-contents" className="text-base font-semibold">
          {copy.contentsHeading}
        </h2>
        <ol className="flex list-decimal flex-col gap-1 ps-5 text-sm leading-relaxed">
          {DEVELOPERS_SECTION_IDS.map((id) => (
            <li key={id}>
              <a href={`#${id}`} className="text-link">
                {copy.sections[id]}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <section id="card" className={SECTION}>
        {heading("card")}
        <Paragraphs texts={copy.card(figures)} />
        <CodeBlock caption={copy.snippetLabel} code={EXAMPLE_SNIPPET} />
        <CodeBlock caption={copy.cardHeadersLabel} code={headerLines(CARD_HEADERS)} />
      </section>

      <section id="parameters" className={SECTION}>
        {heading("parameters")}
        <Paragraphs texts={copy.parametersIntro(figures)} />
        <dl className="flex flex-col gap-4">
          {EMBED_PARAMETERS.map((name) => (
            <div key={name} className="flex min-w-0 flex-col gap-1 border-s-2 border-border ps-4">
              <dt>
                <code dir="ltr" translate="no" className="font-mono text-sm font-semibold">
                  {name}
                </code>
              </dt>
              <dd className="text-sm leading-relaxed text-muted">
                <span className={LABEL}>{copy.acceptsLabel}</span> {prose(parameters[name].accepts)}
              </dd>
              <dd className="text-sm leading-relaxed text-muted">
                <span className={LABEL}>{copy.otherwiseLabel}</span> {prose(parameters[name].otherwise)}
              </dd>
            </div>
          ))}
        </dl>

        <p className="text-sm leading-relaxed text-muted">{prose(copy.chainsCaption)}</p>
        <div className="scroll-hint min-w-0 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th scope="col" className="pe-4 text-start">
                  <code dir="ltr" translate="no">
                    chain
                  </code>
                </th>
                <th scope="col" className="pe-4 text-start">
                  {copy.chainColumns.network}
                </th>
                <th scope="col" className="pe-4 text-start">
                  {copy.chainColumns.v3}
                </th>
                <th scope="col" className="text-start">
                  {copy.chainColumns.v4}
                </th>
              </tr>
            </thead>
            <tbody>
              {CHAINS.map((chain) => (
                <tr key={chain.slug} className="border-b border-border last:border-b-0">
                  <td className="pe-4">
                    <code dir="ltr" translate="no" className="font-mono">
                      {chain.slug}
                    </code>
                  </td>
                  <td className="pe-4">{chain.name}</td>
                  <td className="pe-4 text-muted">{chain.v3 ? copy.read : copy.notRead}</td>
                  <td className="text-muted">{chain.v4 ? copy.read : copy.notRead}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm leading-relaxed text-muted">{prose(copy.languagesCaption)}</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {LOCALES.map((code) => (
            <li key={code} className="flex items-baseline gap-2">
              <code dir="ltr" translate="no" className="font-mono">
                {code}
              </code>
              <span lang={code} dir={LOCALE_DETAILS[code].direction} className="text-muted">
                {LOCALE_DETAILS[code].name}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section id="json" className={SECTION}>
        {heading("json")}
        <Paragraphs texts={copy.json(figures)} />
        <CodeBlock caption={copy.dataHeadersLabel} code={headerLines(DATA_HEADERS)} />

        <p className="text-sm leading-relaxed text-muted">{prose(copy.fieldsCaption)}</p>
        <dl className="flex flex-col rounded-lg border border-border">
          {EMBED_FIELDS.map(({ path, type }) => (
            <div key={path} className="flex min-w-0 flex-col gap-1 border-b border-border px-4 py-3 last:border-b-0">
              <dt className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1" dir="ltr">
                <code translate="no" className="font-mono text-sm font-semibold [overflow-wrap:anywhere]">
                  {path}
                </code>
                <code translate="no" className="font-mono text-xs text-muted">
                  {type}
                </code>
              </dt>
              <dd className="text-sm leading-relaxed text-muted">{prose(fields[path])}</dd>
            </div>
          ))}
        </dl>

        <CodeBlock caption={copy.exampleCaption} code={JSON.stringify(EXAMPLE_RESPONSE, null, 2)} />
      </section>

      <section id="errors" className={SECTION}>
        {heading("errors")}
        <Paragraphs texts={copy.errors(figures)} />
        <p className="text-sm leading-relaxed text-muted">{prose(copy.bodyLabel)}</p>
        {EMBED_STATUSES.map((status) => (
          <div key={status.kind} className="flex min-w-0 flex-col gap-2">
            <h3 className="text-sm font-semibold">
              <code dir="ltr" translate="no" className="font-mono">
                {status.error === null ? status.status : `${status.status} ${status.error}`}
              </code>
            </h3>
            <p className="text-sm leading-relaxed text-muted">{prose(statuses[status.kind])}</p>
            <CodeBlock
              code={[
                headerLines([["Cache-Control", status.cacheControl], ...status.headers]),
                ...(status.body === null ? [] : ["", JSON.stringify(status.body, null, 2)]),
              ].join("\n")}
            />
          </div>
        ))}
      </section>

      <section id="caching" className={SECTION}>
        {heading("caching")}
        <Paragraphs texts={copy.caching(figures)} />
      </section>

      <section id="examples" className={SECTION}>
        {heading("examples")}
        <CodeBlock caption={copy.examples.curl} code={EXAMPLE_CURL} />
        <CodeBlock caption={copy.examples.fetch} code={EXAMPLE_FETCH} />
        <CodeBlock caption={copy.examples.iframe} code={EXAMPLE_SNIPPET} />
        <p className="text-xs leading-relaxed text-muted">{copy.examples.selectHint}</p>
      </section>

      <section id="terms" className={SECTION}>
        {heading("terms")}
        <Paragraphs texts={copy.terms(figures)} />
        <p className="flex flex-wrap gap-x-8 gap-y-3">
          <Link href={links.method.href} prefetch={false} className="text-link">
            {links.method.label}
          </Link>
          <a href={REPOSITORY_URL} rel="noopener" className="text-link">
            {copy.links.code}
          </a>
          <a href={LICENSE_URL} rel="noopener" className="text-link">
            {copy.links.licence}
          </a>
        </p>
      </section>
    </>
  );
}

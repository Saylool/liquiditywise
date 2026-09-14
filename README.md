# Uniswap Strategy Advisor

An educational, AI-assisted decision-support tool for Uniswap v3 and v4 liquidity
strategies. Users describe a goal in plain language; the application explains the
relevant Uniswap features and parameters.

**This is not financial advice.** The application does not predict prices, does
not guarantee returns, and cannot attest that any smart contract is safe.

## Status

Early, but no longer only a library. The pool page runs the whole pipeline
against live data: find a pool by pair or address, read its verified figures, and
read a plain-language explanation written from them by a model that is not
allowed to state one. There is no persistence, authentication, wallet connection
or transaction capability of any kind, and none is planned.

Four read-only market-data adapters exist, all server-only readers over The
Graph:

1. **Current pool snapshot** — one Ethereum mainnet Uniswap v3 pool, normalised
   into a `PoolMarketSnapshot`.
2. **Pool metadata** — a pool's fixed configuration: verified token ordering,
   token `decimals`, symbols and fee tier, normalised into a `V3PoolMetadata`.
   Read separately because the snapshot does not carry it, and it is what any
   price/decimal conversion needs first.
3. **Daily price history** — the previous 31 *completed* UTC days of closing
   prices for one such pool, normalised into a `PoolDailyPriceHistory`. 31 closes
   give 30 daily returns, which is what a 30-day volatility figure needs. The
   current, still-incomplete UTC day is always excluded.
4. **Pool search** — the pools whose token symbols match one or two terms,
   normalised into a `PoolSearchResults` and ordered by this application rather
   than by the source. See [Finding a pool](#finding-a-pool).

Days the source never indexed are reported as gaps, never invented. There is no
forward-filling of a previous close and no treating a missing day as zero, so a
short series stays visibly short rather than looking complete.

A first deterministic analytics layer sits on top of that history: daily
close-to-close log returns and historical volatility. It is pure — no clock, no
network, no environment — so the same input always yields the same output. A
return is only computed between observations exactly one UTC day apart; a pair
straddling a missing day is skipped rather than rescaled into a daily figure, and
the result reports how much of the window it could actually use. Volatility is the
sample standard deviation (divisor `n - 1`) of those log returns, annualised by
`sqrt(365)` because crypto markets trade every calendar day. Figures are decimal
ratios, not percentages.

On top of that sits a deterministic continuous **price band**: a zero-drift,
log-symmetric range around the current pool price, scaled from historical
volatility by `sqrt(horizonDays / 365)` and a caller-supplied standard-deviation
multiplier. Because it is symmetric in log space it is deliberately asymmetric in
percentage terms — a band that reaches half price downward reaches double price
upward, and only one of those is "50%".

A band is **not a prediction and not a probability guarantee**. The multiplier is
not a confidence level: calling `2` a "95% band" would need a distributional
assumption this project does not establish. Zero volatility collapses the band
onto the current price rather than inventing a minimum width.

A band is a statement about *prices*, not about ticks. Turning one into position
boundaries needs three verified inputs: token ordering, token decimals, and the
pool's tick spacing. The metadata adapter supplies the first two.

**Tick spacing cannot come from a subgraph.** It appears nowhere in the official
Uniswap v3 subgraph schema — not on `Pool`, not on `Factory`, not in the tokens
subgraph. Deriving it from the fee tier would mean hardcoding a tier-to-spacing
table, which this project refuses because governance can enable nonstandard tiers
with their own spacing. So it is read directly from the pool contract with a
read-only `eth_call` to `tickSpacing()`, and `fetchEthereumV3Pool` combines that
with the subgraph metadata into a complete `V3Pool`.

That gives tick conversion all three inputs it needs, and the conversion itself
now exists as a pure module (`src/lib/uniswap/v3TickMath.ts`): a human price maps
to the tick at or below it and to the tick at or above it, a tick maps back to a
price, and a tick rounds to a boundary the pool will accept.

Two details there are worth stating, because getting either wrong yields a number
that looks perfectly ordinary. First, a tick encodes `1.0001^t` as token1 per
token0 in *raw* units, so a human price must be shifted by
`10^(token1Decimals - token0Decimals)` before the logarithm — omit it and a
USDC/WETH range lands twelve orders of magnitude away from the pool. Second,
alignment folds the remainder into `[0, tickSpacing)` before subtracting it,
because JavaScript's `%` truncates toward zero and would round negative ticks the
wrong way; most pools holding a 6-decimal token as token0 sit entirely in negative
ticks.

Alignment always returns a tick a pool accepts: a multiple of the spacing, inside
a range that is *narrower* than `MIN_TICK`/`MAX_TICK`, since ±887272 is only a
multiple of the spacing when the spacing is 1 — for the 0.30% tier the real floor
is -887220. A price outside TickMath's range comes back clamped with the bound it
hit named, so a truncated range can never be mistaken for a requested one.

On top of both sits the composition: `calculateV3TickRange` takes a price band, a
`V3Pool` and the snapshot the band was centred on, and produces a **`V3TickRange`**
— two ticks the pool would accept. Each edge moves *outward* only, so the range
always covers at least the band it came from; rounding inward would quietly hand
back a narrower position while still looking like the band's range.

It is still not a position. Nothing here sizes a deposit, quotes an amount of
either token, or claims the range is a good one.

**The range is checked against the chain's own tick.** The subgraph publishes both
the pool's `tick` and its price, so converting that price with the metadata
adapter's decimals must land on that tick. Nothing else in the application can
tell that a pool's decimals are wrong — every downstream figure stays perfectly
well-formed — so when the two disagree by more than one tick, no range is
published at all. A source that reports no tick still produces a range, with a
warning saying the conversion went unverified.

Three more states are reported rather than smoothed over:

- An edge that runs past what the pool can express is **truncated** to the
  outermost usable tick and flagged, so a shortened range is never mistaken for
  the one that was asked for.
- A band narrower than one tick spacing has no two distinct boundaries. It is
  refused, not widened — widening would invent a range the band never described,
  and whether to accept a wider one is a policy decision for a layer that can say
  so out loud.
- A current tick outside the resulting range is flagged, because a position built
  there would hold a single token and earn nothing until price returns.

The `V3TickRange` schema re-derives every price from its tick by direct
exponentiation, where the calculator works in log space, and pins each boundary to
exactly one tick by requiring both that it covers the band and that the next tick
inward does not. A validator that re-ran the calculator's own expression would
reproduce its bugs and agree with itself.

All of it is now wired into one page. `/pool` takes a pool address, runs the three
reads concurrently, and works them through volatility, band and range to a pair of
ticks. It is a Server Component, so the credentials the readers need never enter a
browser bundle, and the address arrives as a search parameter rather than a path
segment so the form that submits it can be plain HTML with no client JavaScript.

The pipeline reports **which stage** stopped when one does, so a pool with two days
of history, a pool behind an unreachable subgraph, and a missing API key are three
distinguishable outcomes rather than one blank screen.

**No pool address is hardcoded anywhere.** Shipping one would mean asserting from
memory which contract a pair lives at, and an address this application cannot
verify has no place in its UI.

`/pool` is rate limited, because every analysed pool costs four upstream calls —
three subgraph queries and one `eth_call` — and the page is public. `src/proxy.ts`
allows **10 analyses per minute per client** and answers the rest with a real
`429` and a `Retry-After`, before rendering begins. Only a request carrying a
well-formed address is counted: a missing or malformed one is answered without a
single upstream call, so a typo never costs an analysis.

Two limits of that, stated rather than papered over:

- **The count lives in one process's memory.** A platform running several
  instances multiplies the effective limit by however many are warm. This is a
  deterrent against casual abuse, not a hard ceiling; a hard ceiling needs a store
  the instances share.
- **A caller is identified by proxy-set headers** (`x-real-ip`, then the leftmost
  `x-forwarded-for`). That is trustworthy behind a proxy that writes them itself,
  as Vercel does, and worthless anywhere a client's own headers pass through
  untouched. Running locally neither header exists and every request shares one
  bucket — the safe direction to fail.

## Finding a pool

Nobody carries pool addresses around, so the pool page takes either: a pair like
`WETH/USDC`, or the address of the pool contract itself. One box decides which by
looking at what arrived — an address is redirected to the canonical `?address=`
URL that every result links to, so there stays exactly one URL meaning "analyse
this pool". A plain GET form, so it works with no JavaScript and a search lands
somewhere that can be linked, reloaded and gone back to.

**Search is the first free text this application accepts.** Until it existed, the
only thing a visitor could supply was a pool address, matched against a strict
hex pattern before any read happened. A search box brings two kinds of text that
were not there before:

- **What the visitor typed.** It reaches the subgraph as a GraphQL variable and
  is never spliced into query text, so a query is well-formed whatever it holds;
  the rules on it are there because it is also *shown back* on the page. Letters
  in any script, digits, and the three punctuation marks that turn up inside
  tickers — one or two terms, two to sixteen characters each.
- **Token symbols nobody went looking for.** A symbol is whatever a contract's
  `symbol()` returns, and deploying a token that calls itself USDC costs nothing;
  the live source returns several. Those strings are rendered beside verified
  figures and reach the prompt the explanation is written from, so a token label
  may not carry Unicode's "other" category: the newline that would open what
  reads as a new line of that prompt, the zero-width characters that make two
  different symbols render identically, the bidirectional override that displays
  text in an order it was not written in.

**The order is the only claim the list makes**, and it is not about quality.
Pools whose token is exactly what was searched for come first; within that, the
value the source reports as locked in each pool. There is no score, no badge, no
"verified" mark and no list of tokens this application has decided are the real
ones — it cannot tell which USDC is genuine, and a mark implying otherwise would
be worse than none. What it does instead is show every token's contract address,
in full, under every pair. A truncated address is exactly what a lookalike hides
behind.

The relevance half of that order is not decoration. The source matches on a
substring, which is what makes a search for "weth" find "WETH" — and also what
returns WPOWETH, MeWETH, and a pool of "ease.org" against "ez-SLP-WBTC-WETH".
Ordered by reported liquidity alone, that last one was the top result for "weth",
on the strength of a 1.3-billion-dollar figure the source derives and plainly got
wrong. Both halves of the key are re-derived by the schema on the way out, so a
merge that went wrong fails instead of publishing a plausible-looking list.

**A list is the one place a single bad entry need not sink the answer.**
Everywhere else a visitor asked about one pool and the only honest replies were
that pool or nothing; here they asked which pools these are, and eleven verified
answers plus one dropped is a true, shorter reply. The dropped one is not quiet
everywhere: the count reaches the server log, where someone can act on it.

**A search is charged against the same allowance as an analysis.** It spends an
upstream query like one, and it is the cheaper of the two to send in a loop — a
box that takes ordinary words is a larger invitation to do that than one that
took a 40-character address. `chargeableRequest.ts` holds that rule, apart from
the proxy that applies it, so it can be tested without a framework.

## The explanation

`getRangeInterpretation` hands one finished analysis to a model and gets back four
short paragraphs: what the range means, what happens if price leaves it, what the
volatility figure is saying, and what the analysis does not cover.

**The model produces no figures.** Every number a reader sees is rendered by the
interface from verified data; the prose refers to them — "the range shown above",
"the volatility figure" — and the output schema rejects any digit that is not one
of the protocol's own version names. This removes the most damaging failure
available to a language model here (quoting a number that is subtly wrong, in a
paragraph that reads as authoritative) by removing the opportunity rather than by
checking for it afterwards.

**The contract has nowhere to put advice.** No risk level, no confidence, no
recommendation, no score. A field the model can fill is a field the model will
fill. What the schema cannot enforce is tone, so that part is the prompt's job
and is not claimed as a guarantee.

The request is built from the analysis alone, rendered with the interface's own
formatters in the reader's language. Nothing a stranger wrote reaches it: the only
visitor input is a pool address, and it passed a strict hex pattern long before
any read happened — so there is no opening for an injected instruction to arrive
through the data.

**The provider is sent the shape, never the rules.** Two schemas describe the
interpretation: the real one, which carries the bounds, the fixed label and the
refusal of any digit, and a wire schema with none of that — just the field names
and that nothing else may appear. Providers differ in which JSON Schema keywords
they accept under a strict output format, and one they reject fails the entire
request; sending the rules would also buy nothing, since an answer is re-checked
on arrival either way. A compile-time test fails the build if the two schemas
ever name different fields.

An explanation that fails any of this is dropped. The figures were verified
without it and stand on their own — the page shows the analysis and reports that
no explanation is available.

**Anything directional is computed, not left to the model.** Which token the
price figures are quoted in, and which token a position is left holding at each
edge of the range, follow from the pool's token order and from the protocol.
Both are stated in the prompt as finished sentences. Asked to work them out
instead, the model got them right for one pool and backwards for the next: it
rendered a price quoted in WETH per USDC as "WETH başına USDC" — Turkish for the
opposite — and named the wrong token at both edges of a WETH/USDT range while
naming the right one for USDC/USDT. Three of the first four pools read carried a
reversed direction somewhere. This is the figures rule again: the deterministic
layer computes, the model interprets, and a fact this fixed has no business
being inferred.

**The prose has to say something about this pool.** Not writing a number is not
the same as saying nothing about it, and the first instruction was read as
though it were — four paragraphs that would have sat equally well under any
other pool. It now asks for the figures in words: whether the band is narrow or
wide, whether the current price sits nearer one edge, whether the pair has
barely moved.

**In Turkish the prose uses the interface's own words.** One deployment wrote
both "gas" and "gaz", both "geçici kayıp" and "impermanent loss", and
"yıllıklaştırılmış" in a paragraph sitting directly beneath a label reading
"Yıllıklandırılmış". The prompt now carries a short glossary for Turkish, which
in turn exposed a collision in the interface itself: "tick aralığı" named both
the tick spacing and the suggested range, one line apart. The spacing is now
"tick adımı".

**An explanation is reused when nothing it could legitimately say has changed.**
The key follows from the no-figures rule: because the model cannot quote a price,
a tick or a percentage, its prose does not depend on them — it refers to "the
range shown above", and that reference stays true whatever the number beside it
now says. So the key carries only what the prose is allowed to describe: the
pool, the two ticks, whether price is inside them, whether either edge was
truncated, which caveats apply, the horizon and multiplier, the language, the
model, and a digest of the standing instruction (so editing the prompt discards
everything written under the old wording). Keying on the figures instead would
look safer and be useless — the price moves every block, so every visit would
miss.

Measured on the pool page: **9.3s on the first visit, 0.3s on the next**, one
model call serving all of them. The figures are never cached; they are
recomputed and rendered fresh every time, and only the prose about them is
reused. Failures are not cached either — pinning a rate limit that has since
cleared would be worse than repeating a call that costs nothing.

Like every in-memory store here it is per-instance, so a platform running several
copies calls the model once per copy. That costs a little more than a shared
store and is wrong in no way: an entry is either valid or absent, never stale in
one place and fresh in another.

Model: **`gpt-5.6-terra`** by default, overridable with `OPENAI_MODEL`. The job is narrow, so a mid-tier
model is the deliberate choice; what keeps it safe is the contract, not the tier.

**`interpretationTransport.ts` is the only module that knows who the provider
is.** The contract, the prompt, the check on the way back and the composition
above them are provider-neutral, and the transport translates the provider's own
vocabulary — an incomplete response, a refusal block — into the two words the
verifier understands. Changing supplier is a change to that one file and the
dependency it imports.

## Language and theme

The interface is published in **English and Turkish**, and renders in the
reader's language on the first paint rather than correcting it after hydration.
An explicit choice is kept in a cookie and always wins; with no choice made, the
`Accept-Language` header decides. Switching is a plain `<form>` driven by a
Server Action, so it works with JavaScript disabled.

Numbers follow the language too — a Turkish reader sees `%0,30` and
`0,000333333`, not `0.30%`. The formatters still name their locale explicitly
and default to English, so a bare call can never quietly follow the *host's*
locale, which is the failure the pinning was there to prevent.

**Warnings and failure messages stay in English.** They are produced in the data
layer as fixed sentences — that fixedness is what makes identical input warn
identically — so translating them means turning them into codes the interface
resolves. That is a change to a layer verified line by line, and it is its own
phase rather than a detail of this one.

Theme has three states, not two: **System, Light, Dark**. System sets no
attribute and lets `prefers-color-scheme` keep deciding, including for a reader
with JavaScript off. An explicit choice lives in `localStorage`, not a cookie,
because a cookie would make changing a colour re-render the page — and on
`/pool` a re-render means reading a subgraph and making an `eth_call`, so
switching theme would spend API quota and a rate-limit slot. A small synchronous
script at the top of `<body>` applies the stored theme before anything paints;
without it, every navigation flashes light before turning dark.

The theme toggle is the application's **only Client Component**. Everything else,
including both switchers' markup, is still server-rendered.

Reading a cookie and a header makes a route dynamic, so the landing page is no
longer statically prerendered. That is the price of being correct on the first
paint, and it costs no upstream calls.

Still absent: no recommendation policy, no risk categories, no AI, no persistence
and no wallet connection.

Shared limits of both adapters:

- Ethereum mainnet (`chainId` 1) and Uniswap v3 only.
- One pool per call, by address.
- No wallet, transaction, signing or approval capability of any kind.
- Rolling 24h/7d/30d volume is **not** available in this phase. The pool entity
  exposes a lifetime cumulative total, which is not a rolling window, so those
  fields stay `null` and the call returns a `partial` result naming them. No
  figure is estimated to fill the gap.
- The subgraph alone cannot build a full `V3Pool`, because the pool entity does
  not report `tickSpacing`. `fetchEthereumV3Pool` adds it from the contract.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the three values below
npm run dev
```

Open http://localhost:3000, then follow **Analyse a pool** to `/pool` and paste an
Ethereum mainnet Uniswap v3 pool address — the pool contract's own address, not a
token's.

Without `.env.local` filled in, the page still renders: it reports a
`configuration-error` for the stage that needed a credential and makes no network
request.

Fonts are self-hosted from `src/app/fonts/` via `next/font/local`, so `next build`
makes no network request for them and works offline or behind a restrictive
proxy.

## Scripts

| Command             | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Development server                                 |
| `npm run build`     | Production build (also type-checks)                |
| `npm run start`     | Serve the production build                         |
| `npm test`          | Run the Vitest runtime regression suite once       |
| `npm run lint`      | ESLint                                             |
| `npm run typecheck` | Generate route types, then `tsc --noEmit`          |

`scripts/readLiveExplanations.spec.ts` runs real pools through the real prompt
and writes each explanation beside the facts it has to agree with — the quote
direction, the token held at each edge, how far price sits from each bound.
Everything else about the explanation is checkable without a network; whether
the sentences are any good is not. It skips unless pools are named, so `npm
test` stays hermetic:

```bash
NODE_USE_ENV_PROXY=1 TONE_POOLS=0x…,0x… TONE_LOCALES=tr,en \
  node --env-file=.env.local ./node_modules/vitest/vitest.mjs run \
  scripts/readLiveExplanations.spec.ts
```

`typecheck` runs `next typegen` first because the App Router type helpers
(`PageProps`, `LayoutProps`, `RouteContext`) are generated, not hand-written.
It also checks the persistent compile-time assertions in
`src/schemas/dataResult.type-test.ts`; those assertions are intentionally not
collected by Vitest as runtime tests.

## Architecture

The governing rule is that **the AI never invents market data and never performs
the important financial arithmetic**. The intended request flow is:

```
user input
  -> backend route handler
  -> fetch verified external data   (src/lib/uniswap)
  -> deterministic calculations     (src/lib/analytics)
  -> AI interpretation              (src/lib/ai)
  -> structured JSON response       (src/schemas)
  -> frontend presentation          (src/app, src/components)
```

### Directories

| Path                  | Contents                                                                    |
| --------------------- | --------------------------------------------------------------------------- |
| `src/app`             | App Router routes, layouts and route handlers.                              |
| `src/components`      | Presentational React components. No data fetching, no secrets.              |
| `src/lib/uniswap`     | One isolated service module per external source (v3 subgraph, v4 subgraph, JSON-RPC), plus pure Uniswap protocol math such as tick conversion. |
| `src/lib/analytics`   | Deterministic, dependency-free calculations: volatility, ranges, ratios.    |
| `src/lib/advisor`     | Composition: the pure pipeline from fetched data to a tick range, plus its server-only wrapper. |
| `src/lib/format`      | Deterministic display formatting. Locale-pinned so server-rendered output cannot vary by host. |
| `src/lib/observability` | Server-side diagnostics for failed reads. Records status codes, never URLs or headers. |
| `src/lib/ratelimit`   | Fixed-window request counter and the client key it counts against. Pure; the clock is injected. |
| `src/lib/search`      | What a visitor may search for, and how one raw string is taken apart. Pure. |
| `src/lib/i18n`        | Published languages, how one is negotiated, and every interface string in each. |
| `src/lib/theme`       | The three theme choices, the store behind the toggle, and the script that applies one before paint. |
| `src/lib/ai`          | The prompt layer, the one model call, the provider wiring, and the check the answer has to pass. |
| `src/lib/ai/prompts`  | One module per feature, composed on top of a shared base instruction module. |
| `src/schemas`         | The normalized domain contracts: Zod schemas plus the types inferred from them. |
| `src/types`           | Internal types with no runtime shape to validate, e.g. UI view models.      |
| `scripts`             | Developer tools that are not part of the application and not part of the suite. |

### Boundary rules

- External API shapes never reach components. Service modules normalise them
  into the domain contracts in `src/schemas` at the boundary, and the rest of
  the application only ever sees those.
- Domain types are inferred from their Zod schema (`z.infer`) rather than
  declared alongside it, so a schema and its type cannot drift apart.
- Every data-fetching module returns `DataResult<T>`, which distinguishes
  success, partial and unavailable. Missing financial metrics are `null`;
  `0` means a source reported zero.
- A failure message meant for a user never carries a credential, a URL containing
  one, a stack trace or a raw provider payload. The technical detail goes to a
  server-side log instead (`src/lib/observability`), which records an HTTP status,
  an elapsed time, a thrown error's *name* and the failure category — and never
  the request URL or its headers, because the RPC URL embeds its key in the path
  and the Graph key rides in an `Authorization` header. Tests assert those absences
  directly rather than trusting the code to have left them out.
- Fetch time and source freshness are separate fields. `fetchedAt` records when a
  response arrived; `sourceBlockNumber` / `sourceBlockTimestamp` record what it
  describes. A lagging indexer must never look fresh, so fetch time is never
  copied into the source-block fields.
- Protocol limits that differ between v3 and v4 (fee ceiling, tick spacing, whether
  the zero address is a valid currency) are validated per protocol variant, not by
  a shared permissive schema.
- Analytics functions stay pure and deterministic so their results are
  reproducible and testable without network access.
- Prompts are composed as `base + feature + user input + verified data`. There is
  no single prompt containing all application logic.
- Server-only modules (anything reading `process.env` or holding a credential)
  import `server-only` and are never re-exported through a barrel file, so a
  Client Component cannot reach a credential path by accident.
- Transport and normalisation stay pure and take an injected `fetch` and clock, so
  the whole flow is testable without the server-only wrapper and without network
  access.
- Missing or stale data returns an explicit missing-data state. The application
  must never substitute fabricated market values.

## Environment variables

All credentials are server-side. See `.env.example`. Never prefix a credential
with `NEXT_PUBLIC_` — that inlines it into the client bundle.

The v3 market-data readers need all three of:

| Variable | Purpose |
| --- | --- |
| `THE_GRAPH_API_KEY` | Sent only as an `Authorization: Bearer` header, never in a URL or body. |
| `UNISWAP_V3_ETHEREUM_SUBGRAPH_ID` | The stable **Subgraph ID** from The Graph Explorer — not a deployment/IPFS id. The gateway resolves it to the latest sufficiently synced deployment. |
| `ETHEREUM_RPC_URL` | Mainnet JSON-RPC endpoint for read-only `eth_call`. **Treat the whole URL as a secret** — most providers embed the key in the path. |

One more is optional:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Writes the plain-language explanation of an already-computed analysis. With it absent every figure is still computed and shown; only the prose is missing. |

Reads are read-only throughout: the RPC path issues `eth_call` and nothing else.
There is no signing, no account access, and no transaction capability anywhere in
the codebase.

With any of them absent or blank, the reader that needs it returns an
`unavailable` result with reason `configuration-error` and makes no network
request — so the page reports a configuration problem rather than a data one.

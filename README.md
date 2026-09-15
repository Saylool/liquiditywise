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
allowed to state one. A wallet can be connected, and the only thing asked of it
is its address — see [Connecting a wallet](#connecting-a-wallet). There is no
persistence, no authentication and no transaction capability of any kind, and
none of the last is planned.

Five read-only market-data adapters exist, all server-only readers over The
Graph:

1. **Current pool snapshot** — one Ethereum mainnet Uniswap v3 pool, normalised
   into a `PoolMarketSnapshot`.
2. **Pool metadata** — a pool's fixed configuration: verified token ordering,
   token `decimals`, symbols and fee tier, normalised into a `V3PoolMetadata`.
   Read separately because the snapshot does not carry it, and it is what any
   price/decimal conversion needs first.
3. **Daily price history** — the previous 121 *completed* UTC days of closing
   prices for one such pool, normalised into a `PoolDailyPriceHistory`. The
   current, still-incomplete UTC day is always excluded.

   Only the most recent 31 of those closes are *measured from*: 31 closes give 30
   daily returns, which is what a 30-day volatility figure needs, and the
   pipeline narrows the history to that window before measuring it. The older
   ninety days are fetched so a band can be fitted at a point in the past and
   checked against the days that actually followed — one request answers both
   questions, and the two windows cannot come from different readings of a moving
   market.
4. **Pool search** — the pools whose token symbols match one or two terms,
   normalised into a `PoolSearchResults` and ordered by this application rather
   than by the source. See [Finding a pool](#finding-a-pool).
5. **Pair fee tiers** — every pool trading the same pair as a given one,
   normalised into a `PairFeeTiers`. Filtered on token addresses rather than
   symbols, so a lookalike ticker cannot join the list. See
   [Where else this pair trades](#where-else-this-pair-trades).

The two readers that return *lists* — 4 and 5 — select a pool through one shared
GraphQL fragment, parse it with one shared schema and verify it with one shared
normaliser, so neither list can admit a pool on easier terms than the other. Both
kinds of entry are a link into a full analysis, and the check that lets a pool
become one belongs in a single place.

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

All of it is wired into one page. `/pool` takes a pair to search for or a pool
address to analyse, runs the three reads concurrently, and works them through
volatility, band and range to a pair of ticks. It is a Server Component, so the
credentials the readers need never enter a browser bundle, and what was asked for
arrives as a search parameter rather than a path segment so the form that submits
it can be plain HTML with no client JavaScript.

The pipeline reports **which stage** stopped when one does, so a pool with two days
of history, a pool behind an unreachable subgraph, and a missing API key are three
distinguishable outcomes rather than one blank screen.

**No pool address is hardcoded anywhere.** Shipping one would mean asserting from
memory which contract a pair lives at, and an address this application cannot
verify has no place in its UI.

`/pool` is rate limited, because every analysed pool costs four upstream calls —
three subgraph queries and one `eth_call` — a search costs one, and the page is
public. `src/proxy.ts` allows **10 a minute per client** and answers the rest with
a real `429` and a `Retry-After`, before rendering begins. Only a request that
will actually reach a source is counted: a missing or malformed address, and a
search term the page refuses, are answered without a single upstream call, so a
typo never costs an analysis. See [The rate limit](#the-rate-limit) for the
counter every instance shares.

One limit of that, stated rather than papered over:

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

## Choosing the band

The band has two parameters and the pipeline has always taken both. Until
recently every visitor saw the same one — thirty days, one standard deviation —
because the page never passed anything else. They are now in the URL, beside the
pool, so a particular reading of a particular pool is one link: reloadable,
linkable, and comparable by opening two of them.

`?days=` and `?sigma=`, set by a plain GET form with no client JavaScript.

**The interface offers less than the schema accepts, and accepts everything the
schema does.** The buttons stop at a quarter because volatility is always
measured over the last 30 completed days whatever horizon is chosen — the
horizon says how far that measured movement is laid forward, not how much
history went into measuring it, and a year-ahead band drawn from a month of
observations is a much larger extrapolation than it looks. A value typed into
the URL that the calculator would accept is still accepted, and the select keeps
it rather than silently snapping to an offered one.

**A value that cannot be read falls back per field**, and the page says so. One
mistyped multiplier does not throw away a horizon that was fine; refusing the
whole analysis over a mistyped URL would be worse than either, and using a
default without saying so would show a band nobody asked for. The horizon and
multiplier actually used are printed above the control that sets them.

Exposing the multiplier turned up a formatting bug that had been latent the
whole time: the figure was rendered with the whole-number formatter, so a band
asked for at 1.5σ would have been labelled **2σ** on the page and described to
the model as two standard deviations, while the arithmetic behind it used 1.5.
It now has its own formatter.

## What the pool actually did

Real 24h/7d/30d volume and the fees the pool charged, summed from the day data
the history read already fetches — so it costs no extra request. Facts, not
estimates.

**None of it is what a position would earn**, and the page says so beside the
figures. That would be these fees multiplied by a share of the liquidity active
in the range while the swaps happened: a share this application does not read,
for a deposit it will not size. There is no yield figure and there will not be
one.

Alongside it, how the measured days sat against the suggested range — entirely
inside, entirely outside, or crossing an edge. Three buckets rather than a
percentage, because the source publishes a daily high and low: a day that spent
part of itself inside cannot be split without intraday data this does not fetch,
and a fraction would put a precision on the answer that the measurement does not
have.

**It is in-sample and the page says that too.** The range was drawn from the
volatility of these same days, so a band containing most of them describes how it
was fitted rather than testing how it holds. It is also a counterfactual nobody
could have acted on — the range is centred on *today's* price. Read as how the
pool's recent movement sits against the range being suggested, it is worth
knowing; read as a backtest, it is wrong. The check that *is* one sits directly
below it: [The same method, on days it never saw](#the-same-method-on-days-it-never-saw).

Two things the source got in the way of, both found by looking rather than
assuming:

- **The extremes arrive the other way up.** `high` and `low` are published in the
  inverse of the direction this application stores prices in, so inverting them
  swaps which is which. A day's own price is then required to sit between its own
  extremes, and the schema repeats the check — a test fixture that had them the
  wrong way round was caught by exactly that.
- **`open` and `close` are not usable in this deployment.** They come back equal
  to each other and one day stale, so neither is selected. The extremes bracket
  the day's own price on every row inspected, and those are used instead.

The snapshot's three rolling-volume fields are gone with this. They were always
null — the source publishes a lifetime cumulative figure and nothing per window —
and they put a caveat on every single analysis that said only that. A snapshot
with a reported block time is now a plain success.

## The same method, on days it never saw

The figures above are all fitted to the days they describe. This one is not.

The method is stepped back by exactly one horizon. Volatility is measured from
the 31 closes *before* that point, the band is centred on the close *at* that
point — a price somebody standing there would actually have seen — and it is then
laid over the days that followed, which the fit knew nothing about.

```
|<-- fit: 31 closes -->|<-- measured: one horizon -->|
                       ^ origin: the band is centred here
```

That is one **fold**, and the window is long enough for several. Each further
fold steps back by another horizon, and the folds tile the recent history end to
end, so no day is counted twice and none is skipped. How many fit is decided by
the horizon, not by a setting: with 121 closes and a 31-close fit, a 7-day
horizon gives twelve folds, 30 days gives three, 90 days gives one.

It costs no request: the daily reader already fetches 121 days for exactly this.
One reading, every window — two reads of a moving market pretending to be one
series is the failure mode that would make the whole thing meaningless.

**What it found is not flattering, which is the point.** Against the live
USDC/WETH 0.05% pool at the default 30 days and 1σ, the three folds read:

| Days checked | Volatility its own fit measured | In / out / crossed |
| --- | --- | --- |
| 17 Jun → 17 Jul | 62.91% | 30 / 0 / 0 |
| 17 Jul → 16 Aug | 47.81% | 30 / 0 / 0 |
| 16 Aug → 15 Sep | 30.45% | 3 / 26 / 1 |

63 of 90 days, against 26 of 30 for the in-sample panel directly above it. The
rows say more than the total does: the two folds fitted on a loud window held
completely, and the one fitted on the quietest window — 30% where the others saw
48% and 63% — drew a band too narrow for what came next. A method that fails
exactly when volatility is about to rise from a quiet stretch is a thing worth
knowing about it, and a single fold would have shown only the failure.

**A few folds on one pool is still not a measure of the method, and the page says
so.** Nothing here is about what happens next. Nobody held these bands either —
each is what the method would have suggested at that moment, laid over prices
that then happened. Consecutive fits overlap, too, because a 31-close fit is
longer than a step of one horizon at every horizon the interface offers, so the
folds are not independent of each other.

A pool without enough indexed history to fit a band *and* leave a full horizon to
check it against gets no check rather than a shortened one. A 30-day band checked
over 20 days is not a check of a 30-day band, and the shorter window flatters it:
fewer days is fewer chances to leave the range.

Six invariants guard each fold, and the two that matter most are about the seam
between its windows. The fit must end exactly where the measurement begins — a
gap discards days, an overlap puts days the fit saw back into the test, which is
the in-sample problem reappearing where nobody would look for it. And the price
the band was centred on must be a close from inside the fit window, never one
from the window being tested.

Three more guard the roll-up above them: the folds tile the history oldest first
without a gap or an overlap, every fold carries the horizon and multiplier the
reader chose, and the totals are re-derived from the rows rather than believed. A
total that had drifted from its rows would be the most persuasive wrong number on
the page.

The band arithmetic and the three-bucket day counting are each shared with the
figures above rather than reimplemented, so the honest check and the in-sample
description cannot drift apart about what "inside" means or where a band's edges
fall.

## Against simply holding

The page compares the suggested range against holding the two tokens, at five
log-spaced prices across it. It is the one figure here that owes nothing to a
data source: two range bounds and two prices determine it exactly, by the
arithmetic of the curve a pool trades on. No window, no sample, no estimate, and
nothing to forecast.

**It is half of the question, and the page says which half.** It counts price
movement and nothing else. The fees a provider earns are precisely what they are
paid for that difference, and this does not model them — see below for why not.

It is size-independent. Liquidity cancels out of a ratio of two portfolios, so
this can be reported without ever sizing a deposit, which this project does not
do.

The usual name for it is wrong and the page corrects it: nothing is *impermanent*
about a position closed at a price other than the one it opened at. "Divergence"
is what it measures, so that is what the code calls it.

**The schema re-derives every ratio in the other numéraire.** A portfolio
compared against another portfolio cannot depend on which of the two tokens they
are priced in, so an arrangement that agrees in both got the algebra right —
where re-running the calculator's own expression would agree with itself whatever
it did. Scaling the calculator's arithmetic by one part in ten thousand makes the
schema refuse the whole figure rather than publish it.

### What is not here, and why

**Fee income is not modelled, and not estimated.** What a position earns is its
share of the liquidity active in its range, multiplied by the volume that trades
while price is inside it. The first needs the tick-level liquidity distribution,
which this application does not read, *and* a deposit size, which it will not
invent. The second, for any period that has not happened yet, is a forecast.
Stacking an estimate on a forecast on data we do not have is exactly the figure
this project exists not to produce, so there is no APR here and there will not
be one.

What can honestly be said about fees is what the pool actually did — its real
volume and the fees it generated, per day, which the source does publish. That is
[What the pool actually did](#what-the-pool-actually-did), above.

## Where else this pair trades

A pair is not one market. Uniswap v3 deploys a pool per `(token0, token1, fee)`
triple, so USDC/WETH trades at 0.01%, 0.05%, 0.30% and 1% on mainnet — four
separate pools, four separate price histories, four separate ranges. Someone who
arrived by pasting an address had no way to know the others were there, and
choosing between them is a decision that comes before anything else on the page
applies.

So under the figures the page lists every pool of the same pair, with what the
source reports is locked in each, and links to the same analysis run on that one.

**It does not say which tier is better, and it is not ordered as if it did.** A
tier holding more liquidity is a larger crowd sharing the same swap fees, not a
better place to be; answering "which one" would need the tick-level liquidity
distribution this application does not read. The list is therefore ascending by
fee — a fixed property of each pool, so it reads the same way today and next
month — rather than descending by dollars, which would make it a ranking. What
the panel offers instead is the comparison itself: open a tier and read its own
figures.

**The chosen band travels with every link.** A reader who set a ninety-day
horizon lands on the next tier at ninety days, because two pools read under two
different bands are not comparable and would look as though they were.
`poolAnalysisHref` is the one place that is decided.

Four things about the read, three of them confirmed against the live gateway
rather than assumed:

- **The filter is on token addresses, not symbols.** A symbol search would return
  pools of different contracts that happen to share a ticker, which is the
  failure the search's own ordering exists to contain. Addresses come from a
  pool this application already verified.
- **Asked with the pair the other way round, the source returns nothing** — a
  pool stores its pair in address order. So there is one selection here, where
  the search needs two aliased ones, and the caller's verified token ordering is
  what makes that safe.
- **An entity-reference filter takes the referenced entity's id**, typed `String!`
  in the generated schema. `ID!` is accepted too; the declared one is used.
- **It costs one request beyond the analysis**, deliberately its own rather than a
  second selection bolted onto the metadata read. A pair's siblings are context:
  failing to read them must cost the page a panel, never its figures. It streams
  into a `<Suspense>` boundary for the same reason the explanation does.

Four invariants are checked on the way out, and each of them would otherwise
produce a list that looks entirely reasonable on screen: every entry is the same
pair (by address, not symbol), no fee tier appears twice — the factory reverts on
a triple that already exists — the order is the one claimed, and the pool the
reader is on is among them. That last one cannot be a fact about Uniswap: the
page has just read that pool's metadata from this same source, so its absence
means the two reads disagree about which pair this is.

A sibling that cannot be verified leaves the list the way a search result does.
The pool the reader is *on* is not special-cased in that loop — the schema
requires it, so dropping it takes the panel down rather than quietly showing
someone every tier except their own.

## Connecting a wallet

A visitor can connect a browser wallet, and the page then knows one thing it did
not before: which address it is speaking about. That is the whole purpose — an
address is what makes it possible to say which pools the tokens someone already
holds can go into, instead of asking them to know.

**The page asks a wallet for its address and never for a signature.** One method
is issued, `eth_requestAccounts`, and there is no code in this repository that
can sign a message or build a transaction — no wallet library, no signer, no
contract-write path. A test asserts the method list, and a live check confirmed
it: driving the button against a stubbed provider, the only call recorded was
`eth_requestAccounts`.

**The promise on the page changed with it, because half of it stopped being
true.** It used to read "never connects a wallet and never sends a transaction".
It now reads "never signs anything and never sends a transaction", in both
languages, and a test asserts the old sentence is gone. A page promising
something the code no longer does is worse than a page promising less.

What comes back from a wallet is untrusted input, exactly like a subgraph
payload. An injected provider is whatever extension got there first, and nothing
in the browser obliges it to answer `eth_requestAccounts` with what the standard
says — so the response is parsed through the same address schema every other
address here passes, which also lowercases it. An array of something else, an
empty array, a bare string, a forty-character value that is not hex: all of them
mean no account, and none of them reaches the page.

A refusal is kept apart from a failure. EIP-1193 gives a user's rejection its own
code, and someone who changed their mind should not be shown an error.

Two implementation notes, both learned the hard way:

- **A Client Component cannot be handed the dictionary.** `Dictionary` holds
  functions, functions cannot cross from a Server Component to a Client one, and
  passing `t` renders the whole page as a server error naming no property. The
  control takes `t.wallet`, which is strings all the way down, and a test checks
  that it stays that way.
- **Whether a wallet exists is looked up on click, not held in state.** Reading
  it into state from an effect is both a lint error under React's current rules
  and worse behaviour: someone without a wallet is told so when they ask, rather
  than greeted with it.

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

**The prose has to keep up with the page.** For as long as nothing on the page
tested the suggested range, the model was told so, and it wrote — correctly —
that the day counts beside the pool's activity were no independent check. The
day an out-of-sample check appeared directly above that prose, the sentence
became a text telling a reader the page lacks what the page is showing. So the
request now carries both, and says which is which: the activity day counts
describe the fit, the check that follows them tests it, and the standing
instruction forbids turning a few stretches of one pool into a verdict on the
method. Live, in Turkish, that comes back as "this shows the fit, it does not
independently test the method… the great majority of checked days stayed inside
the band, but results varied between different past stretches… this is not a
general verdict".

**Everything the model is told about a comparison is computed, not left to be
inferred** — the direction a price is quoted in, which token a position holds at
each edge, and, for the check, the spread between its best and worst stretch. A
total of two thirds of days holding means one thing when every stretch behaved
alike and another when two were perfect and one collapsed; the model cannot see
the rows, so it is handed the difference rather than asked to guess at it.

**The limits paragraph is not an inventory**, and that is enforced by the prompt
rather than by a length. The page already prints its own caveat beside every
figure it qualifies, in the reader's language, whether the prose repeats it or
not — so a paragraph that lists all of them costs the reader the one that
mattered. Telling the model that took the Turkish limits section from 957
characters to 465 in a single change. See
[What the interface says when a read fails](#what-the-interface-says-when-a-read-fails)
for the length bound behind it, and why it is set from measurement.

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

## What the interface says when a read fails

Every sentence about a read that produced nothing, or produced something with a
caveat, lives in the dictionary beside every other string the interface says.
The data layer raises a **code** — `pool-not-found`, `market-data-rate-limited`,
`rolling-volume-unavailable` — and the page turns it into a sentence in the
reader's language.

They were English sentences, written where they were raised, until a second
language made that untenable. A Turkish reader was told in English, on every
single analysis, that rolling volume was unavailable; they would have been told
in English that their address was malformed, or that the source was rate
limited, at the exact moment a sentence has to land.

Three things follow from the change, and all three are why it was worth the
churn through every adapter:

- **A code cannot leak.** `DataResult` used to *ask*, in a comment, that a
  message never carry an API key, a URL containing one, a stack trace or a raw
  provider payload. A fixed set of identifiers cannot carry any of them.
- **Nothing can go untranslated.** The entries are written with `satisfies
  Record<DataFailureNotice, string>`, so adding a code stops the build until both
  languages say something about it. A test covers what the compiler cannot see —
  a Turkish entry that is the English sentence pasted across.
- **The wording stops being the data layer's business.** An adapter says what
  happened; what a reader is told about it is the interface's decision, and it
  can be reworded without touching a read.

The server log keeps the code rather than either sentence. It is the same
identifier in every language, which is what makes a log line and a support
question in Turkish matchable at all. For the same reason, a notice a visitor
reads no longer names an environment variable: which one to set is an operator's
business and reaches them through the log, exactly.

The model is given the caveats as the same sentences the page shows, in the same
language — a model reasoning over an English caveat while writing Turkish prose
about it is reasoning about a different page than the one being read.

## The rate limit

The one route that spends third-party quota is limited to ten requests a minute
per client — an analysis and a search cost the same, because both spend a query
and a box that takes ordinary words is the easier of the two to send in a loop.
It is a cost control, not a product rule.

It is counted twice. **In this process's memory**, always, which needs nothing
configured and answers instantly. And **in a store every running copy shares**,
when one is configured, which is what makes ten mean ten rather than ten per
warm instance. A request has to satisfy both.

That pairing is what makes the store's failure survivable. A refused token, an
unreachable host, an answer that takes longer than a second, a response in a
shape this does not recognise — every one of them comes back as "no answer", and
a request with no answer from the shared counter is governed by the local one
alone. That is the limit this application enforced before a shared store was
possible: a degradation, not an opening. Nothing in that path can throw, because
the proxy it runs in sits in front of a page render.

With nothing configured the shared half costs nothing at all — not one
millisecond — because the decision that there is no store is made before
anything is awaited.

The two windows are not the same shape. The local one starts at a client's first
request; the shared one is aligned to the clock, which is how instances agree on
which counter to increment without coordinating. They rarely line up, and a
request must pass both, so the pair is at worst slightly stricter than either.
For a cost control that is the right direction to be wrong in.

`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` turn the shared half on.
The names are Upstash's own, so attaching a database through Vercel's
integration is the whole setup; the transport is an HTTPS POST with a bearer
token and no dependency. One pipelined request per counted call: `INCR` to count,
`PEXPIRE … NX` to give the key a lifetime *only if it has none* — without `NX`
every request would push the expiry out and a busy window would never end.

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

Still absent from that layer: no recommendation policy, no risk categories, no
AI and no persistence.

Shared limits of both adapters:

- Ethereum mainnet (`chainId` 1) and Uniswap v3 only.
- One pool per call, by address.
- No transaction, signing or approval capability of any kind. A wallet is asked
  for its address and never reaches these adapters.
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

`scripts/readLiveExplanations.spec.ts` runs real pools through the real prompt.
It writes each explanation beside the facts it has to agree with — the quote
direction, the token held at each edge, how far price sits from each bound,
whether the page carries an out-of-sample check the prose must not deny — and it
measures what the answer had left to spare. It skips unless pools are named, so
`npm test` stays hermetic:

```bash
NODE_USE_ENV_PROXY=1 TONE_POOLS=0x…,0x… TONE_LOCALES=tr,en \
  node --env-file=.env.local ./node_modules/vitest/vitest.mjs run \
  scripts/readLiveExplanations.spec.ts
```

The prose lands in `explanations.json` and a summary in
`explanations.report.txt`, which reads:

```
model in use: gpt-5.6-luna
default if unset: gpt-5.6-luna — reachable

0x88e6a0… tr  ok       sections 722/545/629/542 (worst 66% of bound)  tokens 2383 (58% of budget, 1699 reasoning)
0xcbcdf9… tr  ok       sections 488/510/810/429 (worst 74% of bound)  tokens 1587 (39% of budget, 958 reasoning)

worst section margin: 0xcbcdf9… tr whatTheVolatilitySays at 810 of 1100
worst token margin:   0x88e6a0… tr at 2383 of 4096
```

**Every explanation outage this project has had was invisible to the suite and
visible in one run of this.** A section bound of 700 characters, comfortable in
English and not in Turkish. An output budget of 2048 tokens, justified by the
length of the prose, which ignored that these models spend one to two thousand
more tokens thinking before they write. A default model the deployment's key is
refused, which nothing ever called because the configured one worked.

So it reports margins rather than only prose, and fails when one is gone. The two
lines above are the evidence: at the old bounds that same run would have failed
twice over, on a section of 810 characters and a spend of 2383 tokens. It writes
the prose either way — especially when the answer was refused, which is exactly
when you want to read it.

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

Three more are optional, and the application is honest about running without
each of them:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Writes the plain-language explanation of an already-computed analysis. With it absent every figure is still computed and shown; only the prose is missing. |
| `UPSTASH_REDIS_REST_URL` | The shared rate-limit counter, so ten a minute means ten across every running copy rather than ten per warm instance. **Treat the URL as a credential alongside the token.** |
| `UPSTASH_REDIS_REST_TOKEN` | The bearer token for the same database. Both halves are required; either alone is read as no store at all. |

With the last two absent the limit still applies, counted in each instance's own
memory, and the shared half costs nothing — see [The rate limit](#the-rate-limit).

Reads are read-only throughout: the RPC path issues `eth_call` and nothing else.
There is no signing, no account access, and no transaction capability anywhere in
the codebase.

With any of them absent or blank, the reader that needs it returns an
`unavailable` result with reason `configuration-error` and makes no network
request — so the page reports a configuration problem rather than a data one.

# LiquidityWise

liquiditywise.com — an independent, educational Uniswap range advisor. Not affiliated with Uniswap Labs.

An educational, AI-assisted decision-support tool for Uniswap v3 and v4 liquidity
strategies. Name a pool — by its pair, its address or its v4 id — and the
application reads it, works out a price range from how far that pair has actually
moved, and explains the result in plain language. Every figure is computed and
cross-checked before a model is allowed to describe it, and the model is never
allowed to state one.

**This is not financial advice.** The application does not predict prices, does
not guarantee returns, and cannot attest that any smart contract is safe.

## Status

Five pages, both protocols, everything computed. `/pool` and `/v4` run the whole
pipeline against live data — find a pool by pair, address or id, read its
verified figures, and read a plain-language explanation written from them by a
model that is not allowed to state a number. `/holdings` answers which pools the
tokens at an address can go into. `/hooks` lists every hook the week's busiest v4
pools name and what each is permitted to do. A wallet can be connected, and the
only thing asked of it is its address — see
[Connecting a wallet](#connecting-a-wallet). There is no persistence, no
authentication and no transaction capability of any kind, and none of the last is
planned.

The reads are all server-only, and they fall into two kinds.

**Over The Graph**, against the v3 and the v4 subgraph:

1. **Current pool snapshot** — one Ethereum mainnet pool of either protocol,
   normalised into a `PoolMarketSnapshot`: its price, its tick, the liquidity
   active at that price, and what it holds. One query serves both protocols,
   because the v4 subgraph publishes this entity under the same names —
   verified by introspection against the deployed schema, not assumed.
2. **Pool metadata** — a pool's fixed configuration: verified token ordering,
   token `decimals`, symbols and fee tier. Read separately because the snapshot
   does not carry it, and it is what any price/decimal conversion needs first.
3. **Daily price history** — the previous 121 *completed* UTC days for one pool,
   normalised into a `PoolDailyPriceHistory`. The current, still-incomplete UTC
   day is always excluded.

   Only the most recent 31 of those closes are *measured from*: 31 closes give 30
   daily returns, which is what a 30-day volatility figure needs, and the
   pipeline narrows the history to that window before measuring it. The older
   ninety days are fetched so a band can be fitted at a point in the past and
   checked against the days that actually followed — one request answers both
   questions, and the two windows cannot come from different readings of a moving
   market.
4. **Pool search**, per protocol — the pools whose token symbols match one or two
   terms, ordered by this application rather than by the source. See
   [Finding a pool](#finding-a-pool). The v4 search cannot be written the way the
   v3 one is; see [Uniswap v4](#uniswap-v4) for what the source refuses.
5. **Where a pair trades** — every v3 pool of the same pair, and every v4 pool of
   the same two currencies. Filtered on token addresses rather than symbols, so a
   lookalike ticker cannot join the list. See
   [Where else this pair trades](#where-else-this-pair-trades).
6. **The week's busiest pools**, per protocol — a net rather than a page, and the
   only read here that takes no input. Three things are built on the one reading:
   the tokens a holdings lookup asks about, the v4 search, and the hook
   directory.

**Over JSON-RPC**, read-only, for the facts no subgraph exposes or gets right: a
v3 pool's tick spacing, a v4 pool's real fee from the PoolManager's storage and
the log that created it, and every balance a holdings lookup needs. The last of
those is one aggregated call through Multicall3, believed only once the code at
that address has been checked byte for byte — see
[What an address holds](#what-an-address-holds).

The readers that return *lists* select a pool through one shared GraphQL
fragment, parse it with one shared schema and verify it with one shared
normaliser, so no list can admit a pool on easier terms than another. Every entry
is a link into a full analysis, and the check that lets a pool become one belongs
in a single place.

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

It is not a position, and it does not claim the range is a good one. It does now
size a deposit, on the reader's instruction and never on its own — see
[What a deposit would have collected](#what-a-deposit-would-have-collected) — and
it quotes amounts of both tokens for a swap through the pool, which is arithmetic
the protocol fixes rather than a suggestion. Neither is advice and neither is a
forecast.

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

**The three routes that spend upstream quota are rate limited**: `/pool`, `/v4`
and `/holdings`. An analysed v3 pool costs three subgraph queries and an
`eth_call`, a v4 one costs three queries and two chain reads, a holdings lookup
is the dearest of all, a search costs one query, and the pages are public.
`src/proxy.ts` allows **10 a minute per client** and answers the rest with a real
`429` and a `Retry-After`, before rendering begins. Only a request that will
actually reach a source is counted: a missing or malformed address, and a search
term the page refuses, are answered without a single upstream call, so a typo
never costs an analysis. `/hooks` is deliberately outside that list — it takes no
input and its one read is shared and cached, so however often it is asked for it
costs a single query every ten minutes. See
[The rate limit](#the-rate-limit) for the counter every instance shares.

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
Pools whose token is exactly what was searched for come first; within that, what
each pool actually holds — read from the token contracts and put on one scale
using the prices the source derives. There is no score, no badge, no
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

**The size half stopped being the source's figure**, because that figure is not
only unverified — it is wrong, and wrong enough to reorder this list. Measured
against `balanceOf` on the pool contracts, a WETH/LOOKS pool published here at
nine million dollars of reported liquidity held three and a half WETH: nine
thousand dollars, a thousandth of the claim, ranked above pools that genuinely
held more. Across the busiest pools the indexer's token totals run between 1.3
and 13 times the balances the contracts report.

So a search now reads the pool contracts. Each row shows the two token amounts,
and the order uses them priced in ether — ether rather than dollars because
ordering only needs a common unit, and a dollar figure would be one more derived
number to display and defend. Prices are still the source's, and that is a
different kind of figure: a price comes out of a pool's `sqrtPrice`, which is
chain state, while a balance is accumulated from events and drifts. Checked
against live data, a stablecoin came back at 0.000403 ETH, a liquid-staking token
at 1.103, a near-worthless one at 3e-8.

**The window changed with it, and the page says so.** The candidates used to be
the 24 pools the source reported as largest, selected with the same broken
figure. They are now the 24 it reports as most traded. That is a different bias
rather than none — a pool holding a great deal but trading rarely can now fall
outside the window and never reach the ordering at all — and the list states that
limit rather than leaving it to be discovered.

A search is streamed into a `<Suspense>` boundary, because reading what each
candidate holds is a round trip to the chain and the box somebody just typed
into should come back immediately.

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
in the range while the swaps happened — and both halves of that are now read, for
a deposit size the reader sets, in the panel directly below:
[What a deposit would have collected](#what-a-deposit-would-have-collected).
What is still not here is a yield. Nothing is annualised, nothing is projected,
and the figure covers days that have already happened.

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

## What a deposit would have collected

The figures above are the pool's. This one is a position's, and it was the first
thing on the front page's list of what this application could not do — turning
"the pool charged this" into "a deposit would have taken that" needs a position
size and a share of the liquidity active at each price, and neither was read.

Both are read now, and neither costs a request. The size comes from the form
beside the range, defaulting to a thousand dollars and printed next to every
figure derived from it. The liquidity active on a day is one more field on the
`poolDayDatas` query the volatility figure already makes.

The arithmetic is a share, not a model. A position of liquidity `L` in a pool
whose active liquidity is `A` takes `L / (A + L)` of everything charged while the
price sits inside its range. The `+ L` is the deposit diluting itself, and it is
the part that surprises people: **a larger deposit does not collect
proportionally more.** Measured against a small sUSDe/USDT pool, a thousand
dollars would have taken 2.4 cents over 28 days and a million would have taken
$1.22 — a thousand times the money for fifty times the fees. That is why the
interface offers sizes a thousandfold apart rather than printing a rate per
dollar: the figure is not linear in the deposit, and the non-linearity is worth
seeing.

Getting from dollars to the protocol's own `L` is two conversions and both are
exact. The source says what the pool holds, in each token and in dollars, and
those three figures name a rate — **the source's own rate, the one its `feesUSD`
is denominated in.** A price fetched from anywhere else would divide one pool's
fees by another market's money. Then one unit of value buys
`1 / (2√P − √pa − P/√pb)` of liquidity, and because the protocol's `L` is defined
over *raw* token amounts the whole conversion collapses to a single factor of
`10^((d0 + d1) / 2)`. Get that wrong and nothing looks wrong: the figure stays
positive and finite and is out by a power of ten. It is pinned by a test that
derives a stablecoin's price back out of a real pool's published figures and
expects a dollar — live, USDC comes back at $1.0003.

Only days the price never left the range are counted, through the same function
the occupancy panel counts by, so the two cannot disagree about what "inside"
means. A day inside the range that the source could not answer for is counted
separately and named, because a figure covering nineteen of thirty in-range days
and one covering all thirty are different claims.

**It is withheld on exactly the pools the fee figure above it is withheld on.** A
hook permitted to take a share of a swap makes "the fees charged while the price
sat inside this range" unattributable, and a fraction of an unattributable total
is no better. The same flag decides both.

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
this one is reported without a deposit size at all — unlike the fee figure below
it, which needs one and asks for it.

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

**No APR, no yield, and no forecast.** What a position would have taken of the
fees a pool *did* charge is now computed, for a size the reader sets, over days
that have already happened — see
[What a deposit would have collected](#what-a-deposit-would-have-collected).
What is not here is the step from that to a rate: the volume that will trade next
month is a forecast, and multiplying a measured share by a forecast is exactly
the figure this project exists not to produce.

Two smaller absences behind the figure that does exist, both stated on the page
rather than smoothed over:

- **A day that crossed an edge is not apportioned.** The source publishes a daily
  high and low, which cannot say how much of the day was spent inside the range,
  so only days the price never left are counted. The figure is a floor and the
  page says which days it rests on.
- **The share is taken over the liquidity the pool reports for each day**, which
  is the figure at that day's close and is the right denominator for a day the
  price stayed inside the range. Splitting a straddling day would need the
  tick-level liquidity distribution, which this application does not read.

**Gas is still not counted anywhere**, and it is the one absence here that is a
limit of the tooling rather than a decision. A range the price has left has to be
closed and reopened to follow it, which costs gas and turns a divergence on paper
into one that has been realised. Measuring what that actually costs means reading
transaction receipts, and the free RPC tier this is built against does not answer
for them — so rather than assume a figure, the front page lists it as missing.

## The same range, one side at a time

The range this page suggests straddles the current price and earns fees while the
price stays inside it. Split it at the price and each half is a different
instrument: a position sitting wholly on one side holds one token and nothing
else, and the pool converts it into the other as the price moves through the
band. That is a range order, and it was on the front page's list of what this
application could not do. What it needed turned out to be nothing at all — no new
request, no new field, no measurement.

**The price it converts at is exact and does not depend on how much is put in.**
For liquidity `L` in `[pa, pb]` the position holds `L · (1/√pa − 1/√pb)` of token0
below the band and `L · (√pb − √pa)` of token1 above it, so the conversion
averages

```
(√pb − √pa) / ((√pb − √pa) / (√pa·√pb)) = √(pa · pb)
```

— the geometric mean of the bounds, with `L` cancelled out of it. A hundred
dollars and a million convert at the same price, and the figure would be the same
on a pool that had never traded. It is checked against those two amount formulas
written out independently rather than against itself, so a module computing the
mean of the wrong pair, or the arithmetic mean, fails instead of agreeing.

The split is on the pool's tick grid, and **the step the price sits in belongs to
neither side**: a leg starting at the price's own step would already be in range,
which is the one thing a one-sided position is defined by not being. On
USDC/WETH 0.05% that shows in the numbers — selling from 2,467.63 and buying up
to 2,465.16, with the price's own step between them.

Which half sells and which buys is read off the quoted prices rather than the
legs' own names. "Above" means above the *pool's* price, and a pair shown the
other way round turns the pool's upper half into the reader's lower one, so
taking the names at face value would swap the two labels on every pool quoted
that way.

Three sentences say what it does not promise: that the price ever crosses the
whole band, that anything schedules the conversion, that there is a queue or a
counterparty. There is no order book here, and an order the price never reaches
is the ordinary outcome rather than a failure.

## What a swap through it costs

Everything else here is about providing liquidity. This is about using it, and it
exists because nothing else on the page answered the first question anybody asks
of a pool.

There is an exact answer and it has an edge. A pool's liquidity is constant
between initialized ticks, and a tick can only be initialized at a multiple of
the pool's spacing — so **between the two boundaries the price sits between, the
liquidity already read is the whole truth**, and a swap inside that span is
priced from the protocol's formulas with nothing assumed. One boundary further
another position's liquidity may begin, and this application does not read the
liquidity at every price. So the figure stops where the certainty does, and the
page says that the amount is **not a limit**: a larger swap works, and this page
cannot price it.

What it costs is the geometric mean again — of the price now and the price the
swap ends at, from the same two formulas as the range order above, seen from the
other side of the trade. A swap crossing a band pays it; a position sitting in
that band receives it. Live on USDC/WETH 0.05%: 45,078 USDC in one direction
giving up 0.02%, 26.46 WETH in the other giving up 0.03%, the asymmetry being
where in its step the price happens to sit.

Two things the live read found that no fixture would have:

- **On a pool whose steps are one tick wide, the price was sitting 3.6 billionths
  above its lower boundary**, which left two billionths of a token of room
  upward. Both amounts are then differences of nearly equal numbers, the quotient
  came out 4.6e-9 from the price it should be, and the schema refused the pair. A
  leg that cannot be verified to a part in a billion is a leg whose amounts are
  noise — and it must not take the other one down. Each leg is now checked on its
  own, the one that fails is dropped, and the page says why only one direction is
  shown. The other direction had forty-six tokens of room and agreed to 1.2e-12.
- **The refusal when the source's tick and this application's disagree is
  narrower than it looks, and worth keeping.** `calculateTickRange` has already
  refused anything more than one tick apart, so by the time this runs the two can
  differ by at most that — and one tick crosses a spacing boundary only when the
  price is sitting on one, which is exactly when attributing the liquidity to the
  wrong step is most likely to be wrong.

**TWAMM stays on the front page's list.** What is built is the half an analysis
page can answer; scheduling an order over time is a hook's job, and this
application does not model a hook's behaviour.

## Where else this pair trades

A pair is not one market. Uniswap v3 deploys a pool per `(token0, token1, fee)`
triple, so USDC/WETH trades at 0.01%, 0.05%, 0.30% and 1% on mainnet — four
separate pools, four separate price histories, four separate ranges. Someone who
arrived by pasting an address had no way to know the others were there, and
choosing between them is a decision that comes before anything else on the page
applies.

So under the figures the page lists every pool of the same pair, with what the
source reports is locked in each, and links to the same analysis run on that one.

**What each tier holds is read from the chain, not from the indexer, and that is
a correction rather than caution.** The panel used to show
`totalValueLockedUSD`, labelled as the source's own figure. It was measured
against `balanceOf` on the pool contracts for five of the busiest pools, and the
indexer's token totals overstate what is there by between 1.3 and 13 times —
144 million USDC reported against 11 million held, 15,058 WETH against 1,729. The
dollar figure derived from them is internally consistent and therefore wrong by
the same factor. For USDC/WETH it told a reader the 0.05% and 0.30% tiers were
within 1.4x of each other; the chain says one holds seven times the USDC of the
other.

So the figure is two token amounts rather than one dollar amount. Every tier of a
pair holds the same two tokens, so nothing has to be priced to compare them and
nothing can be mispriced. An unread balance stays unread on the page: it is not
an empty pool.

**It does not say which tier is better, and it is not ordered as if it did.** A
tier holding more is a larger crowd sharing the same swap fees, not a better
place to be; answering "which one" would need the tick-level liquidity
distribution this application does not read. The list is therefore ascending by
fee — a fixed property of each pool, so it reads the same way today and next
month — rather than descending by size, which would make it a ranking. What the
panel offers instead is the comparison itself: open a tier and read its own
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

## Uniswap v4

A v4 pool can be read at `/v4?id=0x…`, where the id is a 32-byte hash rather than
an address: a v4 pool is not a contract of its own but an entry inside the
singleton PoolManager, named by the keccak256 of the five things that define it —
the two currencies, the fee, the tick spacing, and the hook.

The read is shorter than the v3 one by a whole request. A v3 pool's tick spacing
appears in no subgraph and has to come from the pool contract; a v4 pool's is in
the PoolKey, so it arrives with everything else and there is no `eth_call` on
this path at all. Three other things have no v3 counterpart, and all three turn
up in live data:

- **Fees finer than v3 can express.** The busiest v4 pool on mainnet, USDC/USDT,
  charges twelve parts per million — 0.0012%, where v3's lowest tier is a
  hundred.
- **Native ether as a currency.** A pool can hold the chain's own ether rather
  than a wrapped token, and it appears as the zero address. That is a currency,
  not a dropped field, which is why a v4 currency goes through `TokenSchema` and
  a v3 one through the stricter schema that refuses it.
- **A fee decided per swap.** A PoolKey can carry the dynamic-fee sentinel
  instead of a fee. It is a wire-format detail and stops at the adapter: nothing
  above sees the number, only that the hook decides.

### What the hook is permitted to do

This is the part the page exists for. A v4 hook can run alongside swaps,
deposits and withdrawals, and nothing about that is visible in a price series —
so a range drawn from price history says less about a v4 pool than about a v3
one, and saying so is not enough on its own.

What *can* be said without trusting anybody is what the protocol will let the
hook do. **v4 stores a hook's permissions nowhere.** A hook is deployed to a
mined address whose last fourteen bits spell out which callbacks the PoolManager
will invoke, and the PoolManager checks those bits rather than asking the
contract. Reading the address is reading the rule; reading the contract's code,
or its name, or its documentation, would be taking somebody's word for it.

So the page lists them, and says in as many words that this is what the hook
*may* do and never what it does — one permitted to rewrite the fee on every swap
may always return the same fee, and that is not knowable from here.

One class of permission is singled out and warned about above the list rather
than below it, because it changes what every other figure would mean: a hook
holding `beforeSwap` can rewrite the fee, and one holding a returns-delta flag
can take a share of the swap itself. A live example — the busiest hooked pool on
mainnet, USDC/WETH — is permitted to do eight things including
`afterSwapReturnsDelta`.

A v4 pool now gets the same analysis a v3 one does — the same band, the same
range, the same comparisons, the same explanation — because the two reads behind
it are the same query against a different subgraph. What is not the same is the
fee, and that took a correction.

**The indexer's `feeTier` on a v4 pool is not the pool's fee.** It is the total
the last swap paid, which on a dynamic-fee pool is whatever the hook decided that
moment and on a hookless one includes the protocol's cut. The fee in the PoolKey
is read instead: from the `Initialize` log that created the pool, for the hooked
ones, and from the PoolManager's own storage for the rest. The page prints what a
swap actually pays, per direction when the protocol's cut differs by direction,
and says when the key carries the dynamic-fee sentinel instead of a number.

**The v4 search cannot be written the way the v3 one is, and the source is why.**
Every `pools` query ordered by volume, and every one filtered by a token's
symbol, dies at the gateway after about fifteen seconds with `bad indexers` —
measured across a dozen variants with a 45-second client timeout so the
gateway's own answer could be seen. Only two indexers serve the subgraph; one
refuses with a 402 and the other times out. What does answer, cold, in under
three seconds, is `poolDayDatas` filtered by date: a thousand of the week's
busiest pool-days name a few hundred distinct pools. So both v4 lists — the
search and the net a holdings lookup casts — come from that one reading, shared
through a ten-minute cache, and the search matches terms in this application
rather than at the source. The page says the window is the week's activity, not
the terms.

### Every hook the net saw

`/hooks` lists them: each hook address, what it is permitted to do in the same
plain words the single-pool page uses, and which of the week's busiest pools run
it. Live today, 250 pools named 37 hooked ones between 30 distinct hooks, the
busiest hook running four pools and most running one.

It is a directory of addresses and permissions and **deliberately not a directory
of behaviour**. What a hook does with a permission is in its code; this
application does not read code, and it keeps no list of hooks anybody has vouched
for. Both would be a claim it cannot check, sitting next to figures it can.

It costs no request — the pools are the same reading the v4 search is built on —
which is also why it is the one page outside the rate limit.

The permission sentences come from a component shared with the single-pool page,
on the same fourteen bits of the same address. Two readings of one hook is the
failure a directory like this could have that nobody would notice.

### Choosing the subgraph

Six v4 Ethereum subgraphs are published, and the one this reads was chosen by
measurement rather than by popularity — which mattered, because popularity picked
the wrong one. The most queried, at nine million a month, answers `_meta` and
fails every real query: its indexers report "too far behind" or "no attestation:
indexing_error", and `hasIndexingErrors` is true. Two more are healthy but model
a different schema, with no `feeTier` and no `token0` on `Pool`. Two have no
allocations at all. The sixth, with two thousand queries a month, answers,
indexes within seconds of head, and carries every field a v4 read needs.

A Subgraph ID is public rather than a credential, so the working one is written
into `.env.example` rather than left blank.

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

## What an address holds

A connected wallet gives the page an address, and `/holdings?address=…` answers
the question a newcomer actually has: which pools can the tokens I already own
go into. Every other page here starts from a pool and assumes the reader knows
which one to ask about.

**It is a search, not an inventory, and the page says so beside the answer.** A
token's balance lives inside the token's own contract, so there is no list of
what an address owns — only tokens that can be asked, one at a time. Every
"wallet contents" anywhere is a list of guesses that were checked; this one
reports how many it checked, and says that something held outside that set is
missing from the page because nobody asked about it, not because the address
does not hold it.

The candidates come from the pools that have actually been traded. Ordered by
`totalValueLockedUSD` this subgraph answers with `ease.org`, `ez-cvxsteCRV` and
`ez-yvCurve-IronBank` before it reaches USDC — the same derived dollar figure
that once put a pool nobody trades at the top of a search for "weth". Ordered by
volume with a floor on transaction count, the first names are USDC, WETH, USDT,
WBTC, DAI, wstETH. Money that moved is harder to inflate than money claimed to be
sitting there, and the transaction floor alone removes all four of those.

Five measurements shaped the read, each of which changed the design:

- **250 pools yield 175 distinct tokens; the two nets together yield 289.** A
  wide net is nearly free: a candidate nobody holds costs one question inside one
  call; a candidate that is missing costs the reader the token they came to ask
  about.
- **175 calls at once are refused** — not for concurrency, since a width of eight
  fails too, but because the provider meters compute units per second.
- **JSON-RPC's own batch form helped, and then stopped being enough.** Seven
  spaced batches read 175 tokens with nothing lost, in 4.8 seconds. Twelve read
  289 and had the last of them refused, then the ether question, then every fee
  read the page makes after the sweep: the endpoint's budget was spent before
  the page was done, and it published its v4 pools with every fee unread.
- **One `eth_call` through Multicall3 reads all 289 in 0.6 seconds**, 65
  kilobytes out and 46 back, and leaves the budget for the reads that follow.
- **The contract's address is still not trusted; its code is.** In the same batch
  as the aggregated call, the sweep reads the code at Multicall3's address and
  believes the answers only if that code is, byte for byte, the runtime this
  application was built against — 3,808 bytes read from mainnet and pinned with
  its hash. A typo would find no code there; another chain finds the same code,
  because the contract was deployed with CREATE2 from the same bytecode
  everywhere. Multicall3 has no owner, no upgrade path and no state of its own,
  so the code it runs is all there is to know about it.

Within the call, each token's answer comes back in the order the questions were
asked, and an answer for a different number of questions is refused whole:
pairing one token's balance with another token's identity would be wrong in a
way nothing downstream could detect.

**An unread balance is not a zero balance**, and that is the failure this whole
read is shaped around. A list built from failed reads renders as "you hold
nothing", which is a definite-looking answer to a question nobody answered — and
unlike a dropped search result, which shortens a visible list, a dropped balance
is invisible. So a refused sweep stops the read, and losses spread thinly enough
to survive that check are counted and refused past a tenth of the sweep. A clean
sweep loses none, which is what makes any material number a signal.

Balances stay base-unit strings from the wire to the formatter, and the formatter
moves a point through the string rather than dividing. An eighteen-decimal
balance is routinely past what a double holds exactly. The digits beyond what is
shown are cut rather than rounded, so a figure someone might act on never reads
higher than what they have.

Two ordering claims are made, and both are stated on the page. Pools whose two
sides are both held come first, which is about the reader rather than the pool —
no swap is needed first. And the one-sided list is cut at twelve, because holding
WETH puts two hundred pools within a swap; what is shown is the most traded of
them, and the page says that is a claim about how busy a pool is and about
nothing else.

The route is guarded by the same rate limit as an analysis, and is the more
expensive of the two.

The candidate list is cached for ten minutes, which took a warm lookup from 8.6
seconds to 2.4. It is the one read here that takes no input — every visitor asks
the same question — and reusing it is safe in a way that reusing a figure would
not be: the list is a net, nothing on the page is derived from it except which
token contracts get asked, and a ten-minute-old net can only mean a pool listed
in the last ten minutes has not been asked about yet. That is a narrower version
of the limit the page already states.

## Positions an address is already in

The page above answers what an address *could* do. This answers what it has
done: the Uniswap positions it is actually in — of either protocol — each with
the prices it covers and whether the pool is inside them now.

It comes from a different place. A position is an ERC-721 token held by one
singleton per protocol, so the question is asked of those contracts rather than
of a pool. Both are proved before anything they say is believed, the way the
balance sweep proves Multicall3: the code at each address is read in the same
batch as the first call and the answers are refused unless it hashes to the
runtime this was built against. A hash rather than the bytes, because the two
managers are 24,384 and 23,877 bytes and pinning all of them to check one thing
is weight the repository does not need to carry.

Below that, the two protocols have almost nothing in common, and the differences
are the interesting part.

### v3: three questions in a row, and a pool that is derived

The ids come out of the count and the positions out of the ids, so the read is
strictly sequential — `balanceOf`, then `tokenOfOwnerByIndex` at each index, then
`positions` for each id. Each step is one aggregated call, so three round trips
carry hundreds of questions. Measured against live addresses: 0.17 seconds for
one holding nothing, 0.88 for one holding 84.

**A position names a pair and a fee, never a pool.** The pool is where v3's
factory deployed it, which is fixed by those two things and the factory — so the
address is computed with CREATE2 rather than looked up. Two of the three inputs
are not taken on trust: the factory is read from the position manager's own
`factory()`, and the derived address is then looked up and must come back
describing the same two tokens and the same fee. A wrong derivation finds
nothing; it cannot find something else. The one input that cannot be read from
anywhere is the pool's creation-code hash, which no live contract publishes — it
is pinned, and pinned safely because the derivation is tested against the pool
address the indexer publishes for a real position and every runtime derivation
is checked against what the source says is there.

### v4: one question, a list that has to come from elsewhere, and a hash

**The v4 manager cannot be asked what an address holds.** It does not implement
ERC-721's optional `Enumerable` extension — measured on 2026-09-18,
`tokenOfOwnerByIndex` reverts — so there is no call that turns an address into
its list, and an indexer is the only place that list exists. That is the weakest
link in this answer, and it is treated as one: every id the indexer offers goes
back to the manager, which is asked who owns it, and an id the manager
attributes to somebody else is dropped. What an indexer can do wrong is leave
something out, and that shows too, because `balanceOf` comes back in the same
batch and the page says so when the two disagree. Measured against both live
addresses, they did not: 104 ids for 104 held, and 7 for 7.

**What a position is, it is in one answer.** `getPoolAndPositionInfo` returns the
pool's whole key beside a single word with everything else packed into it, so
there is nothing to derive and nothing sequential — one aggregated call carries
an owner's entire list. Measured on 2026-09-18: 312 calls for 104 positions in
401 milliseconds.

**The two halves of that answer check each other.** A v4 pool's id is the
keccak256 of its key, and the packed word carries the first 25 bytes of the id
the key must hash to. So the key is hashed and compared, which is free and
conclusive: a misread offset, a word that is not a key's, a fee or a spacing
outside its own range, and the hash comes out somewhere else. The same check
refuses a token nobody minted, whose answer is six zero words — zeros do not
hash to zeros.

That is also why the indexer is asked for so little here. It supplies two
symbols, two decimals and the current tick; the fee, the tick spacing and the
hook all arrive from the chain already proved. In particular the indexer's
`feeTier` is never read — measured on 2026-09-15 it is the total fee of the
pool's latest swap rather than the key's fee — and there is nothing to gain from
it when the key is in hand.

### What each position has earned

The list says which positions an address holds. This says what they have made
and not yet taken out, and it is not an estimate: it is the protocol's own fee
accounting, read and differenced.

A pool stores no record of what any one position is owed. It keeps one running
total per token — fees per unit of liquidity since the pool began — and each
initialised tick keeps that total as it stood on the far side of it. A
position's share is the total inside its range now, less the total inside it
when the position was last touched, times its liquidity. Nothing is iterated
and nothing is annualised. The same arithmetic serves both protocols, over two
completely different reads: three calls per v3 pool and two per position, or
three storage words per v4 pool and seven per position.

**It is checked against the contract's own answer.** The v3 manager will say
what it would pay out — `collect`, asked rather than executed — and on sixteen
live positions this reproduced that figure exactly for fifteen. The sixteenth
came out one unit apart, for a reason worth keeping: the manager and the pool
each hold their own snapshot of the same range, taken at different moments, so
each floors a different difference. What is reported is the position's own
accounting, which is what a holder is asking about; what the pool would hand
over can differ from it by a unit either way. On the v4 side there is no such
call to compare with, so the check is structural instead — the liquidity stored
at the derived slot must equal what the PositionManager reports for that token,
and on 26 live positions all 26 agreed.

Two things about the arithmetic, both found by reading the chain:

- **The counters wrap, and the subtraction has to wrap with them.** They are
  uint256 totals that overflow and keep counting; Solidity does it `unchecked`
  on purpose, and the difference is correct modulo 2^256 even when the later
  value is the smaller one. A live v4 position was found storing a snapshot of
  about 2^256 - 5.8 x 10^38 — arithmetic that refused to wrap would have
  reported its earnings as a number with 41 more digits than the token has
  supply.
- **A figure that overflows `uint128` is reported as unreadable, not as a large
  number.** That is the field both protocols keep the amount in, and the v3
  manager is Solidity 0.7.6, where the cast wraps silently. Two live positions
  in a junk-token pool overflowed it: unwrapped the share came to 1.05 x 10^53,
  wrapped it came to 3.19 x 10^38, and `collect` offered a third figure again —
  the same one for both positions, because the pool's shared record had wrapped
  as well. None of the three is what anybody earned, so the page says it could
  not be read.

**The figure is an addition to the answer, not part of it.** A fee read that
fails costs the earnings and not the list, and a position it did not cover is
shown without the figure rather than with a zero — nothing earned and nothing
read being different facts, and this the one panel where a reader might act on
the difference.

### What both sides do with what they found

**Closed positions are counted, not listed.** An address that has minted and
burnt holds those tokens still: one live address read held 206 tokens across the
two protocols of which 151 were closed. A closed one is a receipt of a position
that was, and the page says how many there are rather than padding a list with
them.

**A protocol that could not be read is named rather than skipped.** Two
protocols mean two ways to fail, and they fail apart: the reads run at once, and
one failing does not take the other with it. But an answer that quietly covered
one of them would let the page tell an address with positions that it has none,
so the panel says which half is missing and that the counts beside it are about
the other protocol alone. Both failing is not a partial answer, and the panel
reports it unavailable.

**Earning first.** The list is capped for display and the protocols are read
separately, so an order that simply followed the reads would bury every v4
position behind a long v3 list. Whether a position is earning right now is what
a holder looks for first, so it is what decides the order.

Three things the chain got in the way of, all found by reading it rather than
assuming:

- **An `int24` arrives sign-extended to the whole 32-byte word**, not to three
  bytes, so a tick of -414400 comes back as `2^256 - 414400` and reading the low
  three bytes gives a number that is not a tick and does not look like one.
- **An `int24` packed beside other fields follows the opposite convention.** It
  cannot be sign-extended past its own bits without overwriting its neighbour,
  so the sign lives in bit 23 rather than bit 255 — and reading v4's packed ticks
  with the rule above returns a large positive number for every negative one,
  which is a wrong answer that looks like a right one. Both functions exist, and
  each is tested against the other's input.
- **A position covering every price a pool can express** — a common, deliberate
  choice — was being printed as `2.96E-39 – 3.38E38`. True, and no use to
  anybody; it is named now instead. For v4 it is named exactly, because a v4
  position carries its pool's tick spacing and the outermost usable ticks follow
  from it. For v3 it cannot be: no source publishes a v3 pool's spacing, so the
  test there has to allow for the widest any pool could have.

And it is the one panel here that describes somebody's own money, so it says
what that does and does not mean: the list is public — a position's owner is on
chain and anybody can read the same one — nothing is stored, and a range is not
a valuation.

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

On a cache hit the prose is on the page at once. The figures are never cached;
they are recomputed and rendered fresh every time, and only the prose about them
is reused. Failures are not cached either — pinning a rate limit that has since
cleared would be worse than repeating a call that costs nothing.

Like every in-memory store here it is per-instance, so a platform running several
copies calls the model once per copy. That costs a little more than a shared
store and is wrong in no way: an entry is either valid or absent, never stale in
one place and fresh in another.

Model: **`gpt-5.6-luna`** by default, overridable with `OPENAI_MODEL`. The job is
narrow, so a mid-tier model is the deliberate choice; what keeps it safe is the
contract, not the tier. The reasoning effort is `low` and the attempt times out
at 45 seconds, both from measurement — `minimal` is refused by this model with a
400, and `none` measured *slower* than `low` in both languages despite spending
no reasoning tokens at all.

**The paragraphs arrive as they are written.** A cold explanation took most of a
minute, under a page the reader could already read in full — and the reader saw
one pending panel for all of it. The model's answer is now streamed, and each
paragraph is released the moment it is complete: the transport accumulates the
deltas, scans for the end of a finished field, and hands it up. It reaches the
page through one promise and one `<Suspense>` boundary per section, so the
paragraphs appear one at a time with no client JavaScript at all.

**Nothing is released that has not been checked.** A finished paragraph is parsed
and then passed through the *same* per-section schema the whole answer is checked
against — the bounds, the refusal of any digit — before it is shown. Streaming
buys latency, not a weaker contract: a section that fails is not displayed, and
the reader is told the explanation is unavailable rather than shown prose nothing
verified.

Measured against the live model over twenty-four calls on 2026-09-17 — four pools
across both protocols, both languages, three runs each — English answers took 7.6
to 9.8 seconds and Turkish 8.1 to 11.7. Nothing was refused, the longest section
ran to 84% of its bound, and the largest spend was 27% of the output budget.

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

## When a page is slow, missing or broken

Three screens the framework used to answer for, in English, on a site published
in two languages.

**While a page is being read.** Every route that waits on a source has a loading
shell that says what it is doing — reading a pool from the indexer and the chain,
asking a few hundred token contracts what an address holds. Without one the
browser sits on the previous screen with nothing to show that a click did
anything, which it does more than it used to: links into counted pages are
deliberately not prefetched. Measured in production, the holdings shell reaches
the reader at 0.8 seconds against content at 17.8 on a fully cold instance.

**A URL that names nothing.** `not-found.tsx` is a page of this site — the
reader's language, the reader's theme, and a link to the one box where a pool
address actually goes, since putting one in the path is the likeliest way to
arrive there.

**A page that threw.** `error.tsx` says what happened, that it is worth trying
again, and that nothing of the reader's was involved — that last because this
application holds no account and stores nothing anybody looks up, and "something
went wrong" without saying so invites a reader to wonder what it lost. It shows
the framework's identifier when there is one and never the error's message, which
can carry a host, a port or a query.

That screen had one real obstacle. **An error boundary has to be a Client
Component, and a Client Component has no request to ask which language to render
in.** The three obvious ways round it are all worse: reading the cookie in the
browser shows a Turkish reader a flash of English while the effect runs,
importing the dictionary ships both languages of every string to every visitor on
every page, and rendering it in English gives up on the reader at the exact
moment an explanation has to land. So the layout, which *is* a Server Component
and already resolves the language to set the document's `lang`, hands ten strings
down through a context. They live in their own module and are served as
`t.error`, so there is one source for them and the translation check walks them
with everything else — and a test pins that nothing in them is a function, since
`Dictionary` is full of template functions and one added there would take down
every page rather than that screen.

`global-error.tsx` covers the layout itself failing. That file replaces the root
layout, so there are no styles, no fonts, no theme and no resolved language: it
writes its own document, styles itself inline as the refusal page in `proxy.ts`
does, and says its two sentences **in both languages**, because guessing wrong
there has no second chance to correct itself.

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

**Links to counted pages are never prefetched.** The router prefetches every
link that scrolls into view, and the proxy counts each of those as a request: it
cannot tell a prefetch from a navigation, because the framework strips the
router's own headers before the proxy runs. Nor is there anything in the
prefetch worth paying for — a page rendered per request is prefetched only down
to its loading skeleton, measured on the deployed application at 379 bytes for
the holdings page with no lookup in it. Left on, a list of twelve pools cost a
visitor twelve of their ten requests before they had clicked on one, and the
click was refused. So every link into a pool, a v4 pool or an address goes
through one component that turns prefetching off, and the click costs the one
request it should.

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

There are **six Client Components** in the whole application, and the list is
worth stating because everything else — including both switchers' markup, every
figure and every panel — is server-rendered. They are the theme toggle, the
wallet button, and four that exist because the framework requires an error
boundary to be one: the two boundaries themselves, the screen they render, and
the provider that carries the reader's language into them. See
[When a page is slow, missing or broken](#when-a-page-is-slow-missing-or-broken).

Reading a cookie and a header makes a route dynamic, so the landing page is no
longer statically prerendered. That is the price of being correct on the first
paint, and it costs no upstream calls.

Standing limits of every read here:

- Ethereum mainnet (`chainId` 1). Both Uniswap v3 and v4; no other chain and no
  other protocol.
- One pool per call, by address or by id. The two list reads are the exception
  and take no input at all.
- No transaction, signing or approval capability of any kind. A wallet is asked
  for its address and never reaches these readers.
- The subgraph alone cannot build a full `V3Pool`, because the pool entity does
  not report `tickSpacing`. `fetchEthereumV3Pool` adds it from the contract. A v4
  pool carries its spacing in the PoolKey and needs no such call — but it does
  need the chain for its real fee, which the indexer reports as something else.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

Open http://localhost:3000, then follow **Find a pool** to `/pool` and search for
a pair, or paste an Ethereum mainnet Uniswap v3 pool address — the pool
contract's own address, not a token's. A v4 pool is read at `/v4?id=` by its
32-byte id, and `/hooks` needs nothing typed at all.

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

0x88e6a0… tr  ok       sections 576/424/621/458 (worst 56% of bound)  tokens 746 (18% of budget, 162 reasoning)
0x2b21c6… tr  ok       sections 591/636/920/774 (worst 84% of bound)  tokens 984 (24% of budget, 189 reasoning)

worst section margin: 0x2b21c6… tr whatTheVolatilitySays at 920 of 1100
worst token margin:   0x7eb593… tr at 1101 of 4096
```

**Run it three times rather than once.** The same section has come back at 466
characters in one run and 812 in the next, so a single run says almost nothing
about the margin that matters. The four pools the bounds were last measured over
are named in the file's own header: a v3 pool that trades heavily and one that
barely trades, a hooked v4 pool and a hookless one, so every optional block in
the brief is in play at least once.

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
| `src/lib/wallet`      | What a browser wallet is asked for, and the parsing of what it answers. One method, never a signature. |
| `src/lib/crypto`      | Protocol hashing this application does itself: a v4 PoolId from its key, a storage slot from a pool id. |
| `src/lib/testing`     | Helpers shared between tests and belonging to no layer — currently a walk over a rendered element tree, for the one thing static markup cannot show. |
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
- **Freshness is judged by what the data describes, not by one clock for
  everything.** A snapshot is a moment — a price and a tick — and goes stale in
  minutes, so a source more than fifteen behind is refused. A daily history is a
  series of closed UTC days, and an indexer twenty minutes or six hours behind
  describes exactly the same days as one caught up; applying the same bar to it
  refused a whole analysis for a reason that did not bear on it, and the page
  said the pool had no range. Whether the source indexed through the last
  completed day is a real question and not a clock one — the adapter knows which
  days the window expects and reports the ones missing. Both policies still
  refuse a block time in our own future, which is not staleness but a response
  contradicting itself.
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

The market-data readers need all four of:

| Variable | Purpose |
| --- | --- |
| `THE_GRAPH_API_KEY` | Sent only as an `Authorization: Bearer` header, never in a URL or body. |
| `UNISWAP_V3_ETHEREUM_SUBGRAPH_ID` | The stable **Subgraph ID** from The Graph Explorer — not a deployment/IPFS id. The gateway resolves it to the latest sufficiently synced deployment. |
| `UNISWAP_V4_ETHEREUM_SUBGRAPH_ID` | The same, for v4. Not a credential — a Subgraph ID is public — so the working one is written into `.env.example` rather than left blank. Which one, and why that one, is in [Choosing the subgraph](#choosing-the-subgraph). |
| `ETHEREUM_RPC_URL` | Mainnet JSON-RPC endpoint for read-only `eth_call`, `eth_getLogs` and `eth_getCode`. **Treat the whole URL as a secret** — most providers embed the key in the path. |

Four more are optional, and the application is honest about running without each
of them:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Writes the plain-language explanation of an already-computed analysis. With it absent every figure is still computed and shown; only the prose is missing. |
| `OPENAI_MODEL` | Which model writes it. Blank uses the default; a name this application does not know the price of falls back to the default, and the page names whichever model actually wrote the text, so a fallback is visible rather than silent. |
| `UPSTASH_REDIS_REST_URL` | The shared rate-limit counter, so ten a minute means ten across every running copy rather than ten per warm instance. **Treat the URL as a credential alongside the token.** |
| `UPSTASH_REDIS_REST_TOKEN` | The bearer token for the same database. Both halves are required; either alone is read as no store at all. |

With the last two absent the limit still applies, counted in each instance's own
memory, and the shared half costs nothing — see [The rate limit](#the-rate-limit).

Reads are read-only throughout: the RPC path issues `eth_call`, `eth_getLogs`
and `eth_getCode` and nothing else.
There is no signing, no account access, and no transaction capability anywhere in
the codebase.

With any of them absent or blank, the reader that needs it returns an
`unavailable` result with reason `configuration-error` and makes no network
request — so the page reports a configuration problem rather than a data one.

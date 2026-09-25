import type { HookPermission, HookTopic } from "../../schemas/hookPermissions";
import type { DataFailureNotice, DataWarningNotice } from "../../schemas/notices";
import { ERROR_COPY } from "./errorCopy";
import type { Locale } from "./locales";

/*
 * Every string the interface shows, in every published language.
 *
 * `Dictionary` is inferred from the English entry, so every other one is checked
 * against it by the compiler: a key added on one side and forgotten on another
 * is a build error rather than an English word surfacing mid-sentence. What the
 * compiler cannot see — a key that is present and still English — is what
 * `translated.test.ts` is for.
 *
 * Interpolated text is a function rather than a template with placeholders. A
 * placeholder string has to be split and rejoined at the call site, which is
 * where word order gets lost — and word order is exactly what differs between
 * these languages. Arabic puts the verb first, Hindi puts it last, and Chinese
 * counts its days with a measure word the English sentence has no room for.
 *
 * Not here: the warnings and failure messages the data layer produces. Those are
 * fixed sentences by design, and turning them into codes the interface resolves
 * is a change to that layer rather than to this one.
 */

const en = {
  metadata: {
    title: "LiquidityWise",
    description:
      "An educational AI-assisted advisor for Uniswap v3 and v4 liquidity strategies. Guidance only — not financial advice.",
    v4Title: "A Uniswap v4 pool · LiquidityWise",
    v4Description:
      "What one Uniswap v4 pool is, and what its hook is permitted to do.",
    holdingsTitle: "What an address holds · LiquidityWise",
    holdingsDescription:
      "The tokens found at one Ethereum address, and the Uniswap v3 pools they can go into.",
    compareTitle: "Fee tiers side by side · LiquidityWise",
    compareDescription: "Every Uniswap v3 fee tier of one pair, read with the same horizon, width and deposit.",
    poolTitle: "Pool range analysis · LiquidityWise",
    poolDescription:
      "A price range for one Ethereum mainnet Uniswap v3 pool, drawn from how far its price has actually moved.",
    hooksTitle: "The hooks on Uniswap v4 · LiquidityWise",
    hooksDescription:
      "Every hook the week's busiest Uniswap v4 pools name, and what each one is permitted to do — read from its own address."
  },

  preferences: {
    languageLabel: "Language",
    selectLanguage: "Select language",
    closeLanguages: "Close",
    /*
     * Said in the reader's own language, at the moment they choose it, rather
     * than left to be discovered paragraph by paragraph. A reader who is told
     * can decide; one who meets it halfway down a page cannot.
     */
    partlyTranslated:
      "This language is still being translated. The menus, labels and headings are in it; the longer explanations are still in English.",
    themeLabel: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    /*
     * The band every pool opens at, set once in the header rather than on
     * every pool. A link naming its own band still wins over it.
     */
    rangeLabel: "Range preferences",
    rangeIntro:
      "The horizon, width and deposit every pool opens at. A link that names its own still wins, and the form under each analysis changes that page only.",
    rangeSave: "Save",
    rangeReset: "Forget",
  },

  disclaimer: {
    ariaLabel: "Important disclaimer",
    title: "Educational tool — not financial advice.",
    body: "This application explains Uniswap mechanics and helps you reason about parameter choices. It does not predict prices, does not guarantee returns, and cannot verify that any smart contract is safe. Liquidity provision carries real risk, including impermanent loss and total loss of funds. Always verify contract addresses and do your own research.",
  },

  home: {
    badge: "Early foundation",
    title: "LiquidityWise",
    introBeforeV3: "An educational advisor for Uniswap ",
    introBetween: ", growing towards ",
    introAfterV4:
      ". Find a pool by its pair, read a price range worked out from how far that pair has actually moved, and get it explained in plain language. Every figure is computed and cross-checked before a model is allowed to describe it — and the model is never allowed to state one.",
    workingTodayHeading: "Working today",
    workingTodayBody:
      "Search for a pool by its pair, or paste a v3 pool address or a v4 pool id. You get the pool's verified configuration and current state, the last month of daily prices drawn against a suggested range, how far the pair has actually moved, and the range that follows from it — with the horizon and the width yours to change. Beside it: what the pool charged and what it actually collected, how its recent days sat against the range, what the same method did on days it never saw, what a position gives up against simply holding, what each of the other widths would have done instead, and — for a deposit whose size is yours to set — what it would have taken of the fees charged on the days the price stayed inside the range. And the same range read the other way round: each of its halves is a one-sided position, and the page says what each would convert at if the price passed through it. What a swap through the pool costs, for the largest one that can be priced without assuming anything. And a directory of every hook the week's busiest v4 pools name, with what each is permitted to do read out of its own address. A v4 pool also says what its hook is permitted to do, in plain words, read out of the hook's own address. An address can be looked up for the pools its tokens can go into, and for the Uniswap v3 positions it already holds — each with the prices it covers and whether the pool is inside them now. Then a plain-language explanation of all of it, in English or Turkish. No model touches any of those figures, none of them is estimated to fill a gap, and the prose has nowhere to put a number of its own.",
    analysePool: "Find a pool →",
    methodHeading: "How it works",
    methodSteps: [
      {
        step: "Verified data",
        detail:
          "Pool facts are fetched from Uniswap subgraphs and read on-chain, never assumed. The price is cross-checked against the state the pool reports for itself.",
      },
      {
        step: "Deterministic maths",
        detail:
          "Volatility, the price band and the position range are computed in plain TypeScript, so the same pool always yields the same numbers.",
      },
      {
        step: "AI interpretation",
        detail:
          "A model explains what those figures mean. It is handed them already checked, and the contract it answers under has nowhere to put a number.",
      },
    ],
    coverageHeading: "Not built yet",
    coverage: [
      {
        version: "Uniswap v3",
        features: [
          {
            name: "Gas, and the cost of following the price",
            summary:
              "A range the price has left has to be closed and reopened to follow it, which costs gas and turns a divergence on paper into one that has been realised. None of that is counted anywhere here.",
          },
        ],
      },
      {
        version: "Uniswap v4",
        features: [
          {
            name: "What a hook actually does",
            summary:
              "A v4 page says what a hook is permitted to do, because the protocol enforces that much and it is read out of the hook's own address. Reading the contract to say what it does with those permissions is a different problem, and this application does not attempt it.",
          },
          {
            name: "TWAMM-style strategies",
            summary:
              "Spreading a large order over time instead of executing it against a single point of liquidity. The half of this an analysis page can already answer is there: what a swap costs against the liquidity at the current price, and how large a swap it can price at all. Scheduling one over time is a hook's job, and this application does not model a hook's behaviour.",
          },
        ],
      },
    ],
    footer:
      "None of the above exists yet. What does is everything higher up this page: a pool found by name, figures computed and cross-checked, and prose that is verified before it is shown. A wallet can be connected, and all that is asked of it is its address. The one thing this application keeps is a Telegram link a reader makes themselves — an address beside a chat id, deleted the moment they send the bot /stop and out of the encrypted backups within seven days — and nothing here can sign or send a transaction on your behalf.",
  },

  pool: {
    back: "← LiquidityWise",
    invalidAddress:
      "That is not an Ethereum address. An address is 0x followed by exactly 40 hexadecimal characters.",
    loading: "Reading live Uniswap data…",
  },

  /*
   * Facts about the pool, and the sentence that keeps them from being read as
   * something else. The gap between "the pool collected this" and "you would
   * have earned this" is where a reader is likeliest to fill in a number nobody
   * gave them.
   */
  activity: {
    heading: "What the pool actually did",
    volume24h: "Volume, 24h",
    volume7d: "Volume, 7d",
    volume30d: "Volume, 30d",
    fees30d: "Fees charged, 30d",
    feesNote: "The whole pool's, shared among everyone whose liquidity was active.",
    tvl: "Total value locked",
    occupancySentence: (days: string, inside: string, outside: string, crossed: string) =>
      `Of the last ${days} days, ${inside} stayed entirely inside this range, ${outside} sat entirely outside it, and ${crossed} crossed an edge.`,
    undeterminedNote:
      "A day that crossed an edge spent part of itself inside and part outside, and the source's daily high and low cannot say how much of each.",
    feesWhileInside: "Fees charged on the days entirely inside",
    /*
     * Shown instead of that figure when the pool's hook may take a share of a
     * swap. The fees are still real; what cannot be stated is their relationship
     * to a position, which is the only reason anyone reads the figure.
     */
    feesWithheld: "Not shown for this pool",
    feesWithheldNote:
      "This pool's hook is permitted to take a share of a swap, and nothing in the source separates the hook's share from the liquidity providers'. The fees above are what the pool charged, which is a fact; tying a portion of them to this range would be a claim about a position nobody can check.",
    inSample:
      "These are the same days the range was drawn from, so they show how it was fitted rather than testing how it holds up — and the range is centred on today's price, which nobody could have opened a month ago. Read them as how the pool's recent movement sits against the range, not as a backtest.",
    notYourEarnings:
      "None of this is what a position would earn: it is what the whole pool charged. What a deposit would have taken of it — its share of the liquidity active while the swaps happened — is the panel directly below, and even that is fees and nothing else.",
  },

  /*
   * The half of the fee question this application used to refuse.
   *
   * The refusal was honest while it lasted: the figures above are the pool's,
   * and turning them into a position's needs a size and a share of the active
   * liquidity. Both are read now, so the page answers instead of declining —
   * and every sentence here exists to stop the answer being read as a yield.
   */
  deposit: {
    heading: "What a deposit would have collected",
    unavailable: "What a deposit would have taken of those fees cannot be worked out for this pool.",
    withheldNote:
      "For the same reason as the figure above it: a hook here may take a share of the swap, and nothing in the source separates its share from the providers'. A fraction of a total that cannot be attributed to this range cannot be attributed to a deposit in it either.",
    deposited: "Deposit",
    depositedNote: "The size this is worked out for. Change it in the form above.",
    collected: "Fees it would have taken",
    collectedNote: (days: string) => `Over the ${days} days the price never left the range.`,
    ofDeposit: "Of the deposit",
    ofDepositNote:
      "Those fees against the money put in, over those days and no others. Not a yearly rate, and nothing here turns it into one.",
    sentence: (deposit: string, days: string, poolFees: string, yourFees: string) =>
      `On the ${days} days the price never left this range, the pool charged ${poolFees} in fees. A deposit of ${deposit} placed in the range would have taken about ${yourFees} of that — its own liquidity as a share of the liquidity that was actually active on each of those days.`,
    unmeasurableNote: (days: string) =>
      `${days} further days sat inside the range, but the source published no fees or no active liquidity for them, so they are not in the total.`,
    dilution:
      "A larger deposit does not collect proportionally more. The share is your liquidity over everybody's including your own, so past a certain size most of what you add dilutes what you already have — which is why the amounts offered are a thousandfold apart.",
    caveat:
      "Fees only, and days that have already happened. It assumes the position was open for every one of them and that nothing moved in response to it, and it says nothing about what the next thirty days will pay. What a position gives up against simply holding the two tokens is the comparison further down this page, and the two have to be read together.",
  },

  realizedFee: {
    heading: "What it actually charged",
    intro:
      "The fee the pool states is one number. This is what swappers actually paid, divided back out of the same days as the figures above: a day's fees over that day's volume. It needs no extra request and nothing from the hook.",
    declared: "Stated fee",
    /** How a stated fee was arrived at, where the protocol takes a cut on top. */
    statedNote: (lp: string, protocol: string) =>
      `${lp} to liquidity providers and ${protocol} to the protocol, combined the way the PoolManager charges them — which is what a swapper pays, and what the fees above are made of.`,
    noDeclared: "None",
    noDeclaredNote: "This pool's key carries no fee. Its hook sets one per swap.",
    median: "Typical day",
    spread: "Lowest to highest day",
    spreadValue: (lowest: string, highest: string) => `${lowest} – ${highest}`,
    aggregate: "Whole window",
    aggregateNote:
      "The window's fees over the window's volume, so a busy day counts for more than a quiet one.",
    daysMeasured: "Days measured",
    daysMeasuredNote: (skipped: string) =>
      `${skipped} more day(s) in the window traded nothing, or were missing a figure, so no rate could be divided out of them.`,
    /*
     * The three verdicts. They exist as separate sentences rather than one with
     * a number in it because they are three different things to know, and the
     * one that matters most is the one a single wording would blur.
     */
    verdictMatches:
      "These agree on every measured day. The declared rate is the rate that was charged.",
    verdictDiffers: (differing: string, measured: string) =>
      `These do not agree. On ${differing} of ${measured} measured days the pool charged something other than its declared rate, so the tier above describes what the pool was created with rather than what a swap costs.`,
    verdictNoneDeclared:
      "There is nothing to compare against: this pool declares no rate at all. The figures here are what its hook actually set.",
    notLpShare:
      "None of this is what reaches a liquidity provider. This pool's hook is permitted to take a share of a swap, and the source does not separate the hook's share from the providers'. What these figures say is what a swap cost, not who received it.",
    unavailableHeading: "What this pool charges could not be measured",
  },

  outOfSample: {
    heading: "Tested on days it never saw",
    showFolds: "Show each stretch",
    intro: (horizon: string) =>
      `Every figure above is fitted to the days it describes. These are not. The method was stepped back ${horizon}, run again on the prices before that point only, and centred on the price at that point — one somebody standing there would actually have seen. Then it was laid over the days that followed, and the whole thing repeated back through the history as many times as it had room for.`,
    folds: "Folds",
    foldsNote: "How many times the history had room to fit a band and then test it.",
    fullyInside: "Days entirely inside",
    fullyOutside: "Days entirely outside",
    undetermined: "Days that crossed an edge",
    verdict: (inside: string, measured: string, folds: string) =>
      `Across ${folds} folds, ${inside} of ${measured} days stayed entirely inside the band this method would have drawn.`,
    foldPeriod: "Days checked",
    foldVolatility: "Fitted volatility",
    foldVerdict: "In / out / crossed",
    foldsCaption: "Each stretch the method was tested over, oldest first",
    foldColumns:
      "Each row is one fold: the days it was checked over, the volatility its own fit measured — not the figure above — and how those days sat against the band that fit produced.",
    /*
     * The two sentences that stop a total becoming a claim about the method.
     * Nobody held these bands, and the folds are not independent of each other.
     */
    notIndependent:
      "A few folds on one pool are not a measure of how often the method holds, and say nothing about what happens next. Consecutive fits overlap, too — a 31-close fit is longer than a step of one horizon — so the folds are not independent of each other.",
    notHeld:
      "Nobody held these bands. Each is what the method would have suggested at that moment, laid over prices that then happened — and the days above, which the suggested range was drawn from, are not these days.",
    unavailableHeading: "This pool could not be checked out of sample",
  },

  divergence: {
    heading: "Compared with just holding",
    intro:
      "What a position in this range would be worth compared with simply holding the two tokens, at each price. Exact arithmetic rather than an estimate — but it counts price movement and nothing else. It says nothing about the fees a position would earn, and fees are precisely what a liquidity provider is paid for this difference.",
    price: (base: string) => `Price of ${base}`,
    loss: "Position against holding",
    entryRow: "The price this is measured from — the pool's current price.",
    impermanentNote:
      "This is what is usually called impermanent loss. It is only impermanent if price comes back: a position closed at a price other than the one it opened at has realised it.",
  },

  /*
   * The other thing the same range can be. It was on the front page's list of
   * what this application could not do, and what it needed turned out to be no
   * data at all: a range order's average price is fixed by the protocol's own
   * formulas and falls out of the two bounds already on the page.
   */
  rangeOrder: {
    heading: "Selling and buying through the range",
    intro:
      "The range above is two-sided: money on both sides of the price, earning fees for as long as the price stays between them. Split it at the price and each half is a different instrument. A position sitting entirely above the price holds one token and nothing else, and the pool sells that token for the other as the price rises through the band. Below the price it does the reverse. That is what a range order is, and both halves of this range are one.",
    selling: (token: string) => `Selling ${token}`,
    buying: (token: string) => `Buying ${token}`,
    band: "Band",
    bandNote:
      "Where the position sits. Its inner edge is the first price step past the one the price is in, so it starts out holding none of what it is converting into.",
    average: "Average price",
    averageNote: "What the conversion works out at, if the price crosses the whole band.",
    against: "Against the current price",
    exact:
      "That average is the geometric mean of the two bounds — exactly, and whichever way round the prices are written. It follows from the protocol's own formulas for what a position holds at each end of its band, and the amount put in cancels out of it: a hundred dollars and a million convert at the same price.",
    onlyIfThrough:
      "And only if the price crosses the whole band. One that turns back inside leaves the position holding some of each, at no single price at all — which is the same thing the range above it is for, arrived at by accident.",
    notAnOrderBook:
      "Nothing here schedules the conversion and nothing guarantees it. This is not an order book: an order the price never reaches is the ordinary outcome rather than a failure, and there is no queue and no counterparty waiting. What there is instead is that the position collects the pool's fees while the price is inside the band, rather than paying them.",
    unavailable: "This range has no one-sided half to describe.",
  },

  /*
   * The one panel about using a pool rather than providing to it.
   *
   * It exists because nothing else here answers the first question anybody asks
   * of a pool, and it stops where the certainty does: at the edge of the price
   * step, because liquidity beyond it is a thing this application has not read.
   */
  swapDepth: {
    heading: "What a swap costs here",
    intro:
      "Everything above is about providing liquidity. This is about using it. A pool's liquidity is constant between the price steps it is built on, so a swap that stays inside the step the price is in can be priced from the protocol's own formulas with nothing assumed — and one step further cannot, because another position's liquidity may begin there and this application does not read the liquidity at every price.",
    /*
     * "into the pool", because the panel above this one also has a leg called
     * "Selling WETH" and it means something else there: a position that sells as
     * the price passes it, rather than a swap sent now. Two labels reading the
     * same on one page is a reader mistaking one for the other.
     */
    selling: (token: string) => `Selling ${token} into the pool`,
    amount: (amount: string, symbol: string) => `${amount} ${symbol}`,
    largest: "Largest swap priced here",
    largestNote:
      "What goes in before the price reaches the end of the step it is in. Not a limit: a larger swap works, and this page cannot say what it costs.",
    cost: "What it gives up",
    costNote: "How far the swap's average sits from the price on the screen.",
    oneSideOnly:
      "Only one direction is shown. The price is sitting close enough to the end of its step that the room the other way is a rounding error rather than a swap, and this page will not print a figure it cannot check.",
    geometric:
      "That average is the geometric mean of the price now and the price the swap ends at — the same identity the one-sided positions above rest on, seen from the other side of the trade. A swap crossing a band pays it; a position sitting in that band receives it.",
    whyItDiffers:
      "The two directions are not the same size because the price sits somewhere inside its step rather than in the middle of it. What is worth comparing between pools is the size itself: it is what this market absorbs before it moves, and it is the reason anybody breaks a large order into small ones instead of sending it at once.",
    hookMayAlter:
      "This pool's hook is permitted to change what a swap costs — to rewrite the fee as each swap happens, to price the swap itself instead of the pool's curve, or to take a share of it afterwards; the hook section above says which. The figures here are what the pool's curve charges, and they hold only if the hook stays out of the way. Nothing read here can tell whether it does.",
    unavailable: "What a swap would cost cannot be worked out for this pool.",
  },

  compare: {
    heading: "Every fee tier of this pair, side by side",
    intro: (pair: string) =>
      `Each ${pair} pool below was read with the same horizon, the same width and the same deposit, so their figures stand on one footing. They describe days that have already happened, not the days to come. The v3 pools stand in order of fee and the v4 pools deepest first, as the note under them explains — none is ranked by what it would have earned.`,
    depositFeesNote: (days: string) => `Over the ${days} days the price stayed inside the range.`,
    daysInside: "Days fully inside the range",
    daysInsideValue: (inside: string, measured: string) => `${inside} of ${measured}`,
    unavailable: "This tier could not be read just now.",
    open: "Open the full analysis",
    link: "Set the tiers side by side",
    onlyOne: (pair: string) =>
      `${pair} trades in one v3 pool only, so there is nothing to set beside it.`,
    readTogether:
      "Fees are half of it. What a range gives up against simply holding the two tokens is on each pool's own page, and the two have to be read together.",
  },

  feeTiers: {
    heading: "Where else this pair trades",
    intro: (pair: string) =>
      `${pair} trades at more than one fee tier. Each is a separate pool with its own liquidity, its own price history and its own range — the figures above describe this one only.`,
    onlyOne: (pair: string) =>
      `${pair} trades at only this fee tier on Ethereum mainnet. Everything above is about the whole pair, because the pair is this one pool.`,
    thisOne: "You are reading this one",
    feeTier: "Fee tier",
    holds: "Holds",
    reservesUnread: "What this pool holds could not be read from the chain.",
    open: "Analyse this tier",
    /*
     * The sentence the panel exists to carry. A list of pools ordered beside
     * dollar figures invites exactly one conclusion, and it is the wrong one.
     */
    biggerIsNotBetter:
      "A tier holding more liquidity is a larger crowd sharing the same swap fees, not a better place to be. Which one suits a position depends on how far the price moves and how often, and that is measured per pool — so the honest way to compare them is to open each and read its own figures. The horizon and multiplier you chose travel with the link.",
    reservesNote:
      "These are the balances the two token contracts report for each pool, read from the chain rather than from an indexer. The indexer's own figure was measured against them and overstates what is there by between 1.3 and 13 times, so it is not shown. Two token amounts rather than one dollar figure, because every tier here holds the same two tokens and nothing has to be priced to compare them.",
    unavailableHeading: "The pair's other fee tiers could not be read",

    /*
     * The other protocol. On a v3 page the same two token contracts on v4; on
     * a v4 page, v4's other pools of the pair and then v3's. Both lists say
     * what "same pair" means here — the same two contracts — because ether and
     * wrapped ether are two different tokens to a pool, whatever they are to
     * a person.
     */
    onV3: "On Uniswap v3",
    onV4: "On Uniswap v4",
    v4Intro: (pair: string) =>
      `The v4 pools that trade ${pair} — the same two contracts. A v4 pair can be many pools: the fee is any number, the price step is free, and every hook makes another.`,
    v4None: (pair: string) => `No Uniswap v4 pool trades ${pair} with these two contracts.`,
    v4OnlyThis: (pair: string) => `On v4, ${pair} trades at only this pool.`,
    v3Intro: (pair: string) => `The v3 pools that trade ${pair} — the same two token contracts, at each fee tier.`,
    v3None: (pair: string) => `No Uniswap v3 pool trades ${pair} with these two contracts.`,
    v3NoNative:
      "This pool holds the chain's own ether, and v3 cannot: every v3 currency is a token contract. Its nearest v3 pools trade wrapped ether instead, which is a different token to a pool.",
    depth: "Depth at the current price",
    depthValue: (ether: string) => `≈ ${ether} ETH`,
    stateUnread: "The pool's liquidity could not be read from the chain.",
    hook: "hook",
    noHook: "no hook",
    hookAltersSwaps: "may change what a swap costs",
    priceStep: (step: string) => `step ${step}`,
    v4Ordering:
      "Ordered by depth at the current price — the pool's active liquidity and price, read from the PoolManager's storage — because a v4 pair is mostly pools somebody initialised and left, and depth is what tells those apart. It says how much a swap can draw on, and nothing about which pool is better: a deeper pool is a larger crowd sharing the same fees.",
    moreNotShown: (count: string) => `${count} more are not shown; they are shallower than these.`,
    v4Unavailable: "The pair's v4 pools could not be read",
    v3Unavailable: "The pair's v3 pools could not be read",
  },

  /*
   * The same method at every width the form offers, on one page. The two day
   * counts are different kinds of figure, and the note under the table says
   * which is which: the first is the fit, the second the check.
   */
  widths: {
    heading: "The other widths",
    intro:
      "The same method at each width the form offers, so the trade-off can be seen rather than told: a wider range holds more of the days, and spreads the same deposit over more prices — which is the last column, and it is the arithmetic of the protocol rather than an estimate.",
    width: "Width",
    range: "Range",
    recent: (days: string) => `Inside, of the last ${days} days`,
    unseen: "Inside, on days it never saw",
    insideOf: (inside: string, total: string) => `${inside} of ${total}`,
    unseenNone: "not enough history",
    feeShare: "Fee share while inside",
    feeShareValue: (times: string) => `${times}×`,
    chosen: "shown above",
    columnsNote:
      "The first count is over the days each range was drawn from, so it says how that width was fitted, not how it held. The second is the check above, run for each width: the method stepped back a horizon and laid over the days that followed.",
    /*
     * The one column that is a comparison rather than a reading, and the one
     * most easily read as a promise. It is exact arithmetic about a day inside
     * the range, and it says nothing about the days outside it — which is the
     * half the column beside it measures.
     */
    feeShareNote:
      "The last column is what the same deposit would take of the fees charged on a day the price stays inside that range, against the width shown above — so that one reads as one. It is the protocol's own position arithmetic rather than an estimate: a narrower range turns the same money into more liquidity over fewer prices. It assumes the rest of the pool's liquidity is unchanged, which a deposit large enough to move it would not leave true, and it says nothing about the days price spends outside.",
    notAdvice:
      "None of these is a recommendation. A narrower range takes a larger share on the days it holds and nothing at all on the days it does not, and which of those matters more depends on what the position is for — which nothing here knows.",
  },

  parameters: {
    heading: "Change the range",
    apply: "Recalculate",
    /*
     * The same words label the figures in "how this range was drawn", so a
     * reader changing one can see which number they are changing.
     */
    horizonLabel: "How far ahead",
    widthLabel: "How wide",
    depositLabel: "How much",
    days: (days: string) => `${days} days`,
    sigma: (value: string) => `${value}σ`,
    /** A word for the offered widths; a width typed into the URL gets none. */
    widthChoice: (sigma: string, word: string | null) =>
      word === null ? sigma : `${word} (${sigma})`,
    widthWords: { tight: "Tight", medium: "Medium", wide: "Wide", veryWide: "Very wide" },
    note: "The horizon says how far the measured movement is laid forward. It does not change the measurement: volatility always comes from the last 30 completed days, whichever horizon is chosen. The width multiplies that movement; a wider range is left less often, and it is not a confidence level.",
    fellBack:
      "Part of what was asked for could not be read, so the default was used where that happened. The horizon and width actually used are shown above.",
    /** Under the form: which of the two things that set a band this one is. */
    preferenceHint:
      "This changes this page. To change what every pool opens at, use the range preferences in the header.",
  },

  holdings: {
    heading: "What this address holds",
    intro:
      "The tokens found at this address, and the pools they can go into. Nothing here is stored unless you ask for Telegram alerts below, and the address is public information — the same list is visible to anyone who looks it up.",
    forAddress: "Address",
    loading: "Asking the token contracts what this address holds…",
    /*
     * The sentence that keeps the answer honest. Nothing can list an address's
     * tokens, so the width of the search is part of the answer.
     */
    howItLooked: (tokens: string, v3Pools: string, v4Pools: string | null) =>
      `A token's balance lives inside the token's own contract, so there is no list of what an address owns — only tokens that can be asked, one at a time. This asked ${tokens} of them: every token in the ${v3Pools} most-traded Uniswap v3 pools on Ethereum mainnet${v4Pools === null ? "" : `, and every currency in the ${v4Pools} v4 pools that traded the most over the last seven days, the chain's own ether among them`}. Something held outside that set is not missing from this page because the address does not hold it.`,
    /*
     * Said out loud when the v4 net could not be cast, because a page that
     * listed only v3 pools and said nothing would read as "no v4 pool takes
     * what you hold", which nobody checked.
     */
    v4NotSearched:
      "Uniswap v4 pools were not searched: their list could not be read. Ether and the currencies of v4 pools are absent from this page for that reason and no other.",
    /** A row's protocol, beside its fee. The names are the protocol's own and are not translated. */
    hookTag: "hook",
    holdingsHeading: "Tokens found",
    nothingFound:
      "None of the tokens checked were found at this address. That is not the same as an empty wallet — see how the search was made, above.",
    poolsHeading: "Pools these tokens can go into",
    bothSides: "You hold both sides",
    oneSide: "You hold one side",
    bothSidesNote:
      "Both of this pool's tokens were found at the address, so a position here needs no swap first.",
    oneSideNote:
      "One of this pool's two tokens was found. A position here needs the other side as well, which means swapping part of what you hold.",
    moreNotShown: (count: string) =>
      `${count} more are not shown. The ones above are the most traded of them, in the order the data source reports — which is a claim about how busy a pool is and about nothing else.`,
    analyse: "Analyse this pool",
    notAdvice:
      "This is a list of what is possible, not a list of what is worth doing. Which of these pools suits anything depends on the figures on each pool's own page, and on what a position is for — neither of which this list knows.",
    unavailableHeading: "This address could not be read",
    invalidAddress: "That is not an Ethereum address, so nothing was looked up.",
    noAddress: "Connect a wallet on the front page, and this page will show what it holds.",
  },

  v4: {
    heading: "A Uniswap v4 pool",
    intro:
      "What this pool is, read from its own key. A v4 pool is not a contract of its own: it lives inside one PoolManager and is named by a hash of the five things that define it — the two currencies, the fee, the price step, and the hook.",
    poolId: "Pool id",
    pair: "Currencies",
    fee: "Fee",
    /*
     * Read from the pool's own key on the chain — the log that created it —
     * and never from the indexer, whose figure was measured to be the total
     * fee of the latest swap rather than the key's fee.
     */
    feeNote: (swap: string, lp: string, protocol: string) =>
      `Read from the pool's own key on the chain. A swap pays ${swap}: this ${lp} to liquidity providers, and ${protocol} to the protocol on top.`,
    feeNoteNoProtocol:
      "Read from the pool's own key on the chain. The protocol takes nothing on top, so this is what a swap pays.",
    dynamicFee: "Set by the hook, per swap",
    dynamicFeeNote:
      "This pool's key carries the dynamic-fee flag instead of a fee, so what a swap costs is decided by the hook at the moment it happens. This read did not observe one, and there is no fee here to report.",
    /*
     * A list row for a pool whose key the chain did not answer for. The fee is
     * a fact about the pool that this read does not have, and nothing else —
     * not the indexer's figure — stands in for it.
     */
    feeUnread: "fee not read",
    feeUnreadNote:
      "The pool's fee lives in the key it was created with, on the chain, and this read could not fetch it. Nothing else is a substitute for it.",
    protocolFee: "Protocol fee",
    protocolFeeNone: "None",
    protocolFeeNote:
      "Taken by the protocol on top of the pool's fee, on every swap. Set by governance, and read from the pool's state on the chain.",
    protocolFeeByDirection: (token0: string, token1: string) =>
      `Differs by direction: the first when ${token0} is sold, the second when ${token1} is.`,
    priceStep: "Price step",
    priceStepNote: (spacing: string) =>
      `The finest step at which a position's edges can be placed in this pool — its tick spacing of ${spacing}. Part of the pool's key in v4, so unlike v3 it needs no separate contract call.`,
    nativeCurrency: "Native ether",
    nativeCurrencyNote:
      "The zero address here is not a missing field. v4 lets a pool hold the chain's own ether rather than a wrapped token, and that is what this is.",
    hookHeading: "The hook",
    noHook: "This pool runs without a hook.",
    noHookNote:
      "Nothing runs alongside its swaps or its deposits, so it behaves the way a v3 pool does.",
    hookMay: "What it is permitted to do",
    /*
     * One sentence per permission, under the moment a reader can picture it
     * at, with the protocol's own names folded away beneath. The names say
     * where in the protocol's code a hook is called; what a reader needs is
     * what that lets it do to a swap, a deposit or a withdrawal of theirs.
     * Every sentence is a "may": the address grants the moment, not the act.
     */
    permissionTopics: {
      swaps: "Around swaps",
      liquidity: "Around deposits and withdrawals",
      creation: "When the pool was created",
      donations: "Around donations",
    } satisfies Record<HookTopic, string>,
    permissionWords: {
      beforeSwap:
        "Run before every swap, where it can refuse the swap and, on a pool with a dynamic fee, set what that swap pays.",
      afterSwap: "Run after every swap, where it can still refuse the swap.",
      beforeSwapReturnsDelta:
        "Take tokens out of a swap, or put its own in, before the pool prices it — so a swap here need not follow the pool's own curve.",
      afterSwapReturnsDelta: "Take a share of a swap after the pool has priced it.",
      beforeAddLiquidity: "Run before every deposit, where it can refuse the deposit.",
      afterAddLiquidity: "Run after every deposit, where it can still refuse the deposit.",
      afterAddLiquidityReturnsDelta:
        "Take tokens from a deposit as it is made, or add tokens to it.",
      beforeRemoveLiquidity: "Run before every withdrawal, where it can refuse the withdrawal.",
      afterRemoveLiquidity: "Run after every withdrawal, where it can still refuse the withdrawal.",
      afterRemoveLiquidityReturnsDelta:
        "Take a share of a withdrawal as it is made, or add tokens to it.",
      beforeInitialize: "Run once, before the pool was created. That has already happened.",
      afterInitialize: "Run once, after the pool was created. That has already happened.",
      beforeDonate:
        "Run before a donation to the pool's providers, where it can refuse the donation.",
      afterDonate:
        "Run after a donation to the pool's providers, where it can still refuse the donation.",
    } satisfies Record<HookPermission, string>,
    noPermissions:
      "Nothing around swaps, deposits or donations: the protocol calls it at none of those moments. What a hook like this can still do is set the fee of a pool whose fee is dynamic.",
    permissionNames: "The protocol's own names for these",
    /*
     * The other side of the swap warning. A hook that runs when a provider
     * withdraws can refuse the withdrawal — a hook that reverts reverts the
     * withdrawal with it — and one holding the returns-delta flag can take a
     * share of what comes out. Said above the list, like the swap warning,
     * for the reader who stops reading.
     */
    withdrawalWarning: (share: boolean): string =>
      share
        ? "This hook runs when a provider withdraws. It is permitted to refuse a withdrawal, and to take a share of what is withdrawn. Whether it ever does is not knowable from here."
        : "This hook runs when a provider withdraws, and is permitted to refuse a withdrawal. Whether it ever does is not knowable from here.",
    /*
     * The sentence this whole page exists to carry. A hook's permissions are not
     * stored anywhere — the address is the permission list — so this is the one
     * claim about a hook that can be made without trusting somebody.
     */
    hookAddressIsThePermission:
      "These are read out of the hook's own address. v4 stores a hook's permissions nowhere: a hook is deployed to an address whose last fourteen bits spell out which callbacks the PoolManager will invoke, and the PoolManager checks those bits rather than asking the contract. So this says what the hook may do, never what it does — one permitted to rewrite the fee on every swap may always return the same fee, and that is not knowable from here.",
    alterSwapWarning:
      "This hook is permitted to change what a swap costs or pays. Any figure drawn from price history — a suggested range, a fee tier, a comparison against simply holding — assumes the pool charges what it says and pays what the curve says. Neither assumption is safe here, and none of it is visible in a price series.",
    /*
     * Replaced the line saying there was no analysis, on the day there was one.
     * What it has to do now is harder: say why a band drawn from price history
     * is as true here as anywhere, without letting that cover the fees, which
     * are the part a hook can move.
     */
    analysisScope:
      "Below is the range analysis. The range comes from prices that already happened, so it holds here exactly as it does for a pool with no hook — a hook cannot retroactively change where price went. What a hook can change is what a swap costs, so the rate this pool charged is measured from what it collected rather than taken from the fee above.",
    unavailableHeading: "This pool could not be read",
    invalidId:
      "That is not a v4 pool id. A v4 pool is named by a 32-byte hash — 0x followed by 64 hexadecimal characters — not by a contract address.",
    noId: "Paste a v4 pool id to see what the pool is and what its hook may do.",
    loading: "Reading this v4 pool, from the indexer and from the chain…",
  },

  /*
   * The page a reader reaches by following something that is not here: an old
   * link, a typo, an address pasted into the path instead of the box. The
   * framework's own answer is an unstyled English line, which on a site
   * published in two languages is the one screen that forgets which it is in.
   */
  notFound: {
    title: "There is no page here",
    body: "The address you followed does not name anything this application serves. A pool is reached by its address or, for v4, by its id — both of which go in the search box rather than in the path.",
    search: "Find a pool →",
  },

  /*
   * The directory, and the line it will not cross.
   *
   * Every sentence here is about what the protocol enforces, because that is the
   * only thing about a hook this application can check. A name, a category, a
   * "verified" badge — all of them would be somebody's claim republished, and
   * the reader would have no way to tell which parts of the page were which.
   */
  hooks: {
    heading: "The hooks running on Uniswap v4",
    loading: "Reading this week's busiest v4 pools…",
    intro:
      "Every v4 pool may name a hook: a contract the PoolManager calls at fixed moments in a swap, a deposit, a withdrawal. Which moments is not a promise anybody makes. It is mined into the hook's address — the low fourteen bits are the list, and the protocol refuses to call the contract for anything outside it.",
    onlyPermissions:
      "That is the whole of what this page knows, and it is worth knowing precisely because it is enforced rather than claimed. What a hook does with a permission is in its code. This application does not read code, and it keeps no list of hooks anybody has vouched for — both would be a claim it could not check, next to figures it can.",
    /*
     * Phrased so no count is followed by a noun that would have to agree with
     * it. A list of one pool is not a case this page will meet — the week's
     * busiest days name hundreds — but "1 pools" is the kind of sentence that
     * only ever appears in front of somebody.
     */
    window: (pools: string, hooked: string, hookless: string) =>
      `Read from the pools of this week's busiest v4 days — ${pools} of them. ${hooked} name a hook; ${hookless} name none, and behave the way a v3 pool does.`,
    ordering:
      "Ordered by how many of those pools run each hook. That is a count of pools and nothing else: a hook on many of them is a hook somebody deployed many pools with.",
    runs: (count: string) => `Runs ${count} of them`,
    poolsHeading: "Where it runs",
    moreNotShown: (count: string) => `and ${count} more`,
    none: "No pool in this week's busiest v4 days names a hook.",
    unavailable: "The week's v4 pools could not be read, so there is no directory to show.",
    fromHome: "See every hook →",
  },

  /*
   * The one panel here that describes somebody's own money.
   *
   * It says so, and it says what that does and does not mean: the same list is
   * public, anybody can read it for any address, and nothing about it is kept.
   */
  positions: {
    heading: "Positions this address already holds",
    intro:
      "Everything above is what this address could do — which pools its tokens open. This is what it has already done. A position of either protocol is a token held by one contract, and both contracts are asked what each token is. The v3 one can also list an address's tokens; the v4 one cannot, so that list comes from an indexer and every id in it is put back to the chain, which is asked who owns it.",
    none: "This address holds no Uniswap position tokens, of either protocol.",
    noneOpen:
      "Every position token this address holds has been closed. A closed one is a receipt of a position that was, not a position.",
    counts: (held: string, open: string, closed: string) =>
      `${held} position tokens, of which ${open} still have liquidity in them and ${closed} have been closed.`,
    inRange: "Earning now",
    outOfRange: "Outside its range",
    rangeUnknown: "Nobody has swapped here",
    analyse: "Analyse this pool →",
    /*
     * Read from the pool's own fee accounting and differenced, not estimated.
     * Deliberately not a rate: it says what has accrued, not over how long or
     * at what pace, because neither follows from the figure.
     */
    feesEarned: (amount0: string, symbol0: string, amount1: string, symbol1: string) =>
      `Earned and not yet taken out: ${amount0} ${symbol0} and ${amount1} ${symbol1}.`,
    feesNone: "Nothing earned to take out yet.",
    feesUnread: "What it has earned could not be read.",
    everyPrice: "Every price this pool can express",
    moreNotShown: (count: string) => `${count} more are open and not listed here.`,
    readCap: (read: string, held: string) =>
      `${read} of ${held} were read. The rest are not on this page, which is a limit of the page rather than of the address.`,
    /*
     * Two protocols mean two ways to fail. The counts beside this cover the
     * other protocol only, and saying so is the difference between a partial
     * answer and a wrong one.
     */
    unreadProtocol: (protocol: string) =>
      `Uniswap ${protocol} positions could not be read this time, so every figure here is about the other protocol alone.`,
    unavailable: "This address's positions could not be read.",
    publicNote:
      "A position's owner is on chain, so this list is public: anybody can read the same one for the same address, and it says nothing this address has not already published by holding these tokens. Nothing here is stored unless you ask for Telegram alerts below, and no figure on this page is a valuation — a range is not what a position is worth.",
  },

  wallet: {
    heading: "Connect a wallet",
    intro:
      "Connect a wallet and this page can see which tokens the address holds, and show you the pools those tokens can go into. It reads the address; that is all a wallet is asked for here.",
    connect: "Connect wallet",
    connecting: "Waiting for the wallet…",
    connectedAs: "Connected as",
    showHoldings: "Show what it holds",
    forget: "Forget this address",
    /*
     * The sentence that replaced "never connects a wallet". The half that is
     * still true is the half worth keeping, and it is the half that matters.
     */
    readOnly:
      "Read-only. This application asks a wallet for its address and never for a signature: there is no code here that can sign a message or send a transaction, and nothing about the wallet is stored between visits.",
    notices: {
      "wallet-not-found":
        "No wallet was found in this browser. A browser wallet extension puts one there; without it, nothing on this page changes.",
      "wallet-request-declined":
        "The request was declined in the wallet. Nothing was read and nothing was sent.",
      "wallet-request-failed":
        "The wallet could not be asked for an address. Nothing was read and nothing was sent.",
      "wallet-no-account":
        "The wallet answered without an address, which usually means it is locked or has no account selected.",
    },
  },

  /*
   * The alerts: what the site says about them, and what the bot says. Kept
   * together because the bot's sentences are this interface's sentences,
   * delivered somewhere else, and they have to agree with the page a reader
   * links from.
   */
  telegram: {
    heading: "Alerts on Telegram",
    intro:
      "Be told, on Telegram, when one of this address's positions comes close to the edge of its range, leaves it, or comes back into it. The button takes you to this site's bot; pressing Start there ties that chat to this address. What is kept is the address and the chat's numeric id — nothing else — and both are deleted from this server the moment you send the bot /stop or forget the link here, and drop out of its encrypted backups within seven days. How often it is checked is up to the server this runs on.",
    connect: "Connect Telegram",
    connected: (address: string) => `This browser is linked: ${address} is being watched.`,
    pending: "The link is waiting: open the bot's chat in Telegram and press Start.",
    forget: "Forget the link",
    notConfigured: "Telegram alerts are not set up on this server.",
    publicNote:
      "Nobody has to own an address to follow it — positions are public, and an alert says nothing this list does not. The bot reads the chain and sends a message; it cannot sign or send anything.",
    linked: (address: string) =>
      `Linked. You will hear here when a position at ${address} comes close to the edge of its range, leaves it, or comes back. Send /stop to end it.`,
    unknownStart:
      "That link is not known or has expired. Press “Connect Telegram” on the site again.",
    alreadyClaimed:
      "That link has already been used by another chat. Press “Connect Telegram” on the site again for a fresh one.",
    stopped: "Stopped. This chat follows nothing now. The record is deleted from the server, and within seven days from its encrypted backups too.",
    nothingToStop: "This chat was not following anything.",
    help:
      "This bot only follows the address you linked on the site, and only says when a position comes close to the edge of its range, leaves it, or re-enters it. Send /stop to end it.",
    storeDown: "The link could not be checked right now. Try again in a minute.",
    left: (pair: string, protocol: string, range: string) =>
      `⚠️ ${pair} (${protocol}) has left its range: ${range}. It holds a single token and earns nothing until the price comes back.`,
    nearing: (pair: string, protocol: string, range: string, price: string, edge: string) =>
      `⏳ ${pair} (${protocol}) is close to the edge of its range: ${range}. The price is ${price}; past ${edge} it holds a single token and earns nothing.`,
    entered: (pair: string, protocol: string, range: string) =>
      `✅ ${pair} (${protocol}) is back inside its range: ${range}. It is earning again.`,
    opened: (pair: string, protocol: string, range: string) => `New position: ${pair} (${protocol}), ${range}.`,
    closed: (protocol: string, tokenId: string) => `Closed: ${protocol} position #${tokenId}.`,
    footer:
      "Information only — not financial advice. Read from public on-chain data; nothing here can act for you.",
  },

  search: {
    label: "A pair, a v3 pool address, or a v4 pool id",
    placeholder: "WETH/USDC",
    help: "Type a pair like WETH/USDC, paste the address of a v3 pool contract, or paste a v4 pool id — the 32-byte hash a v4 pool is named by. Read-only: this application never signs anything and never sends a transaction.",
    submit: "Find pools",

    heading: "Matching Uniswap v3 pools",
    resultsFor: (terms: string) => `Pools whose tokens match ${terms}.`,
    empty: (terms: string) =>
      `No Ethereum mainnet Uniswap v3 pool has a token matching ${terms}.`,
    emptyHint: "Check the spelling, or paste the pool's address if you have it.",

    /*
     * The v4 list, beneath the v3 one. Two lists rather than one merged list,
     * because they are ordered by different numbers — what a pool holds, and
     * what its active liquidity is worth — and one order over both would be
     * comparing them.
     */
    v4Heading: "Matching Uniswap v4 pools",
    v4Empty: (terms: string) =>
      `No Ethereum mainnet Uniswap v4 pool has a currency matching ${terms}.`,
    v4Depth: "Depth at the current price",
    v4DepthValue: (ether: string) => `≈ ${ether} ETH`,
    v4DepthNote:
      "What the pool's active liquidity is worth right now, read from the PoolManager's own storage — not what the pool holds, which no v4 pool reports on its own.",
    v4StateUnread: "The pool's liquidity could not be read from the chain.",
    v4Hook: "Hook",
    v4NoHook: "none",
    v4HookAltersSwaps: "may change what a swap costs",
    v4Ordering:
      "Pools named exactly what you searched for come first. After that the order follows each pool's depth at its current price — its active liquidity and price, read from the PoolManager's storage and put on one scale using the prices the data source derives. Not what the pool holds: every v4 pool's tokens sit in the one PoolManager together, and nothing on chain reports them per pool. The indexer's own liquidity figure was checked against the chain and was fifteen percent off on one of the busiest pools, which is why it is not used.",

    /*
     * The ordering is the one claim a list makes, so it is stated rather than
     * left to be inferred from the order itself.
     */
    ordering:
      "Pools named exactly what you searched for come first. After that the order follows what each pool actually holds, read from the token contracts themselves and put on one scale using the prices the data source derives. It used to follow the value the source reports as locked in each pool, and that figure was wrong enough to reorder this list: one pool was published here at nine million dollars of reported liquidity while its contracts held nine thousand.",
    windowing:
      "This list is drawn from the pools the data source reports as the most traded for your terms, and a pool quiet enough to fall outside that set never reaches the ordering above. That is the honest limit of ranking within what a source chose to return: a pool holding a great deal but trading rarely can be missing from this page.",
    /*
     * The other thing the list leaves out, and why. Said beside the window
     * note because it is the same kind of fact: a pool can be missing from
     * this page for a reason that is not "it does not exist".
     */
    dormantNote:
      "A pool nothing has happened in for a month is not listed. The range is drawn from the last month of prices, and a pool without one has nothing to draw it from — opening it would only say so.",
    /*
     * The v4 window is not the terms. The source cannot answer a search over
     * every v4 pool before this page stops waiting — measured, not assumed —
     * so the search runs over the week's busiest pool-days, and a page that
     * did not say so would let a reader conclude a pool does not exist.
     */
    v4Windowing:
      "This list is drawn from the v4 pools that traded the most on Ethereum mainnet over the last seven days — the thousand busiest pool-days, which come to a few hundred pools — and a pool quieter than that never reaches this page. The source cannot answer a search across every v4 pool before this page stops waiting, so the window is by recent activity rather than by your terms: a pool that exists but has not traded this week is not here.",
    /*
     * The sentence that does the real work on this page. Search is what lets
     * someone reach a pool they did not go looking for.
     */
    symbolWarning:
      "A symbol comes from the token's own contract, and deploying a token that calls itself USDC costs nothing. The contract addresses under each pair are what tell two tokens apart.",

    feeTier: "Fee tier",
    holds: "Holds",
    reservesUnread: "What this pool holds could not be read from the chain.",
    moreNotShown: (count: string) =>
      `${count} more are not shown. The ones above are the most traded of them, in the order the data source reports — which is a claim about how busy a pool is and about nothing else.`,
    analyse: "Analyse this pool",
    /** Under the v4 list: where each row's fee came from, and why the row can say it was not read. */
    v4FeeNote:
      "Each pool's fee is read from the key it was created with, on the chain, rather than from the data source — whose fee figure was measured to be the total a swap last paid, protocol cut included, and not the pool's own fee. A row whose key could not be read says so.",

    unavailableHeading: "The search could not be run",
    rejected: {
      empty: "Type a pair like WETH/USDC, or a pool address.",
      length: (min: number, max: number) =>
        `A search term is between ${min} and ${max} characters.`,
      unsupportedCharacters:
        "A search term can hold letters, digits, and the marks that appear inside tickers — nothing else.",
    },
  },

  report: {
    steps: {
      pool: "reading the pool's configuration",
      snapshot: "reading the pool's current market state",
      history: "reading the pool's daily price history",
      volatility: "measuring how much the price has moved",
      band: "building the price band",
      range: "snapping the band onto the prices this pool can express",
      divergence: "comparing that range against holding the two tokens",
      activity: "reading what the pool did over the measured window",
    },
    noRangeHeading: "No range for this pool",
    stoppedWhile: (step: string) => `This stopped while ${step}.`,
    poolSummary: (protocol: string, fee: string, chain: string) =>
      `Uniswap ${protocol} · ${chain} · ${fee}`,
    feePerSwap: (fee: string) => `${fee} fee on every swap`,
    /** A v4 pool whose protocol takes a cut on top of the pool's own fee. */
    feePlusProtocol: (fee: string, protocol: string) =>
      `${fee} fee on every swap, plus ${protocol} to the protocol`,
    /** Stands where the fee would, for a v4 pool whose hook sets one per swap. */
    noDeclaredFee: "fee set by its hook on every swap",
    caveatsHeading: (count: number) =>
      count === 1 ? "One caveat applies to these figures." : `${count} caveats apply to these figures.`,
    caveatsAriaLabel: "Caveats",

    /*
     * The range, as two prices. Every price on the page is written the way
     * round that makes it at least one — one unit of the dearer token, priced
     * in the cheaper — and the intro says which token that is, so the figures
     * under it can be read without a second thought. The ticks those prices
     * encode are in the technical details at the end, where a reader who
     * wants to check them can, and a reader who does not is never made to.
     */
    contentsHeading: "On this page",
    contentsLabel: "The sections of this analysis",
    rangeHeading: "Suggested price range",
    rangeIntro: (base: string, quote: string) =>
      `Where a position in this pool would be active, as the price of one ${base} in ${quote}.`,
    rangeValue: (lower: string, upper: string, quote: string, base: string) =>
      `${lower} – ${upper} ${quote} per ${base}`,
    rangeDistances: (down: string, up: string) =>
      `${down} below and ${up} above the current price.`,
    rangeMeaning:
      "Between these two prices a position earns its share of the pool's swap fees. Outside them it holds a single token and earns nothing until the price comes back.",
    priceSentence: (base: string, price: string, quote: string) => `1 ${base} = ${price} ${quote}`,
    currentPrice: "Current price",
    inRangeYes: "The current price is inside this range.",
    inRangeNo: "The current price is outside this range.",
    inRangeYesNote: "A position opened here would be active straight away.",
    inRangeNoNote:
      "A position opened here would hold a single token and earn nothing until the price comes back inside.",
    beyondEdges: (below: string, above: string) =>
      `If the price falls below the range, the position ends up holding only ${below}; if it rises above it, only ${above}.`,
    lowerTruncatedNote:
      "The lower edge stops at the lowest price this pool can express, short of where the band would have put it.",
    upperTruncatedNote:
      "The upper edge stops at the highest price this pool can express, short of where the band would have put it.",
    /*
     * The month drawn through the range. The caption says what each mark is,
     * once, in the words the page uses for the same things; the day counts a
     * few panels down are the same days, counted.
     */
    chartLabel: "The last month's prices against the suggested range",
    chartCaption: (days: string) =>
      `Each of the last ${days} days: its close, and the span from its low to its high. The shaded band is the suggested range; the solid line is today's price.`,
    chartLegend:
      "A filled dot is a day that stayed entirely inside the range; a hollow one left it or crossed an edge.",

    /*
     * Where the range came from, in the words a reader has: how much the price
     * moves on a typical day, and what that comes to over the horizon. The
     * standard deviation is named in the notes, not in the labels.
     */
    basisHeading: "How this range was drawn",
    basisIntro: (base: string, days: string) =>
      `From how much the price of ${base} actually moved over the last ${days} completed days — not from a forecast of where it goes next.`,
    dailyMove: "Typical daily move",
    dailyMoveNote: "The standard deviation of one day's price change, over the window.",
    horizonMove: (days: string) => `Over ${days} days`,
    horizonMoveNote:
      "The same movement stretched over the horizon chosen below: one standard deviation, either way.",
    widthValue: (multiplier: string) => `${multiplier}× that, each way`,
    widthNote:
      "Chosen below. A wider range is left less often, and the same deposit spread over it is thinner at any one price.",
    measuredOver: "Measured over",
    measuredOverNote: (returns: string) => `${returns} daily changes went into it.`,
    epilogue:
      "The range is centred on today's price and drawn the same distance up and down in ratio terms — halving and doubling are the same move — which is why the two percentages differ. It describes how far the price has moved, not where it will go: it is not a forecast, and the width is not a confidence level. Nothing here sizes a position or says how much of either token to deposit.",
  },

  /*
   * Everything a reader checking the page against the chain would want, and
   * nothing a reader opening a position needs: the ticks the prices encode,
   * the blocks the figures were read at, the figures in the pool's own
   * direction. Folded away at the end of the report.
   */
  technical: {
    heading: "Technical details",
    summary: "The ticks, blocks and figures the page above is checked against.",
    lowerTick: "Lower tick",
    upperTick: "Upper tick",
    currentTick: "Current tick",
    sourceReportedTick: (tick: string) => `Source reported ${tick}.`,
    noSourceTick:
      "The source reported no tick of its own, so this conversion is unverified.",
    tickSpacing: "Tick spacing",
    tickSpacingNote: (step: string) => `A price step of ${step} between usable edges.`,
    width: "Width",
    widthValue: (ticks: string, spacings: string) => `${ticks} ticks · ${spacings} spacings`,
    poolPrice: "Price as the pool quotes it",
    quotePerBase: (quote: string, base: string) => `${quote} per ${base}`,
    bandLower: "Band lower bound",
    bandUpper: "Band upper bound",
    bandNote: "Before snapping to the tick grid, in the pool's own direction.",
    annualised: "Annualised volatility",
    annualisedNote:
      "Sample standard deviation of daily log returns, scaled by sqrt(365).",
    coverage: "Coverage",
    coverageNote: "How much of the window had consecutive daily prices behind it.",
    sourceBlock: "Source block",
    noBlockTime: "No block time reported.",
    fetchedAt: "Fetched at",
    fetchedAtNote: "When the response arrived, not what it describes.",
    lowerEdge: "Lower edge",
    upperEdge: "Upper edge",
    truncated: "Truncated",
    asAsked: "As asked",
  },

  explanation: {
    heading: "Explanation",
    pending: "Writing the explanation…",
    unavailable: "No explanation is available for this analysis.",
    /*
     * The two states a single paragraph can be in while the rest of the answer
     * is still arriving. Both keep the heading, so the reading order stays put
     * rather than the sections below jumping as each one lands.
     */
    sectionWriting: "Still being written…",
    sectionMissing: "This part could not be written.",
    /*
     * Names the author, and draws the line. Prose written by a model sitting
     * under figures that were computed and cross-checked should say which is
     * which, or a reader is entitled to assume the same hand produced both.
     */
    writtenBy: (model: string) => `Written by ${model}. The figures above were not.`,
    sections: {
      whatThisRangeMeans: "What this range means",
      ifPriceLeavesTheRange: "If price leaves the range",
      whatTheVolatilitySays: "What the volatility says",
      whatThisDoesNotCover: "What this does not cover",
    },
  },

  /*
   * Every sentence this application says about a read that did not go well.
   *
   * They lived in the data layer until search made a second language matter:
   * an adapter raised an English sentence and it travelled, unchanged, to a page
   * being read in Turkish. Now the adapter raises a code and the wording is
   * here, where all the other wording is.
   *
   * `satisfies` is what keeps this honest. Add a code to `notices.ts` and this
   * object stops compiling until it says something about it, in both languages.
   */
  notices: {
    failure: {
      "invalid-pool-address":
        "The pool address must be 0x followed by 40 hexadecimal characters, and cannot be the zero address.",
      "invalid-search-terms":
        "A pool search takes one or two short terms made of letters, digits, and the marks that appear inside tickers.",
      "market-data-not-configured":
        "Uniswap v3 market data is not configured on this server.",
      "chain-data-not-configured":
        "On-chain reads are not configured on this server.",
      "explanation-not-configured":
        "This application is not configured to write explanations, so none is shown.",
      "market-data-timed-out":
        "The market data request timed out.",
      "market-data-unreachable":
        "The market data source could not be reached.",
      "market-data-credentials-rejected":
        "The market data source rejected the configured credentials.",
      "market-data-rate-limited":
        "The market data source rate limit was exceeded.",
      "market-data-unreadable":
        "The market data source returned an unreadable response.",
      "market-data-malformed":
        "The market data source returned a response this application cannot verify.",
      "market-data-indexing-errors":
        "The market data source reported indexing errors, so its figures cannot be treated as verified.",
      "market-data-stale":
        "The market data source is too far behind the chain for these figures to be treated as current.",
      "market-data-future-block-time":
        "The market data source reported a block time ahead of this server's clock, so its figures cannot be verified.",
      "chain-data-timed-out":
        "The on-chain data request timed out.",
      "chain-data-unreachable":
        "The on-chain data source could not be reached.",
      "chain-data-credentials-rejected":
        "The on-chain data source rejected the configured credentials.",
      "chain-data-rate-limited":
        "The on-chain data source rate limit was exceeded.",
      "chain-data-unreadable":
        "The on-chain data source returned an unreadable response.",
      "chain-data-malformed":
        "The on-chain data source returned a response this application cannot verify.",
      "chain-aggregator-unverified":
        "Balances are read through a helper contract on the chain, and the code at its address is not the code this application was built to trust, so nothing was read through it.",
      "pool-not-found":
        "No Uniswap v3 pool was found for this address on Ethereum mainnet.",
      "pool-contract-not-found":
        "No Uniswap v3 pool contract answered at this address on Ethereum mainnet.",
      "pool-configuration-inconsistent":
        "The pool configuration assembled from its two sources could not be verified.",
      "pool-history-insufficient":
        "This pool does not have enough completed daily price history to analyse yet.",
      "pool-history-never-traded":
        "This pool exists, but nothing has ever traded in it, so there are no daily prices to measure a range from.",
      "pool-history-dormant":
        "This pool stopped trading before the period these daily prices are read from, so there is no recent history to measure a range from. Waiting will not change that — only the pool being used again would.",
      "volatility-invalid-input":
        "The price history supplied for this calculation is not a valid normalized history.",
      "volatility-insufficient-history":
        "This pool does not have enough consecutive daily prices to measure volatility.",
      "volatility-unverifiable":
        "The volatility calculation produced a result this application cannot verify.",
      "band-invalid-input":
        "The market data supplied for this price band is not valid, or the snapshot and volatility describe different pools.",
      "band-no-current-price":
        "The current price for this pool is unavailable, so a price band cannot be centred.",
      "band-unverifiable":
        "The price band calculation produced a result this application cannot verify.",
      "range-invalid-input":
        "The pool, price band and snapshot supplied for this range are not valid, or they do not all describe the same pool and the same observation.",
      "range-price-unrepresentable":
        "This pool's current price lies outside the range Uniswap can express, so no position range can be built from it.",
      "range-tick-disagreement":
        "The price the source reports for this pool and the state it reports do not describe the same moment, so no range is published.",
      "range-too-narrow":
        "The price band is narrower than the smallest step this pool allows between two edges, so it does not describe two distinct position boundaries.",
      "range-unverifiable":
        "The range calculation produced a result this application cannot verify.",
      "divergence-unverifiable":
        "The comparison against holding produced a result this application cannot verify.",
      "activity-unverifiable":
        "The pool's recent activity produced a result this application cannot verify.",
      "fee-rate-unmeasurable":
        "This pool traded nothing on any indexed day of the window, so the rate it charges cannot be divided out of what it collected.",
      "deposit-share-unpriceable":
        "The source does not price what this pool holds, so a deposit in dollars cannot be turned into a position in it.",
      "deposit-share-no-days":
        "The price left this range on every day the source could answer for, so there is no day a deposit in it would have collected anything.",
      "deposit-share-unverifiable":
        "What a deposit would have taken did not pass its own check, so it is not shown.",
      "range-order-no-room":
        "This range is too narrow to hold a one-sided position on either side of the current price.",
      "range-order-unverifiable":
        "The one-sided halves of this range did not pass their own check, so they are not shown.",
      "swap-depth-no-liquidity":
        "This pool reports no liquidity at its current price, so there is no swap here to price.",
      "swap-depth-tick-disagreement":
        "The source's own tick puts this pool in a different price step than the price shown, so the liquidity it reported cannot be attributed to this step.",
      "swap-depth-unverifiable":
        "What a swap would cost did not pass its own check, so it is not shown.",
      "out-of-sample-insufficient-history":
        "This pool does not have enough indexed history to fit a band in the past and still have a full horizon of days to check it against.",
      "out-of-sample-unverifiable":
        "The out-of-sample check produced a result this application cannot verify.",
      "hook-directory-unverifiable":
        "The hooks of this week's v4 pools did not pass their own check, so the directory is not shown.",
      "positions-manager-unverified":
        "The contract that holds Uniswap v3 positions did not answer with the code this application was built against, so nothing it said is shown.",
      "positions-unreadable":
        "The chain did not answer for this address's positions, so none is shown — which is not the same as holding none.",
      "positions-unverifiable":
        "This address's positions did not pass their own check, so they are not shown.",
      "holdings-unverifiable":
        "What this address holds produced a result this application cannot verify.",
      "explanation-key-rejected":
        "The explanation service did not accept the configured key, so no explanation is shown.",
      "explanation-model-not-permitted":
        "The configured key is not permitted to use the selected model, so no explanation is shown.",
      "explanation-model-unknown":
        "The selected model is not available to the configured key, so no explanation is shown.",
      "explanation-rate-limited":
        "The explanation service is rate limited right now, so no explanation is shown.",
      "explanation-hourly-cap":
        "This site writes a limited number of explanations each hour, and that many have been written. The figures above are complete; the explanation can be written again within the hour.",
      "explanation-unreachable":
        "The explanation service could not be reached, so no explanation is shown.",
      "explanation-request-refused":
        "The explanation service refused this request, so no explanation is shown.",
      "explanation-declined":
        "The model declined to explain this pool's figures, so no explanation is shown.",
      "explanation-truncated":
        "The explanation was cut off before it was complete, so it is not shown.",
      "explanation-malformed":
        "The explanation came back in a form this application cannot verify, so it is not shown.",
    } satisfies Record<DataFailureNotice, string>,

    warning: {
      "block-time-unreported":
        "The data source did not report a block time, so how current these figures are could not be verified.",
      "history-window-incomplete":
        "The data source did not report a price for every day in this window; the missing days are absent rather than estimated.",
      "volatility-window-incomplete":
        "Some days in this window had no price, so volatility is measured from fewer daily returns than the window covers; the missing days were skipped rather than estimated.",
      "band-window-incomplete":
        "Some days in the volatility window had no price, so this band is based on fewer daily returns than the window covers.",
      "band-price-block-time-unreported":
        "The current price source did not report a block time, so how current it is could not be independently verified.",
      "band-volatility-block-time-unreported":
        "The volatility source did not report a block time, so how current it is could not be independently verified.",
      /*
       * Neither names an edge. The codes name the pool's edges, and the page
       * writes its prices the reader's way round, which can be the other way —
       * so the sentence points at the range panel, which says which edge in
       * the direction shown.
       */
      "range-lower-edge-truncated":
        "One edge of the range stops where the prices this pool can express end — the edge at which the pool's first token is cheapest — so the range does not reach as far as the band would. The range panel says which edge that is in the direction shown.",
      "range-upper-edge-truncated":
        "One edge of the range stops where the prices this pool can express end — the edge at which the pool's first token is dearest — so the range does not reach as far as the band would. The range panel says which edge that is in the direction shown.",
      "range-tick-unverified":
        "The price source did not report the pool's own state, so the price it implies could not be checked against it.",
      "range-excludes-current-price":
        "The pool's current price lies outside this range, so a position built from it would hold a single token and earn nothing until price returns.",
    } satisfies Record<DataWarningNotice, string>,
  },

  rateLimited: {
    title: "Too many requests",
    body: (limit: number) =>
      `This page reads live Uniswap data on every visit, so it is limited to ${limit} analyses per minute.`,
    retry: (seconds: number) =>
      `Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`,
    back: "Back to the advisor",
  },

  /*
   * Served from `errorCopy.ts` rather than written here, because the error
   * boundary that shows it has to be a Client Component and importing this file
   * into one would ship every string in both languages to every browser. It is
   * the same object either way, so the translation check walks it with the rest.
   */
  error: ERROR_COPY.en,
};

export type Dictionary = typeof en;

const tr: Dictionary = {
  metadata: {
    title: "LiquidityWise",
    description:
      "Uniswap v3 ve v4 likidite stratejileri için eğitim amaçlı, yapay zekâ destekli bir danışman. Yalnızca bilgilendirme — yatırım tavsiyesi değildir.",
    v4Title: "Bir Uniswap v4 havuzu · LiquidityWise",
    v4Description:
      "Bir Uniswap v4 havuzunun ne olduğu ve hook'unun neye izinli olduğu.",
    holdingsTitle: "Bir adres ne tutuyor · LiquidityWise",
    holdingsDescription:
      "Bir Ethereum adresinde bulunan tokenlar ve girebilecekleri Uniswap v3 havuzları.",
    compareTitle: "Komisyon kademeleri yan yana · LiquidityWise",
    compareDescription: "Bir çiftin bütün Uniswap v3 komisyon kademeleri, aynı ufuk, genişlik ve yatırım tutarıyla okunmuş halde.",
    poolTitle: "Havuz aralığı analizi · LiquidityWise",
    poolDescription:
      "Bir Ethereum mainnet Uniswap v3 havuzu için, fiyatının gerçekte ne kadar hareket ettiğinden çizilmiş bir fiyat aralığı.",
    hooksTitle: "Uniswap v4 kancaları · LiquidityWise",
    hooksDescription:
      "Haftanın en yoğun Uniswap v4 havuzlarının adını verdiği her kanca ve her birinin neye izinli olduğu — kendi adresinden okunmuş hâliyle."
  },

  preferences: {
    languageLabel: "Dil",
    selectLanguage: "Dil seç",
    closeLanguages: "Kapat",
    partlyTranslated:
      "Bu dilin çevirisi sürüyor. Menüler, etiketler ve başlıklar bu dilde; uzun açıklamalar hâlâ İngilizce.",
    themeLabel: "Tema",
    themeSystem: "Sistem",
    themeLight: "Açık",
    themeDark: "Koyu",
    rangeLabel: "Aralık tercihleri",
    rangeIntro:
      "Her havuzun açıldığı ufuk, genişlik ve tutar. Kendi değerini taşıyan bir bağlantı yine öne geçer; her analizin altındaki form ise yalnızca o sayfayı değiştirir.",
    rangeSave: "Kaydet",
    rangeReset: "Unut",
  },

  disclaimer: {
    ariaLabel: "Önemli uyarı",
    title: "Eğitim aracı — yatırım tavsiyesi değildir.",
    body: "Bu uygulama Uniswap mekaniklerini açıklar ve parametre seçimleri üzerine düşünmene yardım eder. Fiyat tahmini yapmaz, getiri garantisi vermez ve hiçbir akıllı sözleşmenin güvenli olduğunu doğrulayamaz. Likidite sağlamak, geçici kayıp ve paranın tamamının kaybı dahil gerçek riskler taşır. Sözleşme adreslerini daima kendin doğrula ve kendi araştırmanı yap.",
  },

  home: {
    badge: "Erken aşama",
    title: "LiquidityWise",
    introBeforeV3: "Uniswap ",
    introBetween: " için, ",
    introAfterV4:
      "'e doğru büyüyen eğitim amaçlı bir danışman. Havuzu paritesinden bul, o paritenin geçmişte gerçekte ne kadar hareket ettiğinden çıkarılmış bir fiyat aralığını oku, ve bunun ne anlama geldiğini gündelik dille öğren. Her sayı, bir model onu anlatmaya başlamadan önce hesaplanır ve çapraz doğrulanır — modelin ise bir sayı yazmasına hiç izin verilmez.",
    workingTodayHeading: "Bugün çalışan kısım",
    workingTodayBody:
      "Havuzu paritesinden ara, ya da bir v3 havuz adresi veya v4 havuz kimliği yapıştır. Havuzun doğrulanmış yapılandırmasını ve güncel durumunu, son bir ayın günlük fiyatlarını önerilen aralığa çizilmiş hâlde, paritenin gerçekte ne kadar hareket ettiğini ve bundan çıkan aralığı görürsün — ufuk da genişlik de senin elinde. Yanında: havuzun ne komisyon aldığı ve gerçekte ne topladığı, son günlerinin aralığa göre nerede durduğu, aynı yöntemin hiç görmediği günlerde ne yaptığı, bir pozisyonun sadece tutmaya kıyasla neyden vazgeçtiği, diğer genişliklerin her birinin ne yapacağı, ve — büyüklüğünü kendin belirlediğin bir yatırımın — fiyatın aralıkta kaldığı günlerde alınan komisyonlardan ne kadarını alacağı. Bir de aynı aralığın ters okunuşu: her yarısı tek taraflı bir pozisyon, ve sayfa fiyat içinden geçerse her birinin hangi fiyattan dönüşeceğini söylüyor. Havuzdan geçen bir takasın ne kadara mal olduğu — hiçbir şey varsayılmadan fiyatlanabilen en büyük takas için. Bir de haftanın en yoğun v4 havuzlarının adını verdiği bütün kancaların dizini, her birinin neye izinli olduğu kendi adresinden okunmuş hâliyle. Bir v4 havuzu ayrıca hook'unun neye izinli olduğunu, hook'un kendi adresinden okunmuş hâliyle sade cümlelerle söyler. Bir adres, tuttuğu tokenların girebileceği havuzlar için ve hâlihazırda tuttuğu Uniswap v3 pozisyonları için sorgulanabilir — her biri hangi fiyatları kapsadığı ve havuzun şu anda içinde olup olmadığıyla birlikte. Sonra hepsinin gündelik dille açıklaması, Türkçe ya da İngilizce. Bu sayıların hiçbirine model dokunmuyor, hiçbiri bir boşluğu doldurmak için tahmin edilmiyor, ve metnin kendi başına bir sayı koyacağı yer yok.",
    analysePool: "Havuz bul →",
    methodHeading: "Nasıl çalışıyor",
    methodSteps: [
      {
        step: "Doğrulanmış veri",
        detail:
          "Havuz bilgileri Uniswap subgraph'larından çekilir ve zincirden okunur, asla varsayılmaz. Fiyat, havuzun kendisi için bildirdiği duruma karşı çapraz doğrulanır.",
      },
      {
        step: "Deterministik hesap",
        detail:
          "Volatilite, fiyat bandı ve pozisyon aralığı düz TypeScript ile hesaplanır; aynı havuz her zaman aynı sayıları verir.",
      },
      {
        step: "Yapay zekâ yorumu",
        detail:
          "Bir model bu sayıların ne anlama geldiğini açıklar. Sayılar ona doğrulanmış hâlde verilir ve cevap verdiği sözleşmede bir sayı koyacağı yer yoktur.",
      },
    ],
    coverageHeading: "Henüz kurulmadı",
    coverage: [
      {
        version: "Uniswap v3",
        features: [
          {
            name: "Gas, ve fiyatı takip etmenin maliyeti",
            summary:
              "Fiyatın terk ettiği bir aralık, fiyatı takip etmek için kapatılıp yeniden açılmalıdır; bu hem gas harcar hem de kâğıt üstündeki bir sapmayı gerçekleşmiş bir sapmaya çevirir. Bunların hiçbiri burada hesaba katılmıyor.",
          },
        ],
      },
      {
        version: "Uniswap v4",
        features: [
          {
            name: "Bir hook'un gerçekte ne yaptığı",
            summary:
              "Bir v4 sayfası, hook'un neye izinli olduğunu söyler; çünkü protokolün zorladığı kısım budur ve hook'un kendi adresinden okunur. O izinlerle ne yaptığını söylemek için sözleşmeyi okumak gerekir, bu ayrı bir problemdir ve bu uygulama ona girişmez.",
          },
          {
            name: "TWAMM tarzı stratejiler",
            summary:
              "Büyük bir emri tek bir likidite noktasına karşı yürütmek yerine zamana yaymak. Bunun bir analiz sayfasının cevaplayabileceği yarısı artık var: güncel fiyattaki likiditeye karşı bir takasın ne kadara mal olduğu ve sayfanın hangi büyüklüğe kadarını fiyatlayabildiği. Emri zamana yaymak bir kancanın işi ve bu uygulama bir kancanın davranışını modellemiyor.",
          },
        ],
      },
    ],
    footer:
      "Yukarıdakilerin hiçbiri henüz yok. Olan, bu sayfanın üst kısmındaki her şey: adıyla bulunan bir havuz, hesaplanıp çapraz kontrol edilen rakamlar ve gösterilmeden önce doğrulanan metin. Bir cüzdan bağlanabilir ve ondan istenen tek şey adresidir. Bu uygulamanın sakladığı tek şey, okuyucunun kendisinin kurduğu bir Telegram bağlantısıdır — bir sohbet kimliğinin yanında bir adres, bota /stop yazıldığı an silinir ve yedi gün içinde şifreli yedeklerden de düşer — ve buradaki hiçbir şey senin adına işlem imzalayamaz ya da gönderemez.",
  },

  pool: {
    back: "← LiquidityWise",
    invalidAddress:
      "Bu bir Ethereum adresi değil. Adres, 0x ile başlayıp tam olarak 40 onaltılık karakterle devam eder.",
    loading: "Canlı Uniswap verisi okunuyor…",
  },

  activity: {
    heading: "Havuz gerçekte ne yaptı",
    volume24h: "Hacim, 24s",
    volume7d: "Hacim, 7g",
    volume30d: "Hacim, 30g",
    fees30d: "Alınan komisyon, 30g",
    feesNote: "Havuzun tamamının; likiditesi aktif olan herkes arasında paylaşılır.",
    tvl: "Kilitli toplam değer",
    occupancySentence: (days: string, inside: string, outside: string, crossed: string) =>
      `Son ${days} günün ${inside} tanesi tamamen bu aralığın içinde kaldı, ${outside} tanesi tamamen dışındaydı, ${crossed} tanesi bir kenarı geçti.`,
    undeterminedNote:
      "Bir kenarı geçen gün, bir kısmını içeride bir kısmını dışarıda geçirdi; kaynağın günlük en yüksek ve en düşüğü ne kadarının hangisi olduğunu söyleyemez.",
    feesWhileInside: "Tamamen içeride geçen günlerde alınan komisyon",
    feesWithheld: "Bu havuz için gösterilmiyor",
    feesWithheldNote:
      "Bu havuzun hook'u takastan pay almaya izinli ve kaynak, hook'un payını likidite sağlayıcılarınkinden ayırmıyor. Yukarıdaki komisyonlar havuzun aldığı tutar — bu bir olgu; ama onun bir kısmını bu aralığa bağlamak, kimsenin doğrulayamayacağı bir pozisyon iddiası olurdu.",
    inSample:
      "Bunlar aralığın çizildiği günlerin ta kendisi; yani nasıl oturtulduğunu gösterirler, ne kadar tuttuğunu sınamazlar — üstelik aralık bugünkü fiyata ortalanmış, bir ay önce kimse onu açamazdı. Geriye dönük bir test olarak değil, havuzun son dönem hareketinin aralığa göre nerede durduğu olarak oku.",
    notYourEarnings:
      "Bunların hiçbiri bir pozisyonun kazanacağı miktar değil; havuzun tamamının aldığı komisyon. Bir yatırımın bundan alacağı pay — takaslar olurken aktif olan likidite içindeki payı — hemen aşağıdaki bölümde, ve o da yalnızca komisyon, başka hiçbir şey değil.",
  },

  deposit: {
    heading: "Bir yatırım ne toplardı",
    unavailable: "Bir yatırımın bu komisyonlardan alacağı pay bu havuz için hesaplanamıyor.",
    withheldNote:
      "Üstündeki rakamla aynı sebepten: buradaki kanca takastan kendine pay alabilir ve kaynak, onun payını likidite sağlayıcılarınkinden ayırmıyor. Bu aralığa atfedilemeyen bir toplamın bir kesri de, o aralıktaki bir yatırıma atfedilemez.",
    deposited: "Yatırım",
    depositedNote: "Hesabın yapıldığı büyüklük. Yukarıdaki formdan değiştirilebilir.",
    collected: "Alacağı komisyon",
    collectedNote: (days: string) => `Fiyatın aralıktan hiç çıkmadığı ${days} gün boyunca.`,
    ofDeposit: "Yatırımın yüzdesi",
    ofDepositNote:
      "Bu komisyonların, konulan paraya oranı — yalnızca o günler için. Yıllık bir oran değil ve burada hiçbir şey onu yıllığa çevirmiyor.",
    sentence: (deposit: string, days: string, poolFees: string, yourFees: string) =>
      `Fiyatın bu aralıktan hiç çıkmadığı ${days} gün boyunca havuz ${poolFees} komisyon aldı. Bu aralığa konulan ${deposit} tutarında bir yatırım bunun yaklaşık ${yourFees} kadarını alırdı — kendi likiditesinin, o günlerin her birinde gerçekten aktif olan likidite içindeki payı kadar.`,
    unmeasurableNote: (days: string) =>
      `${days} gün daha aralığın içinde kalmış, ama kaynak o günler için ne komisyon ne de aktif likidite yayımlamış; bu yüzden toplama girmiyorlar.`,
    dilution:
      "Daha büyük bir yatırım orantılı olarak daha fazla toplamaz. Pay, senin likiditenin herkesinkine — seninki dahil — oranı; yani belli bir büyüklükten sonra eklediğinin çoğu, hâlihazırda koyduğunu seyreltir. Sunulan tutarların uçtan uca bin kat farklı olmasının sebebi bu.",
    caveat:
      "Yalnızca komisyon ve yalnızca geçmiş günler. Pozisyonun bu günlerin hepsinde açık olduğunu ve buna karşılık piyasada hiçbir şeyin kıpırdamadığını varsayar; önümüzdeki otuz günün ne ödeyeceği hakkında hiçbir şey söylemez. Bir pozisyonun, iki jetonu öylece tutmaya kıyasla neyden vazgeçtiği bu sayfanın aşağısındaki karşılaştırmada; ikisi birlikte okunmalı.",
  },

  realizedFee: {
    heading: "Gerçekte ne kadar aldı",
    intro:
      "Havuzun beyan ettiği komisyon tek bir sayı. Buradaki ise takas yapanların gerçekte ödediği: yukarıdaki sayılarla aynı günlerden geri bölünerek çıkarıldı — bir günün komisyonu, o günün hacmine. Fazladan istek götürmüyor, hook'tan bir şey beklemiyor.",
    declared: "Beyan edilen komisyon",
    statedNote: (lp: string, protocol: string) =>
      `Likidite sağlayıcılarına ${lp}, protokole ${protocol}; PoolManager'ın topladığı şekilde birleştirildi — takas yapanın ödediği bu, yukarıdaki komisyonlar da bundan oluşuyor.`,
    noDeclared: "Yok",
    noDeclaredNote: "Bu havuzun anahtarında komisyon yok. Oranı hook'u her takasta belirliyor.",
    median: "Tipik gün",
    spread: "En düşük ve en yüksek gün",
    spreadValue: (lowest: string, highest: string) => `${lowest} – ${highest}`,
    aggregate: "Pencerenin tamamı",
    aggregateNote:
      "Pencerenin komisyonu pencerenin hacmine bölündü; yani yoğun bir gün, sakin bir günden daha çok söz sahibi.",
    daysMeasured: "Ölçülen gün",
    daysMeasuredNote: (skipped: string) =>
      `Pencerede ${skipped} gün daha var ama hiç işlem görmemiş ya da bir sayısı eksik; bu yüzden onlardan bir oran bölünüp çıkarılamadı.`,
    verdictMatches:
      "Ölçülen her günde birbirini tutuyor. Beyan edilen oran, alınan oranın kendisi.",
    verdictDiffers: (differing: string, measured: string) =>
      `Birbirini tutmuyor. Ölçülen ${measured} günün ${differing} tanesinde havuz, beyan ettiğinden başka bir oran aldı; yani yukarıdaki kademe, havuzun neyle kurulduğunu anlatıyor, bir takasın neye mal olduğunu değil.`,
    verdictNoneDeclared:
      "Kıyaslanacak bir şey yok: bu havuz hiçbir oran beyan etmiyor. Buradaki sayılar, hook'unun fiilen belirlediği oranlar.",
    notLpShare:
      "Bunların hiçbiri likidite sağlayıcısına ulaşan tutar değil. Bu havuzun hook'u takastan pay almaya izinli ve kaynak, hook'un payını sağlayıcılarınkinden ayırmıyor. Bu sayıların söylediği şey, bir takasın neye mal olduğu; kime gittiği değil.",
    unavailableHeading: "Bu havuzun ne kadar aldığı ölçülemedi",
  },

  outOfSample: {
    heading: "Hiç görmediği günlerde sınandı",
    showFolds: "Katları tek tek göster",
    intro: (horizon: string) =>
      `Yukarıdaki her rakam, anlattığı günlere oturtulmuştur. Bunlar öyle değil. Yöntem ${horizon} geriye alındı, yalnızca o noktadan önceki fiyatlarla yeniden çalıştırıldı ve o andaki fiyata ortalandı — orada duran birinin gerçekten göreceği bir fiyata. Sonra sonrasında gelen günlerin üzerine serildi, ve bu işlem geçmişte yer buldukça geriye doğru tekrarlandı.`,
    folds: "Kat sayısı",
    foldsNote: "Geçmişin, bir bant kurup sonra onu sınamaya kaç kez yer verdiği.",
    fullyInside: "Tamamen içeride geçen gün",
    fullyOutside: "Tamamen dışarıda geçen gün",
    undetermined: "Bir kenarı geçen gün",
    verdict: (inside: string, measured: string, folds: string) =>
      `${folds} kat boyunca, ${measured} günün ${inside} tanesi bu yöntemin çizeceği bandın tamamen içinde kaldı.`,
    foldPeriod: "Sınanan günler",
    foldVolatility: "Kurulum volatilitesi",
    foldVerdict: "İçeride / dışarıda / kenar",
    foldsCaption: "Yöntemin sınandığı her aralık, en eskisi önce",
    foldColumns:
      "Her satır bir kat: sınandığı günler, o katın kendi kurulumunun ölçtüğü volatilite — yukarıdaki rakam değil — ve o günlerin, o kurulumun ürettiği banda göre nerede durduğu.",
    notIndependent:
      "Tek bir havuzda birkaç kat, yöntemin ne sıklıkta tuttuğunun ölçüsü değildir ve bundan sonra ne olacağı hakkında hiçbir şey söylemez. Üstelik ardışık kurulumlar örtüşür — 31 kapanışlık bir kurulum, bir ufukluk adımdan uzundur — yani katlar birbirinden bağımsız değildir.",
    notHeld:
      "Bu bantları kimse tutmadı. Her biri, yöntemin o anda önereceği şeyin sonradan gerçekleşen fiyatların üzerine serilmiş hali — ve yukarıdaki günler, önerilen aralığın kendisinden çizildiği günler, bu günler değil.",
    unavailableHeading: "Bu havuz örneklem dışı sınanamadı",
  },

  divergence: {
    heading: "Sadece tutmaya kıyasla",
    intro:
      "Bu aralıktaki bir pozisyonun, iki tokenı sadece tutmaya kıyasla her fiyatta ne edeceği. Tahmin değil, kesin aritmetik — ama yalnızca fiyat hareketini sayar. Pozisyonun kazanacağı komisyon hakkında hiçbir şey söylemez; oysa likidite sağlayıcıya bu farkın karşılığında ödenen şey tam olarak komisyondur.",
    price: (base: string) => `${base} fiyatı`,
    loss: "Pozisyon, tutmaya kıyasla",
    entryRow: "Bunun ölçüldüğü fiyat — havuzun güncel fiyatı.",
    impermanentNote:
      "Buna genelde geçici kayıp denir. Yalnızca fiyat geri gelirse geçicidir: açıldığı fiyattan farklı bir fiyatta kapatılan bir pozisyon onu gerçekleştirmiş olur.",
  },

  rangeOrder: {
    heading: "Aralıktan geçerken satmak ve almak",
    intro:
      "Yukarıdaki aralık iki taraflı: paranın bir kısmı fiyatın altında, bir kısmı üstünde, ve fiyat ikisinin arasında kaldığı sürece komisyon topluyor. Aralığı fiyattan ikiye böl, her yarısı bambaşka bir araç olur. Tamamen fiyatın üstünde duran bir pozisyon tek bir jetondan başka bir şey tutmaz; fiyat o bandın içinden yukarı geçerken havuz o jetonu diğeriyle takas eder. Fiyatın altında ise tersi olur. Aralık emri dedikleri budur, ve bu aralığın iki yarısı da birer tanesidir.",
    selling: (token: string) => `${token} satmak`,
    buying: (token: string) => `${token} almak`,
    band: "Bant",
    bandNote:
      "Pozisyonun durduğu yer. İç kenarı, fiyatın içinde bulunduğu adımdan bir sonraki fiyat adımı — böylece dönüşeceği jetondan başlangıçta hiç tutmaz.",
    average: "Ortalama fiyat",
    averageNote: "Fiyat bandın tamamını geçerse, dönüşümün denk geldiği fiyat.",
    against: "Güncel fiyata göre",
    exact:
      "Bu ortalama, iki sınırın geometrik ortalamasıdır — tam olarak, ve fiyatlar hangi yönde yazılırsa yazılsın. Protokolün, bir pozisyonun bandının her iki ucunda ne tuttuğuna dair kendi formüllerinden çıkar ve konulan miktar sadeleşir: yüz dolar da bir milyon da aynı fiyattan dönüşür.",
    onlyIfThrough:
      "Ve yalnızca fiyat bandın tamamını geçerse. İçeride geri dönen bir fiyat, pozisyonu her ikisinden bir miktar tutar hâlde bırakır — tek bir fiyat diye bir şey olmaz. Bu da zaten üstündeki aralığın işi; sadece kazara varılmış hâli.",
    notAnOrderBook:
      "Burada dönüşümü zamanlayan da garanti eden de yok. Bu bir emir defteri değil: fiyatın hiç ulaşmadığı bir emir, başarısızlık değil olağan sonuçtur; ne sıra vardır ne de bekleyen bir karşı taraf. Bunun yerine olan şey şu: fiyat bandın içindeyken pozisyon havuzun komisyonunu ödemez, toplar.",
    unavailable: "Bu aralığın anlatılacak tek taraflı bir yarısı yok.",
  },

  swapDepth: {
    heading: "Burada bir takas ne kadara mal olur",
    intro:
      "Yukarıdakilerin hepsi likidite sağlamakla ilgili. Bu ise onu kullanmakla. Bir havuzun likiditesi, üzerine kurulduğu fiyat adımlarının arasında sabittir; yani fiyatın içinde bulunduğu adımın dışına çıkmayan bir takas, protokolün kendi formüllerinden hiçbir şey varsayılmadan fiyatlanabilir. Bir adım ötesi fiyatlanamaz: orada başka bir pozisyonun likiditesi başlıyor olabilir ve bu uygulama her fiyattaki likiditeyi okumaz.",
    selling: (token: string) => `Havuza ${token} satmak`,
    amount: (amount: string, symbol: string) => `${amount} ${symbol}`,
    largest: "Burada fiyatlanabilen en büyük takas",
    largestNote:
      "Fiyat, içinde bulunduğu adımın sonuna varmadan önce içeri giren miktar. Bir sınır değil: daha büyük bir takas da çalışır, bu sayfa onun maliyetini söyleyemez.",
    cost: "Neden vazgeçiyor",
    costNote: "Takasın ortalamasının, ekrandaki fiyattan ne kadar uzakta durduğu.",
    oneSideOnly:
      "Yalnızca bir yön gösteriliyor. Fiyat, adımının sonuna o kadar yakın duruyor ki öbür taraftaki yer bir takas değil bir yuvarlama artığı; bu sayfa da doğrulayamadığı bir rakamı yazmıyor.",
    geometric:
      "Bu ortalama, şimdiki fiyat ile takasın bittiği fiyatın geometrik ortalamasıdır — yukarıdaki tek taraflı pozisyonların dayandığı aynı kimlik, alışverişin öbür tarafından görülmüş hâli. Bir bandı geçen takas onu öder; o bantta duran pozisyon onu alır.",
    whyItDiffers:
      "İki yön aynı büyüklükte değil, çünkü fiyat adımının tam ortasında değil bir yerinde duruyor. Havuzlar arasında karşılaştırmaya değen şey büyüklüğün kendisi: bu piyasanın kıpırdamadan önce ne kadarını yuttuğu, ve büyük bir emri tek seferde göndermek yerine küçük parçalara bölmenin sebebi de bu.",
    hookMayAlter:
      "Bu havuzun hook'u bir takasın maliyetini değiştirmeye izinli — her takas olurken komisyonu yeniden yazmaya, takası havuzun eğrisi yerine kendisi fiyatlamaya ya da sonrasında ondan pay almaya; hangisi olduğunu yukarıdaki hook bölümü söylüyor. Buradaki rakamlar havuzun eğrisinin aldığı tutardır ve yalnızca hook araya girmezse geçerlidir. Burada okunan hiçbir şey, girip girmediğini söyleyemez.",
    unavailable: "Bir takasın maliyeti bu havuz için hesaplanamıyor.",
  },

  compare: {
    heading: "Bu çiftin bütün komisyon kademeleri, yan yana",
    intro: (pair: string) =>
      `Aşağıdaki her ${pair} havuzu aynı ufuk, aynı genişlik ve aynı yatırım tutarıyla okundu; rakamları aynı zeminde duruyor. Yaşanmış günleri anlatıyorlar, gelecek günleri değil. v3 havuzları komisyon sırasıyla, v4 havuzları altlarındaki notun anlattığı gibi en derinden başlayarak dizildi — hiçbiri kazandıracağı paraya göre sıralanmadı.`,
    depositFeesNote: (days: string) => `Fiyatın aralık içinde kaldığı ${days} gün boyunca.`,
    daysInside: "Tamamen aralık içinde geçen günler",
    daysInsideValue: (inside: string, measured: string) => `${inside} / ${measured}`,
    unavailable: "Bu kademe şu anda okunamadı.",
    open: "Tam analizi aç",
    link: "Kademeleri yan yana koy",
    onlyOne: (pair: string) =>
      `${pair} yalnızca tek bir v3 havuzunda işlem görüyor; yanına konacak başka bir havuz yok.`,
    readTogether:
      "Komisyon işin yarısı. Bir aralığın, iki jetonu öylece tutmaya göre neyi kaybettirdiği her havuzun kendi sayfasında; ikisi birlikte okunmalı.",
  },

  feeTiers: {
    heading: "Bu parite başka nerede işlem görüyor",
    intro: (pair: string) =>
      `${pair} birden fazla komisyon kademesinde işlem görüyor. Her biri kendi likiditesi, kendi fiyat geçmişi ve kendi aralığı olan ayrı bir havuz — yukarıdaki rakamlar yalnızca bu havuzu anlatıyor.`,
    onlyOne: (pair: string) =>
      `${pair} Ethereum mainnet üzerinde yalnızca bu komisyon kademesinde işlem görüyor. Yukarıdaki her şey pariteyi anlatıyor, çünkü parite bu tek havuzdan ibaret.`,
    thisOne: "Şu an bunu okuyorsun",
    feeTier: "Komisyon kademesi",
    holds: "Tuttuğu",
    reservesUnread: "Bu havuzun ne tuttuğu zincirden okunamadı.",
    open: "Bu kademeyi analiz et",
    biggerIsNotBetter:
      "Daha çok likidite tutan bir kademe, aynı takas komisyonlarını paylaşan daha kalabalık bir gruptur; daha iyi bir yer değil. Hangisinin bir pozisyona uyduğu, fiyatın ne kadar ve ne sıklıkta hareket ettiğine bağlıdır ve bu havuz havuz ölçülür — yani dürüst karşılaştırma, her birini açıp kendi rakamlarını okumaktır. Seçtiğin ufuk ve çarpan bağlantıyla birlikte taşınır.",
    reservesNote:
      "Bunlar, her havuz için iki token sözleşmesinin bildirdiği bakiyeler — bir indeksleyiciden değil, doğrudan zincirden okundu. İndeksleyicinin kendi rakamı bunlara karşı ölçüldü ve orada olanı 1,3 ile 13 kat arasında fazla gösteriyor; bu yüzden gösterilmiyor. Tek bir dolar rakamı yerine iki token miktarı, çünkü buradaki her kademe aynı iki tokenı tutuyor ve karşılaştırmak için hiçbir şeyin fiyatlanması gerekmiyor.",
    unavailableHeading: "Paritenin diğer komisyon kademeleri okunamadı",

    onV3: "Uniswap v3'te",
    onV4: "Uniswap v4'te",
    v4Intro: (pair: string) =>
      `${pair} işlem gören v4 havuzları — aynı iki sözleşme. Bir v4 paritesi pek çok havuz olabilir: komisyon herhangi bir sayı, fiyat adımı serbest, ve her hook bir havuz daha demek.`,
    v4None: (pair: string) => `Bu iki sözleşmeyle ${pair} işlem gören bir Uniswap v4 havuzu yok.`,
    v4OnlyThis: (pair: string) => `v4'te ${pair} yalnızca bu havuzda işlem görüyor.`,
    v3Intro: (pair: string) => `${pair} işlem gören v3 havuzları — aynı iki token sözleşmesi, her komisyon kademesinde.`,
    v3None: (pair: string) => `Bu iki sözleşmeyle ${pair} işlem gören bir Uniswap v3 havuzu yok.`,
    v3NoNative:
      "Bu havuz zincirin kendi ether'ini tutuyor; v3 bunu yapamaz, çünkü v3'te her para birimi bir token sözleşmesidir. En yakın v3 havuzları sarmalanmış ether'le işlem görür; o da bir havuz için başka bir token.",
    depth: "Güncel fiyattaki derinlik",
    depthValue: (ether: string) => `≈ ${ether} ETH`,
    stateUnread: "Havuzun likiditesi zincirden okunamadı.",
    hook: "hook",
    noHook: "hook yok",
    hookAltersSwaps: "bir takasın neye mal olduğunu değiştirebilir",
    priceStep: (step: string) => `adım ${step}`,
    v4Ordering:
      "Güncel fiyattaki derinliğe göre sıralı — havuzun aktif likiditesi ve fiyatı, PoolManager'ın depolamasından okunmuş — çünkü bir v4 paritesi çoğunlukla birinin kurup bıraktığı havuzlardan oluşur ve onları ayıran şey derinliktir. Bir takasın ne kadar çekebileceğini söyler; hangi havuzun daha iyi olduğunu değil: daha derin bir havuz, aynı komisyonları paylaşan daha kalabalık bir gruptur.",
    moreNotShown: (count: string) => `${count} tanesi daha gösterilmiyor; bunlardan daha sığlar.`,
    v4Unavailable: "Paritenin v4 havuzları okunamadı",
    v3Unavailable: "Paritenin v3 havuzları okunamadı",
  },

  widths: {
    heading: "Diğer genişlikler",
    intro:
      "Aynı yöntem, formun sunduğu her genişlikte; böylece ödünleşme anlatılmak yerine görülebilir: daha geniş bir aralık günlerin daha çoğunu içinde tutar ve aynı yatırımı daha çok fiyata yayar — son sütun budur, ve bir tahmin değil protokolün aritmetiğidir.",
    width: "Genişlik",
    range: "Aralık",
    recent: (days: string) => `Son ${days} günün içeride geçeni`,
    unseen: "Hiç görmediği günlerde içeride",
    insideOf: (inside: string, total: string) => `${total} günün ${inside} tanesi`,
    unseenNone: "yeterli geçmiş yok",
    feeShare: "İçerideyken komisyon payı",
    feeShareValue: (times: string) => `${times}×`,
    chosen: "yukarıda gösterilen",
    columnsNote:
      "İlk sayı, her aralığın çizildiği günler üzerinden; yani o genişliğin nasıl oturtulduğunu söyler, nasıl tuttuğunu değil. İkincisi yukarıdaki sınamanın her genişlik için çalıştırılmış hâli: yöntem bir ufuk geriye alınıp sonraki günlerin üzerine serildi.",
    feeShareNote:
      "Son sütun, fiyatın o aralığın içinde kaldığı bir günde alınan komisyonlardan aynı yatırımın alacağı payı, yukarıda gösterilen genişliğe kıyasla verir — bu yüzden o satır bir okunur. Bir tahmin değil, protokolün kendi pozisyon aritmetiği: daha dar bir aralık aynı parayı daha az fiyat üzerinde daha çok likiditeye çevirir. Havuzun geri kalan likiditesinin değişmediğini varsayar; onu kıpırdatacak kadar büyük bir yatırım bunu doğru bırakmaz. Ve fiyatın dışarıda geçirdiği günler hakkında hiçbir şey söylemez.",
    notAdvice:
      "Bunların hiçbiri bir öneri değil. Daha dar bir aralık, tuttuğu günlerde daha büyük bir pay alır, tutmadığı günlerde hiçbir şey almaz; hangisinin daha önemli olduğu pozisyonun ne için olduğuna bağlıdır — ve burada hiçbir şey bunu bilmez.",
  },

  parameters: {
    heading: "Aralığı değiştir",
    apply: "Yeniden hesapla",
    horizonLabel: "Ne kadar ileriye",
    widthLabel: "Ne kadar geniş",
    depositLabel: "Ne kadar para",
    days: (days: string) => `${days} gün`,
    sigma: (value: string) => `${value}σ`,
    widthChoice: (sigma: string, word: string | null) =>
      word === null ? sigma : `${word} (${sigma})`,
    widthWords: { tight: "Dar", medium: "Orta", wide: "Geniş", veryWide: "Çok geniş" },
    note: "Ufuk, ölçülen hareketin ne kadar ileriye taşındığını söyler. Ölçümün kendisini değiştirmez: hangi ufuk seçilirse seçilsin volatilite her zaman tamamlanmış son 30 günden gelir. Genişlik o hareketi çarpar; daha geniş bir aralık daha seyrek terk edilir ve bir güven düzeyi değildir.",
    fellBack:
      "İstenenlerin bir kısmı okunamadı, o alanda varsayılan kullanıldı. Gerçekten kullanılan ufuk ve genişlik yukarıda yazıyor.",
    preferenceHint:
      "Bu yalnızca bu sayfayı değiştirir. Her havuzun açılış değerlerini değiştirmek için üstteki aralık tercihlerini kullanın.",
  },

  holdings: {
    heading: "Bu adres ne tutuyor",
    intro:
      "Bu adreste bulunan jetonlar ve girebilecekleri havuzlar. Aşağıdan Telegram bildirimi istemediğin sürece burada hiçbir şey saklanmaz ve adres herkese açık bir bilgidir — aynı liste onu arayan herkese görünür.",
    forAddress: "Adres",
    loading: "Bu adresin ne tuttuğu token sözleşmelerine soruluyor…",
    howItLooked: (tokens: string, v3Pools: string, v4Pools: string | null) =>
      `Bir tokenın bakiyesi tokenın kendi sözleşmesinin içinde durur; yani bir adresin nelere sahip olduğunun listesi diye bir şey yoktur, yalnızca tek tek sorulabilecek tokenlar vardır. Burada ${tokens} tanesi soruldu: Ethereum mainnet'te en çok işlem gören ${v3Pools} Uniswap v3 havuzunda geçen tokenların tamamı${v4Pools === null ? "" : ` ve son yedi günde en çok işlem gören ${v4Pools} v4 havuzundaki para birimlerinin tamamı — zincirin kendi ether'i dahil`}. Bu kümenin dışında tutulan bir şey, adres onu tutmadığı için değil, sorulmadığı için bu sayfada yok.`,
    v4NotSearched:
      "Uniswap v4 havuzları aranmadı: listeleri okunamadı. Ether ve v4 havuzlarının para birimleri bu sayfada bu yüzden yok, başka bir sebepten değil.",
    hookTag: "hook",
    holdingsHeading: "Bulunan tokenlar",
    nothingFound:
      "Kontrol edilen tokenların hiçbiri bu adreste bulunamadı. Bu, cüzdanın boş olduğu anlamına gelmez — aramanın nasıl yapıldığı yukarıda yazıyor.",
    poolsHeading: "Bu tokenların girebileceği havuzlar",
    bothSides: "İki tarafı da tutuyorsun",
    oneSide: "Bir tarafını tutuyorsun",
    bothSidesNote:
      "Bu havuzun iki tokenı da adreste bulundu; yani buradaki bir pozisyon önce takas gerektirmiyor.",
    oneSideNote:
      "Bu havuzun iki tokenından biri bulundu. Buradaki bir pozisyon diğer tarafı da gerektirir; bu da elindekinin bir kısmını takas etmek demek.",
    moreNotShown: (count: string) =>
      `${count} tanesi daha gösterilmiyor. Yukarıdakiler bunların en çok işlem görenleri, veri kaynağının bildirdiği sırayla — bu, bir havuzun ne kadar yoğun olduğuna dair bir iddiadır ve başka hiçbir şeye dair değildir.`,
    analyse: "Bu havuzu analiz et",
    notAdvice:
      "Bu, neyin mümkün olduğunun listesi; neyin yapmaya değer olduğunun değil. Bu havuzlardan hangisinin neye uyduğu, her havuzun kendi sayfasındaki rakamlara ve pozisyonun ne için açıldığına bağlı — bu listenin ikisini de bilmesi mümkün değil.",
    unavailableHeading: "Bu adres okunamadı",
    invalidAddress: "Bu bir Ethereum adresi değil, bu yüzden hiçbir sorgu yapılmadı.",
    noAddress: "Ön sayfadan bir cüzdan bağla; bu sayfa onun ne tuttuğunu gösterecek.",
  },

  v4: {
    heading: "Bir Uniswap v4 havuzu",
    intro:
      "Bu havuzun ne olduğu, kendi anahtarından okundu. Bir v4 havuzu kendine ait bir sözleşme değildir: tek bir PoolManager'ın içinde yaşar ve onu tanımlayan beş şeyin özetiyle adlandırılır — iki para birimi, komisyon, fiyat adımı ve hook.",
    poolId: "Havuz kimliği",
    pair: "Para birimleri",
    fee: "Komisyon",
    feeNote: (swap: string, lp: string, protocol: string) =>
      `Havuzun zincirdeki kendi anahtarından okundu. Bir takas ${swap} öder: bu ${lp} likidite sağlayıcılarına, üstüne ${protocol} protokole.`,
    feeNoteNoProtocol:
      "Havuzun zincirdeki kendi anahtarından okundu. Protokol üstüne bir şey almıyor; yani bir takasın ödediği tam olarak bu.",
    dynamicFee: "Hook belirliyor, her takasta",
    dynamicFeeNote:
      "Bu havuzun anahtarı komisyon yerine dinamik komisyon bayrağını taşıyor; yani bir takasın ne tutacağına, olduğu anda hook karar veriyor. Bu okuma bir tanesini gözlemlemedi ve burada bildirilecek bir komisyon yok.",
    feeUnread: "komisyon okunamadı",
    feeUnreadNote:
      "Havuzun komisyonu, oluşturulduğu anahtarın içinde, zincirde duruyor; bu okuma onu getiremedi. Başka hiçbir şey onun yerini tutmaz.",
    protocolFee: "Protokol komisyonu",
    protocolFeeNone: "Yok",
    protocolFeeNote:
      "Protokol tarafından havuzun komisyonunun üstüne, her takasta alınır. Yönetişim belirler; havuzun zincirdeki durumundan okundu.",
    protocolFeeByDirection: (token0: string, token1: string) =>
      `Yöne göre değişiyor: ilki ${token0} satılırken, ikincisi ${token1} satılırken.`,
    priceStep: "Fiyat adımı",
    priceStepNote: (spacing: string) =>
      `Bu havuzda bir pozisyonun kenarlarının yerleştirilebildiği en ince adım — tick adımı ${spacing}. v4'te havuzun anahtarının parçası; yani v3'ten farklı olarak ayrı bir sözleşme çağrısı gerektirmiyor.`,
    nativeCurrency: "Yerli ether",
    nativeCurrencyNote:
      "Buradaki sıfır adres eksik bir alan değil. v4, bir havuzun sarmalanmış token yerine zincirin kendi ether'ini tutmasına izin veriyor; bu da o.",
    hookHeading: "Hook",
    noHook: "Bu havuz hook'suz çalışıyor.",
    noHookNote:
      "Takaslarının ya da yatırımlarının yanında hiçbir şey çalışmıyor; yani bir v3 havuzu gibi davranıyor.",
    hookMay: "Neye izinli",
    permissionTopics: {
      swaps: "Takaslarda",
      liquidity: "Yatırma ve çekmelerde",
      creation: "Havuz oluşturulurken",
      donations: "Bağışlarda",
    },
    permissionWords: {
      beforeSwap:
        "Her takastan önce çalışmak; orada takası reddedebilir ve komisyonu dinamik olan bir havuzda o takasın ne ödeyeceğini belirleyebilir.",
      afterSwap: "Her takastan sonra çalışmak; orada takası yine de reddedebilir.",
      beforeSwapReturnsDelta:
        "Havuz fiyatlamadan önce takastan token almak ya da takasa kendi tokenlarını koymak — yani buradaki bir takas havuzun kendi eğrisini izlemek zorunda değil.",
      afterSwapReturnsDelta: "Havuz fiyatladıktan sonra takastan pay almak.",
      beforeAddLiquidity: "Her yatırmadan önce çalışmak; orada yatırmayı reddedebilir.",
      afterAddLiquidity: "Her yatırmadan sonra çalışmak; orada yatırmayı yine de reddedebilir.",
      afterAddLiquidityReturnsDelta:
        "Yatırma yapılırken yatırılandan token almak ya da ona token eklemek.",
      beforeRemoveLiquidity: "Her çekmeden önce çalışmak; orada çekmeyi reddedebilir.",
      afterRemoveLiquidity: "Her çekmeden sonra çalışmak; orada çekmeyi yine de reddedebilir.",
      afterRemoveLiquidityReturnsDelta:
        "Çekme yapılırken çekilenden pay almak ya da ona token eklemek.",
      beforeInitialize: "Havuz oluşturulmadan önce bir kez çalışmak. Bu çoktan oldu.",
      afterInitialize: "Havuz oluşturulduktan sonra bir kez çalışmak. Bu çoktan oldu.",
      beforeDonate:
        "Havuzun sağlayıcılarına yapılan bir bağıştan önce çalışmak; orada bağışı reddedebilir.",
      afterDonate:
        "Havuzun sağlayıcılarına yapılan bir bağıştan sonra çalışmak; orada bağışı yine de reddedebilir.",
    },
    noPermissions:
      "Takaslarda, yatırma ve çekmelerde ya da bağışlarda hiçbir şey: protokol onu bu anların hiçbirinde çağırmıyor. Böyle bir hook'un hâlâ yapabildiği şey, komisyonu dinamik olan bir havuzun komisyonunu belirlemek.",
    permissionNames: "Bunların protokoldeki adları",
    withdrawalWarning: (share: boolean) =>
      share
        ? "Bu hook, bir sağlayıcı para çektiğinde çalışır. Bir çekmeyi reddetmeye ve çekilenden pay almaya izinli. Bunu gerçekten yapıp yapmadığı buradan bilinemez."
        : "Bu hook, bir sağlayıcı para çektiğinde çalışır ve bir çekmeyi reddetmeye izinli. Bunu gerçekten yapıp yapmadığı buradan bilinemez.",
    hookAddressIsThePermission:
      "Bunlar hook'un kendi adresinden okundu. v4 bir hook'un izinlerini hiçbir yerde saklamaz: hook, son on dört biti PoolManager'ın hangi geri çağrıları tetikleyeceğini yazan bir adrese kurulur, ve PoolManager sözleşmeye sormak yerine o bitlere bakar. Yani burada yazan, hook'un ne *yapabileceği*; ne yaptığı değil — her takasta komisyonu yeniden yazmaya izinli bir hook hep aynı komisyonu döndürüyor olabilir, ve bu buradan bilinemez.",
    alterSwapWarning:
      "Bu hook, bir takasın ne tutacağını ya da ne ödeyeceğini değiştirmeye izinli. Fiyat geçmişinden türeyen her rakam — önerilen aralık, komisyon kademesi, sadece tutmaya kıyaslama — havuzun söylediği komisyonu aldığını ve eğrinin söylediğini ödediğini varsayar. Burada iki varsayım da güvenli değil, ve bunların hiçbiri bir fiyat serisinde görünmez.",
    analysisScope:
      "Aşağıda aralık analizi var. Aralık, zaten gerçekleşmiş fiyatlardan çıkıyor; bu yüzden burada, hook'u olmayan bir havuzdaki kadar geçerli — bir hook, fiyatın geçmişte nereye gittiğini geriye dönük değiştiremez. Hook'un değiştirebildiği şey, bir takasın neye mal olduğu; bu yüzden bu havuzun aldığı oran, yukarıdaki komisyondan alınmıyor, topladığı tutardan ölçülüyor.",
    unavailableHeading: "Bu havuz okunamadı",
    invalidId:
      "Bu bir v4 havuz kimliği değil. Bir v4 havuzu 32 baytlık bir özetle adlandırılır — 0x ve ardından 64 onaltılık karakter — bir sözleşme adresiyle değil.",
    noId: "Havuzun ne olduğunu ve hook'unun neye izinli olduğunu görmek için bir v4 havuz kimliği yapıştır.",
    loading: "Bu v4 havuzu, veri kaynağından ve zincirden okunuyor…",
  },

  notFound: {
    title: "Burada bir sayfa yok",
    body: "Takip ettiğin adres, bu uygulamanın sunduğu hiçbir şeyi adlandırmıyor. Bir havuza adresiyle, v4 ise kimliğiyle ulaşılır; ikisi de yolun içine değil, arama kutusuna yazılır.",
    search: "Havuz bul →",
  },

  hooks: {
    heading: "Uniswap v4'te çalışan kancalar",
    loading: "Bu haftanın en yoğun v4 havuzları okunuyor…",
    intro:
      "Her v4 havuzu bir kancanın adını verebilir: PoolManager'ın bir takasın, bir yatırmanın, bir çekmenin belirli anlarında çağırdığı bir sözleşme. Hangi anlarda çağrılacağı kimsenin verdiği bir söz değil. Kancanın adresine kazınmış durumda — düşük on dört bit o listenin kendisi, ve protokol sözleşmeyi bunun dışında hiçbir şey için çağırmaz.",
    onlyPermissions:
      "Bu sayfanın bildiği şeyin tamamı bu, ve tam da iddia değil zorunluluk olduğu için bilmeye değer. Bir kancanın o izinle ne yaptığı kendi kodunda. Bu uygulama kod okumaz ve kimsenin kefil olduğu bir kanca listesi tutmaz — ikisi de, doğrulayabildiği rakamların yanına doğrulayamadığı bir iddia koymak olurdu.",
    window: (pools: string, hooked: string, hookless: string) =>
      `Bu haftanın en yoğun v4 günlerindeki ${pools} havuzdan okundu. Bunların ${hooked} tanesi bir kancanın adını veriyor; ${hookless} tanesi hiçbirini vermiyor ve bir v3 havuzu gibi davranıyor.`,
    ordering:
      "Her kancayı kaç havuzun çalıştırdığına göre sıralanmış. Bu yalnızca bir havuz sayısı: çok havuzda görünen bir kanca, birinin çok havuz açtığı bir kancadır, başka bir şey değil.",
    runs: (count: string) => `Bunların ${count} tanesini çalıştırıyor`,
    poolsHeading: "Nerede çalışıyor",
    moreNotShown: (count: string) => `ve ${count} tane daha`,
    none: "Bu haftanın en yoğun v4 günlerindeki hiçbir havuz bir kancanın adını vermiyor.",
    unavailable: "Haftanın v4 havuzları okunamadı; gösterilecek bir dizin yok.",
    fromHome: "Bütün kancaları gör →",
  },

  positions: {
    heading: "Bu adresin hâlihazırda tuttuğu pozisyonlar",
    intro:
      "Yukarıdakilerin hepsi bu adresin ne yapabileceğiydi — tuttuğu jetonların hangi havuzları açtığı. Bu ise çoktan ne yaptığı. Her iki protokolde de bir pozisyon, tek bir sözleşmenin tuttuğu bir jetondur ve her jetonun ne olduğu o sözleşmeye sorulur. v3 sözleşmesi bir adresin jetonlarını ayrıca sıralayabiliyor; v4 sözleşmesi sıralayamıyor, bu yüzden o liste bir indeksleyiciden geliyor ve içindeki her kimlik zincire geri götürülüp sahibi soruluyor.",
    none: "Bu adres hiçbir protokolde Uniswap pozisyon jetonu tutmuyor.",
    noneOpen:
      "Bu adresin tuttuğu bütün pozisyon jetonları kapatılmış. Kapalı bir jeton, vaktiyle var olan bir pozisyonun makbuzudur, pozisyon değil.",
    counts: (held: string, open: string, closed: string) =>
      `${held} pozisyon jetonu; bunların ${open} tanesinde hâlâ likidite var, ${closed} tanesi kapatılmış.`,
    inRange: "Şu anda kazanıyor",
    outOfRange: "Aralığının dışında",
    rangeUnknown: "Burada hiç takas olmamış",
    analyse: "Bu havuzu analiz et →",
    feesEarned: (amount0: string, symbol0: string, amount1: string, symbol1: string) =>
      `Kazanılmış ve henüz çekilmemiş: ${amount0} ${symbol0} ve ${amount1} ${symbol1}.`,
    feesNone: "Henüz çekilecek bir kazanç yok.",
    feesUnread: "Ne kazandığı okunamadı.",
    everyPrice: "Bu havuzun ifade edebildiği her fiyat",
    moreNotShown: (count: string) => `${count} tane daha açık ama burada listelenmedi.`,
    readCap: (read: string, held: string) =>
      `${held} tanesinin ${read} tanesi okundu. Kalanı bu sayfada yok; bu, adresin değil sayfanın sınırı.`,
    unreadProtocol: (protocol: string) =>
      `Bu sefer Uniswap ${protocol} pozisyonları okunamadı; buradaki bütün rakamlar yalnızca diğer protokole ait.`,
    unavailable: "Bu adresin pozisyonları okunamadı.",
    publicNote:
      "Bir pozisyonun sahibi zincirdedir, dolayısıyla bu liste herkese açıktır: aynı adres için aynı listeyi herkes okuyabilir ve bu liste, adresin bu jetonları tutarak zaten yayımlamadığı hiçbir şeyi söylemez. Aşağıdan Telegram bildirimi istemediğin sürece burada hiçbir şey saklanmaz ve bu sayfadaki hiçbir rakam bir değerleme değildir — bir aralık, bir pozisyonun ne ettiği değildir.",
  },

  wallet: {
    heading: "Cüzdan bağla",
    intro:
      "Bir cüzdan bağladığında bu sayfa, adresin hangi tokenları tuttuğunu görebilir ve o tokenların girebileceği havuzları gösterebilir. Yaptığı şey adresi okumaktır; bir cüzdandan burada istenen tek şey budur.",
    connect: "Cüzdanı bağla",
    connecting: "Cüzdan bekleniyor…",
    connectedAs: "Bağlı adres",
    showHoldings: "Ne tuttuğunu göster",
    forget: "Bu adresi unut",
    readOnly:
      "Salt okunur. Bu uygulama cüzdandan adresini ister, asla imza istemez: burada bir mesajı imzalayabilecek ya da işlem gönderebilecek hiçbir kod yoktur ve cüzdana dair hiçbir şey ziyaretler arasında saklanmaz.",
    notices: {
      "wallet-not-found":
        "Bu tarayıcıda cüzdan bulunamadı. Bir tarayıcı cüzdan eklentisi bunu sağlar; o olmadan bu sayfada hiçbir şey değişmez.",
      "wallet-request-declined":
        "İstek cüzdanda reddedildi. Hiçbir şey okunmadı, hiçbir şey gönderilmedi.",
      "wallet-request-failed":
        "Cüzdandan adres istenemedi. Hiçbir şey okunmadı, hiçbir şey gönderilmedi.",
      "wallet-no-account":
        "Cüzdan adres vermeden cevap verdi; bu genellikle kilitli olduğu ya da seçili bir hesabı olmadığı anlamına gelir.",
    },
  },

  telegram: {
    heading: "Telegram'dan bildirim",
    intro:
      "Bu adresteki bir pozisyon aralığının sınırına yaklaştığında, aralıktan çıktığında ya da geri girdiğinde Telegram'dan haber al. Düğme seni bu sitenin botuna götürür; orada Başlat'a basınca o sohbet bu adrese bağlanır. Saklanan yalnızca adres ile sohbetin sayısal kimliğidir — başka hiçbir şey — ve bota /stop yazdığın ya da bağlantıyı buradan unuttuğun an ikisi de sunucudan silinir, yedi gün içinde de şifreli yedeklerden düşer. Ne sıklıkla kontrol edildiği, bunun çalıştığı sunucuya bağlıdır.",
    connect: "Telegram'a bağla",
    connected: (address: string) => `Bu tarayıcı bağlı: ${address} izleniyor.`,
    pending: "Bağlantı bekliyor: Telegram'da botun sohbetini aç ve Başlat'a bas.",
    forget: "Bağlantıyı unut",
    notConfigured: "Bu sunucuda Telegram bildirimleri kurulu değil.",
    publicNote:
      "Bir adresi izlemek için sahibi olmak gerekmez — pozisyonlar herkese açıktır ve bir bildirim bu listenin söylemediği hiçbir şeyi söylemez. Bot zinciri okur ve mesaj gönderir; hiçbir şey imzalayamaz, hiçbir şey gönderemez.",
    linked: (address: string) =>
      `Bağlandı. ${address} adresindeki bir pozisyon aralığının sınırına yaklaştığında, aralıktan çıktığında ya da geri döndüğünde burada haber alacaksın. Bitirmek için /stop gönder.`,
    unknownStart:
      "Bu bağlantı tanınmıyor ya da süresi dolmuş. Sitede “Telegram'a bağla” düğmesine yeniden bas.",
    alreadyClaimed:
      "Bu bağlantı başka bir sohbet tarafından zaten kullanılmış. Yenisi için sitede “Telegram'a bağla” düğmesine yeniden bas.",
    stopped: "Durduruldu. Bu sohbet artık hiçbir şeyi izlemiyor. Kayıt sunucudan silindi; şifreli yedeklerden de yedi gün içinde düşecek.",
    nothingToStop: "Bu sohbet zaten hiçbir şeyi izlemiyordu.",
    help:
      "Bu bot yalnızca sitede bağladığın adresi izler ve yalnızca bir pozisyon aralığının sınırına yaklaşınca, aralıktan çıkınca ya da geri girince konuşur. Bitirmek için /stop gönder.",
    storeDown: "Bağlantı şu anda kontrol edilemedi. Bir dakika sonra yeniden dene.",
    left: (pair: string, protocol: string, range: string) =>
      `⚠️ ${pair} (${protocol}) aralığından çıktı: ${range}. Fiyat geri gelene kadar tek jeton tutuyor ve hiçbir şey kazanmıyor.`,
    nearing: (pair: string, protocol: string, range: string, price: string, edge: string) =>
      `⏳ ${pair} (${protocol}) aralığının sınırına yaklaştı: ${range}. Fiyat ${price}; ${edge} aşılırsa tek jeton tutar ve hiçbir şey kazanmaz.`,
    entered: (pair: string, protocol: string, range: string) =>
      `✅ ${pair} (${protocol}) yeniden aralığında: ${range}. Yeniden kazanıyor.`,
    opened: (pair: string, protocol: string, range: string) => `Yeni pozisyon: ${pair} (${protocol}), ${range}.`,
    closed: (protocol: string, tokenId: string) => `Kapandı: ${protocol} #${tokenId} pozisyonu.`,
    footer:
      "Yalnızca bilgi — yatırım tavsiyesi değildir. Herkese açık zincir verisinden okunur; buradaki hiçbir şey senin adına işlem yapamaz.",
  },

  search: {
    label: "Bir parite, bir v3 havuz adresi ya da bir v4 havuz kimliği",
    placeholder: "WETH/USDC",
    help: "WETH/USDC gibi bir parite yaz, bir v3 havuz sözleşmesinin adresini yapıştır, ya da bir v4 havuz kimliği yapıştır — v4 havuzunun adlandırıldığı 32 baytlık özet. Salt okunur: bu uygulama hiçbir şey imzalamaz ve asla işlem göndermez.",
    submit: "Havuz bul",

    heading: "Eşleşen Uniswap v3 havuzları",
    resultsFor: (terms: string) => `Tokenları ${terms} ile eşleşen havuzlar.`,
    empty: (terms: string) =>
      `Ethereum mainnet üzerinde ${terms} ile eşleşen tokenı olan bir Uniswap v3 havuzu bulunamadı.`,
    emptyHint: "Yazımı kontrol et, ya da havuzun adresi elindeyse onu yapıştır.",

    v4Heading: "Eşleşen Uniswap v4 havuzları",
    v4Empty: (terms: string) =>
      `Ethereum mainnet üzerinde ${terms} ile eşleşen para birimi olan bir Uniswap v4 havuzu bulunamadı.`,
    v4Depth: "Güncel fiyattaki derinlik",
    v4DepthValue: (ether: string) => `≈ ${ether} ETH`,
    v4DepthNote:
      "Havuzun aktif likiditesinin şu an ettiği değer; PoolManager'ın kendi depolamasından okundu — havuzun tuttuğu şey değil, çünkü hiçbir v4 havuzu onu kendi başına bildirmez.",
    v4StateUnread: "Havuzun likiditesi zincirden okunamadı.",
    v4Hook: "Hook",
    v4NoHook: "yok",
    v4HookAltersSwaps: "bir takasın neye mal olduğunu değiştirebilir",
    v4Ordering:
      "Tam olarak arattığın adı taşıyan havuzlar önce gelir. Sonrası, her havuzun güncel fiyattaki derinliğine göre sıralanır — aktif likiditesi ve fiyatı PoolManager'ın depolamasından okunur ve veri kaynağının türettiği fiyatlarla tek bir ölçeğe konur. Havuzun tuttuğu şey değil: her v4 havuzunun tokenları tek bir PoolManager'da hep birlikte durur ve zincirde onları havuz havuz bildiren hiçbir şey yoktur. İndeksleyicinin kendi likidite rakamı zincirle karşılaştırıldı ve en yoğun havuzlardan birinde yüzde on beş sapıyordu; bu yüzden kullanılmıyor.",

    ordering:
      "Tam olarak arattığın adı taşıyan havuzlar önce gelir. Sonrası, her havuzun gerçekte ne tuttuğuna göre sıralanır — token sözleşmelerinin kendisinden okunur ve veri kaynağının türettiği fiyatlarla tek bir ölçeğe konur. Eskiden kaynağın bildirdiği kilitli değere göre sıralanıyordu; o rakam bu listeyi yeniden dizecek kadar yanlıştı: bir havuz burada dokuz milyon dolarlık bildirilen likiditeyle yayımlanırken sözleşmeleri dokuz bin dolar tutuyordu.",
    windowing:
      "Bu liste, veri kaynağının senin terimlerin için en çok işlem gördüğünü bildirdiği havuzlardan çıkarılır; o kümenin dışında kalacak kadar sessiz bir havuz yukarıdaki sıralamaya hiç ulaşmaz. Bir kaynağın döndürmeyi seçtiği şeyin içinde sıralama yapmanın dürüst sınırı budur: çok şey tutan ama nadiren işlem gören bir havuz bu sayfada olmayabilir.",
    dormantNote:
      "Bir aydır hiçbir şey olmayan havuz listelenmez. Aralık son bir ayın fiyatlarından çizilir; öyle bir ayı olmayan havuzda çizecek bir şey yoktur — açmak yalnızca bunu söylerdi.",
    v4Windowing:
      "Bu liste, Ethereum mainnet'te son yedi günde en çok işlem gören v4 havuzlarından çıkarılır — en yoğun bin havuz-gün, bu da birkaç yüz havuz eder — ve bundan daha sessiz bir havuz bu sayfaya hiç ulaşmaz. Kaynak, her v4 havuzunu tarayan bir aramayı bu sayfa beklemekten vazgeçmeden cevaplayamıyor; bu yüzden pencere senin terimlerine göre değil, yakın dönemin hareketine göre: var olan ama bu hafta işlem görmemiş bir havuz burada yok.",
    symbolWarning:
      "Sembol, tokenın kendi sözleşmesinden gelir; kendine USDC diyen bir token çıkarmanın hiçbir maliyeti yoktur. İki tokenı birbirinden ayıran şey, her paritenin altındaki sözleşme adresleridir.",

    feeTier: "Komisyon kademesi",
    holds: "Tuttuğu",
    reservesUnread: "Bu havuzun ne tuttuğu zincirden okunamadı.",
    moreNotShown: (count: string) =>
      `${count} tanesi daha gösterilmiyor. Yukarıdakiler bunların en çok işlem görenleri, veri kaynağının bildirdiği sırayla — bu, bir havuzun ne kadar yoğun olduğuna dair bir iddiadır ve başka hiçbir şeye dair değildir.`,
    analyse: "Bu havuzu analiz et",
    v4FeeNote:
      "Her havuzun komisyonu, veri kaynağından değil, havuzun oluşturulduğu anahtardan zincirde okundu — kaynağın komisyon rakamı ölçüldüğünde, havuzun kendi komisyonu değil, bir takasın en son ödediği toplam (protokol payı dahil) çıktı. Anahtarı okunamayan satır bunu söylüyor.",

    unavailableHeading: "Arama yapılamadı",
    rejected: {
      empty: "WETH/USDC gibi bir parite ya da bir havuz adresi yaz.",
      length: (min: number, max: number) =>
        `Arama terimi ${min} ile ${max} karakter arasında olmalı.`,
      unsupportedCharacters:
        "Arama terimi harf, rakam ve tickerlarda geçen işaretleri içerebilir — başka bir şey değil.",
    },
  },

  report: {
    steps: {
      pool: "havuzun yapılandırması okunurken",
      snapshot: "havuzun güncel piyasa durumu okunurken",
      history: "havuzun günlük fiyat geçmişi okunurken",
      volatility: "fiyatın ne kadar hareket ettiği ölçülürken",
      band: "fiyat bandı kurulurken",
      range: "bant havuzun ifade edebildiği fiyatlara oturtulurken",
      divergence: "o aralık iki tokenı tutmakla karşılaştırılırken",
      activity: "havuzun ölçüm penceresinde ne yaptığı okunurken",
    },
    noRangeHeading: "Bu havuz için aralık yok",
    stoppedWhile: (step: string) => `İşlem ${step} durdu.`,
    poolSummary: (protocol: string, fee: string, chain: string) =>
      `Uniswap ${protocol} · ${chain} · ${fee}`,
    feePerSwap: (fee: string) => `her takasta ${fee} komisyon`,
    feePlusProtocol: (fee: string, protocol: string) =>
      `her takasta ${fee} komisyon, artı protokole ${protocol}`,
    noDeclaredFee: "komisyonu her takasta hook'u belirliyor",
    caveatsHeading: (count: number) =>
      count === 1
        ? "Bu sayılar için bir çekince geçerli."
        : `Bu sayılar için ${count} çekince geçerli.`,
    caveatsAriaLabel: "Çekinceler",

    contentsHeading: "Bu sayfada",
    contentsLabel: "Bu analizin bölümleri",
    rangeHeading: "Önerilen fiyat aralığı",
    rangeIntro: (base: string, quote: string) =>
      `Bu havuzdaki bir pozisyonun aktif olacağı fiyatlar; ${base} fiyatı ${quote} cinsinden yazıldı.`,
    rangeValue: (lower: string, upper: string, quote: string, base: string) =>
      `${base} başına ${lower} – ${upper} ${quote}`,
    rangeDistances: (down: string, up: string) =>
      `Güncel fiyatın ${down} altından ${up} üstüne.`,
    rangeMeaning:
      "Bu iki fiyatın arasında pozisyon, havuzun takas komisyonlarından payını alır. Dışında tek bir token tutar ve fiyat geri dönene kadar hiçbir şey kazanmaz.",
    priceSentence: (base: string, price: string, quote: string) => `1 ${base} = ${price} ${quote}`,
    currentPrice: "Güncel fiyat",
    inRangeYes: "Güncel fiyat bu aralığın içinde.",
    inRangeNo: "Güncel fiyat bu aralığın dışında.",
    inRangeYesNote: "Burada açılan bir pozisyon hemen aktif olur.",
    inRangeNoNote:
      "Burada açılan bir pozisyon tek bir token tutar ve fiyat aralığa geri dönene kadar hiçbir şey kazanmaz.",
    beyondEdges: (below: string, above: string) =>
      `Fiyat aralığın altına düşerse pozisyonun elinde yalnızca ${below} kalır; üstüne çıkarsa yalnızca ${above}.`,
    lowerTruncatedNote:
      "Alt kenar bu havuzun ifade edebildiği en düşük fiyatta durdu; bandın koyacağı yere ulaşmıyor.",
    upperTruncatedNote:
      "Üst kenar bu havuzun ifade edebildiği en yüksek fiyatta durdu; bandın koyacağı yere ulaşmıyor.",
    chartLabel: "Son bir ayın fiyatları, önerilen aralığa karşı",
    chartCaption: (days: string) =>
      `Son ${days} günün her biri: kapanışı, ve en düşüğünden en yükseğine uzanan çizgi. Gölgeli bant önerilen aralık; düz çizgi bugünkü fiyat.`,
    chartLegend:
      "Dolu nokta, günü tamamen aralığın içinde geçiren gün; içi boş nokta dışına çıkan ya da bir kenarı geçen gün.",

    basisHeading: "Bu aralık nasıl çizildi",
    basisIntro: (base: string, days: string) =>
      `${base} fiyatının tamamlanmış son ${days} günde gerçekte ne kadar hareket ettiğinden — bundan sonra nereye gideceğine dair bir tahminden değil.`,
    dailyMove: "Tipik günlük hareket",
    dailyMoveNote: "Pencere boyunca bir günlük fiyat değişiminin standart sapması.",
    horizonMove: (days: string) => `${days} günde`,
    horizonMoveNote:
      "Aynı hareket, aşağıda seçilen ufka yayılmış hâliyle: her iki yöne bir standart sapma.",
    widthValue: (multiplier: string) => `bunun ${multiplier} katı, her yöne`,
    widthNote:
      "Aşağıdan seçilir. Daha geniş bir aralık daha seyrek terk edilir; aynı yatırım daha geniş bir aralığa yayılınca her fiyatta daha incedir.",
    measuredOver: "Ölçüm penceresi",
    measuredOverNote: (returns: string) => `${returns} günlük değişim kullanıldı.`,
    epilogue:
      "Aralık bugünkü fiyata ortalanır ve oran olarak aşağı ve yukarı aynı mesafede çizilir — yarıya inmekle iki katına çıkmak aynı harekettir — iki yüzdenin farklı olması bundandır. Fiyatın ne kadar hareket ettiğini anlatır, nereye gideceğini değil: bir tahmin değildir, genişliği de bir güven düzeyi değildir. Buradaki hiçbir şey pozisyon büyüklüğü belirlemez, hangi tokendan ne kadar yatırılacağını söylemez.",
  },

  technical: {
    heading: "Teknik ayrıntılar",
    summary: "Yukarıdaki sayfanın karşısında doğrulandığı tick'ler, bloklar ve rakamlar.",
    lowerTick: "Alt tick",
    upperTick: "Üst tick",
    currentTick: "Güncel tick",
    sourceReportedTick: (tick: string) => `Kaynak ${tick} bildirdi.`,
    noSourceTick:
      "Kaynak kendi tick'ini bildirmedi, bu yüzden bu dönüşüm doğrulanmadı.",
    tickSpacing: "Tick adımı",
    tickSpacingNote: (step: string) => `Kullanılabilir kenarlar arasında ${step} fiyat adımı.`,
    width: "Genişlik",
    widthValue: (ticks: string, spacings: string) => `${ticks} tick · ${spacings} adım`,
    poolPrice: "Havuzun kendi yönünde fiyat",
    quotePerBase: (quote: string, base: string) => `${base} başına ${quote}`,
    bandLower: "Bant alt sınırı",
    bandUpper: "Bant üst sınırı",
    bandNote: "Tick ızgarasına oturtulmadan önce, havuzun kendi yönünde.",
    annualised: "Yıllıklandırılmış volatilite",
    annualisedNote:
      "Günlük log getirilerinin örneklem standart sapması, sqrt(365) ile ölçeklenmiş.",
    coverage: "Kapsama",
    coverageNote: "Pencerenin ne kadarının ardışık günlük fiyatlarla desteklendiği.",
    sourceBlock: "Kaynak blok",
    noBlockTime: "Blok zamanı bildirilmedi.",
    fetchedAt: "Çekilme zamanı",
    fetchedAtNote: "Yanıtın geldiği an — anlattığı an değil.",
    lowerEdge: "Alt kenar",
    upperEdge: "Üst kenar",
    truncated: "Kırpıldı",
    asAsked: "İstendiği gibi",
  },

  explanation: {
    heading: "Açıklama",
    pending: "Açıklama yazılıyor…",
    unavailable: "Bu analiz için açıklama yok.",
    sectionWriting: "Hâlâ yazılıyor…",
    sectionMissing: "Bu bölüm yazılamadı.",
    writtenBy: (model: string) =>
      `${model} tarafından yazıldı. Yukarıdaki sayılar ona ait değil.`,
    sections: {
      whatThisRangeMeans: "Bu aralık ne demek",
      ifPriceLeavesTheRange: "Fiyat aralığın dışına çıkarsa",
      whatTheVolatilitySays: "Volatilite ne söylüyor",
      whatThisDoesNotCover: "Bu analiz neyi kapsamıyor",
    },
  },

  notices: {
    failure: {
      "invalid-pool-address":
        "Havuz adresi 0x ile başlayıp tam olarak 40 onaltılık karakterle devam etmeli ve sıfır adresi olamaz.",
      "invalid-search-terms":
        "Havuz araması bir ya da iki kısa terim alır: harfler, rakamlar ve tickerlarda geçen işaretler.",
      "market-data-not-configured":
        "Bu sunucuda Uniswap v3 piyasa verisi yapılandırılmamış.",
      "chain-data-not-configured":
        "Bu sunucuda zincir üstü okuma yapılandırılmamış.",
      "explanation-not-configured":
        "Bu uygulama açıklama yazacak şekilde yapılandırılmamış, bu yüzden açıklama gösterilmiyor.",
      "market-data-timed-out":
        "Piyasa verisi isteği zaman aşımına uğradı.",
      "market-data-unreachable":
        "Piyasa verisi kaynağına ulaşılamadı.",
      "market-data-credentials-rejected":
        "Piyasa verisi kaynağı yapılandırılmış kimlik bilgilerini kabul etmedi.",
      "market-data-rate-limited":
        "Piyasa verisi kaynağının istek sınırı aşıldı.",
      "market-data-unreadable":
        "Piyasa verisi kaynağı okunamayan bir yanıt döndürdü.",
      "market-data-malformed":
        "Piyasa verisi kaynağı, bu uygulamanın doğrulayamadığı bir yanıt döndürdü.",
      "market-data-indexing-errors":
        "Piyasa verisi kaynağı indeksleme hataları bildirdi, bu yüzden verdiği sayılar doğrulanmış sayılamaz.",
      "market-data-stale":
        "Piyasa verisi kaynağı zincirin o kadar gerisinde ki bu sayılar güncel kabul edilemez.",
      "market-data-future-block-time":
        "Piyasa verisi kaynağı, bu sunucunun saatinin ilerisinde bir blok zamanı bildirdi; bu yüzden verdiği sayılar doğrulanamıyor.",
      "chain-data-timed-out":
        "Zincir üstü veri isteği zaman aşımına uğradı.",
      "chain-data-unreachable":
        "Zincir üstü veri kaynağına ulaşılamadı.",
      "chain-data-credentials-rejected":
        "Zincir üstü veri kaynağı yapılandırılmış kimlik bilgilerini kabul etmedi.",
      "chain-data-rate-limited":
        "Zincir üstü veri kaynağının istek sınırı aşıldı.",
      "chain-data-unreadable":
        "Zincir üstü veri kaynağı okunamayan bir yanıt döndürdü.",
      "chain-data-malformed":
        "Zincir üstü veri kaynağı, bu uygulamanın doğrulayamadığı bir yanıt döndürdü.",
      "chain-aggregator-unverified":
        "Bakiyeler zincirdeki bir yardımcı sözleşme üzerinden okunur; adresindeki kod bu uygulamanın güvenmek üzere yazıldığı kod değildi, bu yüzden onun üzerinden hiçbir şey okunmadı.",
      "pool-not-found":
        "Ethereum mainnet üzerinde bu adrese ait bir Uniswap v3 havuzu bulunamadı.",
      "pool-contract-not-found":
        "Ethereum mainnet üzerinde bu adreste yanıt veren bir Uniswap v3 havuz sözleşmesi yok.",
      "pool-configuration-inconsistent":
        "Havuzun iki kaynaktan derlenen yapılandırması doğrulanamadı.",
      "pool-history-insufficient":
        "Bu havuzun analiz için yeterli tamamlanmış günlük fiyat geçmişi henüz yok.",
      "pool-history-never-traded":
        "Bu havuz var, ama içinde hiç işlem yapılmamış; dolayısıyla bir aralığın ölçülebileceği günlük fiyat yok.",
      "pool-history-dormant":
        "Bu havuz, bu günlük fiyatların okunduğu dönem başlamadan önce işlem görmeyi bırakmış; bir aralığın ölçülebileceği yakın geçmiş yok. Beklemek bunu değiştirmez — ancak havuz yeniden kullanılırsa değişir.",
      "volatility-invalid-input":
        "Bu hesaplama için verilen fiyat geçmişi geçerli bir normalize geçmiş değil.",
      "volatility-insufficient-history":
        "Bu havuzun volatilite ölçmeye yetecek kadar ardışık günlük fiyatı yok.",
      "volatility-unverifiable":
        "Volatilite hesabı, bu uygulamanın doğrulayamadığı bir sonuç üretti.",
      "band-invalid-input":
        "Bu fiyat bandı için verilen piyasa verisi geçerli değil ya da anlık durum ile volatilite farklı havuzları anlatıyor.",
      "band-no-current-price":
        "Bu havuzun güncel fiyatı yok, bu yüzden bir fiyat bandı ortalanamıyor.",
      "band-unverifiable":
        "Fiyat bandı hesabı, bu uygulamanın doğrulayamadığı bir sonuç üretti.",
      "range-invalid-input":
        "Bu aralık için verilen havuz, fiyat bandı ve anlık durum geçerli değil ya da hepsi aynı havuzu ve aynı gözlemi anlatmıyor.",
      "range-price-unrepresentable":
        "Bu havuzun güncel fiyatı, Uniswap'ın ifade edebildiği aralığın dışında; bu yüzden ondan bir pozisyon aralığı kurulamıyor.",
      "range-tick-disagreement":
        "Kaynağın bu havuz için bildirdiği fiyat ile bildirdiği durum aynı anı anlatmıyor; bu yüzden aralık yayımlanmıyor.",
      "range-too-narrow":
        "Fiyat bandı bu havuzun iki kenar arasında izin verdiği en küçük adımdan dar, bu yüzden iki ayrı pozisyon sınırı tanımlamıyor.",
      "range-unverifiable":
        "Aralık hesabı, bu uygulamanın doğrulayamadığı bir sonuç üretti.",
      "divergence-unverifiable":
        "Tutmaya kıyaslama hesabı, bu uygulamanın doğrulayamadığı bir sonuç üretti.",
      "activity-unverifiable":
        "Havuzun son dönem hareketliliği, bu uygulamanın doğrulayamadığı bir sonuç üretti.",
      "fee-rate-unmeasurable":
        "Bu havuz, pencerenin indekslenmiş hiçbir gününde işlem görmemiş; bu yüzden aldığı komisyon oranı, topladığı tutardan bölünerek çıkarılamıyor.",
      "deposit-share-unpriceable":
        "Kaynak, bu havuzun tuttuğu varlıklara bir dolar değeri biçmiyor; bu yüzden dolarla verilen bir yatırım, havuzdaki bir pozisyona çevrilemiyor.",
      "deposit-share-no-days":
        "Kaynağın yanıtlayabildiği her gün fiyat bu aralığın dışına çıkmış; yani bu aralıktaki bir yatırımın komisyon toplayacağı tek bir gün bile yok.",
      "deposit-share-unverifiable":
        "Bir yatırımın alacağı pay kendi denetiminden geçemedi; bu yüzden gösterilmiyor.",
      "range-order-no-room":
        "Bu aralık, güncel fiyatın iki yanında da tek taraflı bir pozisyon tutamayacak kadar dar.",
      "range-order-unverifiable":
        "Bu aralığın tek taraflı yarıları kendi denetiminden geçemedi; bu yüzden gösterilmiyor.",
      "swap-depth-no-liquidity":
        "Bu havuz güncel fiyatında hiç likidite bildirmiyor; yani burada fiyatlanacak bir takas yok.",
      "swap-depth-tick-disagreement":
        "Kaynağın kendi tick'i bu havuzu gösterilen fiyattan farklı bir fiyat adımına koyuyor; bu yüzden bildirdiği likidite bu adıma atfedilemiyor.",
      "swap-depth-unverifiable":
        "Bir takasın maliyeti kendi denetiminden geçemedi; bu yüzden gösterilmiyor.",
      "out-of-sample-insufficient-history":
        "Bu havuzun, geçmişte bir bant kurup onu tam bir ufuk boyunca sınamaya yetecek kadar indekslenmiş geçmişi yok.",
      "out-of-sample-unverifiable":
        "Örneklem dışı kontrol, bu uygulamanın doğrulayamadığı bir sonuç üretti.",
      "hook-directory-unverifiable":
        "Bu haftanın v4 havuzlarının kancaları kendi denetiminden geçemedi; bu yüzden dizin gösterilmiyor.",
      "positions-manager-unverified":
        "Uniswap v3 pozisyonlarını tutan sözleşme, bu uygulamanın karşısına aldığı kodla cevap vermedi; bu yüzden söylediklerinin hiçbiri gösterilmiyor.",
      "positions-unreadable":
        "Zincir bu adresin pozisyonları için cevap vermedi; bu yüzden hiçbiri gösterilmiyor — bu, hiç pozisyonu olmadığı anlamına gelmez.",
      "positions-unverifiable":
        "Bu adresin pozisyonları kendi denetiminden geçemedi; bu yüzden gösterilmiyor.",
      "holdings-unverifiable":
        "Bu adresin ne tuttuğu, bu uygulamanın doğrulayamadığı bir sonuç üretti.",
      "explanation-key-rejected":
        "Açıklama servisi yapılandırılmış anahtarı kabul etmedi, bu yüzden açıklama gösterilmiyor.",
      "explanation-model-not-permitted":
        "Yapılandırılmış anahtarın seçilen modeli kullanma izni yok, bu yüzden açıklama gösterilmiyor.",
      "explanation-model-unknown":
        "Seçilen model bu anahtara açık değil, bu yüzden açıklama gösterilmiyor.",
      "explanation-rate-limited":
        "Açıklama servisi şu anda istek sınırında, bu yüzden açıklama gösterilmiyor.",
      "explanation-hourly-cap":
        "Bu site her saat sınırlı sayıda açıklama yazıyor ve o sayıya ulaşıldı. Yukarıdaki rakamlar eksiksiz; açıklama bir saat içinde yeniden yazılabilecek.",
      "explanation-unreachable":
        "Açıklama servisine ulaşılamadı, bu yüzden açıklama gösterilmiyor.",
      "explanation-request-refused":
        "Açıklama servisi bu isteği reddetti, bu yüzden açıklama gösterilmiyor.",
      "explanation-declined":
        "Model bu havuzun sayılarını açıklamayı reddetti, bu yüzden açıklama gösterilmiyor.",
      "explanation-truncated":
        "Açıklama tamamlanmadan kesildi, bu yüzden gösterilmiyor.",
      "explanation-malformed":
        "Açıklama, bu uygulamanın doğrulayamadığı bir biçimde geldi, bu yüzden gösterilmiyor.",
    } satisfies Record<DataFailureNotice, string>,

    warning: {
      "block-time-unreported":
        "Veri kaynağı bir blok zamanı bildirmedi, bu yüzden bu sayıların ne kadar güncel olduğu doğrulanamadı.",
      "history-window-incomplete":
        "Veri kaynağı bu penceredeki her gün için fiyat bildirmedi; eksik günler tahmin edilmek yerine boş bırakıldı.",
      "volatility-window-incomplete":
        "Bu penceredeki bazı günlerin fiyatı yoktu, bu yüzden volatilite pencerenin kapsadığından daha az günlük getiriyle ölçüldü; eksik günler tahmin edilmek yerine atlandı.",
      "band-window-incomplete":
        "Volatilite penceresindeki bazı günlerin fiyatı yoktu, bu yüzden bu bant pencerenin kapsadığından daha az günlük getiriye dayanıyor.",
      "band-price-block-time-unreported":
        "Güncel fiyat kaynağı bir blok zamanı bildirmedi, bu yüzden ne kadar güncel olduğu bağımsız olarak doğrulanamadı.",
      "band-volatility-block-time-unreported":
        "Volatilite kaynağı bir blok zamanı bildirmedi, bu yüzden ne kadar güncel olduğu bağımsız olarak doğrulanamadı.",
      "range-lower-edge-truncated":
        "Aralığın bir kenarı, bu havuzun ifade edebildiği fiyatların bittiği yerde duruyor — havuzun ilk tokenının en ucuz olduğu kenar — bu yüzden aralık bandın uzandığı kadar uzanmıyor. Gösterilen yönde hangi kenar olduğu aralık panelinde yazıyor.",
      "range-upper-edge-truncated":
        "Aralığın bir kenarı, bu havuzun ifade edebildiği fiyatların bittiği yerde duruyor — havuzun ilk tokenının en pahalı olduğu kenar — bu yüzden aralık bandın uzandığı kadar uzanmıyor. Gösterilen yönde hangi kenar olduğu aralık panelinde yazıyor.",
      "range-tick-unverified":
        "Fiyat kaynağı havuzun kendi durumunu bildirmedi, bu yüzden fiyatın ima ettiği durum ona karşı kontrol edilemedi.",
      "range-excludes-current-price":
        "Havuzun güncel fiyatı bu aralığın dışında; burada kurulacak bir pozisyon tek token tutar ve fiyat dönene kadar hiçbir şey kazanmaz.",
    } satisfies Record<DataWarningNotice, string>,
  },

  rateLimited: {
    title: "Çok fazla istek",
    body: (limit: number) =>
      `Bu sayfa her ziyarette canlı Uniswap verisi okuduğu için dakikada ${limit} analizle sınırlı.`,
    retry: (seconds: number) => `${seconds} saniye sonra tekrar dene.`,
    back: "Danışmana dön",
  },

  error: ERROR_COPY.tr,
};

/*
 * The five languages whose interface is translated and whose longer
 * explanations are not yet.
 *
 * Written as partial dictionaries and completed from English, so nothing can
 * render empty and a sentence can be moved across one at a time. What is here
 * is what a reader navigates by: the page titles, the preference controls, the
 * disclaimer, the search, the panel headings and the buttons. What is not here
 * is the explanatory prose, which is the slowest to translate well and the
 * worst to translate badly — and the interface says so, in the reader's own
 * language, at the moment they pick it.
 */

const de: Dictionary = {
  metadata: {
    title: "LiquidityWise",
    description:
      "Ein informativer, KI-gestützter Ratgeber für Liquiditätsstrategien in Uniswap v3 und v4. Nur zur Orientierung — keine Finanzberatung.",
    v4Title: "Ein Uniswap-v4-Pool · LiquidityWise",
    v4Description: "Was ein einzelner Uniswap-v4-Pool ist und was sein Hook tun darf.",
    holdingsTitle: "Was eine Adresse hält · LiquidityWise",
    holdingsDescription:
      "Die an einer Ethereum-Adresse gefundenen Token und die Uniswap-v3-Pools, in die sie fließen können.",
    compareTitle: "Gebührenstufen nebeneinander · LiquidityWise",
    compareDescription: "Alle Uniswap-v3-Gebührenstufen eines Paars, mit demselben Horizont, derselben Breite und derselben Einlage gelesen.",
    poolTitle: "Bereichsanalyse eines Pools · LiquidityWise",
    poolDescription:
      "Ein Preisbereich für einen Uniswap-v3-Pool im Ethereum-Mainnet, hergeleitet daraus, wie weit sich sein Preis tatsächlich bewegt hat.",
    hooksTitle: "Die Hooks in Uniswap v4 · LiquidityWise",
    hooksDescription:
      "Jeder Hook, den die meistgehandelten Uniswap-v4-Pools der Woche nennen, und was jeder von ihnen tun darf — aus seiner eigenen Adresse gelesen.",
  },

  preferences: {
    languageLabel: "Sprache",
    selectLanguage: "Sprache wählen",
    closeLanguages: "Schließen",
    partlyTranslated:
      "Diese Sprache wird noch übersetzt. Menüs, Beschriftungen und Überschriften sind bereits darin; die längeren Erklärungen sind weiterhin auf Englisch.",
    themeLabel: "Darstellung",
    themeSystem: "System",
    themeLight: "Hell",
    themeDark: "Dunkel",
    rangeLabel: "Bereichseinstellungen",
    rangeIntro:
      "Horizont, Breite und Einsatz, mit denen jeder Pool geöffnet wird. Ein Link mit eigenen Werten hat weiterhin Vorrang, und das Formular unter jeder Analyse ändert nur diese Seite.",
    rangeSave: "Speichern",
    rangeReset: "Vergessen",
  },

  disclaimer: {
    ariaLabel: "Wichtiger Hinweis",
    title: "Lernwerkzeug — keine Finanzberatung.",
    body: "Diese Anwendung erklärt die Mechanik von Uniswap und hilft beim Nachdenken über Parameter. Sie sagt keine Kurse voraus, garantiert keine Erträge und kann nicht prüfen, ob ein Smart Contract sicher ist. Liquidität bereitzustellen birgt echte Risiken, darunter Impermanent Loss und den Totalverlust des eingesetzten Kapitals. Prüfen Sie Vertragsadressen immer selbst und recherchieren Sie eigenständig.",
  },

  home: {
    badge: "Frühes Fundament",
    title: "LiquidityWise",
    introBeforeV3: "Ein Lernwerkzeug für Uniswap ",
    introBetween: ", auf dem Weg zu ",
    introAfterV4:
      ". Finden Sie einen Pool über sein Paar, lesen Sie einen Preisbereich, der sich daraus ergibt, wie weit sich dieses Paar tatsächlich bewegt hat, und lassen Sie ihn in klaren Worten erklären. Jede Zahl wird berechnet und gegengeprüft, bevor ein Modell sie beschreiben darf — und das Modell darf keine einzige selbst nennen.",
    workingTodayHeading: "Was heute funktioniert",
    workingTodayBody:
      "Suchen Sie einen Pool über sein Paar, oder fügen Sie die Adresse eines v3-Pools oder die id eines v4-Pools ein. Sie erhalten die geprüfte Konfiguration des Pools und seinen aktuellen Zustand, den letzten Monat an Tagespreisen, gezeichnet gegen einen vorgeschlagenen Bereich, wie weit sich das Paar tatsächlich bewegt hat, und den Bereich, der daraus folgt — Zeithorizont und Breite ändern Sie selbst. Daneben: was der Pool berechnet hat und was er tatsächlich eingenommen hat, wie seine jüngsten Tage zum Bereich standen, was dieselbe Methode an Tagen ergeben hätte, die sie nie gesehen hat, was eine Position gegenüber dem bloßen Halten aufgibt, was jede der anderen Breiten stattdessen ergeben hätte, und — für eine Einlage, deren Höhe Sie bestimmen — welchen Anteil sie an den Gebühren der Tage genommen hätte, an denen der Preis im Bereich blieb. Und derselbe Bereich andersherum gelesen: jede seiner Hälften ist eine einseitige Position, und die Seite sagt, zu welchem Kurs jede umtauschen würde, wenn der Preis hindurchginge. Was ein Tausch durch den Pool kostet, für den größten, der sich ohne jede Annahme bepreisen lässt. Und ein Verzeichnis jedes Hooks, den die meistgehandelten v4-Pools der Woche nennen, mit dem, was jeder tun darf, aus seiner eigenen Adresse gelesen. Auch ein v4-Pool sagt in klaren Worten, was sein Hook tun darf, gelesen aus dessen eigener Adresse. Eine Adresse lässt sich nachschlagen — nach den Pools, in die ihre Token fließen können, und nach den Uniswap-Positionen, die sie bereits hält, jede mit den Preisen, die sie abdeckt, und der Angabe, ob der Pool gerade darin liegt. Dann eine Erklärung all dessen in klaren Worten. Kein Modell fasst eine dieser Zahlen an, keine davon wird geschätzt, um eine Lücke zu füllen, und der Text hat keinen Ort, an dem er eine eigene Zahl unterbringen könnte.",
    analysePool: "Einen Pool finden →",
    methodHeading: "Wie es funktioniert",
    methodSteps: [
      {
        step: "Geprüfte Daten",
        detail:
          "Die Angaben zum Pool stammen aus Uniswap-Subgraphs und werden on-chain gelesen, nie angenommen. Der Preis wird gegen den Zustand geprüft, den der Pool über sich selbst meldet.",
      },
      {
        step: "Deterministische Mathematik",
        detail:
          "Volatilität, Preisband und Positionsbereich werden in gewöhnlichem TypeScript berechnet, sodass derselbe Pool stets dieselben Zahlen ergibt.",
      },
      {
        step: "Deutung durch ein Modell",
        detail:
          "Ein Modell erklärt, was diese Zahlen bedeuten. Es bekommt sie bereits geprüft, und der Vertrag, unter dem es antwortet, lässt keinen Platz für eine Zahl.",
      },
    ],
    coverageHeading: "Noch nicht gebaut",
    coverage: [
      {
        version: "Uniswap v3",
        features: [
          {
            name: "Gas und was es kostet, dem Preis zu folgen",
            summary:
              "Einen Bereich, den der Preis verlassen hat, muss man schließen und neu eröffnen, um ihm zu folgen. Das kostet Gas und macht aus einer Abweichung auf dem Papier eine tatsächlich realisierte. Nichts davon wird hier irgendwo mitgezählt.",
          },
        ],
      },
      {
        version: "Uniswap v4",
        features: [
          {
            name: "Was ein Hook tatsächlich tut",
            summary:
              "Eine v4-Seite sagt, was ein Hook tun darf, denn so weit setzt das Protokoll es durch und es lässt sich aus der Adresse des Hooks selbst lesen. Den Vertrag zu lesen, um zu sagen, was er mit diesen Rechten tut, ist ein anderes Problem, und diese Anwendung versucht es nicht.",
          },
          {
            name: "Strategien nach TWAMM-Art",
            summary:
              "Eine große Order über die Zeit zu verteilen, statt sie gegen einen einzigen Punkt der Liquidität auszuführen. Die Hälfte davon, die eine Analyseseite schon beantworten kann, ist vorhanden: was ein Tausch gegen die Liquidität am aktuellen Preis kostet, und wie groß ein Tausch überhaupt sein darf, damit er sich bepreisen lässt. Ihn über die Zeit zu planen ist die Aufgabe eines Hooks, und diese Anwendung bildet das Verhalten eines Hooks nicht ab.",
          },
        ],
      },
    ],
    footer:
      "Nichts davon gibt es schon. Was es gibt, ist alles weiter oben auf dieser Seite: ein Pool, der beim Namen gefunden wird, Zahlen, die berechnet und gegengeprüft sind, und Text, der geprüft wird, bevor er gezeigt wird. Ein Wallet kann verbunden werden, und alles, was von ihm verlangt wird, ist seine Adresse. Das Einzige, was diese Anwendung aufbewahrt, ist eine Telegram-Verknüpfung, die ein Leser selbst anlegt — eine Adresse neben einer Chat-Kennung, gelöscht in dem Moment, in dem er dem Bot /stop schickt, und binnen sieben Tagen auch aus den verschlüsselten Sicherungen — und nichts hier kann eine Transaktion in deinem Namen signieren oder senden.",
  },

  pool: {
    back: "← LiquidityWise",
    invalidAddress:
      "Das ist keine Ethereum-Adresse. Eine Adresse besteht aus 0x gefolgt von genau 40 hexadezimalen Zeichen.",
    loading: "Aktuelle Uniswap-Daten werden gelesen…",
  },

  activity: {
    heading: "Was der Pool tatsächlich getan hat",
    volume24h: "Volumen, 24 Std.",
    volume7d: "Volumen, 7 Tage",
    volume30d: "Volumen, 30 Tage",
    fees30d: "Berechnete Gebühren, 30 Tage",
    feesNote: "Die des gesamten Pools, geteilt unter allen, deren Liquidität aktiv war.",
    tvl: "Insgesamt hinterlegter Wert",
    occupancySentence: (days: string, inside: string, outside: string, crossed: string) =>
      `Von den letzten ${days} Tagen lagen ${inside} vollständig innerhalb dieses Bereichs, ${outside} vollständig außerhalb, und ${crossed} überschritten eine Kante.`,
    undeterminedNote:
      "Ein Tag, der eine Kante überschritten hat, verbrachte einen Teil innerhalb und einen Teil außerhalb, und Tageshoch und Tagestief der Quelle können nicht sagen, wie viel davon jeweils.",
    feesWhileInside: "Gebühren an den vollständig innen liegenden Tagen",
    feesWithheld: "Für diesen Pool nicht ausgewiesen",
    feesWithheldNote:
      "Der Hook dieses Pools darf sich einen Anteil an einem Tausch nehmen, und nichts in der Quelle trennt den Anteil des Hooks von dem der Liquiditätsgeber. Die Gebühren oben sind das, was der Pool berechnet hat — das ist eine Tatsache; einen Teil davon an diesen Bereich zu binden wäre eine Behauptung über eine Position, die niemand nachprüfen kann.",
    inSample:
      "Das sind dieselben Tage, aus denen der Bereich gezeichnet wurde. Sie zeigen also, wie er angepasst wurde, und prüfen nicht, wie er sich hält — und der Bereich ist um den heutigen Preis zentriert, den vor einem Monat niemand hätte eröffnen können. Lesen Sie sie als Verhältnis der jüngsten Bewegung des Pools zum Bereich, nicht als Rückrechnung.",
    notYourEarnings:
      "Nichts davon ist das, was eine Position einnehmen würde: es ist das, was der ganze Pool berechnet hat. Was eine Einlage davon genommen hätte — ihr Anteil an der Liquidität, die während der Tausche aktiv war — steht direkt darunter, und auch das sind Gebühren und sonst nichts.",
  },

  deposit: {
    heading: "Was eine Einlage eingenommen hätte",
    unavailable:
      "Was eine Einlage von diesen Gebühren genommen hätte, lässt sich für diesen Pool nicht ermitteln.",
    withheldNote:
      "Aus demselben Grund wie bei der Zahl darüber: ein Hook darf sich hier einen Anteil am Tausch nehmen, und nichts in der Quelle trennt seinen Anteil von dem der Geber. Ein Bruchteil einer Summe, der sich diesem Bereich nicht zuordnen lässt, lässt sich auch einer Einlage darin nicht zuordnen.",
    deposited: "Einlage",
    depositedNote: "Die Höhe, für die dies gerechnet ist. Ändern Sie sie im Formular oben.",
    collected: "Gebühren, die sie genommen hätte",
    collectedNote: (days: string) => `Über die ${days} Tage, an denen der Preis den Bereich nie verlassen hat.`,
    ofDeposit: "Von der Einlage",
    ofDepositNote:
      "Diese Gebühren gegen das eingesetzte Geld, über genau diese Tage und keine anderen. Kein Jahressatz, und nichts hier macht einen daraus.",
    sentence: (deposit: string, days: string, poolFees: string, yourFees: string) =>
      `An den ${days} Tagen, an denen der Preis diesen Bereich nie verlassen hat, berechnete der Pool ${poolFees} an Gebühren. Eine Einlage von ${deposit} in diesem Bereich hätte davon etwa ${yourFees} genommen — ihre eigene Liquidität als Anteil an der Liquidität, die an jedem dieser Tage tatsächlich aktiv war.`,
    unmeasurableNote: (days: string) =>
      `${days} weitere Tage lagen innerhalb des Bereichs, aber die Quelle wies für sie keine Gebühren oder keine aktive Liquidität aus; sie sind daher nicht in der Summe enthalten.`,
    dilution:
      "Eine größere Einlage nimmt nicht proportional mehr ein. Der Anteil ist Ihre Liquidität geteilt durch die aller — Ihre eingeschlossen —, sodass ab einer gewissen Größe das meiste, was Sie hinzufügen, verwässert, was Sie bereits haben. Deshalb liegen die angebotenen Beträge um das Tausendfache auseinander.",
    caveat:
      "Nur Gebühren, und nur Tage, die bereits vergangen sind. Es wird angenommen, dass die Position an jedem einzelnen davon offen war und dass sich nichts als Reaktion darauf bewegt hat, und es sagt nichts darüber, was die nächsten dreißig Tage einbringen. Was eine Position gegenüber dem bloßen Halten der beiden Token aufgibt, ist der Vergleich weiter unten auf dieser Seite, und beides muss zusammen gelesen werden.",
  },

  realizedFee: {
    heading: "Was er tatsächlich berechnet hat",
    intro:
      "Die Gebühr, die der Pool angibt, ist eine Zahl. Dies ist, was Tauschende tatsächlich gezahlt haben, zurückgerechnet aus denselben Tagen wie die Zahlen oben: die Gebühren eines Tages geteilt durch das Volumen desselben Tages. Es braucht dafür keine zusätzliche Abfrage und nichts vom Hook.",
    declared: "Angegebene Gebühr",
    statedNote: (lp: string, protocol: string) =>
      `${lp} an die Liquiditätsgeber und ${protocol} an das Protokoll, so zusammengerechnet, wie der PoolManager sie berechnet — und das ist, was ein Tauschender zahlt und woraus die Gebühren oben bestehen.`,
    noDeclared: "Keine",
    noDeclaredNote: "Der Schlüssel dieses Pools trägt keine Gebühr. Sein Hook setzt pro Tausch eine.",
    median: "Typischer Tag",
    spread: "Niedrigster bis höchster Tag",
    spreadValue: (lowest: string, highest: string) => `${lowest} – ${highest}`,
    aggregate: "Gesamtes Fenster",
    aggregateNote:
      "Die Gebühren des Fensters geteilt durch sein Volumen, sodass ein geschäftiger Tag mehr zählt als ein ruhiger.",
    daysMeasured: "Gemessene Tage",
    daysMeasuredNote: (skipped: string) =>
      `An ${skipped} weiteren Tagen im Fenster wurde nichts gehandelt, oder es fehlte eine Angabe, sodass sich daraus kein Satz herausrechnen ließ.`,
    verdictMatches:
      "Diese stimmen an jedem gemessenen Tag überein. Der angegebene Satz ist der Satz, der berechnet wurde.",
    verdictDiffers: (differing: string, measured: string) =>
      `Diese stimmen nicht überein. An ${differing} von ${measured} gemessenen Tagen berechnete der Pool etwas anderes als seinen angegebenen Satz; die Stufe oben beschreibt also, womit der Pool angelegt wurde, und nicht, was ein Tausch kostet.`,
    verdictNoneDeclared:
      "Es gibt nichts zu vergleichen: dieser Pool gibt überhaupt keinen Satz an. Die Zahlen hier sind das, was sein Hook tatsächlich gesetzt hat.",
    notLpShare:
      "Nichts davon ist das, was bei einem Liquiditätsgeber ankommt. Der Hook dieses Pools darf sich einen Anteil an einem Tausch nehmen, und die Quelle trennt den Anteil des Hooks nicht von dem der Geber. Diese Zahlen sagen, was ein Tausch gekostet hat, nicht, wer ihn erhalten hat.",
    unavailableHeading: "Was dieser Pool berechnet, ließ sich nicht messen",
  },

  outOfSample: {
    heading: "An Tagen geprüft, die sie nie gesehen hat",
    showFolds: "Jeden Abschnitt zeigen",
    intro: (horizon: string) =>
      `Jede Zahl oben ist an die Tage angepasst, die sie beschreibt. Diese hier nicht. Die Methode wurde um ${horizon} zurückgesetzt, nur auf den Preisen vor diesem Punkt erneut ausgeführt und auf den Preis an diesem Punkt zentriert — auf einen, den jemand, der dort stand, tatsächlich gesehen hätte. Dann wurde sie über die folgenden Tage gelegt, und das Ganze so oft durch die Historie zurück wiederholt, wie Platz dafür war.`,
    folds: "Abschnitte",
    foldsNote: "Wie oft die Historie Platz hatte, ein Band anzupassen und es dann zu prüfen.",
    fullyInside: "Tage vollständig innerhalb",
    fullyOutside: "Tage vollständig außerhalb",
    undetermined: "Tage, die eine Kante überschritten",
    verdict: (inside: string, measured: string, folds: string) =>
      `Über ${folds} Abschnitte hinweg blieben ${inside} von ${measured} Tagen vollständig innerhalb des Bandes, das diese Methode gezeichnet hätte.`,
    foldPeriod: "Geprüfte Tage",
    foldVolatility: "Angepasste Volatilität",
    foldVerdict: "Innen / außen / überschritten",
    foldsCaption: "Jeder Abschnitt, über den die Methode geprüft wurde, ältester zuerst",
    foldColumns:
      "Jede Zeile ist ein Abschnitt: die Tage, über die geprüft wurde, die Volatilität, die seine eigene Anpassung gemessen hat — nicht die Zahl oben — und wie diese Tage zu dem Band standen, das diese Anpassung ergeben hat.",
    notIndependent:
      "Ein paar Abschnitte an einem Pool sind kein Maß dafür, wie oft die Methode hält, und sagen nichts darüber, was als Nächstes geschieht. Aufeinanderfolgende Anpassungen überlappen sich zudem — eine Anpassung über 31 Schlusskurse ist länger als ein Schritt von einem Zeithorizont —, die Abschnitte sind also nicht unabhängig voneinander.",
    notHeld:
      "Niemand hat diese Bänder gehalten. Jedes ist das, was die Methode in jenem Moment vorgeschlagen hätte, gelegt über Preise, die dann eintraten — und die Tage oben, aus denen der vorgeschlagene Bereich gezeichnet wurde, sind nicht diese Tage.",
    unavailableHeading: "Dieser Pool ließ sich nicht außerhalb der Stichprobe prüfen",
  },

  divergence: {
    heading: "Verglichen mit bloßem Halten",
    intro:
      "Was eine Position in diesem Bereich wert wäre, verglichen damit, die beiden Token einfach zu halten — bei jedem Preis. Exakte Arithmetik statt einer Schätzung, aber sie zählt allein die Preisbewegung. Sie sagt nichts über die Gebühren, die eine Position einnehmen würde, und genau dafür wird ein Liquiditätsgeber mit Gebühren für diesen Unterschied entschädigt.",
    price: (base: string) => `Preis von ${base}`,
    loss: "Position gegenüber Halten",
    entryRow: "Der Preis, von dem aus dies gemessen wird — der aktuelle Preis des Pools.",
    impermanentNote:
      "Das nennt man gewöhnlich Impermanent Loss. Unbeständig ist er nur, wenn der Preis zurückkommt: eine Position, die zu einem anderen Preis geschlossen wird als dem, zu dem sie eröffnet wurde, hat ihn realisiert.",
  },

  rangeOrder: {
    heading: "Verkaufen und Kaufen durch den Bereich",
    intro:
      "Der Bereich oben ist zweiseitig: Geld auf beiden Seiten des Preises, das Gebühren einnimmt, solange der Preis dazwischen bleibt. Teilt man ihn am Preis, ist jede Hälfte ein anderes Instrument. Eine Position, die vollständig über dem Preis liegt, hält einen Token und sonst nichts, und der Pool verkauft diesen Token gegen den anderen, während der Preis durch das Band steigt. Unterhalb des Preises tut er das Umgekehrte. Genau das ist eine Range Order, und beide Hälften dieses Bereichs sind eine.",
    selling: (token: string) => `${token} verkaufen`,
    buying: (token: string) => `${token} kaufen`,
    band: "Band",
    bandNote:
      "Wo die Position liegt. Ihre innere Kante ist der erste Preisschritt jenseits desjenigen, in dem der Preis steht, sodass sie anfangs nichts von dem hält, in das sie umtauscht.",
    average: "Durchschnittspreis",
    averageNote: "Worauf der Umtausch hinausläuft, wenn der Preis das ganze Band durchquert.",
    against: "Gegenüber dem aktuellen Preis",
    exact:
      "Dieser Durchschnitt ist das geometrische Mittel der beiden Grenzen — exakt, und gleichgültig, in welcher Richtung die Preise geschrieben sind. Er folgt aus den Formeln des Protokolls selbst dafür, was eine Position an jedem Ende ihres Bandes hält, und der eingesetzte Betrag kürzt sich heraus: hundert Dollar und eine Million tauschen zum selben Preis um.",
    onlyIfThrough:
      "Und nur, wenn der Preis das ganze Band durchquert. Kehrt er mittendrin um, bleibt die Position mit etwas von beidem zurück, zu überhaupt keinem einzelnen Preis — was genau das ist, wofür der Bereich darüber gedacht ist, nur zufällig erreicht.",
    notAnOrderBook:
      "Nichts hier plant den Umtausch, und nichts garantiert ihn. Dies ist kein Orderbuch: eine Order, die der Preis nie erreicht, ist der gewöhnliche Ausgang und kein Fehlschlag, und es gibt keine Warteschlange und keine wartende Gegenpartei. Was es stattdessen gibt: die Position nimmt die Gebühren des Pools ein, solange der Preis im Band liegt, statt sie zu zahlen.",
    unavailable: "Dieser Bereich hat keine einseitige Hälfte, die sich beschreiben ließe.",
  },

  swapDepth: {
    heading: "Was ein Tausch hier kostet",
    intro:
      "Alles darüber handelt davon, Liquidität bereitzustellen. Dies handelt davon, sie zu nutzen. Die Liquidität eines Pools ist zwischen den Preisschritten, auf denen er aufgebaut ist, konstant. Ein Tausch, der innerhalb des Schritts bleibt, in dem der Preis steht, lässt sich daher aus den Formeln des Protokolls selbst bepreisen, ohne irgendetwas anzunehmen — einer einen Schritt weiter nicht, denn dort kann die Liquidität einer anderen Position beginnen, und diese Anwendung liest die Liquidität nicht bei jedem Preis.",
    selling: (token: string) => `${token} in den Pool verkaufen`,
    amount: (amount: string, symbol: string) => `${amount} ${symbol}`,
    largest: "Größter hier bepreisbarer Tausch",
    largestNote:
      "Was hineingeht, bevor der Preis das Ende seines Schritts erreicht. Keine Grenze: ein größerer Tausch funktioniert, und diese Seite kann nicht sagen, was er kostet.",
    cost: "Was er aufgibt",
    costNote: "Wie weit der Durchschnitt des Tauschs vom Preis auf dem Bildschirm entfernt liegt.",
    oneSideOnly:
      "Es wird nur eine Richtung gezeigt. Der Preis liegt so nah am Ende seines Schritts, dass der Spielraum in die andere Richtung eher ein Rundungsfehler als ein Tausch ist, und diese Seite gibt keine Zahl aus, die sie nicht prüfen kann.",
    geometric:
      "Dieser Durchschnitt ist das geometrische Mittel aus dem jetzigen Preis und dem Preis, bei dem der Tausch endet — dieselbe Identität, auf der die einseitigen Positionen oben beruhen, von der anderen Seite des Geschäfts gesehen. Ein Tausch, der ein Band durchquert, zahlt ihn; eine Position, die in diesem Band liegt, erhält ihn.",
    whyItDiffers:
      "Die beiden Richtungen sind nicht gleich groß, weil der Preis irgendwo innerhalb seines Schritts liegt und nicht in dessen Mitte. Was sich zwischen Pools zu vergleichen lohnt, ist die Größe selbst: sie ist das, was dieser Markt aufnimmt, bevor er sich bewegt, und der Grund, warum irgendjemand eine große Order in kleine zerlegt, statt sie auf einmal zu senden.",
    hookMayAlter:
      "Der Hook dieses Pools darf ändern, was ein Tausch kostet — die Gebühr bei jedem Tausch neu festlegen, den Tausch statt der Kurve des Pools selbst bepreisen oder sich danach einen Anteil daran nehmen; welches davon, steht oben im Hook-Abschnitt. Die Zahlen hier sind das, was die Kurve des Pools berechnet, und sie gelten nur, wenn der Hook nicht eingreift. Nichts, was hier gelesen wurde, kann sagen, ob er es tut.",
    unavailable: "Was ein Tausch kosten würde, lässt sich für diesen Pool nicht ermitteln.",
  },

  compare: {
    heading: "Alle Gebührenstufen dieses Paars, nebeneinander",
    intro: (pair: string) =>
      `Jeder ${pair}-Pool unten wurde mit demselben Horizont, derselben Breite und derselben Einlage gelesen, sodass seine Zahlen auf derselben Grundlage stehen wie die der anderen. Sie beschreiben Tage, die schon vergangen sind, nicht die kommenden. Die v3-Pools stehen in der Reihenfolge ihrer Gebühr, die v4-Pools nach Tiefe, wie die Notiz darunter erklärt — keiner ist danach sortiert, was er eingenommen hätte.`,
    depositFeesNote: (days: string) => `An den ${days} Tagen, an denen der Preis im Bereich blieb.`,
    daysInside: "Tage ganz im Bereich",
    daysInsideValue: (inside: string, measured: string) => `${inside} von ${measured}`,
    unavailable: "Diese Stufe konnte gerade nicht gelesen werden.",
    open: "Die ganze Analyse öffnen",
    link: "Die Stufen nebeneinanderstellen",
    onlyOne: (pair: string) =>
      `${pair} wird nur in einem v3-Pool gehandelt; es gibt nichts, was man danebenstellen könnte.`,
    readTogether:
      "Gebühren sind die Hälfte. Was ein Bereich gegenüber dem bloßen Halten der beiden Token aufgibt, steht auf der Seite jedes Pools, und beides muss zusammen gelesen werden.",
  },

  feeTiers: {
    heading: "Wo dieses Paar sonst noch gehandelt wird",
    intro: (pair: string) =>
      `${pair} wird auf mehr als einer Gebührenstufe gehandelt. Jede ist ein eigener Pool mit eigener Liquidität, eigener Preishistorie und eigenem Bereich — die Zahlen oben beschreiben allein diesen hier.`,
    onlyOne: (pair: string) =>
      `${pair} wird im Ethereum-Mainnet nur auf dieser Gebührenstufe gehandelt. Alles oben gilt für das ganze Paar, denn das Paar ist dieser eine Pool.`,
    thisOne: "Diesen lesen Sie gerade",
    feeTier: "Gebührenstufe",
    holds: "Hält",
    reservesUnread: "Was dieser Pool hält, ließ sich nicht aus der Chain lesen.",
    open: "Diese Stufe analysieren",
    biggerIsNotBetter:
      "Eine Stufe mit mehr Liquidität ist eine größere Menge, die sich dieselben Tauschgebühren teilt — kein besserer Ort. Welche zu einer Position passt, hängt davon ab, wie weit sich der Preis bewegt und wie oft, und das wird je Pool gemessen. Der ehrliche Weg, sie zu vergleichen, ist daher, jede zu öffnen und ihre eigenen Zahlen zu lesen. Der von Ihnen gewählte Zeithorizont und Faktor reisen mit dem Link mit.",
    reservesNote:
      "Dies sind die Bestände, die die beiden Token-Verträge für jeden Pool melden, aus der Chain gelesen statt von einem Indexer. Die eigene Zahl des Indexers wurde dagegen gemessen und überzeichnet das Vorhandene um das 1,3- bis 13-Fache, deshalb wird sie nicht gezeigt. Zwei Token-Beträge statt einer Dollar-Zahl, weil jede Stufe hier dieselben zwei Token hält und für den Vergleich nichts bepreist werden muss.",
    unavailableHeading: "Die anderen Gebührenstufen des Paares ließen sich nicht lesen",

    onV3: "Auf Uniswap v3",
    onV4: "Auf Uniswap v4",
    v4Intro: (pair: string) =>
      `Die v4-Pools, die ${pair} handeln — dieselben zwei Verträge. Ein v4-Paar kann viele Pools sein: die Gebühr ist eine beliebige Zahl, der Preisschritt ist frei, und jeder Hook ergibt einen weiteren.`,
    v4None: (pair: string) => `Kein Uniswap-v4-Pool handelt ${pair} mit diesen beiden Verträgen.`,
    v4OnlyThis: (pair: string) => `Auf v4 wird ${pair} nur in diesem Pool gehandelt.`,
    v3Intro: (pair: string) =>
      `Die v3-Pools, die ${pair} handeln — dieselben zwei Token-Verträge, auf jeder Gebührenstufe.`,
    v3None: (pair: string) => `Kein Uniswap-v3-Pool handelt ${pair} mit diesen beiden Verträgen.`,
    v3NoNative:
      "Dieser Pool hält das Ether der Chain selbst, und v3 kann das nicht: jede v3-Währung ist ein Token-Vertrag. Seine nächstgelegenen v3-Pools handeln stattdessen Wrapped Ether, was für einen Pool ein anderer Token ist.",
    depth: "Tiefe beim aktuellen Preis",
    depthValue: (ether: string) => `≈ ${ether} ETH`,
    stateUnread: "Die Liquidität des Pools ließ sich nicht aus der Chain lesen.",
    hook: "hook",
    noHook: "kein Hook",
    hookAltersSwaps: "kann ändern, was ein Tausch kostet",
    priceStep: (step: string) => `Schritt ${step}`,
    v4Ordering:
      "Sortiert nach Tiefe beim aktuellen Preis — die aktive Liquidität und der Preis des Pools, gelesen aus dem Speicher des PoolManagers —, weil ein v4-Paar meist aus Pools besteht, die jemand angelegt und dann liegen gelassen hat, und die Tiefe genau diese unterscheidet. Sie sagt, worauf ein Tausch zurückgreifen kann, und nichts darüber, welcher Pool besser ist: ein tieferer Pool ist eine größere Menge, die sich dieselben Gebühren teilt.",
    moreNotShown: (count: string) => `${count} weitere werden nicht gezeigt; sie sind flacher als diese.`,
    v4Unavailable: "Die v4-Pools des Paares ließen sich nicht lesen",
    v3Unavailable: "Die v3-Pools des Paares ließen sich nicht lesen",
  },

  widths: {
    heading: "Die anderen Breiten",
    intro:
      "Dieselbe Methode bei jeder Breite, die das Formular anbietet, damit sich der Kompromiss sehen statt behaupten lässt: ein breiterer Bereich fängt mehr der Tage ein und verteilt dieselbe Einlage über mehr Preise — das ist die letzte Spalte, und sie ist die Arithmetik des Protokolls, keine Schätzung.",
    width: "Breite",
    range: "Bereich",
    recent: (days: string) => `Innen, von den letzten ${days} Tagen`,
    unseen: "Innen, an Tagen, die sie nie gesehen hat",
    insideOf: (inside: string, total: string) => `${inside} von ${total}`,
    unseenNone: "zu wenig Historie",
    feeShare: "Gebührenanteil, solange innen",
    feeShareValue: (times: string) => `${times}×`,
    chosen: "oben gezeigt",
    columnsNote:
      "Die erste Zahl bezieht sich auf die Tage, aus denen der jeweilige Bereich gezeichnet wurde; sie sagt also, wie diese Breite angepasst wurde, nicht wie sie sich gehalten hat. Die zweite ist die Prüfung von oben, für jede Breite ausgeführt: die Methode um einen Zeithorizont zurückgesetzt und über die folgenden Tage gelegt.",
    feeShareNote:
      "Die letzte Spalte ist der Anteil, den dieselbe Einlage an den Gebühren eines Tages nähme, an dem der Preis innerhalb dieses Bereichs bleibt — gemessen an der oben gezeigten Breite, die deshalb als eins erscheint. Es ist die Positionsarithmetik des Protokolls selbst und keine Schätzung: ein engerer Bereich macht aus demselben Geld mehr Liquidität über weniger Preise. Dabei wird angenommen, dass die übrige Liquidität des Pools unverändert bleibt — was eine Einlage, die groß genug ist, sie zu bewegen, nicht wahr ließe — und es sagt nichts über die Tage, die der Preis außerhalb verbringt.",
    notAdvice:
      "Nichts davon ist eine Empfehlung. Ein engerer Bereich nimmt an den Tagen, an denen er hält, einen größeren Anteil und an den Tagen, an denen er es nicht tut, überhaupt nichts; was davon schwerer wiegt, hängt davon ab, wozu die Position da ist — und das weiß hier nichts.",
  },

  parameters: {
    heading: "Bereich ändern",
    apply: "Neu berechnen",
    horizonLabel: "Wie weit voraus",
    widthLabel: "Wie breit",
    depositLabel: "Wie viel",
    days: (days: string) => `${days} Tage`,
    sigma: (value: string) => `${value}σ`,
    widthChoice: (sigma: string, word: string | null) => (word === null ? sigma : `${word} (${sigma})`),
    widthWords: { tight: "Eng", medium: "Mittel", wide: "Breit", veryWide: "Sehr breit" },
    note: "Der Zeithorizont sagt, wie weit die gemessene Bewegung nach vorn gelegt wird. Er ändert die Messung nicht: die Volatilität stammt immer aus den letzten 30 abgeschlossenen Tagen, welcher Horizont auch gewählt ist. Die Breite vervielfacht diese Bewegung; ein breiterer Bereich wird seltener verlassen, und er ist kein Konfidenzniveau.",
    fellBack:
      "Ein Teil des Angeforderten ließ sich nicht lesen, deshalb wurde dort der Standard verwendet. Der tatsächlich verwendete Zeithorizont und die Breite stehen oben.",
    preferenceHint:
      "Das ändert nur diese Seite. Womit jeder Pool geöffnet wird, legen die Bereichseinstellungen in der Kopfzeile fest.",
  },

  holdings: {
    heading: "Was diese Adresse hält",
    intro:
      "Die Token, die unter dieser Adresse gefunden wurden, und die Pools, in die sie gehen können. Nichts hier wird gespeichert, sofern du unten keine Telegram-Hinweise anforderst, und die Adresse ist öffentlich — dieselbe Liste sieht jeder, der sie nachschlägt.",
    forAddress: "Adresse",
    loading: "Die Token-Verträge werden gefragt, was diese Adresse hält…",
    howItLooked: (tokens: string, v3Pools: string, v4Pools: string | null) =>
      `Der Bestand eines Tokens liegt im Vertrag des Tokens selbst; es gibt also keine Liste dessen, was eine Adresse besitzt — nur Token, die sich einzeln fragen lassen. Hier wurden ${tokens} davon gefragt: jeder Token in den ${v3Pools} meistgehandelten Uniswap-v3-Pools im Ethereum-Mainnet${v4Pools === null ? "" : `, und jede Währung in den ${v4Pools} v4-Pools mit dem größten Handel der letzten sieben Tage, das Ether der Chain selbst darunter`}. Was außerhalb dieser Menge gehalten wird, fehlt auf dieser Seite nicht deshalb, weil die Adresse es nicht hält.`,
    v4NotSearched:
      "Uniswap-v4-Pools wurden nicht durchsucht: ihre Liste ließ sich nicht lesen. Ether und die Währungen der v4-Pools fehlen auf dieser Seite aus diesem Grund und aus keinem anderen.",
    hookTag: "hook",
    holdingsHeading: "Gefundene Token",
    nothingFound:
      "Keiner der geprüften Token wurde an dieser Adresse gefunden. Das ist nicht dasselbe wie eine leere Wallet — siehe oben, wie gesucht wurde.",
    poolsHeading: "Pools, in die diese Token fließen können",
    bothSides: "Sie halten beide Seiten",
    oneSide: "Sie halten eine Seite",
    bothSidesNote:
      "Beide Token dieses Pools wurden an der Adresse gefunden, eine Position hier braucht also keinen vorherigen Tausch.",
    oneSideNote:
      "Einer der beiden Token dieses Pools wurde gefunden. Eine Position hier braucht auch die andere Seite, also einen Tausch eines Teils dessen, was Sie halten.",
    moreNotShown: (count: string) =>
      `${count} weitere werden nicht gezeigt. Die oben sind die meistgehandelten davon, in der Reihenfolge, die die Datenquelle meldet — was eine Aussage darüber ist, wie geschäftig ein Pool ist, und über nichts sonst.`,
    analyse: "Diesen Pool analysieren",
    notAdvice:
      "Dies ist eine Liste dessen, was möglich ist, nicht dessen, was sich lohnt. Welcher dieser Pools wozu passt, hängt von den Zahlen auf der jeweiligen Pool-Seite ab und davon, wozu eine Position da ist — und beides weiß diese Liste nicht.",
    unavailableHeading: "Diese Adresse ließ sich nicht lesen",
    invalidAddress: "Das ist keine Ethereum-Adresse, es wurde also nichts nachgeschlagen.",
    noAddress:
      "Verbinden Sie auf der Startseite eine Wallet, dann zeigt diese Seite, was sie hält.",
  },

  v4: {
    heading: "Ein Uniswap-v4-Pool",
    intro:
      "Was dieser Pool ist, gelesen aus seinem eigenen Schlüssel. Ein v4-Pool ist kein eigener Vertrag: er lebt in einem PoolManager und wird durch einen Hash der fünf Dinge benannt, die ihn ausmachen — die beiden Währungen, die Gebühr, der Preisschritt und der Hook.",
    poolId: "Pool-id",
    pair: "Währungen",
    fee: "Gebühr",
    feeNote: (swap: string, lp: string, protocol: string) =>
      `Gelesen aus dem eigenen Schlüssel des Pools auf der Chain. Ein Tausch zahlt ${swap}: davon ${lp} an die Liquiditätsgeber und ${protocol} obendrauf an das Protokoll.`,
    feeNoteNoProtocol:
      "Gelesen aus dem eigenen Schlüssel des Pools auf der Chain. Das Protokoll nimmt nichts obendrauf, das ist also, was ein Tausch zahlt.",
    dynamicFee: "Vom Hook gesetzt, je Tausch",
    dynamicFeeNote:
      "Der Schlüssel dieses Pools trägt statt einer Gebühr die Kennzeichnung für eine dynamische Gebühr; was ein Tausch kostet, entscheidet also der Hook im Moment des Tauschs. Dieser Abruf hat keinen beobachtet, und es gibt hier keine Gebühr zu berichten.",
    feeUnread: "Gebühr nicht gelesen",
    feeUnreadNote:
      "Die Gebühr des Pools steht in dem Schlüssel, mit dem er angelegt wurde, auf der Chain, und dieser Abruf konnte sie nicht holen. Nichts anderes ist ein Ersatz dafür.",
    protocolFee: "Protokollgebühr",
    protocolFeeNone: "Keine",
    protocolFeeNote:
      "Wird vom Protokoll bei jedem Tausch zusätzlich zur Gebühr des Pools genommen. Von der Governance festgelegt und aus dem Zustand des Pools auf der Chain gelesen.",
    protocolFeeByDirection: (token0: string, token1: string) =>
      `Je nach Richtung verschieden: die erste, wenn ${token0} verkauft wird, die zweite, wenn ${token1} verkauft wird.`,
    priceStep: "Preisschritt",
    priceStepNote: (spacing: string) =>
      `Der feinste Schritt, in dem die Kanten einer Position in diesem Pool gesetzt werden können — sein Tick-Abstand von ${spacing}. In v4 Teil des Pool-Schlüssels, daher braucht es anders als bei v3 keinen eigenen Vertragsaufruf.`,
    nativeCurrency: "Natives Ether",
    nativeCurrencyNote:
      "Die Nulladresse ist hier kein fehlendes Feld. v4 erlaubt einem Pool, das Ether der Chain selbst zu halten statt eines verpackten Tokens, und genau das ist hier der Fall.",
    hookHeading: "Der Hook",
    noHook: "Dieser Pool läuft ohne Hook.",
    noHookNote:
      "Neben seinen Tauschen und Einlagen läuft nichts, er verhält sich also wie ein v3-Pool.",
    hookMay: "Was er tun darf",
    permissionTopics: {
      swaps: "Rund um Tausche",
      liquidity: "Rund um Einlagen und Abhebungen",
      creation: "Als der Pool angelegt wurde",
      donations: "Rund um Spenden",
    } satisfies Record<HookTopic, string>,
    permissionWords: {
      beforeSwap:
        "Läuft vor jedem Tausch und kann den Tausch dort ablehnen sowie, in einem Pool mit dynamischer Gebühr, festlegen, was dieser Tausch zahlt.",
      afterSwap: "Läuft nach jedem Tausch und kann den Tausch dort noch immer ablehnen.",
      beforeSwapReturnsDelta:
        "Nimmt Token aus einem Tausch heraus oder legt eigene hinein, bevor der Pool ihn bepreist — ein Tausch hier muss also nicht der Kurve des Pools folgen.",
      afterSwapReturnsDelta: "Nimmt einen Anteil an einem Tausch, nachdem der Pool ihn bepreist hat.",
      beforeAddLiquidity: "Läuft vor jeder Einlage und kann die Einlage dort ablehnen.",
      afterAddLiquidity: "Läuft nach jeder Einlage und kann die Einlage dort noch immer ablehnen.",
      afterAddLiquidityReturnsDelta:
        "Nimmt bei einer Einlage Token aus ihr heraus oder fügt ihr Token hinzu.",
      beforeRemoveLiquidity: "Läuft vor jeder Abhebung und kann die Abhebung dort ablehnen.",
      afterRemoveLiquidity: "Läuft nach jeder Abhebung und kann die Abhebung dort noch immer ablehnen.",
      afterRemoveLiquidityReturnsDelta:
        "Nimmt bei einer Abhebung einen Anteil daran oder fügt ihr Token hinzu.",
      beforeInitialize: "Lief einmal, bevor der Pool angelegt wurde. Das ist bereits geschehen.",
      afterInitialize: "Lief einmal, nachdem der Pool angelegt wurde. Das ist bereits geschehen.",
      beforeDonate:
        "Läuft vor einer Spende an die Geber des Pools und kann die Spende dort ablehnen.",
      afterDonate:
        "Läuft nach einer Spende an die Geber des Pools und kann die Spende dort noch immer ablehnen.",
    } satisfies Record<HookPermission, string>,
    noPermissions:
      "Nichts rund um Tausche, Einlagen oder Spenden: das Protokoll ruft ihn in keinem dieser Momente auf. Was ein solcher Hook dennoch kann, ist die Gebühr eines Pools festzulegen, dessen Gebühr dynamisch ist.",
    permissionNames: "Die protokolleigenen Namen dafür",
    withdrawalWarning: (share: boolean): string =>
      share
        ? "Dieser Hook läuft, wenn ein Geber abhebt. Er darf eine Abhebung ablehnen und einen Anteil am Abgehobenen nehmen. Ob er das je tut, ist von hier aus nicht erkennbar."
        : "Dieser Hook läuft, wenn ein Geber abhebt, und darf eine Abhebung ablehnen. Ob er das je tut, ist von hier aus nicht erkennbar.",
    hookAddressIsThePermission:
      "Dies wird aus der Adresse des Hooks selbst gelesen. v4 speichert die Rechte eines Hooks nirgends: ein Hook wird an eine Adresse veröffentlicht, deren letzte vierzehn Bit angeben, welche Rückrufe der PoolManager aufrufen wird, und der PoolManager prüft diese Bits, statt den Vertrag zu fragen. Das sagt also, was der Hook darf, nie, was er tut — einer, der bei jedem Tausch die Gebühr neu schreiben darf, kann immer dieselbe Gebühr zurückgeben, und das ist von hier aus nicht erkennbar.",
    alterSwapWarning:
      "Dieser Hook darf ändern, was ein Tausch kostet oder einbringt. Jede aus der Preishistorie gezogene Zahl — ein vorgeschlagener Bereich, eine Gebührenstufe, ein Vergleich mit bloßem Halten — setzt voraus, dass der Pool berechnet, was er angibt, und zahlt, was die Kurve sagt. Keine dieser Voraussetzungen ist hier sicher, und nichts davon ist in einer Preisreihe sichtbar.",
    analysisScope:
      "Unten steht die Bereichsanalyse. Der Bereich stammt aus Preisen, die bereits eingetreten sind, er gilt hier also genauso wie für einen Pool ohne Hook — ein Hook kann nicht nachträglich ändern, wohin der Preis gegangen ist. Was ein Hook ändern kann, ist, was ein Tausch kostet; deshalb wird der Satz, den dieser Pool berechnet hat, aus dem gemessen, was er eingenommen hat, statt aus der Gebühr oben übernommen.",
    unavailableHeading: "Dieser Pool ließ sich nicht lesen",
    invalidId:
      "Das ist keine v4-Pool-id. Ein v4-Pool wird durch einen 32-Byte-Hash benannt — 0x gefolgt von 64 hexadezimalen Zeichen — nicht durch eine Vertragsadresse.",
    noId: "Fügen Sie eine v4-Pool-id ein, um zu sehen, was der Pool ist und was sein Hook darf.",
    loading: "Dieser v4-Pool wird gelesen, vom Indexer und von der Chain…",
  },

  notFound: {
    title: "Hier gibt es keine Seite",
    body: "Die Adresse, der Sie gefolgt sind, benennt nichts, was diese Anwendung ausliefert. Ein Pool wird über seine Adresse erreicht oder, bei v4, über seine id — beides gehört in das Suchfeld und nicht in den Pfad.",
    search: "Einen Pool finden →",
  },

  hooks: {
    heading: "Die Hooks, die auf Uniswap v4 laufen",
    loading: "Die meistgehandelten v4-Pools dieser Woche werden gelesen…",
    intro:
      "Jeder v4-Pool darf einen Hook nennen: einen Vertrag, den der PoolManager an festen Momenten eines Tauschs, einer Einlage, einer Abhebung aufruft. Welche Momente das sind, ist kein Versprechen, das irgendwer gibt. Es ist in die Adresse des Hooks hineingeschürft — die untersten vierzehn Bit sind die Liste, und das Protokoll weigert sich, den Vertrag für irgendetwas außerhalb davon aufzurufen.",
    onlyPermissions:
      "Das ist alles, was diese Seite weiß, und es lohnt sich zu wissen, gerade weil es durchgesetzt und nicht behauptet wird. Was ein Hook mit einem Recht tut, steht in seinem Code. Diese Anwendung liest keinen Code, und sie führt keine Liste von Hooks, für die jemand gebürgt hat — beides wäre eine Behauptung, die sie nicht prüfen könnte, neben Zahlen, die sie prüfen kann.",
    window: (pools: string, hooked: string, hookless: string) =>
      `Gelesen aus den Pools der meistgehandelten v4-Tage dieser Woche — ${pools} an der Zahl. ${hooked} nennen einen Hook; ${hookless} nennen keinen und verhalten sich wie ein v3-Pool.`,
    ordering:
      "Sortiert danach, wie viele dieser Pools den jeweiligen Hook einsetzen. Das ist eine Zahl von Pools und nichts weiter: ein Hook in vielen davon ist ein Hook, mit dem jemand viele Pools angelegt hat.",
    runs: (count: string) => `Läuft in ${count} davon`,
    poolsHeading: "Wo er läuft",
    moreNotShown: (count: string) => `und ${count} weitere`,
    none: "Kein Pool der meistgehandelten v4-Tage dieser Woche nennt einen Hook.",
    unavailable:
      "Die v4-Pools der Woche ließen sich nicht lesen, es gibt also kein Verzeichnis zu zeigen.",
    fromHome: "Alle Hooks ansehen →",
  },

  positions: {
    heading: "Positionen, die diese Adresse bereits hält",
    intro:
      "Alles darüber ist, was diese Adresse tun könnte — welche Pools ihre Token öffnen. Dies ist, was sie bereits getan hat. Eine Position ist in beiden Protokollen ein Token, den ein Vertrag hält, und beide Verträge werden gefragt, was jeder Token ist. Der v3-Vertrag kann die Token einer Adresse zudem auflisten; der v4-Vertrag kann das nicht, deshalb kommt diese Liste von einem Indexer, und jede id daraus wird an die Chain zurückgegeben, die gefragt wird, wem sie gehört.",
    none: "Diese Adresse hält in keinem der beiden Protokolle einen Uniswap-Positionstoken.",
    noneOpen:
      "Jeder Positionstoken, den diese Adresse hält, wurde geschlossen. Ein geschlossener ist die Quittung einer Position, die einmal war, keine Position.",
    counts: (held: string, open: string, closed: string) =>
      `${held} Positionstoken, davon haben ${open} noch Liquidität und ${closed} wurden geschlossen.`,
    inRange: "Verdient gerade",
    outOfRange: "Außerhalb ihres Bereichs",
    rangeUnknown: "Hier hat noch niemand getauscht",
    analyse: "Diesen Pool analysieren →",
    feesEarned: (amount0: string, symbol0: string, amount1: string, symbol1: string) =>
      `Verdient und noch nicht entnommen: ${amount0} ${symbol0} und ${amount1} ${symbol1}.`,
    feesNone: "Noch nichts verdient, das zu entnehmen wäre.",
    feesUnread: "Was sie verdient hat, ließ sich nicht lesen.",
    everyPrice: "Jeder Preis, den dieser Pool ausdrücken kann",
    moreNotShown: (count: string) => `${count} weitere sind offen und hier nicht aufgeführt.`,
    readCap: (read: string, held: string) =>
      `${read} von ${held} wurden gelesen. Der Rest steht nicht auf dieser Seite, was eine Grenze der Seite ist und nicht der Adresse.`,
    unreadProtocol: (protocol: string) =>
      `Uniswap-${protocol}-Positionen ließen sich diesmal nicht lesen, jede Zahl hier betrifft daher allein das andere Protokoll.`,
    unavailable: "Die Positionen dieser Adresse ließen sich nicht lesen.",
    publicNote:
      "Der Eigentümer einer Position steht on-chain, also ist diese Liste öffentlich: jeder kann für dieselbe Adresse dieselbe lesen, und sie sagt nichts, was diese Adresse nicht schon durch das Halten dieser Token veröffentlicht hat. Nichts hier wird gespeichert, sofern du unten keine Telegram-Hinweise anforderst, und keine Zahl auf dieser Seite ist eine Bewertung — ein Bereich ist nicht, was eine Position wert ist.",
  },

  wallet: {
    heading: "Eine Wallet verbinden",
    intro:
      "Verbinden Sie eine Wallet, dann kann diese Seite sehen, welche Token die Adresse hält, und Ihnen die Pools zeigen, in die diese Token fließen können. Sie liest die Adresse; mehr wird eine Wallet hier nicht gefragt.",
    connect: "Wallet verbinden",
    connecting: "Es wird auf die Wallet gewartet…",
    connectedAs: "Verbunden als",
    showHoldings: "Zeigen, was sie hält",
    forget: "Diese Adresse vergessen",
    readOnly:
      "Nur lesend. Diese Anwendung bittet ein Wallet um seine Adresse und nie um eine Signatur: es gibt hier keinen Code, der eine Nachricht signieren oder eine Transaktion senden könnte, und nichts über das Wallet wird zwischen Besuchen gespeichert.",
    notices: {
      "wallet-not-found":
        "In diesem Browser wurde keine Wallet gefunden. Eine Wallet-Erweiterung bringt eine mit; ohne sie ändert sich auf dieser Seite nichts.",
      "wallet-request-declined":
        "Die Anfrage wurde in der Wallet abgelehnt. Es wurde nichts gelesen und nichts gesendet.",
      "wallet-request-failed":
        "Die Wallet konnte nicht nach einer Adresse gefragt werden. Es wurde nichts gelesen und nichts gesendet.",
      "wallet-no-account":
        "Die Wallet hat ohne Adresse geantwortet, was meist bedeutet, dass sie gesperrt ist oder kein Konto ausgewählt hat.",
    },
  },

  telegram: {
    heading: "Hinweise per Telegram",
    intro:
      "Lass dir per Telegram sagen, wenn eine Position dieser Adresse dem Rand ihres Bereichs nahekommt, ihn verlässt oder wieder hineinkommt. Der Knopf führt zum Bot dieser Seite; drückst du dort auf Start, wird dieser Chat mit dieser Adresse verknüpft. Gespeichert werden die Adresse und die numerische Kennung des Chats — sonst nichts — und beides wird vom Server gelöscht, sobald du dem Bot /stop schickst oder die Verknüpfung hier vergisst, und verschwindet binnen sieben Tagen auch aus seinen verschlüsselten Sicherungen. Wie oft geprüft wird, hängt vom Server ab, auf dem das läuft.",
    connect: "Telegram verbinden",
    connected: (address: string) => `Dieser Browser ist verknüpft: ${address} wird beobachtet.`,
    pending: "Die Verknüpfung wartet: öffne den Chat mit dem Bot in Telegram und drücke auf Start.",
    forget: "Verknüpfung vergessen",
    notConfigured: "Telegram-Hinweise sind auf diesem Server nicht eingerichtet.",
    publicNote:
      "Niemand muss eine Adresse besitzen, um ihr zu folgen — Positionen sind öffentlich, und ein Hinweis sagt nichts, was diese Liste nicht sagt. Der Bot liest die Chain und schickt eine Nachricht; er kann nichts signieren und nichts senden.",
    linked: (address: string) =>
      `Verknüpft. Du erfährst hier, wenn eine Position unter ${address} dem Rand ihres Bereichs nahekommt, ihn verlässt oder zurückkommt. Schick /stop, um das zu beenden.`,
    unknownStart:
      "Dieser Link ist unbekannt oder abgelaufen. Drück auf der Seite noch einmal auf „Telegram verbinden“.",
    alreadyClaimed:
      "Dieser Link wurde bereits von einem anderen Chat benutzt. Drück auf der Seite noch einmal auf „Telegram verbinden“ für einen neuen.",
    stopped: "Beendet. Dieser Chat folgt nun nichts mehr. Der Eintrag ist vom Server gelöscht und verschwindet binnen sieben Tagen auch aus den verschlüsselten Sicherungen.",
    nothingToStop: "Dieser Chat ist nichts gefolgt.",
    help:
      "Dieser Bot folgt nur der Adresse, die du auf der Seite verknüpft hast, und meldet sich nur, wenn eine Position dem Rand ihres Bereichs nahekommt, ihn verlässt oder wieder betritt. Schick /stop, um das zu beenden.",
    storeDown: "Die Verknüpfung konnte gerade nicht geprüft werden. Versuch es in einer Minute noch einmal.",
    left: (pair: string, protocol: string, range: string) =>
      `⚠️ ${pair} (${protocol}) hat seinen Bereich verlassen: ${range}. Es hält nur noch einen Token und verdient nichts, bis der Preis zurückkommt.`,
    nearing: (pair: string, protocol: string, range: string, price: string, edge: string) =>
      `⏳ ${pair} (${protocol}) nähert sich dem Rand seines Bereichs: ${range}. Der Preis steht bei ${price}; jenseits von ${edge} hält es nur noch einen Token und verdient nichts.`,
    entered: (pair: string, protocol: string, range: string) =>
      `✅ ${pair} (${protocol}) ist wieder in seinem Bereich: ${range}. Es verdient wieder.`,
    opened: (pair: string, protocol: string, range: string) => `Neue Position: ${pair} (${protocol}), ${range}.`,
    closed: (protocol: string, tokenId: string) => `Geschlossen: Position ${protocol} #${tokenId}.`,
    footer:
      "Nur zur Information — keine Finanzberatung. Aus öffentlichen On-Chain-Daten gelesen; nichts hier kann für dich handeln.",
  },

  search: {
    label: "Ein Paar, eine v3-Pool-Adresse oder eine v4-Pool-id",
    placeholder: "WETH/USDC",
    help: "Geben Sie ein Paar wie WETH/USDC ein, fügen Sie die Adresse eines v3-Pool-Vertrags ein, oder fügen Sie eine v4-Pool-id ein — den 32-Byte-Hash, über den ein v4-Pool benannt wird. Nur lesend: diese Anwendung signiert nie etwas und sendet nie eine Transaktion.",
    submit: "Pools finden",

    heading: "Passende Uniswap-v3-Pools",
    resultsFor: (terms: string) => `Pools, deren Token zu ${terms} passen.`,
    empty: (terms: string) =>
      `Kein Uniswap-v3-Pool im Ethereum-Mainnet hat einen Token, der zu ${terms} passt.`,
    emptyHint: "Prüfen Sie die Schreibweise, oder fügen Sie die Adresse des Pools ein, falls Sie sie haben.",

    v4Heading: "Passende Uniswap-v4-Pools",
    v4Empty: (terms: string) =>
      `Kein Uniswap-v4-Pool im Ethereum-Mainnet hat eine Währung, die zu ${terms} passt.`,
    v4Depth: "Tiefe beim aktuellen Preis",
    v4DepthValue: (ether: string) => `≈ ${ether} ETH`,
    v4DepthNote:
      "Was die aktive Liquidität des Pools gerade wert ist, gelesen aus dem Speicher des PoolManagers selbst — nicht, was der Pool hält, was kein v4-Pool für sich allein meldet.",
    v4StateUnread: "Die Liquidität des Pools ließ sich nicht aus der Chain lesen.",
    v4Hook: "Hook",
    v4NoHook: "keiner",
    v4HookAltersSwaps: "kann ändern, was ein Tausch kostet",
    v4Ordering:
      "Pools, die genau so heißen, wie Sie gesucht haben, kommen zuerst. Danach folgt die Reihenfolge der Tiefe jedes Pools bei seinem aktuellen Preis — seiner aktiven Liquidität und seinem Preis, aus dem Speicher des PoolManagers gelesen und mithilfe der von der Datenquelle abgeleiteten Preise auf einen Maßstab gebracht. Nicht, was der Pool hält: die Token aller v4-Pools liegen gemeinsam im einen PoolManager, und nichts auf der Chain meldet sie je Pool. Die Liquiditätszahl des Indexers wurde gegen die Chain geprüft und lag bei einem der meistgehandelten Pools um fünfzehn Prozent daneben; deshalb wird sie nicht verwendet.",

    ordering:
      "Pools, die genau so heißen, wie Sie gesucht haben, kommen zuerst. Danach folgt die Reihenfolge dem, was jeder Pool tatsächlich hält, aus den Token-Verträgen selbst gelesen und mithilfe der von der Datenquelle abgeleiteten Preise auf einen Maßstab gebracht. Früher folgte sie dem Wert, den die Quelle als in jedem Pool hinterlegt meldet, und diese Zahl war falsch genug, um diese Liste umzusortieren: ein Pool erschien hier mit neun Millionen Dollar gemeldeter Liquidität, während seine Verträge neuntausend hielten.",
    windowing:
      "Diese Liste stammt aus den Pools, die die Datenquelle für Ihre Suchbegriffe als die meistgehandelten meldet, und ein Pool, der ruhig genug ist, um außerhalb dieser Menge zu liegen, erreicht die obige Sortierung nie. Das ist die ehrliche Grenze einer Rangfolge innerhalb dessen, was eine Quelle zurückzugeben beschlossen hat: ein Pool, der viel hält, aber selten gehandelt wird, kann auf dieser Seite fehlen.",
    dormantNote:
      "Ein Pool, in dem seit einem Monat nichts geschehen ist, wird nicht aufgeführt. Der Bereich wird aus dem letzten Monat an Preisen gezeichnet, und ein Pool ohne einen solchen hat nichts, woraus er sich zeichnen ließe — ihn zu öffnen würde nur das sagen.",
    v4Windowing:
      "Diese Liste stammt aus den v4-Pools, die in den letzten sieben Tagen im Ethereum-Mainnet am meisten gehandelt wurden — den tausend geschäftigsten Pool-Tagen, was auf einige hundert Pools hinausläuft — und ein ruhigerer Pool erreicht diese Seite nie. Die Quelle kann eine Suche über jeden v4-Pool nicht beantworten, bevor diese Seite aufhört zu warten; das Fenster richtet sich daher nach der jüngsten Aktivität und nicht nach Ihren Suchbegriffen: ein Pool, den es gibt, der aber diese Woche nicht gehandelt wurde, steht nicht hier.",
    symbolWarning:
      "Ein Symbol stammt aus dem Vertrag des Tokens selbst, und einen Token zu veröffentlichen, der sich USDC nennt, kostet nichts. Die Vertragsadressen unter jedem Paar sind das, was zwei Token voneinander unterscheidet.",

    feeTier: "Gebührenstufe",
    holds: "Hält",
    reservesUnread: "Was dieser Pool hält, ließ sich nicht aus der Chain lesen.",
    moreNotShown: (count: string) =>
      `${count} weitere werden nicht gezeigt. Die oben sind die meistgehandelten davon, in der Reihenfolge, die die Datenquelle meldet — was eine Aussage darüber ist, wie geschäftig ein Pool ist, und über nichts sonst.`,
    analyse: "Diesen Pool analysieren",
    v4FeeNote:
      "Die Gebühr jedes Pools wird aus dem Schlüssel gelesen, mit dem er angelegt wurde, auf der Chain, und nicht aus der Datenquelle — deren Gebührenzahl sich als die Summe erwies, die ein Tausch zuletzt gezahlt hat, Protokollanteil eingeschlossen, und nicht als die Gebühr des Pools selbst. Eine Zeile, deren Schlüssel sich nicht lesen ließ, sagt das.",

    unavailableHeading: "Die Suche ließ sich nicht ausführen",
    rejected: {
      empty: "Geben Sie ein Paar wie WETH/USDC ein, oder eine Pool-Adresse.",
      length: (min: number, max: number) =>
        `Ein Suchbegriff ist zwischen ${min} und ${max} Zeichen lang.`,
      unsupportedCharacters:
        "Ein Suchbegriff darf Buchstaben, Ziffern und die Zeichen enthalten, die in Tickern vorkommen — sonst nichts.",
    },
  },

  report: {
    steps: {
      pool: "beim Lesen der Konfiguration des Pools",
      snapshot: "beim Lesen des aktuellen Marktzustands des Pools",
      history: "beim Lesen der täglichen Preishistorie des Pools",
      volatility: "beim Messen, wie stark sich der Preis bewegt hat",
      band: "beim Bauen des Preisbandes",
      range: "beim Einrasten des Bandes auf die Preise, die dieser Pool ausdrücken kann",
      divergence: "beim Vergleich dieses Bereichs mit dem Halten der beiden Token",
      activity: "beim Lesen dessen, was der Pool über das gemessene Fenster getan hat",
    },
    noRangeHeading: "Kein Bereich für diesen Pool",
    stoppedWhile: (step: string) => `Dies brach ${step} ab.`,
    poolSummary: (protocol: string, fee: string, chain: string) =>
      `Uniswap ${protocol} · ${chain} · ${fee}`,
    feePerSwap: (fee: string) => `${fee} Gebühr bei jedem Tausch`,
    feePlusProtocol: (fee: string, protocol: string) =>
      `${fee} Gebühr bei jedem Tausch, dazu ${protocol} an das Protokoll`,
    noDeclaredFee: "Gebühr von seinem Hook bei jedem Tausch gesetzt",
    caveatsHeading: (count: number) =>
      count === 1
        ? "Ein Vorbehalt gilt für diese Zahlen."
        : `${count} Vorbehalte gelten für diese Zahlen.`,
    caveatsAriaLabel: "Vorbehalte",

    contentsHeading: "Auf dieser Seite",
    contentsLabel: "Die Abschnitte dieser Analyse",
    rangeHeading: "Vorgeschlagener Preisbereich",
    rangeIntro: (base: string, quote: string) =>
      `Wo eine Position in diesem Pool aktiv wäre, als Preis von einem ${base} in ${quote}.`,
    rangeValue: (lower: string, upper: string, quote: string, base: string) =>
      `${lower} – ${upper} ${quote} je ${base}`,
    rangeDistances: (down: string, up: string) =>
      `${down} unter und ${up} über dem aktuellen Preis.`,
    rangeMeaning:
      "Zwischen diesen beiden Preisen nimmt eine Position ihren Anteil an den Tauschgebühren des Pools ein. Außerhalb hält sie einen einzigen Token und nimmt nichts ein, bis der Preis zurückkommt.",
    priceSentence: (base: string, price: string, quote: string) => `1 ${base} = ${price} ${quote}`,
    currentPrice: "Aktueller Preis",
    inRangeYes: "Der aktuelle Preis liegt innerhalb dieses Bereichs.",
    inRangeNo: "Der aktuelle Preis liegt außerhalb dieses Bereichs.",
    inRangeYesNote: "Eine hier eröffnete Position wäre sofort aktiv.",
    inRangeNoNote:
      "Eine hier eröffnete Position hielte einen einzigen Token und nähme nichts ein, bis der Preis wieder hineinkommt.",
    beyondEdges: (below: string, above: string) =>
      `Fällt der Preis unter den Bereich, hält die Position am Ende nur ${below}; steigt er darüber, nur ${above}.`,
    lowerTruncatedNote:
      "Die untere Kante endet beim niedrigsten Preis, den dieser Pool ausdrücken kann, vor der Stelle, an die das Band sie gesetzt hätte.",
    upperTruncatedNote:
      "Die obere Kante endet beim höchsten Preis, den dieser Pool ausdrücken kann, vor der Stelle, an die das Band sie gesetzt hätte.",
    chartLabel: "Die Preise des letzten Monats gegen den vorgeschlagenen Bereich",
    chartCaption: (days: string) =>
      `Jeder der letzten ${days} Tage: sein Schlusskurs und die Spanne von seinem Tief zu seinem Hoch. Das schattierte Band ist der vorgeschlagene Bereich; die durchgezogene Linie ist der heutige Preis.`,
    chartLegend:
      "Ein gefüllter Punkt ist ein Tag, der vollständig innerhalb des Bereichs geblieben ist; ein hohler hat ihn verlassen oder eine Kante überschritten.",

    basisHeading: "Wie dieser Bereich gezeichnet wurde",
    basisIntro: (base: string, days: string) =>
      `Daraus, wie stark sich der Preis von ${base} über die letzten ${days} abgeschlossenen Tage tatsächlich bewegt hat — nicht aus einer Vorhersage, wohin er als Nächstes geht.`,
    dailyMove: "Typische Tagesbewegung",
    dailyMoveNote: "Die Standardabweichung der Preisänderung eines Tages über das Fenster.",
    horizonMove: (days: string) => `Über ${days} Tage`,
    horizonMoveNote:
      "Dieselbe Bewegung, gestreckt über den unten gewählten Zeithorizont: eine Standardabweichung, in beide Richtungen.",
    widthValue: (multiplier: string) => `${multiplier}× davon, in jede Richtung`,
    widthNote:
      "Unten gewählt. Ein breiterer Bereich wird seltener verlassen, und dieselbe darüber verteilte Einlage ist an jedem einzelnen Preis dünner.",
    measuredOver: "Gemessen über",
    measuredOverNote: (returns: string) => `${returns} Tagesänderungen sind eingeflossen.`,
    epilogue:
      "Der Bereich ist um den heutigen Preis zentriert und in Verhältnissen nach oben und unten gleich weit gezeichnet — Halbieren und Verdoppeln sind dieselbe Bewegung —, weshalb die beiden Prozentsätze auseinandergehen. Er beschreibt, wie weit sich der Preis bewegt hat, nicht, wohin er gehen wird: er ist keine Vorhersage, und die Breite ist kein Konfidenzniveau. Nichts hier bemisst eine Position oder sagt, wie viel von welchem Token einzulegen ist.",
  },

  technical: {
    heading: "Technische Angaben",
    summary: "Die Ticks, Blöcke und Zahlen, gegen die die Seite oben geprüft wird.",
    lowerTick: "Unterer Tick",
    upperTick: "Oberer Tick",
    currentTick: "Aktueller Tick",
    sourceReportedTick: (tick: string) => `Die Quelle meldete ${tick}.`,
    noSourceTick:
      "Die Quelle meldete keinen eigenen Tick, diese Umrechnung ist daher ungeprüft.",
    tickSpacing: "Tick-Abstand",
    tickSpacingNote: (step: string) => `Ein Preisschritt von ${step} zwischen nutzbaren Kanten.`,
    width: "Breite",
    widthValue: (ticks: string, spacings: string) => `${ticks} Ticks · ${spacings} Abstände`,
    poolPrice: "Preis, wie der Pool ihn angibt",
    quotePerBase: (quote: string, base: string) => `${quote} je ${base}`,
    bandLower: "Untere Bandgrenze",
    bandUpper: "Obere Bandgrenze",
    bandNote: "Vor dem Einrasten auf das Tick-Raster, in der Richtung des Pools selbst.",
    annualised: "Annualisierte Volatilität",
    annualisedNote:
      "Stichproben-Standardabweichung der täglichen logarithmischen Renditen, skaliert mit sqrt(365).",
    coverage: "Abdeckung",
    coverageNote: "Wie viel des Fensters durch aufeinanderfolgende Tagespreise gedeckt war.",
    sourceBlock: "Quellblock",
    noBlockTime: "Keine Blockzeit gemeldet.",
    fetchedAt: "Abgerufen um",
    fetchedAtNote: "Wann die Antwort eintraf, nicht was sie beschreibt.",
    lowerEdge: "Untere Kante",
    upperEdge: "Obere Kante",
    truncated: "Abgeschnitten",
    asAsked: "Wie angefordert",
  },

  explanation: {
    heading: "Erklärung",
    pending: "Die Erklärung wird geschrieben…",
    unavailable: "Für diese Analyse ist keine Erklärung verfügbar.",
    sectionWriting: "Wird noch geschrieben…",
    sectionMissing: "Dieser Teil konnte nicht geschrieben werden.",
    writtenBy: (model: string) => `Geschrieben von ${model}. Die Zahlen darüber nicht.`,
    sections: {
      whatThisRangeMeans: "Was dieser Bereich bedeutet",
      ifPriceLeavesTheRange: "Wenn der Preis den Bereich verlässt",
      whatTheVolatilitySays: "Was die Volatilität sagt",
      whatThisDoesNotCover: "Was dies nicht abdeckt",
    },
  },

  notices: {
    failure: {
      "invalid-pool-address":
        "Die Pool-Adresse muss 0x gefolgt von 40 hexadezimalen Zeichen sein und darf nicht die Nulladresse sein.",
      "invalid-search-terms":
        "Eine Pool-Suche nimmt einen oder zwei kurze Begriffe aus Buchstaben, Ziffern und den Zeichen, die in Tickern vorkommen.",
      "market-data-not-configured":
        "Uniswap-v3-Marktdaten sind auf diesem Server nicht eingerichtet.",
      "chain-data-not-configured": "On-Chain-Abrufe sind auf diesem Server nicht eingerichtet.",
      "explanation-not-configured":
        "Diese Anwendung ist nicht dafür eingerichtet, Erklärungen zu schreiben, es wird daher keine gezeigt.",
      "market-data-timed-out": "Die Anfrage an die Marktdaten lief in eine Zeitüberschreitung.",
      "market-data-unreachable": "Die Marktdatenquelle war nicht erreichbar.",
      "market-data-credentials-rejected":
        "Die Marktdatenquelle hat die eingerichteten Zugangsdaten abgelehnt.",
      "market-data-rate-limited": "Das Anfragelimit der Marktdatenquelle wurde überschritten.",
      "market-data-unreadable": "Die Marktdatenquelle lieferte eine unlesbare Antwort.",
      "market-data-malformed":
        "Die Marktdatenquelle lieferte eine Antwort, die diese Anwendung nicht prüfen kann.",
      "market-data-indexing-errors":
        "Die Marktdatenquelle meldete Indizierungsfehler, ihre Zahlen können daher nicht als geprüft gelten.",
      "market-data-stale":
        "Die Marktdatenquelle hinkt der Chain zu weit hinterher, als dass diese Zahlen als aktuell gelten könnten.",
      "market-data-future-block-time":
        "Die Marktdatenquelle meldete eine Blockzeit, die der Uhr dieses Servers vorausgeht; ihre Zahlen lassen sich daher nicht prüfen.",
      "chain-data-timed-out": "Die Anfrage an die On-Chain-Daten lief in eine Zeitüberschreitung.",
      "chain-data-unreachable": "Die On-Chain-Datenquelle war nicht erreichbar.",
      "chain-data-credentials-rejected":
        "Die On-Chain-Datenquelle hat die eingerichteten Zugangsdaten abgelehnt.",
      "chain-data-rate-limited": "Das Anfragelimit der On-Chain-Datenquelle wurde überschritten.",
      "chain-data-unreadable": "Die On-Chain-Datenquelle lieferte eine unlesbare Antwort.",
      "chain-data-malformed":
        "Die On-Chain-Datenquelle lieferte eine Antwort, die diese Anwendung nicht prüfen kann.",
      "chain-aggregator-unverified":
        "Bestände werden über einen Hilfsvertrag auf der Chain gelesen, und der Code an dessen Adresse ist nicht der Code, dem diese Anwendung zu vertrauen gebaut wurde; es wurde daher nichts darüber gelesen.",
      "pool-not-found":
        "Für diese Adresse wurde im Ethereum-Mainnet kein Uniswap-v3-Pool gefunden.",
      "pool-contract-not-found":
        "Unter dieser Adresse antwortete im Ethereum-Mainnet kein Uniswap-v3-Pool-Vertrag.",
      "pool-configuration-inconsistent":
        "Die aus den beiden Quellen zusammengesetzte Pool-Konfiguration ließ sich nicht prüfen.",
      "pool-history-insufficient":
        "Dieser Pool hat noch nicht genug abgeschlossene tägliche Preishistorie, um analysiert zu werden.",
      "pool-history-never-traded":
        "Diesen Pool gibt es, aber in ihm wurde nie gehandelt, also gibt es keine Tagespreise, aus denen sich ein Bereich messen ließe.",
      "pool-history-dormant":
        "Dieser Pool hörte auf zu handeln, bevor der Zeitraum beginnt, aus dem diese Tagespreise gelesen werden, also gibt es keine jüngere Historie, aus der sich ein Bereich messen ließe. Warten ändert daran nichts — nur eine erneute Nutzung des Pools würde es.",
      "volatility-invalid-input":
        "Die für diese Berechnung gelieferte Preishistorie ist keine gültige normalisierte Historie.",
      "volatility-insufficient-history":
        "Dieser Pool hat nicht genug aufeinanderfolgende Tagespreise, um die Volatilität zu messen.",
      "volatility-unverifiable":
        "Die Volatilitätsberechnung ergab ein Resultat, das diese Anwendung nicht prüfen kann.",
      "band-invalid-input":
        "Die für dieses Preisband gelieferten Marktdaten sind ungültig, oder Momentaufnahme und Volatilität beschreiben verschiedene Pools.",
      "band-no-current-price":
        "Der aktuelle Preis dieses Pools ist nicht verfügbar, ein Preisband lässt sich daher nicht zentrieren.",
      "band-unverifiable":
        "Die Preisbandberechnung ergab ein Resultat, das diese Anwendung nicht prüfen kann.",
      "range-invalid-input":
        "Pool, Preisband und Momentaufnahme für diesen Bereich sind ungültig, oder sie beschreiben nicht alle denselben Pool und dieselbe Beobachtung.",
      "range-price-unrepresentable":
        "Der aktuelle Preis dieses Pools liegt außerhalb dessen, was Uniswap ausdrücken kann; daraus lässt sich kein Positionsbereich bauen.",
      "range-tick-disagreement":
        "Der Preis, den die Quelle für diesen Pool meldet, und der Zustand, den sie meldet, beschreiben nicht denselben Moment; es wird daher kein Bereich veröffentlicht.",
      "range-too-narrow":
        "Das Preisband ist schmaler als der kleinste Schritt, den dieser Pool zwischen zwei Kanten zulässt; es beschreibt daher keine zwei verschiedenen Positionsgrenzen.",
      "range-unverifiable":
        "Die Bereichsberechnung ergab ein Resultat, das diese Anwendung nicht prüfen kann.",
      "divergence-unverifiable":
        "Der Vergleich mit dem Halten ergab ein Resultat, das diese Anwendung nicht prüfen kann.",
      "activity-unverifiable":
        "Die jüngste Aktivität des Pools ergab ein Resultat, das diese Anwendung nicht prüfen kann.",
      "fee-rate-unmeasurable":
        "Dieser Pool handelte an keinem indizierten Tag des Fensters etwas; der Satz, den er berechnet, lässt sich daher nicht aus dem herausrechnen, was er eingenommen hat.",
      "deposit-share-unpriceable":
        "Die Quelle bepreist nicht, was dieser Pool hält; eine Einlage in Dollar lässt sich daher nicht in eine Position darin überführen.",
      "deposit-share-no-days":
        "Der Preis verließ diesen Bereich an jedem Tag, für den die Quelle antworten konnte; es gibt daher keinen Tag, an dem eine Einlage darin etwas eingenommen hätte.",
      "deposit-share-unverifiable":
        "Was eine Einlage genommen hätte, bestand die eigene Prüfung nicht und wird daher nicht gezeigt.",
      "range-order-no-room":
        "Dieser Bereich ist zu schmal, um auf einer der beiden Seiten des aktuellen Preises eine einseitige Position aufzunehmen.",
      "range-order-unverifiable":
        "Die einseitigen Hälften dieses Bereichs bestanden ihre eigene Prüfung nicht und werden daher nicht gezeigt.",
      "swap-depth-no-liquidity":
        "Dieser Pool meldet bei seinem aktuellen Preis keine Liquidität; es gibt hier keinen Tausch zu bepreisen.",
      "swap-depth-tick-disagreement":
        "Der eigene Tick der Quelle setzt diesen Pool in einen anderen Preisschritt als den gezeigten Preis; die gemeldete Liquidität lässt sich diesem Schritt daher nicht zuordnen.",
      "swap-depth-unverifiable":
        "Was ein Tausch kosten würde, bestand die eigene Prüfung nicht und wird daher nicht gezeigt.",
      "out-of-sample-insufficient-history":
        "Dieser Pool hat nicht genug indizierte Historie, um in der Vergangenheit ein Band anzupassen und danach noch einen vollen Zeithorizont an Tagen zum Prüfen übrig zu haben.",
      "out-of-sample-unverifiable":
        "Die Prüfung außerhalb der Stichprobe ergab ein Resultat, das diese Anwendung nicht prüfen kann.",
      "hook-directory-unverifiable":
        "Die Hooks der v4-Pools dieser Woche bestanden ihre eigene Prüfung nicht; das Verzeichnis wird daher nicht gezeigt.",
      "positions-manager-unverified":
        "Der Vertrag, der Uniswap-v3-Positionen hält, antwortete nicht mit dem Code, gegen den diese Anwendung gebaut wurde; nichts von dem, was er sagte, wird gezeigt.",
      "positions-unreadable":
        "Die Chain antwortete nicht für die Positionen dieser Adresse; es wird daher keine gezeigt — was nicht dasselbe ist, wie keine zu halten.",
      "positions-unverifiable":
        "Die Positionen dieser Adresse bestanden ihre eigene Prüfung nicht und werden daher nicht gezeigt.",
      "holdings-unverifiable":
        "Was diese Adresse hält, ergab ein Resultat, das diese Anwendung nicht prüfen kann.",
      "explanation-key-rejected":
        "Der Erklärungsdienst hat den eingerichteten Schlüssel nicht akzeptiert, es wird daher keine Erklärung gezeigt.",
      "explanation-model-not-permitted":
        "Der eingerichtete Schlüssel darf das gewählte Modell nicht verwenden, es wird daher keine Erklärung gezeigt.",
      "explanation-model-unknown":
        "Das gewählte Modell steht dem eingerichteten Schlüssel nicht zur Verfügung, es wird daher keine Erklärung gezeigt.",
      "explanation-rate-limited":
        "Der Erklärungsdienst ist derzeit im Anfragelimit, es wird daher keine Erklärung gezeigt.",
      "explanation-hourly-cap":
        "Diese Seite schreibt pro Stunde nur eine begrenzte Zahl von Erklärungen, und so viele sind geschrieben. Die Zahlen oben sind vollständig; innerhalb der Stunde kann die Erklärung wieder geschrieben werden.",
      "explanation-unreachable":
        "Der Erklärungsdienst war nicht erreichbar, es wird daher keine Erklärung gezeigt.",
      "explanation-request-refused":
        "Der Erklärungsdienst hat diese Anfrage abgelehnt, es wird daher keine Erklärung gezeigt.",
      "explanation-declined":
        "Das Modell hat es abgelehnt, die Zahlen dieses Pools zu erklären, es wird daher keine Erklärung gezeigt.",
      "explanation-truncated":
        "Die Erklärung wurde abgeschnitten, bevor sie vollständig war, und wird daher nicht gezeigt.",
      "explanation-malformed":
        "Die Erklärung kam in einer Form zurück, die diese Anwendung nicht prüfen kann, und wird daher nicht gezeigt.",
    } satisfies Record<DataFailureNotice, string>,

    warning: {
      "block-time-unreported":
        "Die Datenquelle meldete keine Blockzeit; wie aktuell diese Zahlen sind, ließ sich daher nicht prüfen.",
      "history-window-incomplete":
        "Die Datenquelle meldete nicht für jeden Tag dieses Fensters einen Preis; die fehlenden Tage fehlen, statt geschätzt zu werden.",
      "volatility-window-incomplete":
        "Einige Tage dieses Fensters hatten keinen Preis; die Volatilität ist daher aus weniger Tagesrenditen gemessen, als das Fenster umfasst. Die fehlenden Tage wurden übersprungen, nicht geschätzt.",
      "band-window-incomplete":
        "Einige Tage im Volatilitätsfenster hatten keinen Preis; dieses Band beruht daher auf weniger Tagesrenditen, als das Fenster umfasst.",
      "band-price-block-time-unreported":
        "Die Quelle des aktuellen Preises meldete keine Blockzeit; wie aktuell er ist, ließ sich daher nicht unabhängig prüfen.",
      "band-volatility-block-time-unreported":
        "Die Volatilitätsquelle meldete keine Blockzeit; wie aktuell sie ist, ließ sich daher nicht unabhängig prüfen.",
      "range-lower-edge-truncated":
        "Eine Kante des Bereichs endet dort, wo die Preise enden, die dieser Pool ausdrücken kann — die Kante, an der der erste Token des Pools am billigsten ist —, der Bereich reicht daher nicht so weit wie das Band. Das Bereichsfeld sagt, welche Kante das in der gezeigten Richtung ist.",
      "range-upper-edge-truncated":
        "Eine Kante des Bereichs endet dort, wo die Preise enden, die dieser Pool ausdrücken kann — die Kante, an der der erste Token des Pools am teuersten ist —, der Bereich reicht daher nicht so weit wie das Band. Das Bereichsfeld sagt, welche Kante das in der gezeigten Richtung ist.",
      "range-tick-unverified":
        "Die Preisquelle meldete nicht den eigenen Zustand des Pools; der Preis, den sie nahelegt, ließ sich daher nicht dagegen prüfen.",
      "range-excludes-current-price":
        "Der aktuelle Preis des Pools liegt außerhalb dieses Bereichs; eine daraus gebaute Position hielte einen einzigen Token und nähme nichts ein, bis der Preis zurückkehrt.",
    } satisfies Record<DataWarningNotice, string>,
  },

  rateLimited: {
    title: "Zu viele Anfragen",
    body: (limit: number) =>
      `Diese Seite liest bei jedem Besuch aktuelle Uniswap-Daten und ist daher auf ${limit} Analysen pro Minute begrenzt.`,
    retry: (seconds: number) => `Versuchen Sie es in ${seconds} Sekunde${seconds === 1 ? "" : "n"} erneut.`,
    back: "Zurück zum Ratgeber",
  },

  error: ERROR_COPY.de,
};
const es: Dictionary = {
  metadata: {
    title: "LiquidityWise",
    description:
      "Un asesor educativo asistido por IA para estrategias de liquidez en Uniswap v3 y v4. Solo orientación — no es asesoramiento financiero.",
    v4Title: "Un pool de Uniswap v4 · LiquidityWise",
    v4Description: "Qué es un pool concreto de Uniswap v4 y qué se le permite hacer a su hook.",
    holdingsTitle: "Lo que tiene una dirección · LiquidityWise",
    holdingsDescription:
      "Los tokens encontrados en una dirección de Ethereum y los pools de Uniswap v3 a los que pueden ir.",
    compareTitle: "Niveles de comisión lado a lado · LiquidityWise",
    compareDescription: "Todos los niveles de comisión de Uniswap v3 de un par, leídos con el mismo horizonte, amplitud y depósito.",
    poolTitle: "Análisis de rango de un pool · LiquidityWise",
    poolDescription:
      "Un rango de precios para un pool de Uniswap v3 en la red principal de Ethereum, trazado a partir de cuánto se ha movido realmente su precio.",
    hooksTitle: "Los hooks de Uniswap v4 · LiquidityWise",
    hooksDescription:
      "Todos los hooks que nombran los pools de Uniswap v4 más activos de la semana, y qué se le permite hacer a cada uno — leído de su propia dirección.",
  },

  preferences: {
    languageLabel: "Idioma",
    selectLanguage: "Seleccionar idioma",
    closeLanguages: "Cerrar",
    partlyTranslated:
      "Este idioma aún se está traduciendo. Los menús, las etiquetas y los títulos ya están en él; las explicaciones más largas siguen en inglés.",
    themeLabel: "Tema",
    themeSystem: "Sistema",
    themeLight: "Claro",
    themeDark: "Oscuro",
    rangeLabel: "Preferencias de rango",
    rangeIntro:
      "El horizonte, la anchura y el depósito con los que se abre cada pool. Un enlace que trae los suyos sigue teniendo prioridad, y el formulario bajo cada análisis cambia solo esa página.",
    rangeSave: "Guardar",
    rangeReset: "Olvidar",
  },

  disclaimer: {
    ariaLabel: "Aviso importante",
    title: "Herramienta educativa — no es asesoramiento financiero.",
    body: "Esta aplicación explica la mecánica de Uniswap y ayuda a razonar sobre la elección de parámetros. No predice precios, no garantiza rendimientos y no puede verificar que un contrato inteligente sea seguro. Aportar liquidez conlleva riesgos reales, incluidas la pérdida impermanente y la pérdida total de los fondos. Verifique siempre las direcciones de los contratos e investigue por su cuenta.",
  },

  home: {
    badge: "Base inicial",
    title: "LiquidityWise",
    introBeforeV3: "Un asesor educativo para Uniswap ",
    introBetween: ", en camino hacia ",
    introAfterV4:
      ". Encuentre un pool por su par, lea un rango de precios deducido de cuánto se ha movido realmente ese par, y obtenga una explicación en lenguaje llano. Cada cifra se calcula y se contrasta antes de que un modelo pueda describirla — y al modelo nunca se le permite enunciar ninguna.",
    workingTodayHeading: "Lo que ya funciona",
    workingTodayBody:
      "Busque un pool por su par, o pegue la dirección de un pool v3 o el id de un pool v4. Obtendrá la configuración verificada del pool y su estado actual, el último mes de precios diarios dibujado contra un rango sugerido, cuánto se ha movido realmente el par, y el rango que se deriva de ello — con el horizonte y la amplitud a su elección. Junto a eso: lo que el pool cobró y lo que realmente recaudó, cómo se situaron sus días recientes respecto al rango, qué habría dado el mismo método en días que nunca vio, qué cede una posición frente a simplemente mantener, qué habría hecho en su lugar cada una de las otras amplitudes, y — para un depósito cuyo tamaño usted fija — qué parte habría tomado de las comisiones cobradas los días en que el precio permaneció dentro del rango. Y el mismo rango leído al revés: cada una de sus mitades es una posición de un solo lado, y la página dice a qué precio convertiría cada una si el precio la atravesara. Lo que cuesta un intercambio a través del pool, para el mayor que puede valorarse sin suponer nada. Y un directorio de todos los hooks que nombran los pools v4 más activos de la semana, con lo que a cada uno se le permite hacer, leído de su propia dirección. Un pool v4 también dice, en palabras llanas, qué se le permite hacer a su hook, leído de la dirección del propio hook. Una dirección puede consultarse para ver los pools a los que pueden ir sus tokens, y las posiciones de Uniswap que ya tiene — cada una con los precios que cubre y si el pool está ahora dentro de ellos. Después, una explicación de todo ello en lenguaje llano. Ningún modelo toca ninguna de esas cifras, ninguna se estima para tapar un hueco, y el texto no tiene dónde poner un número propio.",
    analysePool: "Buscar un pool →",
    methodHeading: "Cómo funciona",
    methodSteps: [
      {
        step: "Datos verificados",
        detail:
          "Los datos del pool se obtienen de los subgraphs de Uniswap y se leen en la cadena, nunca se suponen. El precio se contrasta con el estado que el propio pool declara.",
      },
      {
        step: "Matemática determinista",
        detail:
          "La volatilidad, la banda de precios y el rango de la posición se calculan en TypeScript corriente, de modo que el mismo pool siempre da las mismas cifras.",
      },
      {
        step: "Interpretación por IA",
        detail:
          "Un modelo explica qué significan esas cifras. Se le entregan ya verificadas, y el contrato bajo el que responde no deja sitio para un número.",
      },
    ],
    coverageHeading: "Todavía no construido",
    coverage: [
      {
        version: "Uniswap v3",
        features: [
          {
            name: "El gas y lo que cuesta seguir al precio",
            summary:
              "Un rango que el precio ha abandonado hay que cerrarlo y volver a abrirlo para seguirlo, lo que cuesta gas y convierte una divergencia sobre el papel en una ya realizada. Nada de eso se contabiliza aquí en ningún sitio.",
          },
        ],
      },
      {
        version: "Uniswap v4",
        features: [
          {
            name: "Qué hace realmente un hook",
            summary:
              "Una página v4 dice qué se le permite hacer a un hook, porque hasta ahí lo impone el protocolo y se lee de la propia dirección del hook. Leer el contrato para decir qué hace con esos permisos es otro problema, y esta aplicación no lo intenta.",
          },
          {
            name: "Estrategias al estilo TWAMM",
            summary:
              "Repartir una orden grande en el tiempo en lugar de ejecutarla contra un único punto de liquidez. La mitad de esto que una página de análisis ya puede responder está aquí: lo que cuesta un intercambio contra la liquidez al precio actual, y hasta qué tamaño puede valorarlo siquiera. Programarlo en el tiempo es tarea de un hook, y esta aplicación no modela el comportamiento de un hook.",
          },
        ],
      },
    ],
    footer:
      "Nada de lo anterior existe todavía. Lo que sí existe es todo lo que hay más arriba en esta página: un pool encontrado por su nombre, cifras calculadas y contrastadas, y texto verificado antes de mostrarse. Se puede conectar una cartera, y lo único que se le pide es su dirección. Lo único que guarda esta aplicación es un enlace de Telegram que el propio lector crea — una dirección junto a un identificador de chat, borrado en cuanto envía /stop al bot y fuera de las copias de seguridad cifradas en un plazo de siete días — y nada de esto puede firmar ni enviar una transacción en tu nombre.",
  },

  pool: {
    back: "← LiquidityWise",
    invalidAddress:
      "Eso no es una dirección de Ethereum. Una dirección es 0x seguido de exactamente 40 caracteres hexadecimales.",
    loading: "Leyendo datos de Uniswap en vivo…",
  },

  activity: {
    heading: "Lo que el pool hizo realmente",
    volume24h: "Volumen, 24 h",
    volume7d: "Volumen, 7 días",
    volume30d: "Volumen, 30 días",
    fees30d: "Comisiones cobradas, 30 días",
    feesNote: "Las del pool entero, repartidas entre todos cuya liquidez estuvo activa.",
    tvl: "Valor total bloqueado",
    occupancySentence: (days: string, inside: string, outside: string, crossed: string) =>
      `De los últimos ${days} días, ${inside} se mantuvieron enteramente dentro de este rango, ${outside} quedaron enteramente fuera, y ${crossed} cruzaron un borde.`,
    undeterminedNote:
      "Un día que cruzó un borde pasó parte de sí dentro y parte fuera, y el máximo y el mínimo diarios de la fuente no pueden decir cuánto de cada cosa.",
    feesWhileInside: "Comisiones cobradas los días enteramente dentro",
    feesWithheld: "No se muestra para este pool",
    feesWithheldNote:
      "Al hook de este pool se le permite tomar una parte de un intercambio, y nada en la fuente separa la parte del hook de la de los proveedores de liquidez. Las comisiones de arriba son lo que el pool cobró, y eso es un hecho; atar una porción de ellas a este rango sería una afirmación sobre una posición que nadie puede comprobar.",
    inSample:
      "Estos son los mismos días con los que se trazó el rango, así que muestran cómo se ajustó y no ponen a prueba cómo se sostiene — y el rango está centrado en el precio de hoy, que nadie pudo haber abierto hace un mes. Léalos como la relación entre el movimiento reciente del pool y el rango, no como una prueba retrospectiva.",
    notYourEarnings:
      "Nada de esto es lo que ganaría una posición: es lo que cobró el pool entero. Lo que un depósito habría tomado de ello — su parte de la liquidez activa mientras ocurrían los intercambios — es el panel justo debajo, y aun eso son comisiones y nada más.",
  },

  deposit: {
    heading: "Lo que habría recaudado un depósito",
    unavailable:
      "Lo que un depósito habría tomado de esas comisiones no puede calcularse para este pool.",
    withheldNote:
      "Por la misma razón que la cifra de encima: aquí un hook puede tomar parte del intercambio, y nada en la fuente separa su parte de la de los proveedores. Una fracción de un total que no puede atribuirse a este rango tampoco puede atribuirse a un depósito en él.",
    deposited: "Depósito",
    depositedNote: "El tamaño para el que está calculado. Cámbielo en el formulario de arriba.",
    collected: "Comisiones que habría tomado",
    collectedNote: (days: string) => `A lo largo de los ${days} días en que el precio nunca salió del rango.`,
    ofDeposit: "Sobre el depósito",
    ofDepositNote:
      "Esas comisiones frente al dinero aportado, en esos días y en ningún otro. No es una tasa anual, y nada aquí la convierte en una.",
    sentence: (deposit: string, days: string, poolFees: string, yourFees: string) =>
      `En los ${days} días en que el precio nunca salió de este rango, el pool cobró ${poolFees} en comisiones. Un depósito de ${deposit} colocado en el rango habría tomado alrededor de ${yourFees} de eso — su propia liquidez como parte de la liquidez que estuvo realmente activa cada uno de esos días.`,
    unmeasurableNote: (days: string) =>
      `Otros ${days} días quedaron dentro del rango, pero la fuente no publicó comisiones ni liquidez activa para ellos, así que no están en el total.`,
    dilution:
      "Un depósito mayor no recauda proporcionalmente más. La parte es su liquidez sobre la de todos, la suya incluida, así que pasado cierto tamaño la mayor parte de lo que añade diluye lo que ya tenía — por eso las cantidades ofrecidas se separan por mil veces.",
    caveat:
      "Solo comisiones, y solo días que ya ocurrieron. Supone que la posición estuvo abierta todos y cada uno de ellos y que nada se movió como reacción a ella, y no dice nada sobre lo que pagarán los próximos treinta días. Lo que una posición cede frente a simplemente mantener los dos tokens es la comparación más abajo en esta página, y ambas han de leerse juntas.",
  },

  realizedFee: {
    heading: "Lo que cobró realmente",
    intro:
      "La comisión que el pool declara es un número. Esto es lo que los intercambiadores pagaron realmente, dividido a partir de los mismos días que las cifras de arriba: las comisiones de un día sobre el volumen de ese día. No necesita ninguna petición adicional ni nada del hook.",
    declared: "Comisión declarada",
    statedNote: (lp: string, protocol: string) =>
      `${lp} para los proveedores de liquidez y ${protocol} para el protocolo, combinados como los cobra el PoolManager — que es lo que paga quien intercambia, y de lo que están hechas las comisiones de arriba.`,
    noDeclared: "Ninguna",
    noDeclaredNote: "La clave de este pool no lleva comisión. Su hook fija una por intercambio.",
    median: "Día típico",
    spread: "Del día más bajo al más alto",
    spreadValue: (lowest: string, highest: string) => `${lowest} – ${highest}`,
    aggregate: "Ventana completa",
    aggregateNote:
      "Las comisiones de la ventana sobre su volumen, de modo que un día movido cuenta más que uno tranquilo.",
    daysMeasured: "Días medidos",
    daysMeasuredNote: (skipped: string) =>
      `Otros ${skipped} día(s) de la ventana no negociaron nada, o les faltaba una cifra, así que no pudo dividirse ninguna tasa a partir de ellos.`,
    verdictMatches:
      "Coinciden todos los días medidos. La tasa declarada es la tasa que se cobró.",
    verdictDiffers: (differing: string, measured: string) =>
      `No coinciden. En ${differing} de ${measured} días medidos el pool cobró algo distinto de su tasa declarada, así que el nivel de arriba describe con qué se creó el pool y no lo que cuesta un intercambio.`,
    verdictNoneDeclared:
      "No hay nada con qué comparar: este pool no declara tasa alguna. Las cifras de aquí son lo que su hook fijó realmente.",
    notLpShare:
      "Nada de esto es lo que llega a un proveedor de liquidez. Al hook de este pool se le permite tomar parte de un intercambio, y la fuente no separa la parte del hook de la de los proveedores. Lo que dicen estas cifras es cuánto costó un intercambio, no quién lo recibió.",
    unavailableHeading: "No pudo medirse lo que cobra este pool",
  },

  outOfSample: {
    heading: "Probado en días que nunca vio",
    showFolds: "Mostrar cada tramo",
    intro: (horizon: string) =>
      `Todas las cifras de arriba están ajustadas a los días que describen. Estas no. El método se retrocedió ${horizon}, se ejecutó de nuevo solo con los precios anteriores a ese punto, y se centró en el precio de ese punto — uno que alguien situado allí habría visto de verdad. Después se superpuso a los días siguientes, y todo ello se repitió hacia atrás en el historial tantas veces como hubo espacio.`,
    folds: "Tramos",
    foldsNote: "Cuántas veces el historial tuvo espacio para ajustar una banda y luego probarla.",
    fullyInside: "Días enteramente dentro",
    fullyOutside: "Días enteramente fuera",
    undetermined: "Días que cruzaron un borde",
    verdict: (inside: string, measured: string, folds: string) =>
      `A lo largo de ${folds} tramos, ${inside} de ${measured} días se mantuvieron enteramente dentro de la banda que este método habría trazado.`,
    foldPeriod: "Días comprobados",
    foldVolatility: "Volatilidad ajustada",
    foldVerdict: "Dentro / fuera / cruzados",
    foldsCaption: "Cada tramo sobre el que se probó el método, del más antiguo al más reciente",
    foldColumns:
      "Cada fila es un tramo: los días sobre los que se comprobó, la volatilidad que midió su propio ajuste — no la cifra de arriba — y cómo se situaron esos días respecto a la banda que produjo ese ajuste.",
    notIndependent:
      "Unos pocos tramos en un solo pool no son una medida de con qué frecuencia se sostiene el método, y no dicen nada sobre lo que pasará después. Además, los ajustes consecutivos se solapan — un ajuste de 31 cierres es más largo que un paso de un horizonte — así que los tramos no son independientes entre sí.",
    notHeld:
      "Nadie mantuvo estas bandas. Cada una es lo que el método habría sugerido en ese momento, superpuesto a precios que después ocurrieron — y los días de arriba, de los que se trazó el rango sugerido, no son estos días.",
    unavailableHeading: "Este pool no pudo comprobarse fuera de muestra",
  },

  divergence: {
    heading: "Comparado con simplemente mantener",
    intro:
      "Lo que valdría una posición en este rango comparada con simplemente mantener los dos tokens, a cada precio. Aritmética exacta y no una estimación — pero cuenta el movimiento del precio y nada más. No dice nada sobre las comisiones que ganaría una posición, y las comisiones son precisamente lo que se le paga a un proveedor de liquidez por esta diferencia.",
    price: (base: string) => `Precio de ${base}`,
    loss: "Posición frente a mantener",
    entryRow: "El precio desde el que se mide esto — el precio actual del pool.",
    impermanentNote:
      "Esto es lo que se suele llamar pérdida impermanente. Solo es impermanente si el precio vuelve: una posición cerrada a un precio distinto de aquel al que se abrió ya la ha realizado.",
  },

  rangeOrder: {
    heading: "Vender y comprar a través del rango",
    intro:
      "El rango de arriba tiene dos lados: dinero a ambos lados del precio, ganando comisiones mientras el precio se quede entre ellos. Divídalo por el precio y cada mitad es un instrumento distinto. Una posición situada enteramente por encima del precio mantiene un solo token, y el pool vende ese token por el otro conforme el precio sube por la banda. Por debajo del precio hace lo contrario. Eso es una orden de rango, y ambas mitades de este rango lo son.",
    selling: (token: string) => `Vendiendo ${token}`,
    buying: (token: string) => `Comprando ${token}`,
    band: "Banda",
    bandNote:
      "Dónde se sitúa la posición. Su borde interior es el primer escalón de precio pasado aquel en el que está el precio, de modo que empieza sin nada de aquello en lo que va a convertir.",
    average: "Precio medio",
    averageNote: "A cuánto sale la conversión, si el precio cruza la banda entera.",
    against: "Frente al precio actual",
    exact:
      "Esa media es la media geométrica de los dos límites — exactamente, y en cualquiera de los dos sentidos en que se escriban los precios. Se deduce de las propias fórmulas del protocolo sobre lo que una posición mantiene en cada extremo de su banda, y la cantidad aportada se cancela: cien dólares y un millón convierten al mismo precio.",
    onlyIfThrough:
      "Y solo si el precio cruza la banda entera. Uno que se dé la vuelta dentro deja a la posición con algo de cada token, a ningún precio único — que es justo aquello para lo que sirve el rango de arriba, alcanzado por accidente.",
    notAnOrderBook:
      "Nada aquí programa la conversión y nada la garantiza. Esto no es un libro de órdenes: una orden que el precio nunca alcanza es el desenlace corriente y no un fallo, y no hay cola ni contraparte esperando. Lo que sí hay es que la posición cobra las comisiones del pool mientras el precio está dentro de la banda, en lugar de pagarlas.",
    unavailable: "Este rango no tiene ninguna mitad de un solo lado que describir.",
  },

  swapDepth: {
    heading: "Lo que cuesta un intercambio aquí",
    intro:
      "Todo lo anterior trata de aportar liquidez. Esto trata de usarla. La liquidez de un pool es constante entre los escalones de precio sobre los que está construido, así que un intercambio que se quede dentro del escalón en el que está el precio puede valorarse con las propias fórmulas del protocolo sin suponer nada — y uno que vaya un escalón más allá no, porque ahí puede empezar la liquidez de otra posición y esta aplicación no lee la liquidez a cada precio.",
    selling: (token: string) => `Vendiendo ${token} al pool`,
    amount: (amount: string, symbol: string) => `${amount} ${symbol}`,
    largest: "Mayor intercambio valorable aquí",
    largestNote:
      "Lo que entra antes de que el precio llegue al final del escalón en el que está. No es un límite: un intercambio mayor funciona, y esta página no puede decir cuánto cuesta.",
    cost: "Lo que cede",
    costNote: "A qué distancia queda la media del intercambio respecto al precio en pantalla.",
    oneSideOnly:
      "Solo se muestra una dirección. El precio está tan cerca del final de su escalón que el margen en el otro sentido es un error de redondeo más que un intercambio, y esta página no imprime una cifra que no puede comprobar.",
    geometric:
      "Esa media es la media geométrica del precio de ahora y del precio al que termina el intercambio — la misma identidad en la que se apoyan las posiciones de un solo lado de arriba, vista desde el otro lado de la operación. Un intercambio que cruza una banda la paga; una posición situada en esa banda la recibe.",
    whyItDiffers:
      "Las dos direcciones no son del mismo tamaño porque el precio está en algún punto dentro de su escalón y no en el medio. Lo que merece compararse entre pools es el tamaño en sí: es lo que este mercado absorbe antes de moverse, y es la razón por la que alguien parte una orden grande en otras pequeñas en vez de enviarla de golpe.",
    hookMayAlter:
      "El hook de este pool tiene permitido cambiar lo que cuesta un intercambio: reescribir la comisión en cada intercambio, fijar él mismo el precio del intercambio en lugar de la curva del pool, o quedarse con una parte después; el apartado del hook, más arriba, dice cuál. Las cifras de aquí son lo que cobra la curva del pool, y solo valen si el hook no interviene. Nada de lo leído aquí puede decir si lo hace.",
    unavailable: "Lo que costaría un intercambio no puede calcularse para este pool.",
  },

  compare: {
    heading: "Todos los niveles de comisión de este par, uno al lado del otro",
    intro: (pair: string) =>
      `Cada pool ${pair} de abajo se leyó con el mismo horizonte, la misma amplitud y el mismo depósito, así que sus cifras están sobre la misma base. Describen días que ya pasaron, no los que vienen. Los pools v3 van en orden de comisión y los v4 del más profundo al menos, como explica la nota de debajo; ninguno está clasificado por lo que habría ganado.`,
    depositFeesNote: (days: string) => `En los ${days} días en que el precio se quedó dentro del rango.`,
    daysInside: "Días enteros dentro del rango",
    daysInsideValue: (inside: string, measured: string) => `${inside} de ${measured}`,
    unavailable: "Este nivel no se pudo leer ahora mismo.",
    open: "Abrir el análisis completo",
    link: "Poner los niveles uno al lado del otro",
    onlyOne: (pair: string) =>
      `${pair} solo cotiza en un pool de v3, así que no hay nada que poner a su lado.`,
    readTogether:
      "Las comisiones son la mitad. Lo que un rango cede frente a simplemente mantener los dos tokens está en la página de cada pool, y las dos cosas hay que leerlas juntas.",
  },

  feeTiers: {
    heading: "Dónde más se negocia este par",
    intro: (pair: string) =>
      `${pair} se negocia en más de un nivel de comisión. Cada uno es un pool aparte con su propia liquidez, su propio historial de precios y su propio rango — las cifras de arriba describen solo este.`,
    onlyOne: (pair: string) =>
      `${pair} se negocia solo en este nivel de comisión en la red principal de Ethereum. Todo lo anterior trata del par entero, porque el par es este único pool.`,
    thisOne: "Este es el que está leyendo",
    feeTier: "Nivel de comisión",
    holds: "Contiene",
    reservesUnread: "Lo que contiene este pool no pudo leerse de la cadena.",
    open: "Analizar este nivel",
    biggerIsNotBetter:
      "Un nivel con más liquidez es una multitud mayor repartiéndose las mismas comisiones de intercambio, no un sitio mejor. Cuál conviene a una posición depende de cuánto se mueve el precio y con qué frecuencia, y eso se mide pool por pool — así que la forma honesta de compararlos es abrir cada uno y leer sus propias cifras. El horizonte y el multiplicador que eligió viajan con el enlace.",
    reservesNote:
      "Estos son los saldos que los dos contratos de token declaran para cada pool, leídos de la cadena y no de un indexador. La cifra propia del indexador se midió contra ellos y exagera lo que hay entre 1,3 y 13 veces, así que no se muestra. Dos cantidades de token en lugar de una cifra en dólares, porque cada nivel aquí contiene los mismos dos tokens y no hace falta valorar nada para compararlos.",
    unavailableHeading: "No pudieron leerse los demás niveles de comisión del par",

    onV3: "En Uniswap v3",
    onV4: "En Uniswap v4",
    v4Intro: (pair: string) =>
      `Los pools v4 que negocian ${pair} — los mismos dos contratos. Un par en v4 puede ser muchos pools: la comisión es cualquier número, el escalón de precio es libre, y cada hook crea otro.`,
    v4None: (pair: string) => `Ningún pool de Uniswap v4 negocia ${pair} con estos dos contratos.`,
    v4OnlyThis: (pair: string) => `En v4, ${pair} se negocia solo en este pool.`,
    v3Intro: (pair: string) =>
      `Los pools v3 que negocian ${pair} — los mismos dos contratos de token, en cada nivel de comisión.`,
    v3None: (pair: string) => `Ningún pool de Uniswap v3 negocia ${pair} con estos dos contratos.`,
    v3NoNative:
      "Este pool contiene el ether propio de la cadena, y v3 no puede: toda moneda en v3 es un contrato de token. Sus pools v3 más cercanos negocian ether envuelto, que para un pool es un token distinto.",
    depth: "Profundidad al precio actual",
    depthValue: (ether: string) => `≈ ${ether} ETH`,
    stateUnread: "La liquidez del pool no pudo leerse de la cadena.",
    hook: "hook",
    noHook: "sin hook",
    hookAltersSwaps: "puede cambiar lo que cuesta un intercambio",
    priceStep: (step: string) => `escalón ${step}`,
    v4Ordering:
      "Ordenados por profundidad al precio actual — la liquidez activa y el precio del pool, leídos del almacenamiento del PoolManager — porque un par en v4 son en su mayoría pools que alguien inicializó y dejó, y la profundidad es lo que los distingue. Dice de cuánto puede tirar un intercambio, y nada sobre qué pool es mejor: un pool más profundo es una multitud mayor repartiéndose las mismas comisiones.",
    moreNotShown: (count: string) => `${count} más no se muestran; son menos profundos que estos.`,
    v4Unavailable: "No pudieron leerse los pools v4 del par",
    v3Unavailable: "No pudieron leerse los pools v3 del par",
  },

  widths: {
    heading: "Las otras amplitudes",
    intro:
      "El mismo método en cada amplitud que ofrece el formulario, para que el compromiso pueda verse en lugar de contarse: un rango más ancho retiene más días, y reparte el mismo depósito sobre más precios — que es la última columna, y es la aritmética del protocolo y no una estimación.",
    width: "Amplitud",
    range: "Rango",
    recent: (days: string) => `Dentro, de los últimos ${days} días`,
    unseen: "Dentro, en días que nunca vio",
    insideOf: (inside: string, total: string) => `${inside} de ${total}`,
    unseenNone: "historial insuficiente",
    feeShare: "Parte de las comisiones mientras está dentro",
    feeShareValue: (times: string) => `${times}×`,
    chosen: "mostrado arriba",
    columnsNote:
      "La primera cuenta abarca los días con los que se trazó cada rango, así que dice cómo se ajustó esa amplitud, no cómo se sostuvo. La segunda es la comprobación de arriba, ejecutada para cada amplitud: el método retrocedido un horizonte y superpuesto a los días siguientes.",
    feeShareNote:
      "La última columna es lo que el mismo depósito tomaría de las comisiones cobradas en un día en que el precio se queda dentro de ese rango, frente a la amplitud mostrada arriba — por eso esa aparece como uno. Es la propia aritmética de posiciones del protocolo y no una estimación: un rango más estrecho convierte el mismo dinero en más liquidez sobre menos precios. Supone que el resto de la liquidez del pool no cambia, lo que un depósito lo bastante grande como para moverla no dejaría cierto, y no dice nada sobre los días que el precio pasa fuera.",
    notAdvice:
      "Ninguna de estas es una recomendación. Un rango más estrecho toma una parte mayor los días que aguanta y absolutamente nada los días que no, y cuál de las dos cosas pesa más depende de para qué sirve la posición — cosa que aquí nada sabe.",
  },

  parameters: {
    heading: "Cambiar el rango",
    apply: "Recalcular",
    horizonLabel: "Hasta cuándo",
    widthLabel: "Qué amplitud",
    depositLabel: "Cuánto",
    days: (days: string) => `${days} días`,
    sigma: (value: string) => `${value}σ`,
    widthChoice: (sigma: string, word: string | null) => (word === null ? sigma : `${word} (${sigma})`),
    widthWords: { tight: "Estrecho", medium: "Medio", wide: "Amplio", veryWide: "Muy amplio" },
    note: "El horizonte dice hasta dónde se proyecta hacia adelante el movimiento medido. No cambia la medición: la volatilidad siempre sale de los últimos 30 días completos, sea cual sea el horizonte elegido. La amplitud multiplica ese movimiento; un rango más ancho se abandona menos a menudo, y no es un nivel de confianza.",
    fellBack:
      "Parte de lo solicitado no pudo leerse, así que ahí se usó el valor por defecto. El horizonte y la amplitud realmente usados se muestran arriba.",
    preferenceHint:
      "Esto cambia solo esta página. Para cambiar con qué se abre cada pool, usa las preferencias de rango de la cabecera.",
  },

  holdings: {
    heading: "Lo que tiene esta dirección",
    intro:
      "Los tokens encontrados en esta dirección, y los pools a los que pueden ir. Nada de esto se guarda salvo que pidas avisos por Telegram más abajo, y la dirección es información pública — la misma lista la ve cualquiera que la consulte.",
    forAddress: "Dirección",
    loading: "Preguntando a los contratos de token qué tiene esta dirección…",
    howItLooked: (tokens: string, v3Pools: string, v4Pools: string | null) =>
      `El saldo de un token vive dentro del contrato del propio token, así que no existe una lista de lo que posee una dirección — solo tokens a los que se puede preguntar, de uno en uno. Aquí se preguntó a ${tokens} de ellos: todos los tokens de los ${v3Pools} pools de Uniswap v3 más negociados en la red principal de Ethereum${v4Pools === null ? "" : `, y todas las monedas de los ${v4Pools} pools v4 que más se negociaron en los últimos siete días, el ether propio de la cadena entre ellas`}. Algo que se tenga fuera de ese conjunto no falta en esta página porque la dirección no lo tenga.`,
    v4NotSearched:
      "No se buscaron pools de Uniswap v4: su lista no pudo leerse. El ether y las monedas de los pools v4 faltan en esta página por esa razón y por ninguna otra.",
    hookTag: "hook",
    holdingsHeading: "Tokens encontrados",
    nothingFound:
      "Ninguno de los tokens comprobados se encontró en esta dirección. Eso no es lo mismo que una cartera vacía — vea arriba cómo se hizo la búsqueda.",
    poolsHeading: "Pools a los que pueden ir estos tokens",
    bothSides: "Tiene los dos lados",
    oneSide: "Tiene un lado",
    bothSidesNote:
      "Los dos tokens de este pool se encontraron en la dirección, así que una posición aquí no necesita ningún intercambio previo.",
    oneSideNote:
      "Se encontró uno de los dos tokens de este pool. Una posición aquí necesita también el otro lado, lo que implica intercambiar parte de lo que tiene.",
    moreNotShown: (count: string) =>
      `${count} más no se muestran. Los de arriba son los más negociados de ellos, en el orden que declara la fuente de datos — que es una afirmación sobre cuánto se mueve un pool y sobre nada más.`,
    analyse: "Analizar este pool",
    notAdvice:
      "Esta es una lista de lo que es posible, no de lo que merece la pena. Cuál de estos pools conviene a algo depende de las cifras de la página de cada pool y de para qué sirve una posición — y esta lista no sabe ninguna de las dos cosas.",
    unavailableHeading: "Esta dirección no pudo leerse",
    invalidAddress: "Eso no es una dirección de Ethereum, así que no se consultó nada.",
    noAddress: "Conecte una cartera en la página principal y esta página mostrará lo que tiene.",
  },

  v4: {
    heading: "Un pool de Uniswap v4",
    intro:
      "Qué es este pool, leído de su propia clave. Un pool v4 no es un contrato propio: vive dentro de un PoolManager y se nombra mediante un hash de las cinco cosas que lo definen — las dos monedas, la comisión, el escalón de precio y el hook.",
    poolId: "Id del pool",
    pair: "Monedas",
    fee: "Comisión",
    feeNote: (swap: string, lp: string, protocol: string) =>
      `Leída de la propia clave del pool en la cadena. Un intercambio paga ${swap}: de ello ${lp} a los proveedores de liquidez, y ${protocol} al protocolo por encima.`,
    feeNoteNoProtocol:
      "Leída de la propia clave del pool en la cadena. El protocolo no se lleva nada por encima, así que esto es lo que paga un intercambio.",
    dynamicFee: "Fijada por el hook, en cada intercambio",
    dynamicFeeNote:
      "La clave de este pool lleva la marca de comisión dinámica en lugar de una comisión, así que lo que cuesta un intercambio lo decide el hook en el momento en que ocurre. Esta lectura no observó ninguno, y aquí no hay comisión que declarar.",
    feeUnread: "comisión no leída",
    feeUnreadNote:
      "La comisión del pool vive en la clave con la que se creó, en la cadena, y esta lectura no pudo obtenerla. Ninguna otra cosa la sustituye.",
    protocolFee: "Comisión del protocolo",
    protocolFeeNone: "Ninguna",
    protocolFeeNote:
      "La toma el protocolo por encima de la comisión del pool, en cada intercambio. La fija la gobernanza, y se lee del estado del pool en la cadena.",
    protocolFeeByDirection: (token0: string, token1: string) =>
      `Difiere según la dirección: la primera cuando se vende ${token0}, la segunda cuando se vende ${token1}.`,
    priceStep: "Escalón de precio",
    priceStepNote: (spacing: string) =>
      `El escalón más fino en el que pueden colocarse los bordes de una posición en este pool — su separación de ticks de ${spacing}. En v4 forma parte de la clave del pool, así que a diferencia de v3 no necesita una llamada aparte al contrato.`,
    nativeCurrency: "Ether nativo",
    nativeCurrencyNote:
      "La dirección cero aquí no es un campo que falte. v4 permite que un pool contenga el ether propio de la cadena en lugar de un token envuelto, y eso es lo que ocurre aquí.",
    hookHeading: "El hook",
    noHook: "Este pool funciona sin hook.",
    noHookNote:
      "No se ejecuta nada junto a sus intercambios ni a sus depósitos, así que se comporta como un pool v3.",
    hookMay: "Lo que se le permite hacer",
    permissionTopics: {
      swaps: "En torno a los intercambios",
      liquidity: "En torno a depósitos y retiradas",
      creation: "Cuando se creó el pool",
      donations: "En torno a las donaciones",
    } satisfies Record<HookTopic, string>,
    permissionWords: {
      beforeSwap:
        "Se ejecuta antes de cada intercambio, donde puede rechazarlo y, en un pool con comisión dinámica, fijar lo que paga ese intercambio.",
      afterSwap: "Se ejecuta después de cada intercambio, donde todavía puede rechazarlo.",
      beforeSwapReturnsDelta:
        "Saca tokens de un intercambio, o pone los suyos, antes de que el pool lo valore — así que un intercambio aquí no tiene por qué seguir la curva del propio pool.",
      afterSwapReturnsDelta: "Toma una parte de un intercambio después de que el pool lo haya valorado.",
      beforeAddLiquidity: "Se ejecuta antes de cada depósito, donde puede rechazarlo.",
      afterAddLiquidity: "Se ejecuta después de cada depósito, donde todavía puede rechazarlo.",
      afterAddLiquidityReturnsDelta:
        "Toma tokens de un depósito según se hace, o le añade tokens.",
      beforeRemoveLiquidity: "Se ejecuta antes de cada retirada, donde puede rechazarla.",
      afterRemoveLiquidity: "Se ejecuta después de cada retirada, donde todavía puede rechazarla.",
      afterRemoveLiquidityReturnsDelta:
        "Toma una parte de una retirada según se hace, o le añade tokens.",
      beforeInitialize: "Se ejecutó una vez, antes de crearse el pool. Eso ya ha ocurrido.",
      afterInitialize: "Se ejecutó una vez, después de crearse el pool. Eso ya ha ocurrido.",
      beforeDonate:
        "Se ejecuta antes de una donación a los proveedores del pool, donde puede rechazarla.",
      afterDonate:
        "Se ejecuta después de una donación a los proveedores del pool, donde todavía puede rechazarla.",
    } satisfies Record<HookPermission, string>,
    noPermissions:
      "Nada en torno a intercambios, depósitos ni donaciones: el protocolo no lo llama en ninguno de esos momentos. Lo que un hook así todavía puede hacer es fijar la comisión de un pool cuya comisión es dinámica.",
    permissionNames: "Los nombres que el propio protocolo les da",
    withdrawalWarning: (share: boolean): string =>
      share
        ? "Este hook se ejecuta cuando un proveedor retira. Se le permite rechazar una retirada y tomar una parte de lo retirado. Si alguna vez lo hace no puede saberse desde aquí."
        : "Este hook se ejecuta cuando un proveedor retira, y se le permite rechazar una retirada. Si alguna vez lo hace no puede saberse desde aquí.",
    hookAddressIsThePermission:
      "Esto se lee de la propia dirección del hook. v4 no guarda los permisos de un hook en ninguna parte: un hook se despliega en una dirección cuyos últimos catorce bits deletrean qué llamadas invocará el PoolManager, y el PoolManager comprueba esos bits en lugar de preguntar al contrato. Así que esto dice lo que el hook puede hacer, nunca lo que hace — uno al que se le permite reescribir la comisión en cada intercambio puede devolver siempre la misma comisión, y eso no puede saberse desde aquí.",
    alterSwapWarning:
      "A este hook se le permite cambiar lo que cuesta o lo que paga un intercambio. Cualquier cifra extraída del historial de precios — un rango sugerido, un nivel de comisión, una comparación con simplemente mantener — supone que el pool cobra lo que dice y paga lo que dice la curva. Ninguna de las dos suposiciones es segura aquí, y nada de ello es visible en una serie de precios.",
    analysisScope:
      "Debajo está el análisis de rango. El rango procede de precios que ya ocurrieron, así que se sostiene aquí exactamente igual que en un pool sin hook — un hook no puede cambiar retroactivamente por dónde fue el precio. Lo que un hook sí puede cambiar es lo que cuesta un intercambio, así que la tasa que este pool cobró se mide a partir de lo que recaudó en lugar de tomarse de la comisión de arriba.",
    unavailableHeading: "Este pool no pudo leerse",
    invalidId:
      "Eso no es un id de pool v4. Un pool v4 se nombra mediante un hash de 32 bytes — 0x seguido de 64 caracteres hexadecimales — no mediante una dirección de contrato.",
    noId: "Pegue un id de pool v4 para ver qué es el pool y qué puede hacer su hook.",
    loading: "Leyendo este pool v4, del indexador y de la cadena…",
  },

  notFound: {
    title: "Aquí no hay ninguna página",
    body: "La dirección que ha seguido no nombra nada que esta aplicación sirva. A un pool se llega por su dirección o, en v4, por su id — y ambos van en el cuadro de búsqueda, no en la ruta.",
    search: "Buscar un pool →",
  },

  hooks: {
    heading: "Los hooks que funcionan en Uniswap v4",
    loading: "Leyendo los pools v4 más activos de esta semana…",
    intro:
      "Todo pool v4 puede nombrar un hook: un contrato al que el PoolManager llama en momentos fijos de un intercambio, un depósito, una retirada. Qué momentos no es una promesa que haga nadie. Está minado en la dirección del hook — los catorce bits más bajos son la lista, y el protocolo se niega a llamar al contrato para cualquier cosa fuera de ella.",
    onlyPermissions:
      "Eso es todo lo que esta página sabe, y merece saberse precisamente porque se impone en lugar de afirmarse. Lo que un hook hace con un permiso está en su código. Esta aplicación no lee código, y no mantiene ninguna lista de hooks por los que alguien haya respondido — ambas cosas serían una afirmación que no podría comprobar, junto a cifras que sí puede.",
    window: (pools: string, hooked: string, hookless: string) =>
      `Leído de los pools de los días v4 más activos de esta semana — ${pools} de ellos. ${hooked} nombran un hook; ${hookless} no nombran ninguno, y se comportan como un pool v3.`,
    ordering:
      "Ordenados por cuántos de esos pools usan cada hook. Eso es un recuento de pools y nada más: un hook en muchos de ellos es un hook con el que alguien desplegó muchos pools.",
    runs: (count: string) => `Funciona en ${count} de ellos`,
    poolsHeading: "Dónde funciona",
    moreNotShown: (count: string) => `y ${count} más`,
    none: "Ningún pool de los días v4 más activos de esta semana nombra un hook.",
    unavailable: "Los pools v4 de la semana no pudieron leerse, así que no hay directorio que mostrar.",
    fromHome: "Ver todos los hooks →",
  },

  positions: {
    heading: "Posiciones que ya tiene esta dirección",
    intro:
      "Todo lo anterior es lo que esta dirección podría hacer — qué pools abren sus tokens. Esto es lo que ya ha hecho. Una posición de cualquiera de los dos protocolos es un token que guarda un contrato, y a ambos contratos se les pregunta qué es cada token. El de v3 además puede enumerar los tokens de una dirección; el de v4 no, así que esa lista viene de un indexador y cada id de ella se devuelve a la cadena, a la que se pregunta de quién es.",
    none: "Esta dirección no tiene ningún token de posición de Uniswap, de ninguno de los dos protocolos.",
    noneOpen:
      "Todos los tokens de posición que tiene esta dirección están cerrados. Uno cerrado es el recibo de una posición que hubo, no una posición.",
    counts: (held: string, open: string, closed: string) =>
      `${held} tokens de posición, de los cuales ${open} todavía tienen liquidez y ${closed} están cerrados.`,
    inRange: "Ganando ahora",
    outOfRange: "Fuera de su rango",
    rangeUnknown: "Aquí nadie ha intercambiado",
    analyse: "Analizar este pool →",
    feesEarned: (amount0: string, symbol0: string, amount1: string, symbol1: string) =>
      `Ganado y todavía sin retirar: ${amount0} ${symbol0} y ${amount1} ${symbol1}.`,
    feesNone: "Todavía no hay nada ganado que retirar.",
    feesUnread: "Lo que ha ganado no pudo leerse.",
    everyPrice: "Todos los precios que este pool puede expresar",
    moreNotShown: (count: string) => `${count} más están abiertas y no figuran aquí.`,
    readCap: (read: string, held: string) =>
      `Se leyeron ${read} de ${held}. El resto no está en esta página, lo cual es un límite de la página y no de la dirección.`,
    unreadProtocol: (protocol: string) =>
      `Las posiciones de Uniswap ${protocol} no pudieron leerse esta vez, así que todas las cifras de aquí se refieren únicamente al otro protocolo.`,
    unavailable: "Las posiciones de esta dirección no pudieron leerse.",
    publicNote:
      "El dueño de una posición está en la cadena, así que esta lista es pública: cualquiera puede leer la misma para la misma dirección, y no dice nada que esta dirección no haya publicado ya al tener estos tokens. Nada de esto se guarda salvo que pidas avisos por Telegram más abajo, y ninguna cifra de esta página es una valoración — un rango no es lo que vale una posición.",
  },

  wallet: {
    heading: "Conectar una cartera",
    intro:
      "Conecte una cartera y esta página podrá ver qué tokens tiene la dirección, y mostrarle los pools a los que pueden ir esos tokens. Lee la dirección; eso es todo lo que aquí se le pide a una cartera.",
    connect: "Conectar cartera",
    connecting: "Esperando a la cartera…",
    connectedAs: "Conectado como",
    showHoldings: "Mostrar lo que tiene",
    forget: "Olvidar esta dirección",
    readOnly:
      "Solo lectura. Esta aplicación pide a la cartera su dirección y nunca una firma: no hay aquí código que pueda firmar un mensaje ni enviar una transacción, y nada sobre la cartera se guarda entre visitas.",
    notices: {
      "wallet-not-found":
        "No se encontró ninguna cartera en este navegador. Una extensión de cartera pone una; sin ella, nada en esta página cambia.",
      "wallet-request-declined":
        "La solicitud se rechazó en la cartera. No se leyó nada y no se envió nada.",
      "wallet-request-failed":
        "No se pudo pedir una dirección a la cartera. No se leyó nada y no se envió nada.",
      "wallet-no-account":
        "La cartera respondió sin dirección, lo que suele significar que está bloqueada o que no tiene ninguna cuenta seleccionada.",
    },
  },

  telegram: {
    heading: "Avisos por Telegram",
    intro:
      "Entérate por Telegram cuando una posición de esta dirección se acerque al borde de su rango, salga de él o vuelva a entrar. El botón te lleva al bot de este sitio; al pulsar Iniciar allí, ese chat queda ligado a esta dirección. Se guarda la dirección y el identificador numérico del chat — nada más — y ambos se borran del servidor en cuanto envías /stop al bot u olvidas el enlace aquí, y de sus copias de seguridad cifradas en un plazo de siete días. La frecuencia de las comprobaciones depende del servidor donde se ejecuta esto.",
    connect: "Conectar Telegram",
    connected: (address: string) => `Este navegador está enlazado: se vigila ${address}.`,
    pending: "El enlace está a la espera: abre el chat del bot en Telegram y pulsa Iniciar.",
    forget: "Olvidar el enlace",
    notConfigured: "Los avisos por Telegram no están configurados en este servidor.",
    publicNote:
      "Nadie necesita ser dueño de una dirección para seguirla — las posiciones son públicas, y un aviso no dice nada que esta lista no diga. El bot lee la cadena y envía un mensaje; no puede firmar ni enviar nada.",
    linked: (address: string) =>
      `Enlazado. Recibirás aquí un aviso cuando una posición de ${address} se acerque al borde de su rango, salga de él o vuelva. Envía /stop para terminar.`,
    unknownStart:
      "Ese enlace no se reconoce o ha caducado. Pulsa de nuevo «Conectar Telegram» en el sitio.",
    alreadyClaimed:
      "Ese enlace ya lo usó otro chat. Pulsa de nuevo «Conectar Telegram» en el sitio para obtener uno nuevo.",
    stopped: "Detenido. Este chat ya no sigue nada. El registro se ha borrado del servidor y desaparecerá de las copias de seguridad cifradas en un plazo de siete días.",
    nothingToStop: "Este chat no seguía nada.",
    help:
      "Este bot solo sigue la dirección que enlazaste en el sitio, y solo habla cuando una posición se acerca al borde de su rango, sale de él o vuelve a entrar. Envía /stop para terminar.",
    storeDown: "No se pudo comprobar el enlace ahora mismo. Inténtalo de nuevo en un minuto.",
    left: (pair: string, protocol: string, range: string) =>
      `⚠️ ${pair} (${protocol}) ha salido de su rango: ${range}. Mantiene un solo token y no gana nada hasta que el precio vuelva.`,
    nearing: (pair: string, protocol: string, range: string, price: string, edge: string) =>
      `⏳ ${pair} (${protocol}) está cerca del borde de su rango: ${range}. El precio está en ${price}; más allá de ${edge} mantiene un solo token y no gana nada.`,
    entered: (pair: string, protocol: string, range: string) =>
      `✅ ${pair} (${protocol}) vuelve a estar en su rango: ${range}. Vuelve a ganar.`,
    opened: (pair: string, protocol: string, range: string) => `Nueva posición: ${pair} (${protocol}), ${range}.`,
    closed: (protocol: string, tokenId: string) => `Cerrada: posición ${protocol} #${tokenId}.`,
    footer:
      "Solo información — no es asesoramiento financiero. Leído de datos públicos en cadena; nada de esto puede actuar por ti.",
  },

  search: {
    label: "Un par, la dirección de un pool v3 o el id de un pool v4",
    placeholder: "WETH/USDC",
    help: "Escriba un par como WETH/USDC, pegue la dirección de un contrato de pool v3, o pegue el id de un pool v4 — el hash de 32 bytes con el que se nombra un pool v4. Solo lectura: esta aplicación nunca firma nada y nunca envía una transacción.",
    submit: "Buscar pools",

    heading: "Pools de Uniswap v3 coincidentes",
    resultsFor: (terms: string) => `Pools cuyos tokens coinciden con ${terms}.`,
    empty: (terms: string) =>
      `Ningún pool de Uniswap v3 en la red principal de Ethereum tiene un token que coincida con ${terms}.`,
    emptyHint: "Revise la ortografía, o pegue la dirección del pool si la tiene.",

    v4Heading: "Pools de Uniswap v4 coincidentes",
    v4Empty: (terms: string) =>
      `Ningún pool de Uniswap v4 en la red principal de Ethereum tiene una moneda que coincida con ${terms}.`,
    v4Depth: "Profundidad al precio actual",
    v4DepthValue: (ether: string) => `≈ ${ether} ETH`,
    v4DepthNote:
      "Lo que vale ahora mismo la liquidez activa del pool, leído del propio almacenamiento del PoolManager — no lo que el pool contiene, que ningún pool v4 declara por su cuenta.",
    v4StateUnread: "La liquidez del pool no pudo leerse de la cadena.",
    v4Hook: "Hook",
    v4NoHook: "ninguno",
    v4HookAltersSwaps: "puede cambiar lo que cuesta un intercambio",
    v4Ordering:
      "Los pools que se llaman exactamente como lo que buscó van primero. Después el orden sigue la profundidad de cada pool a su precio actual — su liquidez activa y su precio, leídos del almacenamiento del PoolManager y puestos en una misma escala con los precios que deriva la fuente de datos. No lo que el pool contiene: los tokens de todos los pools v4 están juntos en un único PoolManager, y nada en la cadena los declara por pool. La cifra de liquidez del propio indexador se contrastó con la cadena y se desviaba un quince por ciento en uno de los pools más activos, y por eso no se usa.",

    ordering:
      "Los pools que se llaman exactamente como lo que buscó van primero. Después el orden sigue lo que cada pool contiene realmente, leído de los propios contratos de token y puesto en una misma escala con los precios que deriva la fuente de datos. Antes seguía el valor que la fuente declara como bloqueado en cada pool, y esa cifra estaba lo bastante equivocada como para reordenar esta lista: un pool aparecía aquí con nueve millones de dólares de liquidez declarada mientras sus contratos contenían nueve mil.",
    windowing:
      "Esta lista se extrae de los pools que la fuente de datos declara como los más negociados para sus términos, y un pool lo bastante tranquilo como para quedar fuera de ese conjunto nunca llega al orden anterior. Ese es el límite honesto de clasificar dentro de lo que una fuente decidió devolver: un pool que contiene mucho pero se negocia poco puede faltar en esta página.",
    dormantNote:
      "Un pool en el que no ha pasado nada en un mes no aparece. El rango se traza a partir del último mes de precios, y un pool sin ese mes no tiene de dónde trazarlo — abrirlo solo diría eso.",
    v4Windowing:
      "Esta lista se extrae de los pools v4 que más se negociaron en la red principal de Ethereum en los últimos siete días — los mil días-pool más activos, que son unos pocos cientos de pools — y un pool más tranquilo que eso nunca llega a esta página. La fuente no puede responder a una búsqueda en todos los pools v4 antes de que esta página deje de esperar, así que la ventana va por actividad reciente y no por sus términos: un pool que existe pero que no se ha negociado esta semana no está aquí.",
    symbolWarning:
      "Un símbolo viene del propio contrato del token, y desplegar un token que se llame USDC no cuesta nada. Las direcciones de contrato bajo cada par son lo que distingue dos tokens.",

    feeTier: "Nivel de comisión",
    holds: "Contiene",
    reservesUnread: "Lo que contiene este pool no pudo leerse de la cadena.",
    moreNotShown: (count: string) =>
      `${count} más no se muestran. Los de arriba son los más negociados de ellos, en el orden que declara la fuente de datos — que es una afirmación sobre cuánto se mueve un pool y sobre nada más.`,
    analyse: "Analizar este pool",
    v4FeeNote:
      "La comisión de cada pool se lee de la clave con la que se creó, en la cadena, y no de la fuente de datos — cuya cifra de comisión resultó ser el total que pagó el último intercambio, recorte del protocolo incluido, y no la comisión propia del pool. Una fila cuya clave no pudo leerse lo dice.",

    unavailableHeading: "La búsqueda no pudo ejecutarse",
    rejected: {
      empty: "Escriba un par como WETH/USDC, o la dirección de un pool.",
      length: (min: number, max: number) =>
        `Un término de búsqueda tiene entre ${min} y ${max} caracteres.`,
      unsupportedCharacters:
        "Un término de búsqueda puede llevar letras, dígitos y los signos que aparecen dentro de los tickers — nada más.",
    },
  },

  report: {
    steps: {
      pool: "leyendo la configuración del pool",
      snapshot: "leyendo el estado de mercado actual del pool",
      history: "leyendo el historial diario de precios del pool",
      volatility: "midiendo cuánto se ha movido el precio",
      band: "construyendo la banda de precios",
      range: "ajustando la banda a los precios que este pool puede expresar",
      divergence: "comparando ese rango con mantener los dos tokens",
      activity: "leyendo lo que el pool hizo durante la ventana medida",
    },
    noRangeHeading: "No hay rango para este pool",
    stoppedWhile: (step: string) => `Esto se detuvo ${step}.`,
    poolSummary: (protocol: string, fee: string, chain: string) =>
      `Uniswap ${protocol} · ${chain} · ${fee}`,
    feePerSwap: (fee: string) => `${fee} de comisión en cada intercambio`,
    feePlusProtocol: (fee: string, protocol: string) =>
      `${fee} de comisión en cada intercambio, más ${protocol} para el protocolo`,
    noDeclaredFee: "comisión fijada por su hook en cada intercambio",
    caveatsHeading: (count: number) =>
      count === 1
        ? "Una salvedad se aplica a estas cifras."
        : `${count} salvedades se aplican a estas cifras.`,
    caveatsAriaLabel: "Salvedades",

    contentsHeading: "En esta página",
    contentsLabel: "Las secciones de este análisis",
    rangeHeading: "Rango de precios sugerido",
    rangeIntro: (base: string, quote: string) =>
      `Dónde estaría activa una posición en este pool, como precio de un ${base} en ${quote}.`,
    rangeValue: (lower: string, upper: string, quote: string, base: string) =>
      `${lower} – ${upper} ${quote} por ${base}`,
    rangeDistances: (down: string, up: string) =>
      `${down} por debajo y ${up} por encima del precio actual.`,
    rangeMeaning:
      "Entre estos dos precios una posición gana su parte de las comisiones de intercambio del pool. Fuera de ellos mantiene un solo token y no gana nada hasta que el precio vuelve.",
    priceSentence: (base: string, price: string, quote: string) => `1 ${base} = ${price} ${quote}`,
    currentPrice: "Precio actual",
    inRangeYes: "El precio actual está dentro de este rango.",
    inRangeNo: "El precio actual está fuera de este rango.",
    inRangeYesNote: "Una posición abierta aquí estaría activa de inmediato.",
    inRangeNoNote:
      "Una posición abierta aquí mantendría un solo token y no ganaría nada hasta que el precio volviera a entrar.",
    beyondEdges: (below: string, above: string) =>
      `Si el precio cae por debajo del rango, la posición acaba manteniendo solo ${below}; si sube por encima, solo ${above}.`,
    lowerTruncatedNote:
      "El borde inferior se detiene en el precio más bajo que este pool puede expresar, antes de donde lo habría puesto la banda.",
    upperTruncatedNote:
      "El borde superior se detiene en el precio más alto que este pool puede expresar, antes de donde lo habría puesto la banda.",
    chartLabel: "Los precios del último mes frente al rango sugerido",
    chartCaption: (days: string) =>
      `Cada uno de los últimos ${days} días: su cierre, y el recorrido de su mínimo a su máximo. La banda sombreada es el rango sugerido; la línea continua es el precio de hoy.`,
    chartLegend:
      "Un punto relleno es un día que se mantuvo enteramente dentro del rango; uno hueco lo abandonó o cruzó un borde.",

    basisHeading: "Cómo se trazó este rango",
    basisIntro: (base: string, days: string) =>
      `A partir de cuánto se movió realmente el precio de ${base} durante los últimos ${days} días completos — no a partir de una previsión de adónde irá.`,
    dailyMove: "Movimiento diario típico",
    dailyMoveNote: "La desviación típica del cambio de precio de un día, a lo largo de la ventana.",
    horizonMove: (days: string) => `A lo largo de ${days} días`,
    horizonMoveNote:
      "El mismo movimiento estirado sobre el horizonte elegido abajo: una desviación típica, en cada sentido.",
    widthValue: (multiplier: string) => `${multiplier}× eso, en cada sentido`,
    widthNote:
      "Elegido abajo. Un rango más ancho se abandona menos a menudo, y el mismo depósito repartido sobre él es más fino en cualquier precio concreto.",
    measuredOver: "Medido sobre",
    measuredOverNote: (returns: string) => `Entraron ${returns} cambios diarios.`,
    epilogue:
      "El rango está centrado en el precio de hoy y trazado a la misma distancia hacia arriba y hacia abajo en términos de proporción — reducir a la mitad y duplicar son el mismo movimiento —, y por eso los dos porcentajes difieren. Describe cuánto se ha movido el precio, no adónde irá: no es una previsión, y la amplitud no es un nivel de confianza. Nada aquí dimensiona una posición ni dice cuánto de cada token depositar.",
  },

  technical: {
    heading: "Detalles técnicos",
    summary: "Los ticks, bloques y cifras contra los que se comprueba la página de arriba.",
    lowerTick: "Tick inferior",
    upperTick: "Tick superior",
    currentTick: "Tick actual",
    sourceReportedTick: (tick: string) => `La fuente declaró ${tick}.`,
    noSourceTick: "La fuente no declaró ningún tick propio, así que esta conversión está sin verificar.",
    tickSpacing: "Separación de ticks",
    tickSpacingNote: (step: string) => `Un escalón de precio de ${step} entre bordes utilizables.`,
    width: "Amplitud",
    widthValue: (ticks: string, spacings: string) => `${ticks} ticks · ${spacings} separaciones`,
    poolPrice: "Precio tal como lo cotiza el pool",
    quotePerBase: (quote: string, base: string) => `${quote} por ${base}`,
    bandLower: "Límite inferior de la banda",
    bandUpper: "Límite superior de la banda",
    bandNote: "Antes de ajustarse a la rejilla de ticks, en el sentido del propio pool.",
    annualised: "Volatilidad anualizada",
    annualisedNote:
      "Desviación típica muestral de los rendimientos logarítmicos diarios, escalada por sqrt(365).",
    coverage: "Cobertura",
    coverageNote: "Qué parte de la ventana tenía precios diarios consecutivos detrás.",
    sourceBlock: "Bloque de origen",
    noBlockTime: "No se declaró hora de bloque.",
    fetchedAt: "Obtenido a las",
    fetchedAtNote: "Cuándo llegó la respuesta, no qué describe.",
    lowerEdge: "Borde inferior",
    upperEdge: "Borde superior",
    truncated: "Truncado",
    asAsked: "Tal como se pidió",
  },

  explanation: {
    heading: "Explicación",
    pending: "Escribiendo la explicación…",
    unavailable: "No hay explicación disponible para este análisis.",
    sectionWriting: "Todavía escribiéndose…",
    sectionMissing: "Esta parte no pudo escribirse.",
    writtenBy: (model: string) => `Escrito por ${model}. Las cifras de arriba no.`,
    sections: {
      whatThisRangeMeans: "Qué significa este rango",
      ifPriceLeavesTheRange: "Si el precio sale del rango",
      whatTheVolatilitySays: "Qué dice la volatilidad",
      whatThisDoesNotCover: "Qué no cubre esto",
    },
  },

  notices: {
    failure: {
      "invalid-pool-address":
        "La dirección del pool debe ser 0x seguido de 40 caracteres hexadecimales, y no puede ser la dirección cero.",
      "invalid-search-terms":
        "Una búsqueda de pools admite uno o dos términos cortos formados por letras, dígitos y los signos que aparecen dentro de los tickers.",
      "market-data-not-configured":
        "Los datos de mercado de Uniswap v3 no están configurados en este servidor.",
      "chain-data-not-configured": "Las lecturas en cadena no están configuradas en este servidor.",
      "explanation-not-configured":
        "Esta aplicación no está configurada para escribir explicaciones, así que no se muestra ninguna.",
      "market-data-timed-out": "La petición de datos de mercado agotó el tiempo de espera.",
      "market-data-unreachable": "No se pudo alcanzar la fuente de datos de mercado.",
      "market-data-credentials-rejected":
        "La fuente de datos de mercado rechazó las credenciales configuradas.",
      "market-data-rate-limited":
        "Se superó el límite de peticiones de la fuente de datos de mercado.",
      "market-data-unreadable": "La fuente de datos de mercado devolvió una respuesta ilegible.",
      "market-data-malformed":
        "La fuente de datos de mercado devolvió una respuesta que esta aplicación no puede verificar.",
      "market-data-indexing-errors":
        "La fuente de datos de mercado declaró errores de indexación, así que sus cifras no pueden tenerse por verificadas.",
      "market-data-stale":
        "La fuente de datos de mercado está demasiado rezagada respecto a la cadena para que estas cifras se tengan por actuales.",
      "market-data-future-block-time":
        "La fuente de datos de mercado declaró una hora de bloque por delante del reloj de este servidor, así que sus cifras no pueden verificarse.",
      "chain-data-timed-out": "La petición de datos en cadena agotó el tiempo de espera.",
      "chain-data-unreachable": "No se pudo alcanzar la fuente de datos en cadena.",
      "chain-data-credentials-rejected":
        "La fuente de datos en cadena rechazó las credenciales configuradas.",
      "chain-data-rate-limited": "Se superó el límite de peticiones de la fuente de datos en cadena.",
      "chain-data-unreadable": "La fuente de datos en cadena devolvió una respuesta ilegible.",
      "chain-data-malformed":
        "La fuente de datos en cadena devolvió una respuesta que esta aplicación no puede verificar.",
      "chain-aggregator-unverified":
        "Los saldos se leen a través de un contrato auxiliar en la cadena, y el código en su dirección no es el código en el que esta aplicación fue construida para confiar, así que no se leyó nada a través de él.",
      "pool-not-found":
        "No se encontró ningún pool de Uniswap v3 para esta dirección en la red principal de Ethereum.",
      "pool-contract-not-found":
        "Ningún contrato de pool de Uniswap v3 respondió en esta dirección en la red principal de Ethereum.",
      "pool-configuration-inconsistent":
        "La configuración del pool compuesta a partir de sus dos fuentes no pudo verificarse.",
      "pool-history-insufficient":
        "Este pool todavía no tiene suficiente historial diario de precios completado para analizarse.",
      "pool-history-never-traded":
        "Este pool existe, pero nunca se ha intercambiado nada en él, así que no hay precios diarios con los que medir un rango.",
      "pool-history-dormant":
        "Este pool dejó de operarse antes del periodo del que se leen estos precios diarios, así que no hay historial reciente con el que medir un rango. Esperar no lo cambiará; solo lo cambiaría que el pool volviera a usarse.",
      "volatility-invalid-input":
        "El historial de precios aportado para este cálculo no es un historial normalizado válido.",
      "volatility-insufficient-history":
        "Este pool no tiene suficientes precios diarios consecutivos para medir la volatilidad.",
      "volatility-unverifiable":
        "El cálculo de volatilidad produjo un resultado que esta aplicación no puede verificar.",
      "band-invalid-input":
        "Los datos de mercado aportados para esta banda de precios no son válidos, o la instantánea y la volatilidad describen pools distintos.",
      "band-no-current-price":
        "El precio actual de este pool no está disponible, así que no puede centrarse una banda de precios.",
      "band-unverifiable":
        "El cálculo de la banda de precios produjo un resultado que esta aplicación no puede verificar.",
      "range-invalid-input":
        "El pool, la banda de precios y la instantánea aportados para este rango no son válidos, o no describen todos el mismo pool y la misma observación.",
      "range-price-unrepresentable":
        "El precio actual de este pool queda fuera del rango que Uniswap puede expresar, así que no puede construirse ningún rango de posición a partir de él.",
      "range-tick-disagreement":
        "El precio que la fuente declara para este pool y el estado que declara no describen el mismo momento, así que no se publica ningún rango.",
      "range-too-narrow":
        "La banda de precios es más estrecha que el escalón más pequeño que este pool permite entre dos bordes, así que no describe dos límites de posición distintos.",
      "range-unverifiable":
        "El cálculo del rango produjo un resultado que esta aplicación no puede verificar.",
      "divergence-unverifiable":
        "La comparación con mantener produjo un resultado que esta aplicación no puede verificar.",
      "activity-unverifiable":
        "La actividad reciente del pool produjo un resultado que esta aplicación no puede verificar.",
      "fee-rate-unmeasurable":
        "Este pool no negoció nada en ningún día indexado de la ventana, así que la tasa que cobra no puede dividirse a partir de lo que recaudó.",
      "deposit-share-unpriceable":
        "La fuente no valora lo que este pool contiene, así que un depósito en dólares no puede convertirse en una posición dentro de él.",
      "deposit-share-no-days":
        "El precio salió de este rango todos los días por los que la fuente pudo responder, así que no hay ningún día en que un depósito en él hubiera recaudado nada.",
      "deposit-share-unverifiable":
        "Lo que un depósito habría tomado no pasó su propia comprobación, así que no se muestra.",
      "range-order-no-room":
        "Este rango es demasiado estrecho para alojar una posición de un solo lado a cualquiera de los dos lados del precio actual.",
      "range-order-unverifiable":
        "Las mitades de un solo lado de este rango no pasaron su propia comprobación, así que no se muestran.",
      "swap-depth-no-liquidity":
        "Este pool no declara liquidez a su precio actual, así que aquí no hay ningún intercambio que valorar.",
      "swap-depth-tick-disagreement":
        "El tick propio de la fuente sitúa este pool en un escalón de precio distinto del precio mostrado, así que la liquidez que declaró no puede atribuirse a este escalón.",
      "swap-depth-unverifiable":
        "Lo que costaría un intercambio no pasó su propia comprobación, así que no se muestra.",
      "out-of-sample-insufficient-history":
        "Este pool no tiene suficiente historial indexado para ajustar una banda en el pasado y aún conservar un horizonte completo de días con el que comprobarla.",
      "out-of-sample-unverifiable":
        "La comprobación fuera de muestra produjo un resultado que esta aplicación no puede verificar.",
      "hook-directory-unverifiable":
        "Los hooks de los pools v4 de esta semana no pasaron su propia comprobación, así que el directorio no se muestra.",
      "positions-manager-unverified":
        "El contrato que guarda las posiciones de Uniswap v3 no respondió con el código contra el que se construyó esta aplicación, así que no se muestra nada de lo que dijo.",
      "positions-unreadable":
        "La cadena no respondió por las posiciones de esta dirección, así que no se muestra ninguna — lo cual no es lo mismo que no tener ninguna.",
      "positions-unverifiable":
        "Las posiciones de esta dirección no pasaron su propia comprobación, así que no se muestran.",
      "holdings-unverifiable":
        "Lo que contiene esta dirección produjo un resultado que esta aplicación no puede verificar.",
      "explanation-key-rejected":
        "El servicio de explicaciones no aceptó la clave configurada, así que no se muestra ninguna explicación.",
      "explanation-model-not-permitted":
        "La clave configurada no tiene permiso para usar el modelo seleccionado, así que no se muestra ninguna explicación.",
      "explanation-model-unknown":
        "El modelo seleccionado no está disponible para la clave configurada, así que no se muestra ninguna explicación.",
      "explanation-rate-limited":
        "El servicio de explicaciones está limitado por peticiones ahora mismo, así que no se muestra ninguna explicación.",
      "explanation-hourly-cap":
        "Este sitio escribe un número limitado de explicaciones cada hora, y ya se han escrito todas. Las cifras de arriba están completas; dentro de la hora se podrá volver a escribir la explicación.",
      "explanation-unreachable":
        "No se pudo alcanzar el servicio de explicaciones, así que no se muestra ninguna explicación.",
      "explanation-request-refused":
        "El servicio de explicaciones rechazó esta petición, así que no se muestra ninguna explicación.",
      "explanation-declined":
        "El modelo declinó explicar las cifras de este pool, así que no se muestra ninguna explicación.",
      "explanation-truncated":
        "La explicación se cortó antes de estar completa, así que no se muestra.",
      "explanation-malformed":
        "La explicación llegó en una forma que esta aplicación no puede verificar, así que no se muestra.",
    } satisfies Record<DataFailureNotice, string>,

    warning: {
      "block-time-unreported":
        "La fuente de datos no declaró una hora de bloque, así que no pudo verificarse cuán actuales son estas cifras.",
      "history-window-incomplete":
        "La fuente de datos no declaró un precio para cada día de esta ventana; los días que faltan están ausentes en lugar de estimados.",
      "volatility-window-incomplete":
        "Algunos días de esta ventana no tenían precio, así que la volatilidad se mide con menos rendimientos diarios de los que abarca la ventana; los días que faltan se omitieron en lugar de estimarse.",
      "band-window-incomplete":
        "Algunos días de la ventana de volatilidad no tenían precio, así que esta banda se basa en menos rendimientos diarios de los que abarca la ventana.",
      "band-price-block-time-unreported":
        "La fuente del precio actual no declaró una hora de bloque, así que no pudo verificarse de forma independiente cuán actual es.",
      "band-volatility-block-time-unreported":
        "La fuente de volatilidad no declaró una hora de bloque, así que no pudo verificarse de forma independiente cuán actual es.",
      "range-lower-edge-truncated":
        "Un borde del rango se detiene donde terminan los precios que este pool puede expresar — el borde en el que el primer token del pool está más barato —, así que el rango no llega tan lejos como la banda. El panel del rango dice qué borde es ese en el sentido mostrado.",
      "range-upper-edge-truncated":
        "Un borde del rango se detiene donde terminan los precios que este pool puede expresar — el borde en el que el primer token del pool está más caro —, así que el rango no llega tan lejos como la banda. El panel del rango dice qué borde es ese en el sentido mostrado.",
      "range-tick-unverified":
        "La fuente del precio no declaró el estado propio del pool, así que el precio que implica no pudo contrastarse con él.",
      "range-excludes-current-price":
        "El precio actual del pool queda fuera de este rango, así que una posición construida a partir de él mantendría un solo token y no ganaría nada hasta que el precio volviera.",
    } satisfies Record<DataWarningNotice, string>,
  },

  rateLimited: {
    title: "Demasiadas peticiones",
    body: (limit: number) =>
      `Esta página lee datos de Uniswap en vivo en cada visita, así que está limitada a ${limit} análisis por minuto.`,
    retry: (seconds: number) => `Inténtelo de nuevo en ${seconds} segundo${seconds === 1 ? "" : "s"}.`,
    back: "Volver al asesor",
  },

  error: ERROR_COPY.es,
};
const ar: Dictionary = {
  metadata: {
    title: "LiquidityWise",
    description:
      "مرشد تعليمي مدعوم بالذكاء الاصطناعي لاستراتيجيات السيولة في Uniswap v3 و v4. إرشاد فقط — وليس نصيحة مالية.",
    v4Title: "تجمّع Uniswap v4 · LiquidityWise",
    v4Description: "ما هو هذا التجمّع في Uniswap v4، وما المسموح لـ hook الخاص به أن يفعله.",
    holdingsTitle: "ما الذي يملكه عنوان ما · LiquidityWise",
    holdingsDescription:
      "الرموز الموجودة في عنوان إيثيريوم واحد، وتجمّعات Uniswap v3 التي يمكن أن تذهب إليها.",
    compareTitle: "مستويات الرسوم جنبًا إلى جنب · LiquidityWise",
    compareDescription: "كل مستويات رسوم Uniswap v3 لزوج واحد، مقروءة بالأفق والاتساع والإيداع نفسه.",
    poolTitle: "تحليل نطاق تجمّع · LiquidityWise",
    poolDescription:
      "نطاق سعري لتجمّع Uniswap v3 على شبكة إيثيريوم الرئيسية، مرسوم من مدى تحرّك سعره فعلًا.",
    hooksTitle: "خطّافات Uniswap v4 · LiquidityWise",
    hooksDescription:
      "كل hook تسمّيه أكثر تجمّعات Uniswap v4 نشاطًا هذا الأسبوع، وما المسموح لكلٍّ منها أن يفعله — مقروءًا من عنوانه نفسه.",
  },

  preferences: {
    languageLabel: "اللغة",
    selectLanguage: "اختر اللغة",
    closeLanguages: "إغلاق",
    partlyTranslated:
      "لا تزال هذه اللغة قيد الترجمة. القوائم والتسميات والعناوين بها، أما الشروح الطويلة فما زالت بالإنجليزية.",
    themeLabel: "المظهر",
    themeSystem: "النظام",
    themeLight: "فاتح",
    themeDark: "داكن",
    rangeLabel: "تفضيلات النطاق",
    rangeIntro:
      "الأفق والعرض والإيداع التي يُفتح بها كل مجمّع. الرابط الذي يحمل قيمه الخاصة يبقى له الأولوية، والنموذج أسفل كل تحليل يغيّر تلك الصفحة وحدها.",
    rangeSave: "حفظ",
    rangeReset: "نسيان",
  },

  disclaimer: {
    ariaLabel: "تنبيه مهم",
    title: "أداة تعليمية — وليست نصيحة مالية.",
    body: "يشرح هذا التطبيق آليات Uniswap ويساعدك على التفكير في اختيار المعايير. وهو لا يتنبأ بالأسعار، ولا يضمن أي عائد، ولا يمكنه التحقق من أمان أي عقد ذكي. توفير السيولة ينطوي على مخاطر حقيقية، منها الخسارة غير الدائمة وفقدان الأموال بالكامل. تحقّق دائمًا من عناوين العقود بنفسك وابحث على مسؤوليتك.",
  },

  home: {
    badge: "أساس مبكر",
    title: "LiquidityWise",
    introBeforeV3: "مرشد تعليمي لـ Uniswap ",
    introBetween: "، في طريقه نحو ",
    introAfterV4:
      ". ابحث عن تجمّع عبر زوجه، واقرأ نطاقًا سعريًا مستخرجًا من مدى تحرّك ذلك الزوج فعلًا، واحصل على شرح له بلغة واضحة. كل رقم يُحسب ويُراجَع قبل أن يُسمح لنموذج بوصفه — ولا يُسمح للنموذج أبدًا بذكر رقم واحد.",
    workingTodayHeading: "ما يعمل اليوم",
    workingTodayBody:
      "ابحث عن تجمّع عبر زوجه، أو ألصق عنوان تجمّع v3 أو معرّف تجمّع v4. ستحصل على إعدادات التجمّع المتحقَّق منها وحالته الراهنة، وأسعار الشهر الأخير اليومية مرسومة مقابل نطاق مقترح، ومدى تحرّك الزوج فعلًا، والنطاق المترتّب على ذلك — والأفق والاتساع لك أن تغيّرهما. وإلى جانب ذلك: ما تقاضاه التجمّع وما حصّله بالفعل، وكيف وقعت أيامه الأخيرة بالنسبة إلى النطاق، وماذا كانت الطريقة نفسها لتعطي في أيام لم ترها قط، وما الذي تتخلّى عنه المراكز مقابل الاحتفاظ البسيط، وماذا كان كل اتساع آخر ليفعل بدلًا من ذلك، و — لإيداع تحدّد أنت حجمه — كم كان ليأخذ من الرسوم المتقاضاة في الأيام التي بقي فيها السعر داخل النطاق. والنطاق نفسه مقروءًا بالمقلوب: كل نصف منه مركز أحادي الجانب، والصفحة تقول بأي سعر يتحوّل كل نصف لو عبره السعر. وكم يكلّف التبادل عبر التجمّع، لأكبر تبادل يمكن تسعيره دون افتراض أي شيء. ودليل لكل hook تسمّيه أكثر تجمّعات v4 نشاطًا هذا الأسبوع، مع ما يُسمح لكلٍّ منها أن يفعله، مقروءًا من عنوانه نفسه. كما يقول تجمّع v4 بكلمات واضحة ما المسموح لـ hook الخاص به أن يفعله، مقروءًا من عنوان الـ hook نفسه. ويمكن البحث عن عنوان لمعرفة التجمّعات التي يمكن لرموزه أن تذهب إليها، والمراكز التي يملكها بالفعل في Uniswap — كل مركز مع الأسعار التي يغطّيها وما إذا كان التجمّع داخلها الآن. ثم شرح لكل ذلك بلغة واضحة. لا يلمس أي نموذج أيًّا من هذه الأرقام، ولا يُقدَّر أي منها لسدّ فجوة، وليس في النص موضع يضع فيه رقمًا من عنده.",
    analysePool: "ابحث عن تجمّع ←",
    methodHeading: "كيف يعمل",
    methodSteps: [
      {
        step: "بيانات متحقَّق منها",
        detail:
          "تُجلب معطيات التجمّع من subgraphs الخاصة بـ Uniswap وتُقرأ من السلسلة، ولا تُفترض أبدًا. ويُراجَع السعر مقابل الحالة التي يعلنها التجمّع عن نفسه.",
      },
      {
        step: "رياضيات حتمية",
        detail:
          "يُحسب التقلّب وحزمة السعر ونطاق المركز في TypeScript عادي، فيعطي التجمّع نفسه الأرقام نفسها دائمًا.",
      },
      {
        step: "تفسير بالذكاء الاصطناعي",
        detail:
          "يشرح نموذج معنى هذه الأرقام. وهي تُسلَّم إليه متحقَّقًا منها سلفًا، والعقد الذي يجيب ضمنه لا يترك موضعًا لرقم.",
      },
    ],
    coverageHeading: "لم يُبنَ بعد",
    coverage: [
      {
        version: "Uniswap v3",
        features: [
          {
            name: "الغاز، وتكلفة ملاحقة السعر",
            summary:
              "النطاق الذي غادره السعر يجب إغلاقه وإعادة فتحه لملاحقته، وهذا يكلّف غازًا ويحوّل انحرافًا على الورق إلى انحراف محقَّق فعلًا. ولا يُحتسب أي من ذلك هنا في أي موضع.",
          },
        ],
      },
      {
        version: "Uniswap v4",
        features: [
          {
            name: "ما يفعله الـ hook فعليًا",
            summary:
              "تقول صفحة v4 ما المسموح لـ hook أن يفعله، لأن هذا القدر يفرضه البروتوكول ويُقرأ من عنوان الـ hook نفسه. أما قراءة العقد لقول ما يفعله بهذه الصلاحيات فمسألة أخرى، ولا يحاولها هذا التطبيق.",
          },
          {
            name: "استراتيجيات على نمط TWAMM",
            summary:
              "توزيع أمر كبير على الزمن بدل تنفيذه مقابل نقطة سيولة واحدة. والنصف الذي تستطيع صفحة تحليل الإجابة عنه موجود بالفعل: كم يكلّف التبادل مقابل السيولة عند السعر الحالي، وما أكبر تبادل يمكن تسعيره أصلًا. أما جدولته على الزمن فمن عمل الـ hook، وهذا التطبيق لا يحاكي سلوك الـ hook.",
          },
        ],
      },
    ],
    footer:
      "لا شيء مما سبق موجود بعد. الموجود هو كل ما في أعلى هذه الصفحة: مجمّع يُعثر عليه باسمه، وأرقام تُحسب وتُراجَع، ونص يُتحقق منه قبل عرضه. يمكن ربط محفظة، وكل ما يُطلب منها هو عنوانها. الشيء الوحيد الذي يحتفظ به هذا التطبيق هو ربط تيليغرام ينشئه القارئ بنفسه — عنوان إلى جانب معرّف محادثة، يُمحى لحظة إرساله /stop إلى البوت ويخرج من النسخ الاحتياطية المشفّرة خلال سبعة أيام — ولا شيء هنا يستطيع توقيع معاملة أو إرسالها نيابةً عنك.",
  },

  pool: {
    /*
     * Pointing right, not left. Reading runs right-to-left here, so the way
     * back is the way the arrow that means "onward" does not point — and every
     * onward link in this dictionary carries the left-pointing one.
     */
    back: "← LiquidityWise",
    invalidAddress:
      "هذا ليس عنوان إيثيريوم. العنوان هو 0x يتبعه 40 حرفًا ست عشريًا بالضبط.",
    loading: "تُقرأ بيانات Uniswap الحيّة…",
  },

  activity: {
    heading: "ما فعله التجمّع فعلًا",
    volume24h: "حجم التداول، 24 ساعة",
    volume7d: "حجم التداول، 7 أيام",
    volume30d: "حجم التداول، 30 يومًا",
    fees30d: "الرسوم المتقاضاة، 30 يومًا",
    feesNote: "رسوم التجمّع كله، موزّعة على كل من كانت سيولته نشطة.",
    tvl: "إجمالي القيمة المودعة",
    occupancySentence: (days: string, inside: string, outside: string, crossed: string) =>
      `من آخر ${days} يومًا، بقي ${inside} داخل هذا النطاق بالكامل، ووقع ${outside} خارجه بالكامل، وعبر ${crossed} إحدى الحافتين.`,
    undeterminedNote:
      "اليوم الذي عبر حافة قضى جزءًا منه داخل النطاق وجزءًا خارجه، وأعلى وأدنى سعر يومي في المصدر لا يمكنهما تحديد كم من كلٍّ.",
    feesWhileInside: "الرسوم المتقاضاة في الأيام الواقعة داخل النطاق بالكامل",
    feesWithheld: "لا يُعرض لهذا التجمّع",
    feesWithheldNote:
      "يُسمح لـ hook هذا التجمّع بأخذ حصة من التبادل، ولا شيء في المصدر يفصل حصة الـ hook عن حصة مزوّدي السيولة. الرسوم أعلاه هي ما تقاضاه التجمّع، وهذه حقيقة؛ أما ربط جزء منها بهذا النطاق فادّعاء عن مركز لا يستطيع أحد التحقق منه.",
    inSample:
      "هذه هي الأيام نفسها التي رُسم منها النطاق، فهي تُظهر كيف جرت مواءمته لا كيف يصمد — والنطاق مركزه سعر اليوم، وهو سعر لم يكن بوسع أحد أن يفتح عليه قبل شهر. اقرأها بوصفها موقع حركة التجمّع الأخيرة من النطاق، لا بوصفها اختبارًا رجعيًا.",
    notYourEarnings:
      "لا شيء من هذا هو ما سيكسبه مركز: هذا ما تقاضاه التجمّع كله. أما ما كان إيداع ليأخذه منه — حصته من السيولة النشطة أثناء وقوع التبادلات — فهو في اللوحة التي تلي مباشرة، وحتى تلك رسوم ولا شيء غيرها.",
  },

  deposit: {
    heading: "كم كان إيداع ليحصّل",
    unavailable: "ما كان إيداع ليأخذه من تلك الرسوم لا يمكن استخراجه لهذا التجمّع.",
    withheldNote:
      "للسبب نفسه الذي يخصّ الرقم أعلاه: قد يأخذ hook هنا حصة من التبادل، ولا شيء في المصدر يفصل حصته عن حصة المزوّدين. وجزءٌ من مجموع لا يمكن نسبته إلى هذا النطاق لا يمكن نسبته إلى إيداع فيه أيضًا.",
    deposited: "الإيداع",
    depositedNote: "الحجم الذي حُسب على أساسه. غيّره في النموذج أعلاه.",
    collected: "الرسوم التي كان ليأخذها",
    collectedNote: (days: string) => `على مدى الـ ${days} يومًا التي لم يغادر فيها السعر النطاق.`,
    ofDeposit: "من الإيداع",
    ofDepositNote:
      "تلك الرسوم مقابل المال المودَع، على مدى تلك الأيام دون غيرها. ليست معدّلًا سنويًا، ولا شيء هنا يحوّلها إلى معدّل.",
    sentence: (deposit: string, days: string, poolFees: string, yourFees: string) =>
      `في الـ ${days} يومًا التي لم يغادر فيها السعر هذا النطاق، تقاضى التجمّع ${poolFees} رسومًا. وإيداع قدره ${deposit} داخل النطاق كان ليأخذ نحو ${yourFees} من ذلك — سيولته الخاصة كحصة من السيولة التي كانت نشطة فعلًا في كل يوم من تلك الأيام.`,
    unmeasurableNote: (days: string) =>
      `وقع ${days} يومًا إضافية داخل النطاق، لكن المصدر لم ينشر لها رسومًا ولا سيولة نشطة، فهي ليست ضمن المجموع.`,
    dilution:
      "الإيداع الأكبر لا يحصّل أكثر بالتناسب. فالحصة هي سيولتك على سيولة الجميع بما فيها سيولتك، وبعد حجم معيّن يصبح معظم ما تضيفه تخفيفًا لما تملكه أصلًا — ولهذا تتباعد المبالغ المعروضة بمقدار ألف ضعف.",
    caveat:
      "رسوم فقط، وأيام وقعت بالفعل. يفترض أن المركز كان مفتوحًا في كل يوم منها وأن شيئًا لم يتحرّك استجابةً له، ولا يقول شيئًا عمّا ستدفعه الثلاثون يومًا القادمة. أما ما يتخلّى عنه المركز مقابل الاحتفاظ البسيط بالرمزين فهو المقارنة أسفل هذه الصفحة، ولا بد من قراءة الاثنين معًا.",
  },

  realizedFee: {
    heading: "كم تقاضى فعلًا",
    intro:
      "الرسم الذي يعلنه التجمّع رقم واحد. أما هذا فما دفعه المبادلون فعلًا، مقسومًا من الأيام نفسها التي جاءت منها الأرقام أعلاه: رسوم اليوم على حجم تداول اليوم نفسه. لا يحتاج إلى طلب إضافي ولا إلى شيء من الـ hook.",
    declared: "الرسم المعلَن",
    statedNote: (lp: string, protocol: string) =>
      `${lp} لمزوّدي السيولة و${protocol} للبروتوكول، مجموعين بالطريقة التي يتقاضاها بها PoolManager — وهو ما يدفعه المبادل، وما تتكوّن منه الرسوم أعلاه.`,
    noDeclared: "لا يوجد",
    noDeclaredNote: "لا يحمل مفتاح هذا التجمّع أي رسم. فـ hook الخاص به يحدّد رسمًا لكل تبادل.",
    median: "اليوم المعتاد",
    spread: "من أدنى يوم إلى أعلاه",
    spreadValue: (lowest: string, highest: string) => `${lowest} – ${highest}`,
    aggregate: "النافذة كاملة",
    aggregateNote:
      "رسوم النافذة على حجم تداولها، فيكون لليوم النشط وزن أكبر من اليوم الهادئ.",
    daysMeasured: "الأيام المقيسة",
    daysMeasuredNote: (skipped: string) =>
      `${skipped} يومًا إضافية في النافذة لم تشهد أي تداول، أو كان ينقصها رقم، فلم يمكن استخراج أي معدّل منها.`,
    verdictMatches: "يتطابقان في كل يوم مقيس. المعدّل المعلَن هو المعدّل الذي تُقوضي.",
    verdictDiffers: (differing: string, measured: string) =>
      `لا يتطابقان. ففي ${differing} من ${measured} يومًا مقيسًا تقاضى التجمّع شيئًا غير معدّله المعلَن، وعليه فإن المستوى أعلاه يصف ما أُنشئ به التجمّع لا ما يكلّفه التبادل.`,
    verdictNoneDeclared:
      "لا شيء للمقارنة به: هذا التجمّع لا يعلن أي معدّل أصلًا. والأرقام هنا هي ما حدّده الـ hook فعلًا.",
    notLpShare:
      "لا شيء من هذا هو ما يصل إلى مزوّد السيولة. فـ hook هذا التجمّع مسموح له بأخذ حصة من التبادل، والمصدر لا يفصل حصة الـ hook عن حصة المزوّدين. ما تقوله هذه الأرقام هو كم كلّف التبادل، لا من الذي تلقّاه.",
    unavailableHeading: "تعذّر قياس ما يتقاضاه هذا التجمّع",
  },

  outOfSample: {
    heading: "مُختبَر في أيام لم يرها قط",
    showFolds: "اعرض كل مقطع",
    intro: (horizon: string) =>
      `كل رقم أعلاه مواءَم للأيام التي يصفها. أما هذه فلا. أُعيدت الطريقة إلى الوراء ${horizon}، ونُفّذت من جديد على الأسعار السابقة لتلك النقطة وحدها، ومركزها سعر تلك النقطة — سعر كان من يقف هناك ليراه فعلًا. ثم وُضعت فوق الأيام التالية، وتكرّر ذلك كله رجوعًا في التاريخ بقدر ما اتّسع له.`,
    folds: "المقاطع",
    foldsNote: "كم مرة اتّسع التاريخ لمواءمة حزمة ثم اختبارها.",
    fullyInside: "أيام داخل النطاق بالكامل",
    fullyOutside: "أيام خارج النطاق بالكامل",
    undetermined: "أيام عبرت حافة",
    verdict: (inside: string, measured: string, folds: string) =>
      `عبر ${folds} مقاطع، بقي ${inside} من ${measured} يومًا داخل الحزمة التي كانت هذه الطريقة لترسمها بالكامل.`,
    foldPeriod: "الأيام المفحوصة",
    foldVolatility: "التقلّب المواءَم",
    foldVerdict: "داخل / خارج / عابر",
    foldsCaption: "كل مقطع اختُبرت عليه الطريقة، الأقدم أولًا",
    foldColumns:
      "كل صف مقطع واحد: الأيام التي فُحص عليها، والتقلّب الذي قاسته مواءمته هو — لا الرقم أعلاه — وكيف وقعت تلك الأيام بالنسبة إلى الحزمة التي أنتجتها تلك المواءمة.",
    notIndependent:
      "بضعة مقاطع على تجمّع واحد ليست مقياسًا لمدى صمود الطريقة، ولا تقول شيئًا عمّا سيحدث تاليًا. كما أن المواءمات المتتالية تتداخل — فمواءمة على 31 إغلاقًا أطول من خطوة أفق واحد — فالمقاطع ليست مستقلة بعضها عن بعض.",
    notHeld:
      "لم يحتفظ أحد بهذه الحزم. كل واحدة هي ما كانت الطريقة لتقترحه في تلك اللحظة، موضوعًا فوق أسعار وقعت بعد ذلك — والأيام أعلاه، التي رُسم منها النطاق المقترح، ليست هذه الأيام.",
    unavailableHeading: "تعذّر فحص هذا التجمّع خارج العيّنة",
  },

  divergence: {
    heading: "مقارنةً بالاحتفاظ البسيط",
    intro:
      "كم سيساوي مركز في هذا النطاق مقارنةً بالاحتفاظ بالرمزين ببساطة، عند كل سعر. حساب دقيق لا تقدير — لكنه يحسب حركة السعر ولا شيء غيرها. فهو لا يقول شيئًا عن الرسوم التي سيكسبها المركز، والرسوم هي بالضبط ما يُدفع لمزوّد السيولة مقابل هذا الفارق.",
    price: (base: string) => `سعر ${base}`,
    loss: "المركز مقابل الاحتفاظ",
    entryRow: "السعر الذي يُقاس منه هذا — سعر التجمّع الحالي.",
    impermanentNote:
      "هذا ما يُسمّى عادةً الخسارة غير الدائمة. وهي غير دائمة فقط إن عاد السعر: فالمركز الذي يُغلق عند سعر غير الذي فُتح عنده يكون قد حقّقها.",
  },

  rangeOrder: {
    heading: "البيع والشراء عبر النطاق",
    intro:
      "النطاق أعلاه ثنائي الجانب: مال على جانبي السعر، يكسب رسومًا ما دام السعر بينهما. اقسمه عند السعر، فيصير كل نصف أداة مختلفة. المركز الواقع كله فوق السعر يحمل رمزًا واحدًا لا غير، ويبيع التجمّع ذلك الرمز مقابل الآخر مع صعود السعر عبر الحزمة. وتحت السعر يفعل العكس. هذا هو أمر النطاق، وكلا نصفي هذا النطاق أمر نطاق.",
    selling: (token: string) => `بيع ${token}`,
    buying: (token: string) => `شراء ${token}`,
    band: "الحزمة",
    bandNote:
      "موضع المركز. حافته الداخلية هي أول خطوة سعرية بعد الخطوة التي يقف فيها السعر، فيبدأ ولا يحمل شيئًا مما سيتحوّل إليه.",
    average: "متوسط السعر",
    averageNote: "ما يؤول إليه التحويل، إن عبر السعر الحزمة كاملة.",
    against: "مقابل السعر الحالي",
    exact:
      "هذا المتوسط هو الوسط الهندسي للحدّين — بالضبط، وبأي اتجاه كُتب السعران. وهو ينبع من صيغ البروتوكول نفسه لما يحمله المركز عند كل طرف من حزمته، والمبلغ المودَع يُختصر منه: مئة دولار ومليون يتحوّلان بالسعر نفسه.",
    onlyIfThrough:
      "وذلك فقط إن عبر السعر الحزمة كاملة. أما الذي يرتدّ في الداخل فيترك المركز حاملًا بعضًا من كلٍّ، ولا عند سعر واحد بعينه — وهو الشيء نفسه الذي وُضع النطاق أعلاه من أجله، بلغ بالمصادفة.",
    notAnOrderBook:
      "لا شيء هنا يجدول التحويل ولا شيء يضمنه. هذا ليس دفتر أوامر: فالأمر الذي لا يبلغه السعر أبدًا نتيجة عادية لا إخفاق، ولا يوجد طابور ولا طرف مقابل ينتظر. ما يوجد بدل ذلك هو أن المركز يجمع رسوم التجمّع ما دام السعر داخل الحزمة، بدل أن يدفعها.",
    unavailable: "لا يملك هذا النطاق نصفًا أحادي الجانب ليوصف.",
  },

  swapDepth: {
    heading: "كم يكلّف التبادل هنا",
    intro:
      "كل ما سبق عن توفير السيولة. وهذا عن استخدامها. سيولة التجمّع ثابتة بين الخطوات السعرية التي بُني عليها، فالتبادل الذي يبقى داخل الخطوة التي يقف فيها السعر يمكن تسعيره من صيغ البروتوكول نفسه دون افتراض أي شيء — أما الذي يتجاوزها بخطوة فلا، لأن سيولة مركز آخر قد تبدأ هناك، وهذا التطبيق لا يقرأ السيولة عند كل سعر.",
    selling: (token: string) => `بيع ${token} إلى التجمّع`,
    amount: (amount: string, symbol: string) => `${amount} ${symbol}`,
    largest: "أكبر تبادل يمكن تسعيره هنا",
    largestNote:
      "ما يدخل قبل أن يبلغ السعر نهاية الخطوة التي هو فيها. ليس حدًّا: التبادل الأكبر ينجح، لكن هذه الصفحة لا تستطيع قول كم يكلّف.",
    cost: "ما يتخلّى عنه",
    costNote: "كم يبعد متوسط التبادل عن السعر المعروض على الشاشة.",
    oneSideOnly:
      "يُعرض اتجاه واحد فقط. فالسعر قريب من نهاية خطوته إلى حدّ يجعل المتّسع في الاتجاه الآخر خطأ تقريب لا تبادلًا، وهذه الصفحة لا تطبع رقمًا لا تستطيع التحقق منه.",
    geometric:
      "هذا المتوسط هو الوسط الهندسي لسعر الآن والسعر الذي ينتهي عنده التبادل — الهوية نفسها التي تقوم عليها المراكز الأحادية الجانب أعلاه، منظورًا إليها من الجهة الأخرى من الصفقة. فالتبادل العابر لحزمة يدفعه، والمركز القائم في تلك الحزمة يتلقّاه.",
    whyItDiffers:
      "الاتجاهان ليسا بالحجم نفسه لأن السعر يقع في موضع ما داخل خطوته لا في منتصفها. وما يستحق المقارنة بين التجمّعات هو الحجم نفسه: فهو ما يستوعبه هذا السوق قبل أن يتحرّك، وهو سبب تقسيم أي أحد أمرًا كبيرًا إلى أوامر صغيرة بدل إرساله دفعة واحدة.",
    hookMayAlter:
      "يُسمح للـ hook في هذا التجمّع بتغيير تكلفة التبادل: أن يعيد كتابة الرسوم مع كل تبادل، أو أن يسعّر التبادل بنفسه بدل منحنى التجمّع، أو أن يأخذ حصة منه بعد ذلك؛ وقسم الـ hook أعلاه يبيّن أيّها. الأرقام هنا هي ما يتقاضاه منحنى التجمّع، ولا تصحّ إلا إذا لم يتدخّل الـ hook. ولا شيء مما قُرئ هنا يستطيع أن يقول إن كان يتدخّل.",
    unavailable: "لا يمكن استخراج تكلفة التبادل لهذا التجمّع.",
  },

  compare: {
    heading: "كل مستويات الرسوم لهذا الزوج، جنبًا إلى جنب",
    intro: (pair: string) =>
      `قُرئ كل تجمّع ${pair} أدناه بالأفق نفسه والاتساع نفسه والإيداع نفسه، فتقف أرقامه على الأساس نفسه. إنها تصف أيامًا مضت، لا الأيام المقبلة. تجمّعات v3 مرتبة حسب الرسوم، وتجمّعات v4 من الأعمق إلى الأقل كما توضح الملاحظة تحتها؛ ولا يُرتَّب أيّ منها حسب ما كان سيكسبه.`,
    depositFeesNote: (days: string) => `خلال ${days} يومًا بقي فيها السعر داخل النطاق.`,
    daysInside: "أيام كاملة داخل النطاق",
    daysInsideValue: (inside: string, measured: string) => `${inside} من ${measured}`,
    unavailable: "تعذّرت قراءة هذا المستوى الآن.",
    open: "افتح التحليل الكامل",
    link: "ضع المستويات جنبًا إلى جنب",
    onlyOne: (pair: string) =>
      `يُتداول ${pair} في تجمّع v3 واحد فقط، فلا شيء يوضع بجانبه.`,
    readTogether:
      "الرسوم نصف الصورة. ما يتخلّى عنه النطاق مقارنةً بمجرد الاحتفاظ بالرمزين موجود في صفحة كل تجمّع، ويجب قراءة الأمرين معًا.",
  },

  feeTiers: {
    heading: "أين يُتداول هذا الزوج أيضًا",
    intro: (pair: string) =>
      `يُتداول ${pair} عند أكثر من مستوى رسوم. كل مستوى تجمّع مستقل بسيولته وتاريخ أسعاره ونطاقه — والأرقام أعلاه تصف هذا التجمّع وحده.`,
    onlyOne: (pair: string) =>
      `يُتداول ${pair} عند هذا المستوى فقط على شبكة إيثيريوم الرئيسية. وكل ما سبق يخصّ الزوج كله، لأن الزوج هو هذا التجمّع الواحد.`,
    thisOne: "هذا الذي تقرأه",
    feeTier: "مستوى الرسوم",
    holds: "يحمل",
    reservesUnread: "تعذّرت قراءة ما يحمله هذا التجمّع من السلسلة.",
    open: "حلّل هذا المستوى",
    biggerIsNotBetter:
      "المستوى الذي يحمل سيولة أكبر هو جمع أكبر يتقاسم رسوم التبادل نفسها، لا موضع أفضل. وأيّها يناسب مركزًا يعتمد على مدى تحرّك السعر وعدد مرّاته، وهذا يُقاس لكل تجمّع على حدة — فالطريق الأمين للمقارنة هو فتح كلٍّ منها وقراءة أرقامه. والأفق والمعامل اللذان اخترتهما ينتقلان مع الرابط.",
    reservesNote:
      "هذه هي الأرصدة التي يعلنها عقدا الرمزين لكل تجمّع، مقروءةً من السلسلة لا من مفهرس. وقد قيس رقم المفهرس نفسه مقابلها فتبيّن أنه يضخّم الموجود بين 1.3 و13 ضعفًا، ولذلك لا يُعرض. مقدارا رمزين بدل رقم واحد بالدولار، لأن كل مستوى هنا يحمل الرمزين نفسيهما ولا يلزم تسعير شيء للمقارنة بينها.",
    unavailableHeading: "تعذّرت قراءة مستويات الرسوم الأخرى لهذا الزوج",

    onV3: "على Uniswap v3",
    onV4: "على Uniswap v4",
    v4Intro: (pair: string) =>
      `تجمّعات v4 التي تتداول ${pair} — العقدان نفساهما. وزوج v4 قد يكون تجمّعات كثيرة: الرسم أي رقم، والخطوة السعرية حرّة، وكل hook ينشئ تجمّعًا آخر.`,
    v4None: (pair: string) => `لا يتداول أي تجمّع في Uniswap v4 زوج ${pair} بهذين العقدين.`,
    v4OnlyThis: (pair: string) => `على v4، يُتداول ${pair} في هذا التجمّع وحده.`,
    v3Intro: (pair: string) =>
      `تجمّعات v3 التي تتداول ${pair} — عقدا الرمزين نفساهما، عند كل مستوى رسوم.`,
    v3None: (pair: string) => `لا يتداول أي تجمّع في Uniswap v3 زوج ${pair} بهذين العقدين.`,
    v3NoNative:
      "يحمل هذا التجمّع الإيثر الأصلي للسلسلة، وv3 لا تستطيع ذلك: فكل عملة في v3 عقد رمز. وأقرب تجمّعات v3 إليه تتداول الإيثر المغلّف، وهو رمز مختلف بالنسبة إلى تجمّع.",
    depth: "العمق عند السعر الحالي",
    depthValue: (ether: string) => `≈ ${ether} ETH`,
    stateUnread: "تعذّرت قراءة سيولة التجمّع من السلسلة.",
    hook: "hook",
    noHook: "بلا hook",
    hookAltersSwaps: "قد يغيّر تكلفة التبادل",
    priceStep: (step: string) => `خطوة ${step}`,
    v4Ordering:
      "مرتّبة بالعمق عند السعر الحالي — سيولة التجمّع النشطة وسعره، مقروءين من مخزن PoolManager — لأن زوج v4 معظمه تجمّعات أنشأها أحدهم ثم تركها، والعمق هو ما يميّزها. وهو يقول كم يمكن للتبادل أن يسحب، ولا يقول شيئًا عن أي تجمّع أفضل: فالتجمّع الأعمق جمع أكبر يتقاسم الرسوم نفسها.",
    moreNotShown: (count: string) => `${count} أخرى لا تُعرض؛ فهي أقل عمقًا من هذه.`,
    v4Unavailable: "تعذّرت قراءة تجمّعات v4 لهذا الزوج",
    v3Unavailable: "تعذّرت قراءة تجمّعات v3 لهذا الزوج",
  },

  widths: {
    heading: "الاتساعات الأخرى",
    intro:
      "الطريقة نفسها عند كل اتساع يعرضه النموذج، ليُرى التنازل بدل أن يُحكى: النطاق الأوسع يحتوي أيامًا أكثر، ويوزّع الإيداع نفسه على أسعار أكثر — وهذا هو العمود الأخير، وهو حساب البروتوكول لا تقدير.",
    width: "الاتساع",
    range: "النطاق",
    recent: (days: string) => `داخل النطاق، من آخر ${days} يومًا`,
    unseen: "داخل النطاق، في أيام لم يرها قط",
    insideOf: (inside: string, total: string) => `${inside} من ${total}`,
    unseenNone: "التاريخ غير كافٍ",
    feeShare: "حصة الرسوم أثناء الوجود داخل النطاق",
    feeShareValue: (times: string) => `${times}×`,
    chosen: "المعروض أعلاه",
    columnsNote:
      "العدّ الأول يخصّ الأيام التي رُسم منها كل نطاق، فيقول كيف وُوئم ذلك الاتساع لا كيف صمد. والثاني هو الفحص أعلاه، منفّذًا لكل اتساع: الطريقة مُعادة أفقًا إلى الوراء وموضوعة فوق الأيام التالية.",
    feeShareNote:
      "العمود الأخير هو ما كان الإيداع نفسه ليأخذه من الرسوم المتقاضاة في يوم يبقى فيه السعر داخل ذلك النطاق، قياسًا إلى الاتساع المعروض أعلاه — ولذلك يظهر ذاك كواحد. وهو حساب المراكز في البروتوكول نفسه لا تقدير: فالنطاق الأضيق يحوّل المال نفسه إلى سيولة أكبر على أسعار أقل. ويفترض أن بقية سيولة التجمّع لم تتغيّر، وهو ما لا يبقى صحيحًا مع إيداع كبير بما يكفي لتحريكها، ولا يقول شيئًا عن الأيام التي يقضيها السعر خارج النطاق.",
    notAdvice:
      "لا شيء من هذه توصية. فالنطاق الأضيق يأخذ حصة أكبر في الأيام التي يصمد فيها ولا يأخذ شيئًا البتة في الأيام التي لا يصمد، وأيّهما أهمّ يعتمد على الغرض من المركز — وهو ما لا يعرفه شيء هنا.",
  },

  parameters: {
    heading: "غيّر النطاق",
    apply: "أعد الحساب",
    horizonLabel: "إلى أي مدى",
    widthLabel: "ما اتساعه",
    depositLabel: "كم المبلغ",
    days: (days: string) => `${days} يومًا`,
    sigma: (value: string) => `${value}σ`,
    widthChoice: (sigma: string, word: string | null) => (word === null ? sigma : `${word} (${sigma})`),
    widthWords: { tight: "ضيّق", medium: "متوسط", wide: "واسع", veryWide: "واسع جدًا" },
    note: "الأفق يقول إلى أي مدى تُمدّ الحركة المقيسة إلى الأمام. وهو لا يغيّر القياس: فالتقلّب يأتي دائمًا من آخر 30 يومًا مكتملًا، أيًّا كان الأفق المختار. والاتساع يضاعف تلك الحركة؛ والنطاق الأوسع يُغادَر أقل، وهو ليس مستوى ثقة.",
    fellBack:
      "تعذّرت قراءة جزء مما طُلب، فاستُخدم الإعداد الافتراضي حيث حدث ذلك. والأفق والاتساع المستخدمان فعلًا معروضان أعلاه.",
    preferenceHint:
      "هذا يغيّر هذه الصفحة وحدها. لتغيير ما يُفتح به كل مجمّع، استخدم تفضيلات النطاق في الترويسة.",
  },

  holdings: {
    heading: "ما الذي يملكه هذا العنوان",
    intro:
      "الرموز الموجودة في هذا العنوان، والمجمّعات التي يمكن أن تدخلها. لا يُحفظ هنا شيء ما لم تطلب تنبيهات تيليغرام أدناه، والعنوان معلومة علنية — القائمة نفسها يراها كل من يبحث عنه.",
    forAddress: "العنوان",
    loading: "تُسأل عقود الرموز عمّا يملكه هذا العنوان…",
    howItLooked: (tokens: string, v3Pools: string, v4Pools: string | null) =>
      `رصيد الرمز موجود داخل عقد الرمز نفسه، فلا توجد قائمة بما يملكه عنوان — بل رموز يمكن سؤالها، واحدًا واحدًا. وقد سُئل هنا ${tokens} منها: كل رمز في أكثر ${v3Pools} تجمّعًا تداولًا في Uniswap v3 على شبكة إيثيريوم الرئيسية${v4Pools === null ? "" : `، وكل عملة في تجمّعات v4 الـ ${v4Pools} الأكثر تداولًا خلال الأيام السبعة الماضية، ومنها الإيثر الأصلي للسلسلة`}. وما يُملك خارج تلك المجموعة ليس غائبًا عن هذه الصفحة لأن العنوان لا يملكه.`,
    v4NotSearched:
      "لم يُبحث في تجمّعات Uniswap v4: تعذّرت قراءة قائمتها. والإيثر وعملات تجمّعات v4 غائبة عن هذه الصفحة لهذا السبب لا لغيره.",
    hookTag: "hook",
    holdingsHeading: "الرموز الموجودة",
    nothingFound:
      "لم يُعثر على أي من الرموز المفحوصة في هذا العنوان. وهذا ليس كالمحفظة الفارغة — انظر أعلاه كيف جرى البحث.",
    poolsHeading: "التجمّعات التي يمكن أن تذهب إليها هذه الرموز",
    bothSides: "تملك الجانبين",
    oneSide: "تملك جانبًا واحدًا",
    bothSidesNote:
      "وُجد رمزا هذا التجمّع كلاهما في العنوان، فالمركز هنا لا يحتاج إلى تبادل مسبق.",
    oneSideNote:
      "وُجد أحد رمزي هذا التجمّع. والمركز هنا يحتاج إلى الجانب الآخر أيضًا، أي تبادل جزء مما تملك.",
    moreNotShown: (count: string) =>
      `${count} أخرى لا تُعرض. والمعروضة أعلاه هي الأكثر تداولًا منها، بالترتيب الذي يعلنه مصدر البيانات — وهو ادّعاء عن مدى نشاط التجمّع ولا شيء غيره.`,
    analyse: "حلّل هذا التجمّع",
    notAdvice:
      "هذه قائمة بما هو ممكن، لا بما يستحق الفعل. وأيّ هذه التجمّعات يناسب شيئًا يعتمد على أرقام صفحة كل تجمّع، وعلى الغرض من المركز — ولا تعرف هذه القائمة أيًّا منهما.",
    unavailableHeading: "تعذّرت قراءة هذا العنوان",
    invalidAddress: "هذا ليس عنوان إيثيريوم، فلم يُبحث عن شيء.",
    noAddress: "اربط محفظة في الصفحة الرئيسية، وستعرض هذه الصفحة ما تملكه.",
  },

  v4: {
    heading: "تجمّع Uniswap v4",
    intro:
      "ما هذا التجمّع، مقروءًا من مفتاحه نفسه. تجمّع v4 ليس عقدًا مستقلًا: فهو يعيش داخل PoolManager واحد ويُسمّى بتجزئة الأشياء الخمسة التي تعرّفه — العملتان، والرسم، والخطوة السعرية، والـ hook.",
    poolId: "معرّف التجمّع",
    pair: "العملتان",
    fee: "الرسم",
    feeNote: (swap: string, lp: string, protocol: string) =>
      `مقروء من مفتاح التجمّع نفسه على السلسلة. يدفع التبادل ${swap}: منها ${lp} لمزوّدي السيولة، و${protocol} للبروتوكول فوق ذلك.`,
    feeNoteNoProtocol:
      "مقروء من مفتاح التجمّع نفسه على السلسلة. ولا يأخذ البروتوكول شيئًا فوقه، فهذا ما يدفعه التبادل.",
    dynamicFee: "يحدّده الـ hook، لكل تبادل",
    dynamicFeeNote:
      "يحمل مفتاح هذا التجمّع علامة الرسم المتغيّر بدل رسم ثابت، فتكلفة التبادل يقرّرها الـ hook في لحظة وقوعه. ولم ترصد هذه القراءة أي تبادل، فليس هنا رسم يُذكر.",
    feeUnread: "لم يُقرأ الرسم",
    feeUnreadNote:
      "رسم التجمّع موجود في المفتاح الذي أُنشئ به، على السلسلة، ولم تستطع هذه القراءة جلبه. ولا شيء آخر يقوم مقامه.",
    protocolFee: "رسم البروتوكول",
    protocolFeeNone: "لا يوجد",
    protocolFeeNote:
      "يأخذه البروتوكول فوق رسم التجمّع، في كل تبادل. تحدّده الحوكمة، ويُقرأ من حالة التجمّع على السلسلة.",
    protocolFeeByDirection: (token0: string, token1: string) =>
      `يختلف باختلاف الاتجاه: الأول حين يُباع ${token0}، والثاني حين يُباع ${token1}.`,
    priceStep: "الخطوة السعرية",
    priceStepNote: (spacing: string) =>
      `أدقّ خطوة يمكن أن تُوضع عندها حافّتا مركز في هذا التجمّع — تباعد الـ tick لديه وقدره ${spacing}. وهي جزء من مفتاح التجمّع في v4، فهي بخلاف v3 لا تحتاج إلى استدعاء عقد منفصل.`,
    nativeCurrency: "إيثر أصلي",
    nativeCurrencyNote:
      "العنوان الصفري هنا ليس حقلًا ناقصًا. فـ v4 تتيح للتجمّع أن يحمل الإيثر الأصلي للسلسلة بدل رمز مغلّف، وهذا ما يحدث هنا.",
    hookHeading: "الـ hook",
    noHook: "يعمل هذا التجمّع بلا hook.",
    noHookNote: "لا يعمل شيء إلى جانب تبادلاته أو إيداعاته، فهو يتصرّف كما يتصرّف تجمّع v3.",
    hookMay: "ما المسموح له أن يفعله",
    permissionTopics: {
      swaps: "حول التبادلات",
      liquidity: "حول الإيداعات والسحوبات",
      creation: "حين أُنشئ التجمّع",
      donations: "حول التبرّعات",
    } satisfies Record<HookTopic, string>,
    permissionWords: {
      beforeSwap:
        "يعمل قبل كل تبادل، وله هناك أن يرفض التبادل، وفي تجمّع ذي رسم متغيّر أن يحدّد ما يدفعه ذلك التبادل.",
      afterSwap: "يعمل بعد كل تبادل، وله هناك أن يرفض التبادل بعد.",
      beforeSwapReturnsDelta:
        "يأخذ رموزًا من التبادل، أو يضع رموزه هو، قبل أن يسعّره التجمّع — فالتبادل هنا لا يلزم أن يتبع منحنى التجمّع نفسه.",
      afterSwapReturnsDelta: "يأخذ حصة من التبادل بعد أن يسعّره التجمّع.",
      beforeAddLiquidity: "يعمل قبل كل إيداع، وله هناك أن يرفض الإيداع.",
      afterAddLiquidity: "يعمل بعد كل إيداع، وله هناك أن يرفض الإيداع بعد.",
      afterAddLiquidityReturnsDelta: "يأخذ رموزًا من الإيداع وهو يُنفَّذ، أو يضيف إليه رموزًا.",
      beforeRemoveLiquidity: "يعمل قبل كل سحب، وله هناك أن يرفض السحب.",
      afterRemoveLiquidity: "يعمل بعد كل سحب، وله هناك أن يرفض السحب بعد.",
      afterRemoveLiquidityReturnsDelta: "يأخذ حصة من السحب وهو يُنفَّذ، أو يضيف إليه رموزًا.",
      beforeInitialize: "عمل مرة واحدة، قبل إنشاء التجمّع. وقد حدث ذلك بالفعل.",
      afterInitialize: "عمل مرة واحدة، بعد إنشاء التجمّع. وقد حدث ذلك بالفعل.",
      beforeDonate: "يعمل قبل التبرّع لمزوّدي التجمّع، وله هناك أن يرفض التبرّع.",
      afterDonate: "يعمل بعد التبرّع لمزوّدي التجمّع، وله هناك أن يرفض التبرّع بعد.",
    } satisfies Record<HookPermission, string>,
    noPermissions:
      "لا شيء حول التبادلات أو الإيداعات أو التبرّعات: فالبروتوكول لا يستدعيه في أي من تلك اللحظات. وما يبقى في وسع hook كهذا هو تحديد رسم تجمّع رسمه متغيّر.",
    permissionNames: "أسماء البروتوكول نفسه لهذه",
    withdrawalWarning: (share: boolean): string =>
      share
        ? "يعمل هذا الـ hook حين يسحب مزوّد. ويُسمح له برفض السحب وبأخذ حصة مما يُسحب. أما هل يفعل ذلك يومًا فلا سبيل إلى معرفته من هنا."
        : "يعمل هذا الـ hook حين يسحب مزوّد، ويُسمح له برفض السحب. أما هل يفعل ذلك يومًا فلا سبيل إلى معرفته من هنا.",
    hookAddressIsThePermission:
      "تُقرأ هذه من عنوان الـ hook نفسه. فـ v4 لا تخزّن صلاحيات الـ hook في أي مكان: إذ يُنشر الـ hook على عنوان تُملي بتّاته الأربع عشرة الأخيرة أي الاستدعاءات سينفّذها PoolManager، ويفحص PoolManager تلك البتّات بدل أن يسأل العقد. فهذا يقول ما يُسمح للـ hook أن يفعله، لا ما يفعله — فمن يُسمح له بإعادة كتابة الرسم في كل تبادل قد يُعيد الرسم نفسه دائمًا، وذلك ما لا سبيل إلى معرفته من هنا.",
    alterSwapWarning:
      "يُسمح لهذا الـ hook بتغيير تكلفة التبادل أو عائده. وكل رقم مستخرج من تاريخ الأسعار — نطاق مقترح، مستوى رسوم، مقارنة بالاحتفاظ البسيط — يفترض أن التجمّع يتقاضى ما يعلنه ويدفع ما يقوله المنحنى. ولا أحد من الافتراضين آمن هنا، ولا شيء من ذلك ظاهر في سلسلة أسعار.",
    analysisScope:
      "في الأسفل تحليل النطاق. والنطاق مستمدّ من أسعار وقعت بالفعل، فهو يصمد هنا تمامًا كما يصمد لتجمّع بلا hook — فالـ hook لا يستطيع تغيير أين ذهب السعر بأثر رجعي. أما ما يستطيع الـ hook تغييره فهو تكلفة التبادل، ولذلك يُقاس المعدّل الذي تقاضاه هذا التجمّع مما حصّله بدل أن يُؤخذ من الرسم أعلاه.",
    unavailableHeading: "تعذّرت قراءة هذا التجمّع",
    invalidId:
      "هذا ليس معرّف تجمّع v4. فتجمّع v4 يُسمّى بتجزئة من 32 بايت — 0x يتبعها 64 حرفًا ست عشريًا — لا بعنوان عقد.",
    noId: "ألصق معرّف تجمّع v4 لترى ما هو التجمّع وما الذي قد يفعله hook الخاص به.",
    loading: "يُقرأ تجمّع v4 هذا، من المفهرس ومن السلسلة…",
  },

  notFound: {
    title: "لا توجد صفحة هنا",
    body: "العنوان الذي اتّبعته لا يسمّي شيئًا يقدّمه هذا التطبيق. فالتجمّع يُبلغ بعنوانه، أو بمعرّفه في v4 — وكلاهما يوضع في صندوق البحث لا في المسار.",
    search: "ابحث عن تجمّع ←",
  },

  hooks: {
    heading: "الخطّافات العاملة على Uniswap v4",
    loading: "تُقرأ أكثر تجمّعات v4 نشاطًا هذا الأسبوع…",
    intro:
      "لكل تجمّع v4 أن يسمّي hook: عقدًا يستدعيه PoolManager في لحظات محدّدة من التبادل والإيداع والسحب. وأيّ اللحظات ليس وعدًا يقطعه أحد. بل هو منقوش في عنوان الـ hook — فالبتّات الأربع عشرة الدنيا هي القائمة، والبروتوكول يرفض استدعاء العقد لأي شيء خارجها.",
    onlyPermissions:
      "هذا كل ما تعرفه هذه الصفحة، وهو جدير بأن يُعرف تحديدًا لأنه مفروض لا مدّعى. أما ما يفعله الـ hook بصلاحية ما فموجود في شيفرته. وهذا التطبيق لا يقرأ الشيفرة، ولا يحتفظ بأي قائمة لخطّافات زكّاها أحد — وكلاهما ادّعاء لا يستطيع التحقق منه، بجوار أرقام يستطيع.",
    window: (pools: string, hooked: string, hookless: string) =>
      `مقروء من تجمّعات أكثر أيام v4 نشاطًا هذا الأسبوع — وعددها ${pools}. منها ${hooked} تسمّي hook؛ و${hookless} لا تسمّي شيئًا، وتتصرّف كما يتصرّف تجمّع v3.`,
    ordering:
      "مرتّبة بعدد تلك التجمّعات التي يعمل فيها كل hook. وهذا عدّ للتجمّعات ولا شيء غيره: فالـ hook الموجود في كثير منها هو hook أنشأ به أحدهم تجمّعات كثيرة.",
    runs: (count: string) => `يعمل في ${count} منها`,
    poolsHeading: "أين يعمل",
    moreNotShown: (count: string) => `و${count} أخرى`,
    none: "لا يسمّي أي تجمّع من أكثر أيام v4 نشاطًا هذا الأسبوع أي hook.",
    unavailable: "تعذّرت قراءة تجمّعات v4 لهذا الأسبوع، فلا دليل لعرضه.",
    fromHome: "اعرض كل الخطّافات ←",
  },

  positions: {
    heading: "المراكز التي يملكها هذا العنوان بالفعل",
    intro:
      "كل ما سبق هو ما يمكن لهذا العنوان أن يفعله — أي التجمّعات تفتحها رموزه. وهذا ما فعله بالفعل. والمركز في كلا البروتوكولين رمز يحمله عقد واحد، ويُسأل العقدان كلاهما عمّا يكونه كل رمز. كما يستطيع عقد v3 أن يعدّد رموز عنوان ما؛ أما عقد v4 فلا، ولذلك تأتي تلك القائمة من مفهرس ويُعاد كل معرّف فيها إلى السلسلة، التي تُسأل عمّن يملكه.",
    none: "لا يملك هذا العنوان أي رمز مركز في Uniswap، في أي من البروتوكولين.",
    noneOpen:
      "كل رموز المراكز التي يملكها هذا العنوان أُغلقت. والمغلق إيصال لمركز كان، لا مركز.",
    counts: (held: string, open: string, closed: string) =>
      `${held} رمز مركز، منها ${open} ما زالت فيها سيولة و${closed} أُغلقت.`,
    inRange: "يكسب الآن",
    outOfRange: "خارج نطاقه",
    rangeUnknown: "لم يبادل أحد هنا",
    analyse: "حلّل هذا التجمّع ←",
    feesEarned: (amount0: string, symbol0: string, amount1: string, symbol1: string) =>
      `مكتسَب ولم يُسحب بعد: ${amount0} ${symbol0} و${amount1} ${symbol1}.`,
    feesNone: "لا شيء مكتسَب بعدُ ليُسحب.",
    feesUnread: "تعذّرت قراءة ما اكتسبه.",
    everyPrice: "كل سعر يستطيع هذا التجمّع التعبير عنه",
    moreNotShown: (count: string) => `${count} أخرى مفتوحة وغير مدرجة هنا.`,
    readCap: (read: string, held: string) =>
      `قُرئ ${read} من ${held}. والباقي ليس في هذه الصفحة، وهذا حدّ من حدود الصفحة لا حدّ من حدود العنوان.`,
    unreadProtocol: (protocol: string) =>
      `تعذّرت قراءة مراكز Uniswap ${protocol} هذه المرة، فكل رقم هنا يخصّ البروتوكول الآخر وحده.`,
    unavailable: "تعذّرت قراءة مراكز هذا العنوان.",
    publicNote:
      "مالك المركز مسجّل على السلسلة، فهذه القائمة علنية: يمكن لأي أحد قراءة القائمة نفسها للعنوان نفسه، وهي لا تقول شيئًا لم ينشره هذا العنوان أصلًا بحيازته هذه الرموز. لا يُحفظ هنا شيء ما لم تطلب تنبيهات تيليغرام أدناه، ولا رقم في هذه الصفحة هو تقييم — النطاق ليس قيمة المركز.",
  },

  wallet: {
    heading: "اربط محفظة",
    intro:
      "اربط محفظة، فتستطيع هذه الصفحة أن ترى أي الرموز يملكها العنوان، وأن تعرض عليك التجمّعات التي يمكن أن تذهب إليها تلك الرموز. إنها تقرأ العنوان؛ وهذا كل ما تُسأل عنه المحفظة هنا.",
    connect: "اربط المحفظة",
    connecting: "في انتظار المحفظة…",
    connectedAs: "متصل باسم",
    showHoldings: "اعرض ما تملكه",
    forget: "انسَ هذا العنوان",
    readOnly:
      "للقراءة فقط. يطلب هذا التطبيق من المحفظة عنوانها ولا يطلب توقيعًا أبدًا: لا يوجد هنا أي كود يستطيع توقيع رسالة أو إرسال معاملة، ولا يُحفظ شيء عن المحفظة بين الزيارات.",
    notices: {
      "wallet-not-found":
        "لم يُعثر على محفظة في هذا المتصفّح. وإضافة محفظة للمتصفّح تضع واحدة؛ وبدونها لا يتغيّر شيء في هذه الصفحة.",
      "wallet-request-declined": "رُفض الطلب في المحفظة. لم يُقرأ شيء ولم يُرسل شيء.",
      "wallet-request-failed": "تعذّر سؤال المحفظة عن عنوان. لم يُقرأ شيء ولم يُرسل شيء.",
      "wallet-no-account":
        "أجابت المحفظة بلا عنوان، وهذا يعني غالبًا أنها مقفلة أو لا حساب مختارًا فيها.",
    },
  },

  telegram: {
    heading: "تنبيهات عبر تيليغرام",
    intro:
      "اعرف عبر تيليغرام متى يقترب أحد مراكز هذا العنوان من حافة نطاقه أو يخرج منه أو يعود إليه. الزر يأخذك إلى بوت هذا الموقع؛ وبالضغط على «ابدأ» هناك تُربط تلك المحادثة بهذا العنوان. ما يُحفظ هو العنوان والمعرّف الرقمي للمحادثة — لا شيء غيرهما — ويُمحى كلاهما من الخادم لحظة إرسالك /stop إلى البوت أو نسيانك الرابط هنا، ومن نسخه الاحتياطية المشفّرة خلال سبعة أيام. أما تكرار الفحص فيحدده الخادم الذي يعمل عليه هذا.",
    connect: "ربط تيليغرام",
    connected: (address: string) => `هذا المتصفح مربوط: يُراقَب ${address}.`,
    pending: "الرابط بانتظارك: افتح محادثة البوت في تيليغرام واضغط «ابدأ».",
    forget: "نسيان الرابط",
    notConfigured: "تنبيهات تيليغرام غير مهيأة على هذا الخادم.",
    publicNote:
      "لا يحتاج أحد إلى امتلاك عنوان ليتابعه — المراكز علنية، والتنبيه لا يقول شيئًا لا تقوله هذه القائمة. البوت يقرأ السلسلة ويرسل رسالة؛ ولا يستطيع توقيع شيء ولا إرسال شيء.",
    linked: (address: string) =>
      `تم الربط. ستُخبَر هنا عندما يقترب مركز في ${address} من حافة نطاقه أو يخرج منه أو يعود إليه. أرسل /stop للإنهاء.`,
    unknownStart:
      "هذا الرابط غير معروف أو انتهت صلاحيته. اضغط «ربط تيليغرام» في الموقع مرة أخرى.",
    alreadyClaimed:
      "هذا الرابط استُخدم من محادثة أخرى. اضغط «ربط تيليغرام» في الموقع مرة أخرى للحصول على رابط جديد.",
    stopped: "توقّف. هذه المحادثة لا تتابع شيئًا الآن. مُحي السجل من الخادم، وسيُمحى من النسخ الاحتياطية المشفّرة خلال سبعة أيام.",
    nothingToStop: "هذه المحادثة لم تكن تتابع شيئًا.",
    help:
      "هذا البوت يتابع فقط العنوان الذي ربطته في الموقع، ولا يتكلم إلا عندما يقترب مركز من حافة نطاقه أو يخرج منه أو يعود إليه. أرسل /stop للإنهاء.",
    storeDown: "تعذّر فحص الرابط الآن. حاول مجددًا بعد دقيقة.",
    left: (pair: string, protocol: string, range: string) =>
      `⚠️ خرج ${pair} (${protocol}) من نطاقه: ${range}. يحمل رمزًا واحدًا ولا يكسب شيئًا حتى يعود السعر.`,
    nearing: (pair: string, protocol: string, range: string, price: string, edge: string) =>
      `⏳ اقترب ${pair} (${protocol}) من حافة نطاقه: ${range}. السعر الآن ${price}؛ وبعد ${edge} يحمل رمزًا واحدًا ولا يكسب شيئًا.`,
    entered: (pair: string, protocol: string, range: string) =>
      `✅ عاد ${pair} (${protocol}) إلى نطاقه: ${range}. يكسب من جديد.`,
    opened: (pair: string, protocol: string, range: string) => `مركز جديد: ${pair} (${protocol})، ${range}.`,
    closed: (protocol: string, tokenId: string) => `أُغلق: مركز ${protocol} رقم ${tokenId}.`,
    footer:
      "للمعلومات فقط — ليست نصيحة مالية. مقروءة من بيانات السلسلة العلنية؛ لا شيء هنا يستطيع التصرف نيابةً عنك.",
  },

  search: {
    label: "زوج، أو عنوان تجمّع v3، أو معرّف تجمّع v4",
    placeholder: "WETH/USDC",
    help: "اكتب زوجًا مثل WETH/USDC، أو ألصق عنوان عقد تجمّع v3، أو ألصق معرّف تجمّع v4 — وهو التجزئة ذات 32 بايت التي يُسمّى بها تجمّع v4. للقراءة فقط: هذا التطبيق لا يوقّع شيئًا أبدًا ولا يرسل معاملة أبدًا.",
    submit: "ابحث عن التجمّعات",

    heading: "تجمّعات Uniswap v3 المطابقة",
    resultsFor: (terms: string) => `تجمّعات تطابق رموزها ${terms}.`,
    empty: (terms: string) =>
      `لا يوجد تجمّع Uniswap v3 على شبكة إيثيريوم الرئيسية فيه رمز يطابق ${terms}.`,
    emptyHint: "راجع الإملاء، أو ألصق عنوان التجمّع إن كان لديك.",

    v4Heading: "تجمّعات Uniswap v4 المطابقة",
    v4Empty: (terms: string) =>
      `لا يوجد تجمّع Uniswap v4 على شبكة إيثيريوم الرئيسية فيه عملة تطابق ${terms}.`,
    v4Depth: "العمق عند السعر الحالي",
    v4DepthValue: (ether: string) => `≈ ${ether} ETH`,
    v4DepthNote:
      "كم تساوي سيولة التجمّع النشطة الآن، مقروءةً من مخزن PoolManager نفسه — لا ما يحمله التجمّع، وهو ما لا يعلنه أي تجمّع v4 عن نفسه.",
    v4StateUnread: "تعذّرت قراءة سيولة التجمّع من السلسلة.",
    v4Hook: "Hook",
    v4NoHook: "لا يوجد",
    v4HookAltersSwaps: "قد يغيّر تكلفة التبادل",
    v4Ordering:
      "التجمّعات المسمّاة تمامًا بما بحثت عنه تأتي أولًا. وبعدها يتبع الترتيب عمق كل تجمّع عند سعره الحالي — سيولته النشطة وسعره، مقروءين من مخزن PoolManager وموضوعين على مقياس واحد باستعمال الأسعار التي يشتقّها مصدر البيانات. لا ما يحمله التجمّع: فرموز كل تجمّعات v4 تقع معًا في PoolManager واحد، ولا شيء على السلسلة يعلنها لكل تجمّع. وقد فُحص رقم السيولة لدى المفهرس نفسه مقابل السلسلة فانحرف بخمسة عشر بالمئة في أحد أكثر التجمّعات نشاطًا، ولذلك لا يُستعمل.",

    ordering:
      "التجمّعات المسمّاة تمامًا بما بحثت عنه تأتي أولًا. وبعدها يتبع الترتيب ما يحمله كل تجمّع فعلًا، مقروءًا من عقود الرموز نفسها وموضوعًا على مقياس واحد باستعمال الأسعار التي يشتقّها مصدر البيانات. وكان يتبع سابقًا القيمة التي يعلن المصدر أنها مودعة في كل تجمّع، وكان ذلك الرقم خاطئًا بما يكفي لإعادة ترتيب هذه القائمة: فقد نُشر هنا تجمّع بتسعة ملايين دولار من السيولة المعلَنة بينما كانت عقوده تحمل تسعة آلاف.",
    windowing:
      "هذه القائمة مستمدّة من التجمّعات التي يعلن مصدر البيانات أنها الأكثر تداولًا لمصطلحاتك، والتجمّع الهادئ بما يكفي ليقع خارج تلك المجموعة لا يبلغ الترتيب أعلاه أبدًا. وهذا هو الحدّ الأمين للترتيب داخل ما اختار مصدر أن يعيده: فالتجمّع الذي يحمل الكثير ويُتداول نادرًا قد يغيب عن هذه الصفحة.",
    dormantNote:
      "المجمّع الذي لم يحدث فيه شيء منذ شهر لا يُدرج. النطاق يُرسم من أسعار الشهر الأخير، والمجمّع الذي لا شهر له لا شيء يُرسم منه — وفتحه لن يقول سوى ذلك.",
    v4Windowing:
      "هذه القائمة مستمدّة من تجمّعات v4 الأكثر تداولًا على شبكة إيثيريوم الرئيسية خلال الأيام السبعة الماضية — أي أنشط ألف يوم-تجمّع، وهي بضع مئات من التجمّعات — والتجمّع الأهدأ من ذلك لا يبلغ هذه الصفحة أبدًا. فالمصدر لا يستطيع الإجابة عن بحث في كل تجمّعات v4 قبل أن تكفّ هذه الصفحة عن الانتظار، ولذلك تقوم النافذة على النشاط الأخير لا على مصطلحاتك: فالتجمّع الموجود الذي لم يُتداول هذا الأسبوع ليس هنا.",
    symbolWarning:
      "الرمز يأتي من عقد الرمز نفسه، ونشر رمز يسمّي نفسه USDC لا يكلّف شيئًا. وعناوين العقود تحت كل زوج هي ما يميّز رمزين.",

    feeTier: "مستوى الرسوم",
    holds: "يحمل",
    reservesUnread: "تعذّرت قراءة ما يحمله هذا التجمّع من السلسلة.",
    moreNotShown: (count: string) =>
      `${count} أخرى لا تُعرض. والمعروضة أعلاه هي الأكثر تداولًا منها، بالترتيب الذي يعلنه مصدر البيانات — وهو ادّعاء عن مدى نشاط التجمّع ولا شيء غيره.`,
    analyse: "حلّل هذا التجمّع",
    v4FeeNote:
      "يُقرأ رسم كل تجمّع من المفتاح الذي أُنشئ به، على السلسلة، لا من مصدر البيانات — الذي تبيّن أن رقم رسومه هو مجموع ما دفعه آخر تبادل، بما فيه حصة البروتوكول، لا رسم التجمّع نفسه. والصف الذي تعذّرت قراءة مفتاحه يقول ذلك.",

    unavailableHeading: "تعذّر تنفيذ البحث",
    rejected: {
      empty: "اكتب زوجًا مثل WETH/USDC، أو عنوان تجمّع.",
      length: (min: number, max: number) => `مصطلح البحث بين ${min} و${max} حرفًا.`,
      unsupportedCharacters:
        "يمكن أن يحمل مصطلح البحث حروفًا وأرقامًا والعلامات التي تظهر داخل الرموز — ولا شيء غير ذلك.",
    },
  },

  report: {
    steps: {
      pool: "أثناء قراءة إعدادات التجمّع",
      snapshot: "أثناء قراءة حالة السوق الراهنة للتجمّع",
      history: "أثناء قراءة تاريخ الأسعار اليومي للتجمّع",
      volatility: "أثناء قياس مدى تحرّك السعر",
      band: "أثناء بناء حزمة السعر",
      range: "أثناء إسقاط الحزمة على الأسعار التي يستطيع هذا التجمّع التعبير عنها",
      divergence: "أثناء مقارنة ذلك النطاق بالاحتفاظ بالرمزين",
      activity: "أثناء قراءة ما فعله التجمّع خلال النافذة المقيسة",
    },
    noRangeHeading: "لا نطاق لهذا التجمّع",
    stoppedWhile: (step: string) => `توقّف هذا ${step}.`,
    poolSummary: (protocol: string, fee: string, chain: string) =>
      `Uniswap ${protocol} · ${chain} · ${fee}`,
    feePerSwap: (fee: string) => `رسم ${fee} على كل تبادل`,
    feePlusProtocol: (fee: string, protocol: string) =>
      `رسم ${fee} على كل تبادل، إضافةً إلى ${protocol} للبروتوكول`,
    noDeclaredFee: "رسم يحدّده hook الخاص به في كل تبادل",
    caveatsHeading: (count: number) =>
      count === 1 ? "ينطبق تحفّظ واحد على هذه الأرقام." : `تنطبق ${count} تحفّظات على هذه الأرقام.`,
    caveatsAriaLabel: "التحفّظات",

    contentsHeading: "في هذه الصفحة",
    contentsLabel: "أقسام هذا التحليل",
    rangeHeading: "النطاق السعري المقترح",
    rangeIntro: (base: string, quote: string) =>
      `أين سيكون المركز نشطًا في هذا التجمّع، بوصفه سعر ${base} واحد بـ${quote}.`,
    rangeValue: (lower: string, upper: string, quote: string, base: string) =>
      `${lower} – ${upper} ${quote} لكل ${base}`,
    rangeDistances: (down: string, up: string) => `${down} دون السعر الحالي و${up} فوقه.`,
    rangeMeaning:
      "بين هذين السعرين يكسب المركز حصته من رسوم تبادلات التجمّع. وخارجهما يحمل رمزًا واحدًا ولا يكسب شيئًا حتى يعود السعر.",
    priceSentence: (base: string, price: string, quote: string) => `1 ${base} = ${price} ${quote}`,
    currentPrice: "السعر الحالي",
    inRangeYes: "السعر الحالي داخل هذا النطاق.",
    inRangeNo: "السعر الحالي خارج هذا النطاق.",
    inRangeYesNote: "المركز المفتوح هنا سيكون نشطًا فورًا.",
    inRangeNoNote:
      "المركز المفتوح هنا سيحمل رمزًا واحدًا ولن يكسب شيئًا حتى يعود السعر إلى الداخل.",
    beyondEdges: (below: string, above: string) =>
      `إن هبط السعر دون النطاق انتهى المركز حاملًا ${below} فقط؛ وإن ارتفع فوقه فـ${above} فقط.`,
    lowerTruncatedNote:
      "تقف الحافة السفلى عند أدنى سعر يستطيع هذا التجمّع التعبير عنه، قبل الموضع الذي كانت الحزمة لتضعها فيه.",
    upperTruncatedNote:
      "تقف الحافة العليا عند أعلى سعر يستطيع هذا التجمّع التعبير عنه، قبل الموضع الذي كانت الحزمة لتضعها فيه.",
    chartLabel: "أسعار الشهر الأخير مقابل النطاق المقترح",
    chartCaption: (days: string) =>
      `كل يوم من آخر ${days} يومًا: إغلاقه، والمدى من أدناه إلى أعلاه. والحزمة المظلّلة هي النطاق المقترح؛ والخط المتصل هو سعر اليوم.`,
    chartLegend:
      "النقطة الممتلئة يوم بقي داخل النطاق بالكامل؛ والمجوّفة يوم غادره أو عبر حافة.",

    basisHeading: "كيف رُسم هذا النطاق",
    basisIntro: (base: string, days: string) =>
      `من مدى تحرّك سعر ${base} فعلًا خلال آخر ${days} يومًا مكتملًا — لا من تنبّؤ بما سيؤول إليه.`,
    dailyMove: "الحركة اليومية المعتادة",
    dailyMoveNote: "الانحراف المعياري لتغيّر سعر يوم واحد، على مدى النافذة.",
    horizonMove: (days: string) => `على مدى ${days} يومًا`,
    horizonMoveNote:
      "الحركة نفسها ممدودة على الأفق المختار أدناه: انحراف معياري واحد، في كل اتجاه.",
    widthValue: (multiplier: string) => `${multiplier}× من ذلك، في كل اتجاه`,
    widthNote:
      "مختار أدناه. النطاق الأوسع يُغادَر أقل، والإيداع نفسه موزّعًا عليه أرقّ عند أي سعر بعينه.",
    measuredOver: "مقيس على",
    measuredOverNote: (returns: string) => `دخل فيه ${returns} تغيّرًا يوميًا.`,
    epilogue:
      "النطاق مركزه سعر اليوم، ومرسوم بالمسافة نفسها صعودًا وهبوطًا من حيث النسبة — فالتنصيف والمضاعفة حركة واحدة — ولهذا تختلف النسبتان المئويتان. وهو يصف مدى تحرّك السعر، لا إلى أين سيذهب: فهو ليس تنبّؤًا، والاتساع ليس مستوى ثقة. ولا شيء هنا يحدّد حجم مركز ولا يقول كم يُودع من كل رمز.",
  },

  technical: {
    heading: "تفاصيل تقنية",
    summary: "الـ ticks والكتل والأرقام التي تُفحص الصفحة أعلاه مقابلها.",
    lowerTick: "الـ tick الأدنى",
    upperTick: "الـ tick الأعلى",
    currentTick: "الـ tick الحالي",
    sourceReportedTick: (tick: string) => `أعلن المصدر ${tick}.`,
    noSourceTick: "لم يعلن المصدر أي tick خاص به، فهذا التحويل غير متحقَّق منه.",
    tickSpacing: "تباعد الـ ticks",
    tickSpacingNote: (step: string) => `خطوة سعرية قدرها ${step} بين الحافات القابلة للاستعمال.`,
    width: "الاتساع",
    widthValue: (ticks: string, spacings: string) => `${ticks} tick · ${spacings} تباعدًا`,
    poolPrice: "السعر كما يعرضه التجمّع",
    quotePerBase: (quote: string, base: string) => `${quote} لكل ${base}`,
    bandLower: "الحدّ الأدنى للحزمة",
    bandUpper: "الحدّ الأعلى للحزمة",
    bandNote: "قبل الإسقاط على شبكة الـ ticks، في اتجاه التجمّع نفسه.",
    annualised: "التقلّب السنوي",
    annualisedNote: "الانحراف المعياري العيّني للعوائد اللوغاريتمية اليومية، مقيسًا بـ sqrt(365).",
    coverage: "التغطية",
    coverageNote: "كم من النافذة كان وراءه أسعار يومية متتالية.",
    sourceBlock: "كتلة المصدر",
    noBlockTime: "لم يُعلن وقت الكتلة.",
    fetchedAt: "جُلب في",
    fetchedAtNote: "متى وصل الرد، لا ما يصفه.",
    lowerEdge: "الحافة السفلى",
    upperEdge: "الحافة العليا",
    truncated: "مقتطع",
    asAsked: "كما طُلب",
  },

  explanation: {
    heading: "الشرح",
    pending: "يُكتب الشرح…",
    unavailable: "لا يتوفّر شرح لهذا التحليل.",
    sectionWriting: "ما زال قيد الكتابة…",
    sectionMissing: "تعذّرت كتابة هذا الجزء.",
    writtenBy: (model: string) => `كتبه ${model}. أما الأرقام أعلاه فلا.`,
    sections: {
      whatThisRangeMeans: "ماذا يعني هذا النطاق",
      ifPriceLeavesTheRange: "إن غادر السعر النطاق",
      whatTheVolatilitySays: "ماذا يقول التقلّب",
      whatThisDoesNotCover: "ما لا يغطّيه هذا",
    },
  },

  notices: {
    failure: {
      "invalid-pool-address":
        "يجب أن يكون عنوان التجمّع 0x يتبعه 40 حرفًا ست عشريًا، ولا يمكن أن يكون العنوان الصفري.",
      "invalid-search-terms":
        "يأخذ البحث عن التجمّعات مصطلحًا أو مصطلحين قصيرين من حروف وأرقام والعلامات التي تظهر داخل الرموز.",
      "market-data-not-configured": "بيانات سوق Uniswap v3 غير مهيّأة على هذا الخادم.",
      "chain-data-not-configured": "القراءات من السلسلة غير مهيّأة على هذا الخادم.",
      "explanation-not-configured":
        "هذا التطبيق غير مهيّأ لكتابة الشروح، فلا يُعرض أي شرح.",
      "market-data-timed-out": "انتهت مهلة طلب بيانات السوق.",
      "market-data-unreachable": "تعذّر الوصول إلى مصدر بيانات السوق.",
      "market-data-credentials-rejected": "رفض مصدر بيانات السوق بيانات الاعتماد المهيّأة.",
      "market-data-rate-limited": "تُجووز حدّ الطلبات لدى مصدر بيانات السوق.",
      "market-data-unreadable": "أعاد مصدر بيانات السوق ردًّا غير قابل للقراءة.",
      "market-data-malformed":
        "أعاد مصدر بيانات السوق ردًّا لا يستطيع هذا التطبيق التحقق منه.",
      "market-data-indexing-errors":
        "أعلن مصدر بيانات السوق أخطاء فهرسة، فلا يمكن اعتبار أرقامه متحقَّقًا منها.",
      "market-data-stale":
        "مصدر بيانات السوق متأخّر عن السلسلة أكثر مما يسمح باعتبار هذه الأرقام راهنة.",
      "market-data-future-block-time":
        "أعلن مصدر بيانات السوق وقت كتلة يسبق ساعة هذا الخادم، فلا يمكن التحقق من أرقامه.",
      "chain-data-timed-out": "انتهت مهلة طلب البيانات من السلسلة.",
      "chain-data-unreachable": "تعذّر الوصول إلى مصدر البيانات على السلسلة.",
      "chain-data-credentials-rejected":
        "رفض مصدر البيانات على السلسلة بيانات الاعتماد المهيّأة.",
      "chain-data-rate-limited": "تُجووز حدّ الطلبات لدى مصدر البيانات على السلسلة.",
      "chain-data-unreadable": "أعاد مصدر البيانات على السلسلة ردًّا غير قابل للقراءة.",
      "chain-data-malformed":
        "أعاد مصدر البيانات على السلسلة ردًّا لا يستطيع هذا التطبيق التحقق منه.",
      "chain-aggregator-unverified":
        "تُقرأ الأرصدة عبر عقد مساعد على السلسلة، والشيفرة الموجودة في عنوانه ليست الشيفرة التي بُني هذا التطبيق على الوثوق بها، فلم يُقرأ شيء عبره.",
      "pool-not-found":
        "لم يُعثر على أي تجمّع Uniswap v3 لهذا العنوان على شبكة إيثيريوم الرئيسية.",
      "pool-contract-not-found":
        "لم يُجب أي عقد تجمّع Uniswap v3 على هذا العنوان على شبكة إيثيريوم الرئيسية.",
      "pool-configuration-inconsistent":
        "تعذّر التحقق من إعدادات التجمّع المجمّعة من مصدريها.",
      "pool-history-insufficient":
        "لا يملك هذا التجمّع بعدُ تاريخًا يوميًا مكتملًا كافيًا من الأسعار ليُحلَّل.",
      "pool-history-never-traded":
        "هذا التجمّع موجود، لكن لم تجرِ فيه أي مبادلة قط، فلا توجد أسعار يومية يُقاس منها نطاق.",
      "pool-history-dormant":
        "توقّف التداول في هذا التجمّع قبل بداية الفترة التي تُقرأ منها هذه الأسعار اليومية، فلا يوجد تاريخ حديث يُقاس منه نطاق. الانتظار لن يغيّر ذلك؛ وحده استخدام التجمّع من جديد يغيّره.",
      "volatility-invalid-input":
        "تاريخ الأسعار المقدَّم لهذا الحساب ليس تاريخًا معياريًا صالحًا.",
      "volatility-insufficient-history":
        "لا يملك هذا التجمّع أسعارًا يومية متتالية كافية لقياس التقلّب.",
      "volatility-unverifiable":
        "أنتج حساب التقلّب نتيجة لا يستطيع هذا التطبيق التحقق منها.",
      "band-invalid-input":
        "بيانات السوق المقدَّمة لحزمة السعر هذه غير صالحة، أو أن اللقطة والتقلّب يصفان تجمّعين مختلفين.",
      "band-no-current-price":
        "السعر الحالي لهذا التجمّع غير متاح، فلا يمكن تمركز حزمة سعرية.",
      "band-unverifiable":
        "أنتج حساب حزمة السعر نتيجة لا يستطيع هذا التطبيق التحقق منها.",
      "range-invalid-input":
        "التجمّع وحزمة السعر واللقطة المقدَّمة لهذا النطاق غير صالحة، أو أنها لا تصف كلها التجمّع نفسه والرصد نفسه.",
      "range-price-unrepresentable":
        "يقع السعر الحالي لهذا التجمّع خارج المدى الذي تستطيع Uniswap التعبير عنه، فلا يمكن بناء نطاق مركز منه.",
      "range-tick-disagreement":
        "السعر الذي يعلنه المصدر لهذا التجمّع والحالة التي يعلنها لا يصفان اللحظة نفسها، فلا يُنشر أي نطاق.",
      "range-too-narrow":
        "حزمة السعر أضيق من أصغر خطوة يسمح بها هذا التجمّع بين حافّتين، فهي لا تصف حدّي مركز متمايزين.",
      "range-unverifiable": "أنتج حساب النطاق نتيجة لا يستطيع هذا التطبيق التحقق منها.",
      "divergence-unverifiable":
        "أنتجت المقارنة بالاحتفاظ نتيجة لا يستطيع هذا التطبيق التحقق منها.",
      "activity-unverifiable":
        "أنتج نشاط التجمّع الأخير نتيجة لا يستطيع هذا التطبيق التحقق منها.",
      "fee-rate-unmeasurable":
        "لم يتداول هذا التجمّع شيئًا في أي يوم مفهرس من النافذة، فلا يمكن استخراج المعدّل الذي يتقاضاه مما حصّله.",
      "deposit-share-unpriceable":
        "لا يسعّر المصدر ما يحمله هذا التجمّع، فلا يمكن تحويل إيداع بالدولار إلى مركز فيه.",
      "deposit-share-no-days":
        "غادر السعر هذا النطاق في كل يوم استطاع المصدر الإجابة عنه، فليس هناك يوم كان إيداع فيه ليحصّل شيئًا.",
      "deposit-share-unverifiable":
        "لم يجتز ما كان إيداع ليأخذه فحصه الخاص، فلا يُعرض.",
      "range-order-no-room":
        "هذا النطاق أضيق من أن يستوعب مركزًا أحادي الجانب على أي من جانبي السعر الحالي.",
      "range-order-unverifiable":
        "لم تجتز الأنصاف الأحادية الجانب لهذا النطاق فحصها الخاص، فلا تُعرض.",
      "swap-depth-no-liquidity":
        "لا يعلن هذا التجمّع أي سيولة عند سعره الحالي، فليس هنا تبادل ليُسعَّر.",
      "swap-depth-tick-disagreement":
        "يضع الـ tick الخاص بالمصدر هذا التجمّع في خطوة سعرية غير الخطوة التي يقع فيها السعر المعروض، فلا يمكن نسبة السيولة التي أعلنها إلى هذه الخطوة.",
      "swap-depth-unverifiable": "لم تجتز تكلفة التبادل فحصها الخاص، فلا تُعرض.",
      "out-of-sample-insufficient-history":
        "لا يملك هذا التجمّع تاريخًا مفهرسًا كافيًا لمواءمة حزمة في الماضي ثم يبقى أفق كامل من الأيام لفحصها مقابله.",
      "out-of-sample-unverifiable":
        "أنتج الفحص خارج العيّنة نتيجة لا يستطيع هذا التطبيق التحقق منها.",
      "hook-directory-unverifiable":
        "لم تجتز خطّافات تجمّعات v4 لهذا الأسبوع فحصها الخاص، فلا يُعرض الدليل.",
      "positions-manager-unverified":
        "لم يُجب العقد الذي يحمل مراكز Uniswap v3 بالشيفرة التي بُني هذا التطبيق عليها، فلا يُعرض شيء مما قاله.",
      "positions-unreadable":
        "لم تُجب السلسلة عن مراكز هذا العنوان، فلا يُعرض أي مركز — وهذا ليس كعدم امتلاك أي مركز.",
      "positions-unverifiable":
        "لم تجتز مراكز هذا العنوان فحصها الخاص، فلا تُعرض.",
      "holdings-unverifiable":
        "أنتج ما يملكه هذا العنوان نتيجة لا يستطيع هذا التطبيق التحقق منها.",
      "explanation-key-rejected":
        "لم تقبل خدمة الشرح المفتاح المهيّأ، فلا يُعرض أي شرح.",
      "explanation-model-not-permitted":
        "المفتاح المهيّأ غير مسموح له باستعمال النموذج المختار، فلا يُعرض أي شرح.",
      "explanation-model-unknown":
        "النموذج المختار غير متاح للمفتاح المهيّأ، فلا يُعرض أي شرح.",
      "explanation-rate-limited":
        "خدمة الشرح مقيّدة بحدّ الطلبات في هذه اللحظة، فلا يُعرض أي شرح.",
      "explanation-hourly-cap":
        "يكتب هذا الموقع عددًا محدودًا من الشروح كل ساعة، وقد كُتب هذا العدد. الأرقام أعلاه كاملة؛ ويمكن أن يُكتب الشرح من جديد خلال الساعة.",
      "explanation-unreachable": "تعذّر الوصول إلى خدمة الشرح، فلا يُعرض أي شرح.",
      "explanation-request-refused": "رفضت خدمة الشرح هذا الطلب، فلا يُعرض أي شرح.",
      "explanation-declined":
        "امتنع النموذج عن شرح أرقام هذا التجمّع، فلا يُعرض أي شرح.",
      "explanation-truncated": "قُطع الشرح قبل اكتماله، فلا يُعرض.",
      "explanation-malformed":
        "عاد الشرح بصيغة لا يستطيع هذا التطبيق التحقق منها، فلا يُعرض.",
    } satisfies Record<DataFailureNotice, string>,

    warning: {
      "block-time-unreported":
        "لم يعلن مصدر البيانات وقت كتلة، فتعذّر التحقق من مدى حداثة هذه الأرقام.",
      "history-window-incomplete":
        "لم يعلن مصدر البيانات سعرًا لكل يوم في هذه النافذة؛ والأيام الناقصة غائبة لا مقدَّرة.",
      "volatility-window-incomplete":
        "بعض أيام هذه النافذة بلا سعر، فقيس التقلّب من عوائد يومية أقل مما تغطّيه النافذة؛ والأيام الناقصة تُخطّيت لا قُدّرت.",
      "band-window-incomplete":
        "بعض أيام نافذة التقلّب بلا سعر، فهذه الحزمة مبنية على عوائد يومية أقل مما تغطّيه النافذة.",
      "band-price-block-time-unreported":
        "لم يعلن مصدر السعر الحالي وقت كتلة، فتعذّر التحقق المستقل من مدى حداثته.",
      "band-volatility-block-time-unreported":
        "لم يعلن مصدر التقلّب وقت كتلة، فتعذّر التحقق المستقل من مدى حداثته.",
      "range-lower-edge-truncated":
        "تقف إحدى حافتي النطاق حيث تنتهي الأسعار التي يستطيع هذا التجمّع التعبير عنها — الحافة التي يكون فيها الرمز الأول للتجمّع أرخص ما يكون — فلا يبلغ النطاق ما كانت الحزمة لتبلغه. ولوحة النطاق تقول أي حافة تلك في الاتجاه المعروض.",
      "range-upper-edge-truncated":
        "تقف إحدى حافتي النطاق حيث تنتهي الأسعار التي يستطيع هذا التجمّع التعبير عنها — الحافة التي يكون فيها الرمز الأول للتجمّع أغلى ما يكون — فلا يبلغ النطاق ما كانت الحزمة لتبلغه. ولوحة النطاق تقول أي حافة تلك في الاتجاه المعروض.",
      "range-tick-unverified":
        "لم يعلن مصدر السعر حالة التجمّع نفسها، فتعذّر فحص السعر الذي يستلزمه مقابلها.",
      "range-excludes-current-price":
        "يقع السعر الحالي للتجمّع خارج هذا النطاق، فالمركز المبني عليه سيحمل رمزًا واحدًا ولن يكسب شيئًا حتى يعود السعر.",
    } satisfies Record<DataWarningNotice, string>,
  },

  rateLimited: {
    title: "طلبات كثيرة جدًا",
    body: (limit: number) =>
      `تقرأ هذه الصفحة بيانات Uniswap الحيّة في كل زيارة، ولذلك فهي محدودة بـ${limit} تحليلًا في الدقيقة.`,
    retry: (seconds: number) => `أعد المحاولة بعد ${seconds} ثانية.`,
    back: "العودة إلى المرشد",
  },

  error: ERROR_COPY.ar,
};
const hi: Dictionary = {
  metadata: {
    title: "LiquidityWise",
    description:
      "Uniswap v3 और v4 की तरलता रणनीतियों के लिए एक शैक्षिक, AI-सहायित सलाहकार। केवल मार्गदर्शन — वित्तीय सलाह नहीं।",
    v4Title: "एक Uniswap v4 पूल · LiquidityWise",
    v4Description: "यह Uniswap v4 पूल क्या है, और इसके hook को क्या करने की अनुमति है।",
    holdingsTitle: "एक पते के पास क्या है · LiquidityWise",
    holdingsDescription:
      "एक Ethereum पते पर मिले टोकन, और वे Uniswap v3 पूल जिनमें वे जा सकते हैं।",
    compareTitle: "शुल्क स्तर साथ-साथ · LiquidityWise",
    compareDescription: "एक जोड़ी के सभी Uniswap v3 शुल्क स्तर, एक ही अवधि, चौड़ाई और जमा के साथ पढ़े गए।",
    poolTitle: "पूल के दायरे का विश्लेषण · LiquidityWise",
    poolDescription:
      "Ethereum मेननेट के एक Uniswap v3 पूल के लिए कीमत का दायरा, इस आधार पर खींचा गया कि उसकी कीमत वास्तव में कितनी हिली है।",
    hooksTitle: "Uniswap v4 के hooks · LiquidityWise",
    hooksDescription:
      "इस हफ़्ते के सबसे व्यस्त Uniswap v4 पूल जिन hooks का नाम लेते हैं, और हर एक को क्या करने की अनुमति है — उसके अपने पते से पढ़ा गया।",
  },

  preferences: {
    languageLabel: "भाषा",
    selectLanguage: "भाषा चुनें",
    closeLanguages: "बंद करें",
    partlyTranslated:
      "इस भाषा का अनुवाद अभी चल रहा है। मेन्यू, लेबल और शीर्षक इसी भाषा में हैं; लंबे स्पष्टीकरण अब भी अंग्रेज़ी में हैं।",
    themeLabel: "थीम",
    themeSystem: "सिस्टम",
    themeLight: "उजला",
    themeDark: "गहरा",
    rangeLabel: "दायरे की प्राथमिकताएँ",
    rangeIntro:
      "वह अवधि, चौड़ाई और राशि जिनसे हर पूल खुलता है। अपने मान लिए हुए लिंक फिर भी आगे रहता है, और हर विश्लेषण के नीचे का फ़ॉर्म केवल उसी पृष्ठ को बदलता है।",
    rangeSave: "सहेजें",
    rangeReset: "भूल जाएँ",
  },

  disclaimer: {
    ariaLabel: "महत्वपूर्ण सूचना",
    title: "शैक्षिक उपकरण — वित्तीय सलाह नहीं।",
    body: "यह ऐप्लिकेशन Uniswap की कार्यप्रणाली समझाता है और पैरामीटर चुनने पर सोचने में मदद करता है। यह कीमतों का अनुमान नहीं लगाता, किसी प्रतिफल की गारंटी नहीं देता, और यह जाँच नहीं सकता कि कोई स्मार्ट कॉन्ट्रैक्ट सुरक्षित है। तरलता देने में वास्तविक जोखिम है, जिसमें अस्थायी हानि और पूरी पूँजी का नुकसान शामिल है। कॉन्ट्रैक्ट के पते हमेशा स्वयं जाँचें और अपनी ओर से शोध करें।",
  },

  home: {
    badge: "शुरुआती नींव",
    title: "LiquidityWise",
    introBeforeV3: "Uniswap ",
    introBetween: " के लिए एक शैक्षिक सलाहकार, और ",
    introAfterV4:
      " की ओर बढ़ता हुआ। किसी पूल को उसकी जोड़ी से खोजिए, वह कीमत दायरा पढ़िए जो इस आधार पर निकला है कि वह जोड़ी वास्तव में कितनी हिली है, और उसका सरल भाषा में स्पष्टीकरण पाइए। हर आँकड़ा गणना और जाँच के बाद ही किसी मॉडल को बताने दिया जाता है — और मॉडल को कभी कोई आँकड़ा स्वयं कहने की अनुमति नहीं है।",
    workingTodayHeading: "आज जो काम करता है",
    workingTodayBody:
      "किसी पूल को उसकी जोड़ी से खोजिए, या किसी v3 पूल का पता या किसी v4 पूल की id चिपकाइए। आपको मिलेगा: पूल का सत्यापित विन्यास और उसकी मौजूदा स्थिति, पिछले महीने की दैनिक कीमतें एक सुझाए गए दायरे के सामने खींची हुईं, जोड़ी वास्तव में कितनी हिली, और उससे निकलने वाला दायरा — जिसकी अवधि और चौड़ाई बदलना आपके हाथ में है। साथ में: पूल ने क्या शुल्क लिया और वास्तव में क्या वसूला, उसके हाल के दिन दायरे के सामने कैसे बैठे, वही तरीका उन दिनों पर क्या करता जो उसने कभी देखे ही नहीं, केवल टोकन रखने की तुलना में एक पोज़िशन क्या छोड़ती है, बाकी हर चौड़ाई इसके बजाय क्या करती, और — एक जमा के लिए जिसका आकार आप तय करते हैं — उन दिनों के शुल्कों में से उसने कितना लिया होता जिन दिनों कीमत दायरे के भीतर रही। और वही दायरा उल्टा पढ़ा हुआ: उसका हर आधा हिस्सा एक तरफ़ा पोज़िशन है, और पृष्ठ बताता है कि कीमत उससे गुज़रे तो हर आधा किस भाव पर बदलेगा। पूल से होकर एक स्वैप की लागत क्या है, उस सबसे बड़े स्वैप के लिए जिसकी कीमत बिना कुछ माने आँकी जा सके। और इस हफ़्ते के सबसे व्यस्त v4 पूल जिन hooks का नाम लेते हैं उन सबकी सूची, हर एक को क्या करने की अनुमति है यह उसके अपने पते से पढ़कर। कोई v4 पूल भी सरल शब्दों में बताता है कि उसके hook को क्या करने की अनुमति है, hook के अपने पते से पढ़कर। किसी पते के बारे में देखा जा सकता है कि उसके टोकन किन पूलों में जा सकते हैं, और उसके पास पहले से कौन-सी Uniswap पोज़िशन हैं — हर एक उन कीमतों के साथ जिन्हें वह घेरती है और यह कि पूल इस समय उनके भीतर है या नहीं। फिर इन सबका सरल भाषा में स्पष्टीकरण। इनमें से किसी आँकड़े को कोई मॉडल नहीं छूता, किसी को खाली जगह भरने के लिए अनुमान से नहीं गढ़ा जाता, और गद्य के पास अपना कोई आँकड़ा रखने की जगह ही नहीं है।",
    analysePool: "कोई पूल खोजें →",
    methodHeading: "यह कैसे काम करता है",
    methodSteps: [
      {
        step: "सत्यापित डेटा",
        detail:
          "पूल के तथ्य Uniswap के subgraphs से लिए जाते हैं और चेन पर पढ़े जाते हैं, कभी मान नहीं लिए जाते। कीमत को उस स्थिति के सामने जाँचा जाता है जो पूल स्वयं अपने बारे में बताता है।",
      },
      {
        step: "निश्चयात्मक गणित",
        detail:
          "अस्थिरता, कीमत का बैंड और पोज़िशन का दायरा सादे TypeScript में गिने जाते हैं, इसलिए वही पूल हमेशा वही आँकड़े देता है।",
      },
      {
        step: "AI की व्याख्या",
        detail:
          "एक मॉडल बताता है कि इन आँकड़ों का अर्थ क्या है। वे उसे पहले से जाँचे हुए सौंपे जाते हैं, और जिस अनुबंध के तहत वह उत्तर देता है उसमें किसी आँकड़े के लिए जगह ही नहीं है।",
      },
    ],
    coverageHeading: "अभी नहीं बना",
    coverage: [
      {
        version: "Uniswap v3",
        features: [
          {
            name: "गैस, और कीमत का पीछा करने की लागत",
            summary:
              "जिस दायरे को कीमत छोड़ चुकी है उसका पीछा करने के लिए उसे बंद करके फिर खोलना पड़ता है, जिसमें गैस लगती है और काग़ज़ी अंतर वास्तविक हो जाता है। इसमें से कुछ भी यहाँ कहीं नहीं गिना जाता।",
          },
        ],
      },
      {
        version: "Uniswap v4",
        features: [
          {
            name: "hook वास्तव में क्या करता है",
            summary:
              "v4 का पृष्ठ बताता है कि किसी hook को क्या करने की अनुमति है, क्योंकि इतना प्रोटोकॉल स्वयं लागू करता है और यह hook के अपने पते से पढ़ा जाता है। उन अनुमतियों से वह क्या करता है यह बताने के लिए कॉन्ट्रैक्ट पढ़ना एक अलग समस्या है, और यह ऐप्लिकेशन उसका प्रयास नहीं करता।",
          },
          {
            name: "TWAMM जैसी रणनीतियाँ",
            summary:
              "किसी बड़े ऑर्डर को तरलता के एक ही बिंदु पर चलाने के बजाय समय पर फैलाना। इसका जो आधा हिस्सा विश्लेषण पृष्ठ पहले ही बता सकता है वह मौजूद है: मौजूदा कीमत पर तरलता के सामने एक स्वैप की लागत क्या है, और वह कितने बड़े स्वैप की कीमत आँक भी सकता है। उसे समय पर बाँटना hook का काम है, और यह ऐप्लिकेशन किसी hook के व्यवहार का मॉडल नहीं बनाता।",
          },
        ],
      },
    ],
    footer:
      "ऊपर लिखी कोई भी चीज़ अभी मौजूद नहीं है। जो मौजूद है, वह इस पृष्ठ के ऊपर का सब कुछ है: नाम से खोजा गया पूल, गणना करके और आपस में मिलाकर जाँचे गए आँकड़े, और दिखाने से पहले सत्यापित पाठ। एक वॉलेट जोड़ा जा सकता है, और उससे केवल उसका पता माँगा जाता है। यह ऐप जो एकमात्र चीज़ रखता है, वह पाठक का स्वयं बनाया हुआ Telegram लिंक है — एक चैट पहचान के साथ एक पता, जो बॉट को /stop भेजते ही मिट जाता है और सात दिनों के भीतर एन्क्रिप्टेड बैकअप से भी हट जाता है — और यहाँ कुछ भी आपकी ओर से लेन-देन पर हस्ताक्षर या उसे प्रेषित नहीं कर सकता।",
  },

  pool: {
    back: "← LiquidityWise",
    invalidAddress:
      "यह Ethereum पता नहीं है। पता 0x के बाद ठीक 40 हेक्साडेसिमल अक्षरों का होता है।",
    loading: "Uniswap का ताज़ा डेटा पढ़ा जा रहा है…",
  },

  activity: {
    heading: "पूल ने वास्तव में क्या किया",
    volume24h: "कारोबार, 24 घंटे",
    volume7d: "कारोबार, 7 दिन",
    volume30d: "कारोबार, 30 दिन",
    fees30d: "लिया गया शुल्क, 30 दिन",
    feesNote: "पूरे पूल का, उन सबमें बँटा जिनकी तरलता सक्रिय थी।",
    tvl: "कुल जमा मूल्य",
    occupancySentence: (days: string, inside: string, outside: string, crossed: string) =>
      `पिछले ${days} दिनों में से ${inside} पूरी तरह इस दायरे के भीतर रहे, ${outside} पूरी तरह उसके बाहर रहे, और ${crossed} ने कोई किनारा पार किया।`,
    undeterminedNote:
      "जिस दिन ने कोई किनारा पार किया उसने अपना कुछ हिस्सा भीतर और कुछ बाहर बिताया, और स्रोत का दैनिक उच्च और निम्न यह नहीं बता सकते कि कितना-कितना।",
    feesWhileInside: "पूरी तरह भीतर रहे दिनों पर लिया गया शुल्क",
    feesWithheld: "इस पूल के लिए नहीं दिखाया जाता",
    feesWithheldNote:
      "इस पूल के hook को स्वैप का एक हिस्सा लेने की अनुमति है, और स्रोत में कुछ भी hook के हिस्से को तरलता देने वालों के हिस्से से अलग नहीं करता। ऊपर के शुल्क वही हैं जो पूल ने लिए, और यह एक तथ्य है; उसका कोई अंश इस दायरे से बाँधना ऐसी पोज़िशन के बारे में दावा होगा जिसे कोई जाँच नहीं सकता।",
    inSample:
      "ये वही दिन हैं जिनसे दायरा खींचा गया, इसलिए ये दिखाते हैं कि उसे कैसे बिठाया गया, न कि यह परखते हैं कि वह टिकता कैसे है — और दायरा आज की कीमत पर केंद्रित है, जिस पर एक महीने पहले कोई खोल ही नहीं सकता था। इन्हें पढ़िए इस तरह कि पूल की हाल की हलचल दायरे के सामने कहाँ बैठती है, न कि किसी पिछली जाँच की तरह।",
    notYourEarnings:
      "इसमें से कुछ भी वह नहीं है जो कोई पोज़िशन कमाती: यह वह है जो पूरे पूल ने लिया। उसमें से एक जमा ने कितना लिया होता — स्वैप होते समय सक्रिय तरलता में उसका हिस्सा — यह ठीक नीचे वाला पैनल है, और वह भी केवल शुल्क है और कुछ नहीं।",
  },

  deposit: {
    heading: "एक जमा ने कितना वसूला होता",
    unavailable: "उन शुल्कों में से एक जमा ने कितना लिया होता, यह इस पूल के लिए निकाला नहीं जा सकता।",
    withheldNote:
      "उसी कारण से जो ऊपर के आँकड़े पर लागू है: यहाँ कोई hook स्वैप का हिस्सा ले सकता है, और स्रोत में कुछ भी उसके हिस्से को देने वालों के हिस्से से अलग नहीं करता। जिस कुल का अंश इस दायरे को नहीं सौंपा जा सकता, उसे उसमें रखी जमा को भी नहीं सौंपा जा सकता।",
    deposited: "जमा",
    depositedNote: "वह आकार जिसके लिए यह निकाला गया है। इसे ऊपर के फ़ॉर्म में बदलिए।",
    collected: "वह शुल्क जो उसने लिया होता",
    collectedNote: (days: string) => `उन ${days} दिनों में जब कीमत ने दायरा कभी नहीं छोड़ा।`,
    ofDeposit: "जमा के मुक़ाबले",
    ofDepositNote:
      "वे शुल्क लगाई गई रकम के सामने, उन्हीं दिनों में और किसी और में नहीं। यह वार्षिक दर नहीं है, और यहाँ कुछ भी इसे दर में नहीं बदलता।",
    sentence: (deposit: string, days: string, poolFees: string, yourFees: string) =>
      `उन ${days} दिनों में जब कीमत ने यह दायरा कभी नहीं छोड़ा, पूल ने ${poolFees} शुल्क लिया। इस दायरे में रखी ${deposit} की जमा उसमें से लगभग ${yourFees} ले जाती — उसकी अपनी तरलता, उन दिनों में से हर दिन वास्तव में सक्रिय रही तरलता के हिस्से के रूप में।`,
    unmeasurableNote: (days: string) =>
      `${days} और दिन दायरे के भीतर रहे, पर स्रोत ने उनके लिए न शुल्क प्रकाशित किया न सक्रिय तरलता, इसलिए वे कुल में नहीं हैं।`,
    dilution:
      "बड़ी जमा अनुपात में अधिक नहीं वसूलती। हिस्सा है आपकी तरलता बटा सबकी तरलता, जिसमें आपकी भी शामिल है — इसलिए एक आकार के बाद आप जो जोड़ते हैं उसका अधिकांश आपके पहले से रखे हुए को ही पतला करता है। इसीलिए दी गई राशियाँ हज़ार गुना दूर हैं।",
    caveat:
      "केवल शुल्क, और केवल वे दिन जो बीत चुके हैं। इसमें यह माना गया है कि पोज़िशन उनमें से हर दिन खुली थी और उसके जवाब में कुछ हिला नहीं, और यह अगले तीस दिनों के बारे में कुछ नहीं कहता। दोनों टोकन केवल रखने की तुलना में एक पोज़िशन क्या छोड़ती है, यह इसी पृष्ठ पर नीचे की तुलना है, और दोनों को साथ पढ़ना ज़रूरी है।",
  },

  realizedFee: {
    heading: "उसने वास्तव में क्या लिया",
    intro:
      "पूल जो शुल्क घोषित करता है वह एक संख्या है। यह वह है जो स्वैप करने वालों ने वास्तव में चुकाया, उन्हीं दिनों से वापस निकालकर जिनसे ऊपर के आँकड़े आए हैं: एक दिन का शुल्क बटा उसी दिन का कारोबार। इसके लिए कोई अतिरिक्त अनुरोध नहीं चाहिए और hook से कुछ नहीं चाहिए।",
    declared: "घोषित शुल्क",
    statedNote: (lp: string, protocol: string) =>
      `${lp} तरलता देने वालों को और ${protocol} प्रोटोकॉल को, उसी तरह जोड़कर जैसे PoolManager उन्हें लेता है — और यही वह है जो स्वैप करने वाला चुकाता है, और जिससे ऊपर के शुल्क बने हैं।`,
    noDeclared: "कोई नहीं",
    noDeclaredNote: "इस पूल की कुंजी में कोई शुल्क नहीं है। उसका hook हर स्वैप पर एक तय करता है।",
    median: "सामान्य दिन",
    spread: "सबसे कम से सबसे अधिक दिन तक",
    spreadValue: (lowest: string, highest: string) => `${lowest} – ${highest}`,
    aggregate: "पूरी खिड़की",
    aggregateNote:
      "खिड़की का शुल्क बटा खिड़की का कारोबार, जिससे व्यस्त दिन शांत दिन से अधिक गिना जाता है।",
    daysMeasured: "मापे गए दिन",
    daysMeasuredNote: (skipped: string) =>
      `खिड़की के ${skipped} और दिनों में कोई कारोबार नहीं हुआ, या कोई आँकड़ा नहीं था, इसलिए उनसे कोई दर नहीं निकाली जा सकी।`,
    verdictMatches: "ये हर मापे गए दिन पर मेल खाते हैं। घोषित दर ही वह दर है जो ली गई।",
    verdictDiffers: (differing: string, measured: string) =>
      `ये मेल नहीं खाते। मापे गए ${measured} दिनों में से ${differing} दिन पूल ने अपनी घोषित दर से कुछ और लिया, इसलिए ऊपर का स्तर बताता है कि पूल किसके साथ बनाया गया था, न कि एक स्वैप की लागत क्या है।`,
    verdictNoneDeclared:
      "तुलना करने को कुछ है ही नहीं: यह पूल कोई दर घोषित ही नहीं करता। यहाँ के आँकड़े वही हैं जो उसके hook ने वास्तव में तय किए।",
    notLpShare:
      "इसमें से कुछ भी वह नहीं है जो तरलता देने वाले तक पहुँचता है। इस पूल के hook को स्वैप का हिस्सा लेने की अनुमति है, और स्रोत hook के हिस्से को देने वालों के हिस्से से अलग नहीं करता। ये आँकड़े बताते हैं कि स्वैप की लागत क्या रही, यह नहीं कि वह किसे मिली।",
    unavailableHeading: "यह पूल क्या लेता है, यह मापा नहीं जा सका",
  },

  outOfSample: {
    heading: "उन दिनों पर परखा गया जो इसने कभी देखे नहीं",
    showFolds: "हर हिस्सा दिखाएँ",
    intro: (horizon: string) =>
      `ऊपर का हर आँकड़ा उन्हीं दिनों पर बिठाया गया है जिन्हें वह बताता है। ये नहीं। तरीके को ${horizon} पीछे ले जाया गया, केवल उस बिंदु से पहले की कीमतों पर फिर चलाया गया, और उसी बिंदु की कीमत पर केंद्रित किया गया — वह कीमत जो वहाँ खड़ा कोई व्यक्ति सचमुच देख सकता था। फिर उसे आगे आने वाले दिनों पर रखा गया, और यही सब इतिहास में पीछे तब तक दोहराया गया जब तक जगह रही।`,
    folds: "हिस्से",
    foldsNote: "इतिहास में कितनी बार एक बैंड बिठाकर फिर उसे परखने की जगह थी।",
    fullyInside: "पूरी तरह भीतर रहे दिन",
    fullyOutside: "पूरी तरह बाहर रहे दिन",
    undetermined: "किनारा पार करने वाले दिन",
    verdict: (inside: string, measured: string, folds: string) =>
      `${folds} हिस्सों में, ${measured} में से ${inside} दिन पूरी तरह उस बैंड के भीतर रहे जो यह तरीका खींचता।`,
    foldPeriod: "जाँचे गए दिन",
    foldVolatility: "बिठाई गई अस्थिरता",
    foldVerdict: "भीतर / बाहर / पार",
    foldsCaption: "हर वह हिस्सा जिस पर तरीका परखा गया, सबसे पुराना पहले",
    foldColumns:
      "हर पंक्ति एक हिस्सा है: वे दिन जिन पर जाँच हुई, वह अस्थिरता जो उसकी अपनी बिठाई ने मापी — ऊपर वाला आँकड़ा नहीं — और वे दिन उस बैंड के सामने कैसे बैठे जो उस बिठाई से निकला।",
    notIndependent:
      "एक पूल पर कुछ हिस्से इस बात का माप नहीं हैं कि तरीका कितनी बार टिकता है, और अगली बार क्या होगा इस बारे में कुछ नहीं कहते। साथ ही लगातार बिठाइयाँ एक-दूसरे पर चढ़ती हैं — 31 बंद भावों की बिठाई एक अवधि के क़दम से लंबी होती है — इसलिए हिस्से एक-दूसरे से स्वतंत्र नहीं हैं।",
    notHeld:
      "इन बैंडों को किसी ने रखा नहीं था। हर एक वही है जो तरीका उस क्षण सुझाता, उन कीमतों पर रखा हुआ जो उसके बाद घटीं — और ऊपर के दिन, जिनसे सुझाया गया दायरा खींचा गया, ये दिन नहीं हैं।",
    unavailableHeading: "इस पूल को नमूने के बाहर जाँचा नहीं जा सका",
  },

  divergence: {
    heading: "केवल रखे रहने की तुलना में",
    intro:
      "इस दायरे में रखी एक पोज़िशन का मूल्य हर कीमत पर, दोनों टोकन केवल रखे रहने की तुलना में। अनुमान नहीं, सटीक गणित — पर यह केवल कीमत की हलचल गिनता है। यह उन शुल्कों के बारे में कुछ नहीं कहता जो एक पोज़िशन कमाती, और शुल्क ही तो वह चीज़ है जो तरलता देने वाले को इसी अंतर के बदले मिलती है।",
    price: (base: string) => `${base} की कीमत`,
    loss: "पोज़िशन बनाम रखे रहना",
    entryRow: "वह कीमत जिससे यह मापा जाता है — पूल की मौजूदा कीमत।",
    impermanentNote:
      "इसी को आमतौर पर अस्थायी हानि कहते हैं। वह अस्थायी तभी है जब कीमत लौट आए: जो पोज़िशन उस कीमत से अलग किसी कीमत पर बंद होती है जिस पर खुली थी, उसने उसे वास्तविक कर लिया।",
  },

  rangeOrder: {
    heading: "दायरे से होकर बेचना और ख़रीदना",
    intro:
      "ऊपर का दायरा दोतरफ़ा है: कीमत के दोनों ओर पैसा, जो तब तक शुल्क कमाता है जब तक कीमत उनके बीच रहे। उसे कीमत पर बाँटिए और हर आधा एक अलग साधन बन जाता है। कीमत से पूरी तरह ऊपर बैठी पोज़िशन केवल एक टोकन रखती है, और जैसे-जैसे कीमत बैंड से होकर चढ़ती है पूल उस टोकन को दूसरे के बदले बेचता जाता है। कीमत से नीचे वह उल्टा करता है। यही एक रेंज ऑर्डर है, और इस दायरे के दोनों आधे वही हैं।",
    selling: (token: string) => `${token} बेचना`,
    buying: (token: string) => `${token} ख़रीदना`,
    band: "बैंड",
    bandNote:
      "पोज़िशन कहाँ बैठी है। उसका भीतरी किनारा उस क़दम के बाद का पहला कीमत-क़दम है जिसमें कीमत खड़ी है, इसलिए वह शुरुआत में उस चीज़ में से कुछ नहीं रखती जिसमें वह बदल रही है।",
    average: "औसत कीमत",
    averageNote: "अगर कीमत पूरा बैंड पार कर जाए तो बदलाव किस भाव पर पड़ता है।",
    against: "मौजूदा कीमत के मुक़ाबले",
    exact:
      "वह औसत दोनों सीमाओं का गुणोत्तर माध्य है — बिल्कुल सटीक, और कीमतें चाहे किसी भी दिशा में लिखी हों। यह प्रोटोकॉल के अपने सूत्रों से निकलता है कि पोज़िशन अपने बैंड के हर छोर पर क्या रखती है, और लगाई गई रकम उसमें से कट जाती है: सौ डॉलर और दस लाख एक ही भाव पर बदलते हैं।",
    onlyIfThrough:
      "और तभी जब कीमत पूरा बैंड पार करे। जो कीमत भीतर ही लौट जाए वह पोज़िशन को दोनों में से कुछ-कुछ के साथ छोड़ देती है, किसी एक भाव पर नहीं — जो ठीक वही चीज़ है जिसके लिए ऊपर का दायरा है, बस संयोग से पहुँची हुई।",
    notAnOrderBook:
      "यहाँ कुछ भी इस बदलाव का समय तय नहीं करता और कुछ भी उसकी गारंटी नहीं देता। यह ऑर्डर बुक नहीं है: जिस ऑर्डर तक कीमत कभी पहुँचती ही नहीं, वह विफलता नहीं बल्कि सामान्य परिणाम है, और यहाँ न कोई क़तार है न कोई प्रतीक्षारत प्रतिपक्ष। इसके बदले जो है वह यह कि कीमत बैंड के भीतर रहने तक पोज़िशन पूल के शुल्क चुकाने के बजाय बटोरती है।",
    unavailable: "इस दायरे का कोई एकतरफ़ा आधा नहीं है जिसे बताया जा सके।",
  },

  swapDepth: {
    heading: "यहाँ एक स्वैप की लागत क्या है",
    intro:
      "ऊपर का सब कुछ तरलता देने के बारे में है। यह उसे इस्तेमाल करने के बारे में है। पूल की तरलता उन कीमत-क़दमों के बीच स्थिर रहती है जिन पर वह बना है, इसलिए जो स्वैप उसी क़दम के भीतर रहे जिसमें कीमत है, उसकी क़ीमत प्रोटोकॉल के अपने सूत्रों से बिना कुछ माने आँकी जा सकती है — और एक क़दम आगे वाले की नहीं, क्योंकि वहाँ किसी दूसरी पोज़िशन की तरलता शुरू हो सकती है और यह ऐप्लिकेशन हर कीमत पर तरलता नहीं पढ़ता।",
    selling: (token: string) => `पूल में ${token} बेचना`,
    amount: (amount: string, symbol: string) => `${amount} ${symbol}`,
    largest: "यहाँ आँका जा सकने वाला सबसे बड़ा स्वैप",
    largestNote:
      "कीमत अपने क़दम के अंत तक पहुँचने से पहले जितना भीतर जाता है। यह कोई सीमा नहीं है: इससे बड़ा स्वैप भी चलता है, और यह पृष्ठ नहीं बता सकता कि उसकी लागत क्या है।",
    cost: "वह क्या छोड़ता है",
    costNote: "स्वैप का औसत स्क्रीन पर दिख रही कीमत से कितनी दूर बैठता है।",
    oneSideOnly:
      "केवल एक दिशा दिखाई गई है। कीमत अपने क़दम के अंत के इतने पास बैठी है कि दूसरी ओर की गुंजाइश स्वैप से ज़्यादा एक राउंडिंग त्रुटि है, और यह पृष्ठ ऐसा आँकड़ा नहीं छापता जिसे वह जाँच न सके।",
    geometric:
      "वह औसत अभी की कीमत और स्वैप जिस कीमत पर ख़त्म होता है, उन दोनों का गुणोत्तर माध्य है — वही पहचान जिस पर ऊपर की एकतरफ़ा पोज़िशनें टिकी हैं, सौदे की दूसरी ओर से देखी गई। बैंड पार करता स्वैप उसे चुकाता है; उसी बैंड में बैठी पोज़िशन उसे पाती है।",
    whyItDiffers:
      "दोनों दिशाएँ एक आकार की नहीं हैं क्योंकि कीमत अपने क़दम के भीतर कहीं बैठी है, उसके बीच में नहीं। पूलों के बीच तुलने लायक़ चीज़ यह आकार ही है: यही वह है जो यह बाज़ार हिलने से पहले सोख लेता है, और यही वजह है कि कोई बड़ा ऑर्डर एक साथ भेजने के बजाय छोटे-छोटे टुकड़ों में तोड़ता है।",
    hookMayAlter:
      "इस पूल के hook को यह बदलने की अनुमति है कि स्वैप की लागत क्या हो — हर स्वैप के समय शुल्क दोबारा लिखना, पूल के वक्र की जगह स्वैप की कीमत खुद तय करना, या बाद में उसमें से हिस्सा लेना; इनमें से कौन-सा, यह ऊपर hook वाला हिस्सा बताता है। यहाँ के आँकड़े वही हैं जो पूल का वक्र लेता है, और वे तभी सही हैं जब hook बीच में न आए। यहाँ पढ़ी गई कोई भी चीज़ यह नहीं बता सकती कि वह आता है या नहीं।",
    unavailable: "एक स्वैप की लागत इस पूल के लिए निकाली नहीं जा सकती।",
  },

  compare: {
    heading: "इस जोड़ी के सभी शुल्क स्तर, साथ-साथ",
    intro: (pair: string) =>
      `नीचे का हर ${pair} पूल एक ही अवधि, एक ही चौड़ाई और एक ही जमा के साथ पढ़ा गया, इसलिए उनके आँकड़े एक ही आधार पर खड़े हैं। ये बीत चुके दिनों का वर्णन करते हैं, आने वाले दिनों का नहीं। v3 पूल शुल्क के क्रम में हैं और v4 पूल सबसे गहरे से शुरू, जैसा नीचे की टिप्पणी बताती है — किसी को भी इस हिसाब से क्रमबद्ध नहीं किया गया कि वह कितना कमाता।`,
    depositFeesNote: (days: string) => `उन ${days} दिनों में जब कीमत दायरे के भीतर रही।`,
    daysInside: "पूरी तरह दायरे के भीतर बीते दिन",
    daysInsideValue: (inside: string, measured: string) => `${measured} में से ${inside}`,
    unavailable: "यह स्तर अभी पढ़ा नहीं जा सका।",
    open: "पूरा विश्लेषण खोलें",
    link: "स्तरों को साथ-साथ रखें",
    onlyOne: (pair: string) =>
      `${pair} केवल एक v3 पूल में कारोबार करती है, इसलिए उसके साथ रखने को कुछ नहीं है।`,
    readTogether:
      "शुल्क आधी बात है। दोनों टोकन बस रखे रहने की तुलना में कोई दायरा क्या छोड़ देता है, वह हर पूल के अपने पृष्ठ पर है, और दोनों को साथ पढ़ना चाहिए।",
  },

  feeTiers: {
    heading: "यह जोड़ी और कहाँ कारोबार करती है",
    intro: (pair: string) =>
      `${pair} एक से अधिक शुल्क स्तर पर कारोबार करती है। हर स्तर अपनी तरलता, अपने कीमत-इतिहास और अपने दायरे वाला अलग पूल है — ऊपर के आँकड़े केवल इसी को बताते हैं।`,
    onlyOne: (pair: string) =>
      `Ethereum मेननेट पर ${pair} केवल इसी शुल्क स्तर पर कारोबार करती है। ऊपर का सब कुछ पूरी जोड़ी के बारे में है, क्योंकि जोड़ी यही एक पूल है।`,
    thisOne: "आप यही पढ़ रहे हैं",
    feeTier: "शुल्क स्तर",
    holds: "रखता है",
    reservesUnread: "यह पूल क्या रखता है, यह चेन से पढ़ा नहीं जा सका।",
    open: "इस स्तर का विश्लेषण करें",
    biggerIsNotBetter:
      "जिस स्तर में अधिक तरलता है वह वही स्वैप-शुल्क बाँटने वाली बड़ी भीड़ है, बेहतर जगह नहीं। किसी पोज़िशन के लिए कौन-सा उपयुक्त है यह इस पर निर्भर करता है कि कीमत कितनी और कितनी बार हिलती है, और यह हर पूल के लिए अलग मापा जाता है — इसलिए उनकी ईमानदार तुलना का तरीका है हर एक को खोलकर उसके अपने आँकड़े पढ़ना। आपकी चुनी अवधि और गुणक लिंक के साथ चलते हैं।",
    reservesNote:
      "ये वे शेष हैं जो दोनों टोकन कॉन्ट्रैक्ट हर पूल के लिए बताते हैं, किसी इंडेक्सर से नहीं बल्कि चेन से पढ़े गए। इंडेक्सर का अपना आँकड़ा इनके सामने मापा गया और वह मौजूद चीज़ को 1.3 से 13 गुना तक बढ़ाकर बताता है, इसलिए वह नहीं दिखाया जाता। एक डॉलर आँकड़े के बजाय दो टोकन मात्राएँ, क्योंकि यहाँ हर स्तर वही दो टोकन रखता है और तुलना के लिए कुछ भी मूल्यांकित करने की ज़रूरत नहीं।",
    unavailableHeading: "जोड़ी के दूसरे शुल्क स्तर पढ़े नहीं जा सके",

    onV3: "Uniswap v3 पर",
    onV4: "Uniswap v4 पर",
    v4Intro: (pair: string) =>
      `वे v4 पूल जो ${pair} का कारोबार करते हैं — वही दो कॉन्ट्रैक्ट। v4 में एक जोड़ी कई पूल हो सकती है: शुल्क कोई भी संख्या है, कीमत-क़दम स्वतंत्र है, और हर hook एक और पूल बनाता है।`,
    v4None: (pair: string) => `इन दो कॉन्ट्रैक्ट के साथ कोई Uniswap v4 पूल ${pair} का कारोबार नहीं करता।`,
    v4OnlyThis: (pair: string) => `v4 पर ${pair} केवल इसी पूल में कारोबार करती है।`,
    v3Intro: (pair: string) =>
      `वे v3 पूल जो ${pair} का कारोबार करते हैं — वही दो टोकन कॉन्ट्रैक्ट, हर शुल्क स्तर पर।`,
    v3None: (pair: string) => `इन दो कॉन्ट्रैक्ट के साथ कोई Uniswap v3 पूल ${pair} का कारोबार नहीं करता।`,
    v3NoNative:
      "यह पूल चेन का अपना ether रखता है, और v3 यह नहीं कर सकती: v3 की हर मुद्रा एक टोकन कॉन्ट्रैक्ट है। उसके सबसे नज़दीकी v3 पूल इसके बजाय लपेटा हुआ ether कारोबार करते हैं, जो किसी पूल के लिए अलग टोकन है।",
    depth: "मौजूदा कीमत पर गहराई",
    depthValue: (ether: string) => `≈ ${ether} ETH`,
    stateUnread: "पूल की तरलता चेन से पढ़ी नहीं जा सकी।",
    hook: "hook",
    noHook: "कोई hook नहीं",
    hookAltersSwaps: "स्वैप की लागत बदल सकता है",
    priceStep: (step: string) => `क़दम ${step}`,
    v4Ordering:
      "मौजूदा कीमत पर गहराई के क्रम में — पूल की सक्रिय तरलता और कीमत, PoolManager के भंडारण से पढ़ी हुई — क्योंकि v4 की एक जोड़ी अधिकतर ऐसे पूलों की होती है जिन्हें किसी ने शुरू करके छोड़ दिया, और गहराई ही उन्हें अलग करती है। यह बताती है कि एक स्वैप कितना खींच सकता है, और यह नहीं कि कौन-सा पूल बेहतर है: अधिक गहरा पूल वही शुल्क बाँटने वाली बड़ी भीड़ है।",
    moreNotShown: (count: string) => `${count} और नहीं दिखाए गए; वे इनसे कम गहरे हैं।`,
    v4Unavailable: "जोड़ी के v4 पूल पढ़े नहीं जा सके",
    v3Unavailable: "जोड़ी के v3 पूल पढ़े नहीं जा सके",
  },

  widths: {
    heading: "दूसरी चौड़ाइयाँ",
    intro:
      "फ़ॉर्म जो-जो चौड़ाई देता है उन सब पर वही तरीका, ताकि सौदेबाज़ी कही नहीं बल्कि देखी जा सके: चौड़ा दायरा अधिक दिन समेटता है, और वही जमा अधिक कीमतों पर फैलाता है — यही अंतिम स्तंभ है, और यह अनुमान नहीं बल्कि प्रोटोकॉल का गणित है।",
    width: "चौड़ाई",
    range: "दायरा",
    recent: (days: string) => `भीतर, पिछले ${days} दिनों में से`,
    unseen: "भीतर, उन दिनों पर जो इसने कभी देखे नहीं",
    insideOf: (inside: string, total: string) => `${total} में से ${inside}`,
    unseenNone: "पर्याप्त इतिहास नहीं",
    feeShare: "भीतर रहते हुए शुल्क में हिस्सा",
    feeShareValue: (times: string) => `${times}×`,
    chosen: "ऊपर दिखाया गया",
    columnsNote:
      "पहली गिनती उन दिनों पर है जिनसे हर दायरा खींचा गया, इसलिए वह बताती है कि वह चौड़ाई कैसे बिठाई गई, न कि वह कैसे टिकी। दूसरी ऊपर वाली जाँच है, हर चौड़ाई के लिए चलाई गई: तरीका एक अवधि पीछे ले जाकर आगे आने वाले दिनों पर रखा गया।",
    feeShareNote:
      "अंतिम स्तंभ वह है जो वही जमा उस दिन के शुल्कों में से लेती जिस दिन कीमत उस दायरे के भीतर रहती, ऊपर दिखाई चौड़ाई के मुक़ाबले — इसीलिए वह एक के रूप में दिखती है। यह अनुमान नहीं बल्कि प्रोटोकॉल का अपना पोज़िशन-गणित है: संकरा दायरा उसी पैसे को कम कीमतों पर अधिक तरलता में बदल देता है। इसमें माना गया है कि पूल की बाकी तरलता अपरिवर्तित है, जो इतनी बड़ी जमा के बाद सच नहीं रहता जो उसे हिला दे, और यह उन दिनों के बारे में कुछ नहीं कहता जो कीमत बाहर बिताती है।",
    notAdvice:
      "इनमें से कोई सिफ़ारिश नहीं है। संकरा दायरा उन दिनों बड़ा हिस्सा लेता है जिन दिनों वह टिकता है और उन दिनों कुछ भी नहीं जिन दिनों नहीं टिकता, और इनमें से कौन अधिक मायने रखता है यह इस पर निर्भर है कि पोज़िशन किसलिए है — जो यहाँ कुछ भी नहीं जानता।",
  },

  parameters: {
    heading: "दायरा बदलें",
    apply: "फिर से गणना करें",
    horizonLabel: "कितना आगे तक",
    widthLabel: "कितना चौड़ा",
    depositLabel: "कितना",
    days: (days: string) => `${days} दिन`,
    sigma: (value: string) => `${value}σ`,
    widthChoice: (sigma: string, word: string | null) => (word === null ? sigma : `${word} (${sigma})`),
    widthWords: { tight: "संकरा", medium: "मध्यम", wide: "चौड़ा", veryWide: "बहुत चौड़ा" },
    note: "अवधि बताती है कि मापी गई हलचल कितनी आगे तक बिछाई जाए। वह माप को नहीं बदलती: अस्थिरता हमेशा पिछले 30 पूरे दिनों से आती है, अवधि चाहे कोई भी चुनी जाए। चौड़ाई उस हलचल को गुणा करती है; चौड़ा दायरा कम बार छूटता है, और वह कोई विश्वास-स्तर नहीं है।",
    fellBack:
      "जो माँगा गया था उसका कुछ हिस्सा पढ़ा नहीं जा सका, इसलिए वहाँ डिफ़ॉल्ट इस्तेमाल हुआ। वास्तव में इस्तेमाल हुई अवधि और चौड़ाई ऊपर दिखाई गई हैं।",
    preferenceHint:
      "यह केवल इस पृष्ठ को बदलता है। हर पूल किन मानों से खुले, यह बदलने के लिए ऊपर की दायरे की प्राथमिकताएँ इस्तेमाल करें।",
  },

  holdings: {
    heading: "इस पते के पास क्या है",
    intro:
      "इस पते पर मिले टोकन, और वे पूल जिनमें वे जा सकते हैं। जब तक आप नीचे Telegram सूचनाएँ न माँगें, यहाँ कुछ भी रखा नहीं जाता, और पता सार्वजनिक जानकारी है — वही सूची उसे खोजने वाले हर किसी को दिखती है।",
    forAddress: "पता",
    loading: "टोकन कॉन्ट्रैक्ट से पूछा जा रहा है कि इस पते के पास क्या है…",
    howItLooked: (tokens: string, v3Pools: string, v4Pools: string | null) =>
      `किसी टोकन का शेष उसी टोकन के अपने कॉन्ट्रैक्ट में रहता है, इसलिए इसकी कोई सूची नहीं होती कि कोई पता क्या रखता है — केवल ऐसे टोकन होते हैं जिनसे एक-एक करके पूछा जा सके। यहाँ उनमें से ${tokens} से पूछा गया: Ethereum मेननेट के ${v3Pools} सबसे अधिक कारोबार वाले Uniswap v3 पूलों का हर टोकन${v4Pools === null ? "" : `, और पिछले सात दिनों में सबसे अधिक कारोबार करने वाले ${v4Pools} v4 पूलों की हर मुद्रा, जिनमें चेन का अपना ether भी है`}। उस समूह के बाहर रखी कोई चीज़ इस पृष्ठ से इसलिए ग़ायब नहीं है कि पता उसे नहीं रखता।`,
    v4NotSearched:
      "Uniswap v4 पूल खोजे नहीं गए: उनकी सूची पढ़ी नहीं जा सकी। ether और v4 पूलों की मुद्राएँ इस पृष्ठ से इसी कारण से अनुपस्थित हैं, किसी और कारण से नहीं।",
    hookTag: "hook",
    holdingsHeading: "मिले टोकन",
    nothingFound:
      "जाँचे गए टोकनों में से कोई इस पते पर नहीं मिला। यह ख़ाली वॉलेट जैसा नहीं है — ऊपर देखिए कि खोज कैसे की गई।",
    poolsHeading: "वे पूल जिनमें ये टोकन जा सकते हैं",
    bothSides: "आपके पास दोनों तरफ़ हैं",
    oneSide: "आपके पास एक तरफ़ है",
    bothSidesNote:
      "इस पूल के दोनों टोकन पते पर मिले, इसलिए यहाँ पोज़िशन के लिए पहले किसी स्वैप की ज़रूरत नहीं।",
    oneSideNote:
      "इस पूल के दो टोकनों में से एक मिला। यहाँ पोज़िशन के लिए दूसरी तरफ़ भी चाहिए, यानी जो आपके पास है उसका कुछ हिस्सा स्वैप करना।",
    moreNotShown: (count: string) =>
      `${count} और नहीं दिखाए गए। ऊपर वाले उनमें सबसे अधिक कारोबार वाले हैं, उसी क्रम में जो डेटा स्रोत बताता है — जो इस बारे में दावा है कि पूल कितना व्यस्त है और किसी और बारे में नहीं।`,
    analyse: "इस पूल का विश्लेषण करें",
    notAdvice:
      "यह उसकी सूची है जो संभव है, उसकी नहीं जो करने लायक़ है। इनमें से कौन-सा पूल किसके लिए ठीक है यह हर पूल के अपने पृष्ठ के आँकड़ों पर और इस पर निर्भर है कि पोज़िशन किसलिए है — और यह सूची दोनों में से कुछ नहीं जानती।",
    unavailableHeading: "यह पता पढ़ा नहीं जा सका",
    invalidAddress: "यह Ethereum पता नहीं है, इसलिए कुछ खोजा नहीं गया।",
    noAddress: "मुख्य पृष्ठ पर एक वॉलेट जोड़िए, और यह पृष्ठ दिखाएगा कि उसके पास क्या है।",
  },

  v4: {
    heading: "एक Uniswap v4 पूल",
    intro:
      "यह पूल क्या है, इसकी अपनी कुंजी से पढ़ा गया। v4 पूल अपना कोई कॉन्ट्रैक्ट नहीं है: वह एक PoolManager के भीतर रहता है और उन पाँच चीज़ों के हैश से नामित होता है जो उसे परिभाषित करती हैं — दोनों मुद्राएँ, शुल्क, कीमत-क़दम, और hook।",
    poolId: "पूल id",
    pair: "मुद्राएँ",
    fee: "शुल्क",
    feeNote: (swap: string, lp: string, protocol: string) =>
      `चेन पर पूल की अपनी कुंजी से पढ़ा गया। एक स्वैप ${swap} चुकाता है: इसमें ${lp} तरलता देने वालों को, और ${protocol} उसके ऊपर प्रोटोकॉल को।`,
    feeNoteNoProtocol:
      "चेन पर पूल की अपनी कुंजी से पढ़ा गया। प्रोटोकॉल ऊपर से कुछ नहीं लेता, इसलिए एक स्वैप यही चुकाता है।",
    dynamicFee: "hook तय करता है, हर स्वैप पर",
    dynamicFeeNote:
      "इस पूल की कुंजी में शुल्क के बजाय गतिशील-शुल्क का चिह्न है, इसलिए एक स्वैप की लागत उसी क्षण hook तय करता है जब वह होता है। इस पठन ने कोई देखा नहीं, और यहाँ बताने को कोई शुल्क नहीं है।",
    feeUnread: "शुल्क पढ़ा नहीं गया",
    feeUnreadNote:
      "पूल का शुल्क उसी कुंजी में रहता है जिससे वह बना था, चेन पर, और यह पठन उसे ला नहीं सका। कोई और चीज़ उसका विकल्प नहीं है।",
    protocolFee: "प्रोटोकॉल शुल्क",
    protocolFeeNone: "कोई नहीं",
    protocolFeeNote:
      "हर स्वैप पर पूल के शुल्क के ऊपर प्रोटोकॉल लेता है। इसे गवर्नेंस तय करती है, और यह चेन पर पूल की स्थिति से पढ़ा जाता है।",
    protocolFeeByDirection: (token0: string, token1: string) =>
      `दिशा के अनुसार अलग: पहला तब जब ${token0} बेचा जाए, दूसरा तब जब ${token1} बेचा जाए।`,
    priceStep: "कीमत-क़दम",
    priceStepNote: (spacing: string) =>
      `इस पूल में किसी पोज़िशन के किनारे जिस सबसे बारीक क़दम पर रखे जा सकते हैं — उसका ${spacing} का tick अंतराल। v4 में यह पूल की कुंजी का हिस्सा है, इसलिए v3 के विपरीत इसके लिए अलग कॉन्ट्रैक्ट कॉल नहीं चाहिए।`,
    nativeCurrency: "मूल ether",
    nativeCurrencyNote:
      "यहाँ शून्य पता कोई छूटा हुआ खाना नहीं है। v4 किसी पूल को लपेटे हुए टोकन के बजाय चेन का अपना ether रखने देती है, और यहाँ यही है।",
    hookHeading: "hook",
    noHook: "यह पूल बिना hook के चलता है।",
    noHookNote:
      "इसके स्वैप या जमा के साथ कुछ नहीं चलता, इसलिए यह वैसे ही बरतता है जैसे v3 का पूल।",
    hookMay: "इसे क्या करने की अनुमति है",
    permissionTopics: {
      swaps: "स्वैप के आसपास",
      liquidity: "जमा और निकासी के आसपास",
      creation: "जब पूल बना था",
      donations: "दान के आसपास",
    } satisfies Record<HookTopic, string>,
    permissionWords: {
      beforeSwap:
        "हर स्वैप से पहले चलता है, जहाँ वह स्वैप को मना कर सकता है और गतिशील शुल्क वाले पूल में तय कर सकता है कि वह स्वैप क्या चुकाएगा।",
      afterSwap: "हर स्वैप के बाद चलता है, जहाँ वह तब भी स्वैप को मना कर सकता है।",
      beforeSwapReturnsDelta:
        "पूल द्वारा कीमत आँके जाने से पहले स्वैप में से टोकन निकालता है, या अपने टोकन डालता है — इसलिए यहाँ किसी स्वैप को पूल के अपने वक्र का पालन करना ज़रूरी नहीं।",
      afterSwapReturnsDelta: "पूल द्वारा कीमत आँके जाने के बाद स्वैप का एक हिस्सा लेता है।",
      beforeAddLiquidity: "हर जमा से पहले चलता है, जहाँ वह जमा को मना कर सकता है।",
      afterAddLiquidity: "हर जमा के बाद चलता है, जहाँ वह तब भी जमा को मना कर सकता है।",
      afterAddLiquidityReturnsDelta:
        "जमा होते समय उसमें से टोकन लेता है, या उसमें टोकन जोड़ता है।",
      beforeRemoveLiquidity: "हर निकासी से पहले चलता है, जहाँ वह निकासी को मना कर सकता है।",
      afterRemoveLiquidity: "हर निकासी के बाद चलता है, जहाँ वह तब भी निकासी को मना कर सकता है।",
      afterRemoveLiquidityReturnsDelta:
        "निकासी होते समय उसका एक हिस्सा लेता है, या उसमें टोकन जोड़ता है।",
      beforeInitialize: "एक बार चला, पूल बनने से पहले। वह हो चुका है।",
      afterInitialize: "एक बार चला, पूल बनने के बाद। वह हो चुका है।",
      beforeDonate:
        "पूल के तरलता देने वालों को दान से पहले चलता है, जहाँ वह दान को मना कर सकता है।",
      afterDonate:
        "पूल के तरलता देने वालों को दान के बाद चलता है, जहाँ वह तब भी दान को मना कर सकता है।",
    } satisfies Record<HookPermission, string>,
    noPermissions:
      "स्वैप, जमा या दान के आसपास कुछ नहीं: प्रोटोकॉल उसे इनमें से किसी क्षण पर नहीं बुलाता। ऐसा hook फिर भी जो कर सकता है वह है उस पूल का शुल्क तय करना जिसका शुल्क गतिशील है।",
    permissionNames: "प्रोटोकॉल के अपने नाम इनके लिए",
    withdrawalWarning: (share: boolean): string =>
      share
        ? "यह hook तब चलता है जब कोई तरलता देने वाला निकासी करता है। इसे निकासी मना करने की और निकाली जा रही रक़म का हिस्सा लेने की अनुमति है। यह कभी ऐसा करता है या नहीं, यह यहाँ से जाना नहीं जा सकता।"
        : "यह hook तब चलता है जब कोई तरलता देने वाला निकासी करता है, और इसे निकासी मना करने की अनुमति है। यह कभी ऐसा करता है या नहीं, यह यहाँ से जाना नहीं जा सकता।",
    hookAddressIsThePermission:
      "ये hook के अपने पते से पढ़े जाते हैं। v4 किसी hook की अनुमतियाँ कहीं संग्रहीत नहीं करती: hook ऐसे पते पर तैनात होता है जिसके अंतिम चौदह बिट बताते हैं कि PoolManager कौन-से कॉलबैक बुलाएगा, और PoolManager कॉन्ट्रैक्ट से पूछने के बजाय उन्हीं बिटों को जाँचता है। इसलिए यह बताता है कि hook क्या कर सकता है, कभी यह नहीं कि वह क्या करता है — जिसे हर स्वैप पर शुल्क फिर से लिखने की अनुमति है वह हमेशा वही शुल्क लौटा सकता है, और यह यहाँ से जाना नहीं जा सकता।",
    alterSwapWarning:
      "इस hook को यह बदलने की अनुमति है कि स्वैप की लागत या उससे मिलने वाली रक़म क्या हो। कीमत-इतिहास से निकाला कोई भी आँकड़ा — सुझाया गया दायरा, कोई शुल्क स्तर, केवल रखे रहने से तुलना — यह मानता है कि पूल वही लेता है जो वह कहता है और वही देता है जो वक्र कहता है। यहाँ दोनों में से कोई मान्यता सुरक्षित नहीं है, और इसमें से कुछ भी कीमतों की शृंखला में दिखाई नहीं देता।",
    analysisScope:
      "नीचे दायरे का विश्लेषण है। दायरा उन कीमतों से आता है जो पहले ही घट चुकीं, इसलिए यह यहाँ ठीक वैसे ही टिकता है जैसे बिना hook वाले पूल पर — hook पिछली तारीख़ से यह नहीं बदल सकता कि कीमत कहाँ गई। hook जो बदल सकता है वह है स्वैप की लागत, इसलिए इस पूल ने जो दर ली उसे ऊपर के शुल्क से लेने के बजाय उसकी वसूली से मापा जाता है।",
    unavailableHeading: "यह पूल पढ़ा नहीं जा सका",
    invalidId:
      "यह v4 पूल id नहीं है। v4 पूल 32-बाइट हैश से नामित होता है — 0x के बाद 64 हेक्साडेसिमल अक्षर — किसी कॉन्ट्रैक्ट पते से नहीं।",
    noId: "यह देखने के लिए कि पूल क्या है और उसका hook क्या कर सकता है, कोई v4 पूल id चिपकाइए।",
    loading: "यह v4 पूल पढ़ा जा रहा है, इंडेक्सर से और चेन से…",
  },

  notFound: {
    title: "यहाँ कोई पृष्ठ नहीं है",
    body: "आपने जिस पते का अनुसरण किया वह ऐसी किसी चीज़ का नाम नहीं है जो यह ऐप्लिकेशन देता हो। पूल तक उसके पते से पहुँचा जाता है, या v4 में उसकी id से — और ये दोनों पथ में नहीं, खोज-बक्से में जाते हैं।",
    search: "कोई पूल खोजें →",
  },

  hooks: {
    heading: "Uniswap v4 पर चल रहे hooks",
    loading: "इस हफ़्ते के सबसे व्यस्त v4 पूल पढ़े जा रहे हैं…",
    intro:
      "हर v4 पूल किसी hook का नाम ले सकता है: एक कॉन्ट्रैक्ट जिसे PoolManager स्वैप, जमा और निकासी के तय क्षणों पर बुलाता है। कौन-से क्षण, यह किसी का दिया वादा नहीं है। यह hook के पते में ही गढ़ा होता है — नीचे के चौदह बिट ही वह सूची हैं, और प्रोटोकॉल उससे बाहर की किसी भी बात के लिए कॉन्ट्रैक्ट को बुलाने से इनकार करता है।",
    onlyPermissions:
      "यह पृष्ठ बस इतना ही जानता है, और यह जानने लायक़ ठीक इसलिए है क्योंकि इसे दावा नहीं किया जाता बल्कि लागू किया जाता है। किसी अनुमति से hook क्या करता है यह उसके कोड में है। यह ऐप्लिकेशन कोड नहीं पढ़ता, और उन hooks की कोई सूची नहीं रखता जिनकी किसी ने सिफ़ारिश की हो — दोनों ऐसे दावे होते जिन्हें वह जाँच नहीं सकता, उन आँकड़ों के बगल में जिन्हें वह जाँच सकता है।",
    window: (pools: string, hooked: string, hookless: string) =>
      `इस हफ़्ते के सबसे व्यस्त v4 दिनों के पूलों से पढ़ा गया — उनमें से ${pools}। ${hooked} किसी hook का नाम लेते हैं; ${hookless} किसी का नहीं, और वे वैसे ही बरतते हैं जैसे v3 का पूल।`,
    ordering:
      "इस क्रम में कि उन पूलों में से कितनों पर हर hook चलता है। यह केवल पूलों की गिनती है और कुछ नहीं: कई पूलों पर मौजूद hook वह hook है जिससे किसी ने कई पूल बनाए।",
    runs: (count: string) => `उनमें से ${count} पर चलता है`,
    poolsHeading: "यह कहाँ चलता है",
    moreNotShown: (count: string) => `और ${count} अन्य`,
    none: "इस हफ़्ते के सबसे व्यस्त v4 दिनों का कोई पूल किसी hook का नाम नहीं लेता।",
    unavailable: "इस हफ़्ते के v4 पूल पढ़े नहीं जा सके, इसलिए दिखाने को कोई सूची नहीं है।",
    fromHome: "हर hook देखें →",
  },

  positions: {
    heading: "इस पते के पास पहले से मौजूद पोज़िशन",
    intro:
      "ऊपर का सब कुछ वह है जो यह पता कर सकता था — उसके टोकन कौन-से पूल खोलते हैं। यह वह है जो वह पहले ही कर चुका है। दोनों प्रोटोकॉल में पोज़िशन एक टोकन है जिसे एक कॉन्ट्रैक्ट रखता है, और दोनों कॉन्ट्रैक्ट से पूछा जाता है कि हर टोकन क्या है। v3 वाला किसी पते के टोकन गिना भी सकता है; v4 वाला नहीं, इसलिए वह सूची एक इंडेक्सर से आती है और उसकी हर id चेन को वापस दी जाती है, जिससे पूछा जाता है कि वह किसकी है।",
    none: "इस पते के पास किसी भी प्रोटोकॉल का कोई Uniswap पोज़िशन टोकन नहीं है।",
    noneOpen:
      "इस पते के पास मौजूद हर पोज़िशन टोकन बंद हो चुका है। बंद टोकन उस पोज़िशन की रसीद है जो थी, पोज़िशन नहीं।",
    counts: (held: string, open: string, closed: string) =>
      `${held} पोज़िशन टोकन, जिनमें से ${open} में अब भी तरलता है और ${closed} बंद हो चुके हैं।`,
    inRange: "अभी कमा रही है",
    outOfRange: "अपने दायरे से बाहर",
    rangeUnknown: "यहाँ किसी ने स्वैप नहीं किया",
    analyse: "इस पूल का विश्लेषण करें →",
    feesEarned: (amount0: string, symbol0: string, amount1: string, symbol1: string) =>
      `कमाया गया और अभी तक नहीं निकाला: ${amount0} ${symbol0} और ${amount1} ${symbol1}।`,
    feesNone: "निकालने लायक़ अभी कुछ नहीं कमाया।",
    feesUnread: "इसने क्या कमाया, यह पढ़ा नहीं जा सका।",
    everyPrice: "हर वह कीमत जो यह पूल व्यक्त कर सकता है",
    moreNotShown: (count: string) => `${count} और खुली हैं और यहाँ सूचीबद्ध नहीं हैं।`,
    readCap: (read: string, held: string) =>
      `${held} में से ${read} पढ़े गए। बाकी इस पृष्ठ पर नहीं हैं, जो पृष्ठ की सीमा है, पते की नहीं।`,
    unreadProtocol: (protocol: string) =>
      `Uniswap ${protocol} की पोज़िशनें इस बार पढ़ी नहीं जा सकीं, इसलिए यहाँ का हर आँकड़ा केवल दूसरे प्रोटोकॉल के बारे में है।`,
    unavailable: "इस पते की पोज़िशनें पढ़ी नहीं जा सकीं।",
    publicNote:
      "पोज़िशन का मालिक चेन पर दर्ज है, इसलिए यह सूची सार्वजनिक है: कोई भी उसी पते के लिए वही सूची पढ़ सकता है, और यह ऐसा कुछ नहीं कहती जो इस पते ने इन टोकनों को रखकर पहले ही प्रकाशित न कर दिया हो। जब तक आप नीचे Telegram सूचनाएँ न माँगें, यहाँ कुछ भी रखा नहीं जाता, और इस पृष्ठ का कोई आँकड़ा मूल्यांकन नहीं है — दायरा वह नहीं है जो पोज़िशन की कीमत है।",
  },

  wallet: {
    heading: "वॉलेट जोड़ें",
    intro:
      "एक वॉलेट जोड़िए और यह पृष्ठ देख सकेगा कि पते के पास कौन-से टोकन हैं, और आपको वे पूल दिखा सकेगा जिनमें वे टोकन जा सकते हैं। यह पता पढ़ता है; वॉलेट से यहाँ बस इतना ही माँगा जाता है।",
    connect: "वॉलेट जोड़ें",
    connecting: "वॉलेट का इंतज़ार…",
    connectedAs: "इस रूप में जुड़ा",
    showHoldings: "दिखाइए कि उसके पास क्या है",
    forget: "यह पता भूल जाएँ",
    readOnly:
      "केवल पढ़ने के लिए। यह ऐप वॉलेट से उसका पता माँगता है, हस्ताक्षर कभी नहीं: यहाँ ऐसा कोई कोड नहीं है जो कोई संदेश हस्ताक्षरित कर सके या लेन-देन भेज सके, और वॉलेट के बारे में कुछ भी दो यात्राओं के बीच रखा नहीं जाता।",
    notices: {
      "wallet-not-found":
        "इस ब्राउज़र में कोई वॉलेट नहीं मिली। ब्राउज़र की वॉलेट एक्सटेंशन एक रखती है; उसके बिना इस पृष्ठ पर कुछ नहीं बदलता।",
      "wallet-request-declined":
        "वॉलेट में अनुरोध अस्वीकार कर दिया गया। न कुछ पढ़ा गया, न कुछ भेजा गया।",
      "wallet-request-failed":
        "वॉलेट से पता नहीं माँगा जा सका। न कुछ पढ़ा गया, न कुछ भेजा गया।",
      "wallet-no-account":
        "वॉलेट ने बिना पते के उत्तर दिया, जिसका आम तौर पर मतलब है कि वह बंद है या उसमें कोई खाता चुना नहीं गया।",
    },
  },

  telegram: {
    heading: "Telegram पर सूचनाएँ",
    intro:
      "जब इस पते की कोई पोज़िशन अपने दायरे के किनारे के पास पहुँचे, उससे बाहर जाए या वापस आए, Telegram पर जानें। यह बटन आपको इस साइट के बॉट तक ले जाता है; वहाँ Start दबाते ही वह चैट इस पते से जुड़ जाती है। रखा केवल पता और चैट की संख्यात्मक पहचान जाती है — और कुछ नहीं — और बॉट को /stop भेजते ही या यहाँ लिंक भुलाते ही दोनों सर्वर से मिट जाते हैं, और सात दिनों के भीतर उसके एन्क्रिप्टेड बैकअप से भी। कितनी बार जाँच होती है, यह उस सर्वर पर निर्भर है जिस पर यह चलता है।",
    connect: "Telegram जोड़ें",
    connected: (address: string) => `यह ब्राउज़र जुड़ा है: ${address} पर नज़र रखी जा रही है।`,
    pending: "लिंक प्रतीक्षा में है: Telegram में बॉट की चैट खोलें और Start दबाएँ।",
    forget: "लिंक भूल जाएँ",
    notConfigured: "इस सर्वर पर Telegram सूचनाएँ विन्यस्त नहीं हैं।",
    publicNote:
      "किसी पते पर नज़र रखने के लिए उसका मालिक होना ज़रूरी नहीं — पोज़िशनें सार्वजनिक हैं, और कोई सूचना वह नहीं कहती जो यह सूची न कहे। बॉट चेन पढ़ता है और संदेश भेजता है; वह कुछ हस्ताक्षरित या प्रेषित नहीं कर सकता।",
    linked: (address: string) =>
      `जुड़ गया। ${address} की कोई पोज़िशन अपने दायरे के किनारे के पास पहुँचेगी, उससे बाहर जाएगी या लौटेगी तो यहाँ पता चलेगा। समाप्त करने के लिए /stop भेजें।`,
    unknownStart:
      "यह लिंक पहचाना नहीं गया या इसकी अवधि बीत चुकी है। साइट पर “Telegram जोड़ें” फिर से दबाएँ।",
    alreadyClaimed:
      "यह लिंक किसी और चैट ने पहले ही इस्तेमाल कर लिया है। नए लिंक के लिए साइट पर “Telegram जोड़ें” फिर से दबाएँ।",
    stopped: "रोक दिया गया। यह चैट अब किसी पर नज़र नहीं रखती। रिकॉर्ड सर्वर से मिटा दिया गया है, और सात दिनों के भीतर एन्क्रिप्टेड बैकअप से भी मिट जाएगा।",
    nothingToStop: "यह चैट किसी पर नज़र नहीं रख रही थी।",
    help:
      "यह बॉट केवल उस पते पर नज़र रखता है जो आपने साइट पर जोड़ा है, और केवल तभी बोलता है जब कोई पोज़िशन अपने दायरे के किनारे के पास पहुँचे, उससे बाहर जाए या वापस आए। समाप्त करने के लिए /stop भेजें।",
    storeDown: "लिंक अभी जाँचा नहीं जा सका। एक मिनट बाद फिर कोशिश करें।",
    left: (pair: string, protocol: string, range: string) =>
      `⚠️ ${pair} (${protocol}) अपने दायरे से बाहर निकल गई: ${range}। कीमत लौटने तक यह एक ही टोकन रखती है और कुछ नहीं कमाती।`,
    nearing: (pair: string, protocol: string, range: string, price: string, edge: string) =>
      `⏳ ${pair} (${protocol}) अपने दायरे के किनारे के पास है: ${range}। कीमत ${price} है; ${edge} के पार यह एक ही टोकन रखेगी और कुछ नहीं कमाएगी।`,
    entered: (pair: string, protocol: string, range: string) =>
      `✅ ${pair} (${protocol}) फिर अपने दायरे में है: ${range}। फिर से कमा रही है।`,
    opened: (pair: string, protocol: string, range: string) => `नई पोज़िशन: ${pair} (${protocol}), ${range}।`,
    closed: (protocol: string, tokenId: string) => `बंद हुई: ${protocol} पोज़िशन #${tokenId}।`,
    footer:
      "केवल जानकारी — वित्तीय सलाह नहीं। सार्वजनिक ऑन-चेन डेटा से पढ़ा गया; यहाँ कुछ भी आपकी ओर से कार्रवाई नहीं कर सकता।",
  },

  search: {
    label: "एक जोड़ी, कोई v3 पूल पता, या कोई v4 पूल id",
    placeholder: "WETH/USDC",
    help: "WETH/USDC जैसी कोई जोड़ी लिखिए, किसी v3 पूल कॉन्ट्रैक्ट का पता चिपकाइए, या कोई v4 पूल id चिपकाइए — वह 32-बाइट हैश जिससे v4 पूल नामित होता है। केवल पढ़ने के लिए: यह ऐप्लिकेशन कभी कुछ हस्ताक्षरित नहीं करता और कभी कोई लेन-देन नहीं भेजता।",
    submit: "पूल खोजें",

    heading: "मेल खाते Uniswap v3 पूल",
    resultsFor: (terms: string) => `वे पूल जिनके टोकन ${terms} से मेल खाते हैं।`,
    empty: (terms: string) =>
      `Ethereum मेननेट के किसी Uniswap v3 पूल में ${terms} से मेल खाता कोई टोकन नहीं है।`,
    emptyHint: "वर्तनी जाँचें, या पूल का पता आपके पास हो तो वही चिपकाएँ।",

    v4Heading: "मेल खाते Uniswap v4 पूल",
    v4Empty: (terms: string) =>
      `Ethereum मेननेट के किसी Uniswap v4 पूल में ${terms} से मेल खाती कोई मुद्रा नहीं है।`,
    v4Depth: "मौजूदा कीमत पर गहराई",
    v4DepthValue: (ether: string) => `≈ ${ether} ETH`,
    v4DepthNote:
      "पूल की सक्रिय तरलता अभी किस मूल्य की है, PoolManager के अपने भंडारण से पढ़ी गई — यह नहीं कि पूल क्या रखता है, जो कोई v4 पूल अपने बारे में बताता ही नहीं।",
    v4StateUnread: "पूल की तरलता चेन से पढ़ी नहीं जा सकी।",
    v4Hook: "Hook",
    v4NoHook: "कोई नहीं",
    v4HookAltersSwaps: "स्वैप की लागत बदल सकता है",
    v4Ordering:
      "जिन पूलों का नाम ठीक वही है जो आपने खोजा, वे पहले आते हैं। उसके बाद क्रम हर पूल की उसकी मौजूदा कीमत पर गहराई के अनुसार चलता है — उसकी सक्रिय तरलता और कीमत, PoolManager के भंडारण से पढ़कर और डेटा स्रोत की निकाली कीमतों से एक ही पैमाने पर लाकर। यह नहीं कि पूल क्या रखता है: हर v4 पूल के टोकन एक ही PoolManager में साथ पड़े रहते हैं, और चेन पर कुछ भी उन्हें प्रति पूल नहीं बताता। इंडेक्सर के अपने तरलता आँकड़े को चेन के सामने जाँचा गया और वह सबसे व्यस्त पूलों में से एक पर पंद्रह प्रतिशत ग़लत निकला, इसीलिए उसका उपयोग नहीं होता।",

    ordering:
      "जिन पूलों का नाम ठीक वही है जो आपने खोजा, वे पहले आते हैं। उसके बाद क्रम इस अनुसार चलता है कि हर पूल वास्तव में क्या रखता है, टोकन कॉन्ट्रैक्ट से ही पढ़कर और डेटा स्रोत की निकाली कीमतों से एक ही पैमाने पर लाकर। पहले यह उस मूल्य के अनुसार चलता था जिसे स्रोत हर पूल में जमा बताता है, और वह आँकड़ा इतना ग़लत था कि इस सूची का क्रम ही बदल जाता: एक पूल यहाँ नब्बे लाख डॉलर की बताई गई तरलता के साथ छपा था जबकि उसके कॉन्ट्रैक्ट नौ हज़ार रखे थे।",
    windowing:
      "यह सूची उन पूलों से बनी है जिन्हें डेटा स्रोत आपके शब्दों के लिए सबसे अधिक कारोबार वाला बताता है, और जो पूल इतना शांत है कि उस समूह से बाहर रह जाए वह ऊपर के क्रम तक कभी नहीं पहुँचता। किसी स्रोत ने जो लौटाना चुना उसी के भीतर क्रम लगाने की यही ईमानदार सीमा है: जो पूल बहुत कुछ रखता है पर कम कारोबार करता है, वह इस पृष्ठ से ग़ायब हो सकता है।",
    dormantNote:
      "जिस पूल में एक महीने से कुछ नहीं हुआ, वह सूची में नहीं आता। दायरा पिछले एक महीने की कीमतों से खींचा जाता है, और जिस पूल के पास वह महीना नहीं, उसके पास खींचने को कुछ नहीं — उसे खोलना केवल यही कहता।",
    v4Windowing:
      "यह सूची उन v4 पूलों से बनी है जिन्होंने पिछले सात दिनों में Ethereum मेननेट पर सबसे अधिक कारोबार किया — सबसे व्यस्त एक हज़ार पूल-दिन, जो कुछ सौ पूल बनते हैं — और इससे शांत पूल इस पृष्ठ तक कभी नहीं पहुँचता। स्रोत हर v4 पूल में खोज का उत्तर इस पृष्ठ के प्रतीक्षा छोड़ने से पहले नहीं दे सकता, इसलिए खिड़की आपके शब्दों के बजाय हाल की सक्रियता से तय होती है: जो पूल मौजूद है पर इस हफ़्ते कारोबार नहीं किया, वह यहाँ नहीं है।",
    symbolWarning:
      "चिह्न टोकन के अपने कॉन्ट्रैक्ट से आता है, और ऐसा टोकन तैनात करने में कुछ नहीं लगता जो ख़ुद को USDC कहे। हर जोड़ी के नीचे दिए कॉन्ट्रैक्ट पते ही दो टोकनों को अलग बताते हैं।",

    feeTier: "शुल्क स्तर",
    holds: "रखता है",
    reservesUnread: "यह पूल क्या रखता है, यह चेन से पढ़ा नहीं जा सका।",
    moreNotShown: (count: string) =>
      `${count} और नहीं दिखाए गए। ऊपर वाले उनमें सबसे अधिक कारोबार वाले हैं, उसी क्रम में जो डेटा स्रोत बताता है — जो इस बारे में दावा है कि पूल कितना व्यस्त है और किसी और बारे में नहीं।`,
    analyse: "इस पूल का विश्लेषण करें",
    v4FeeNote:
      "हर पूल का शुल्क उसी कुंजी से पढ़ा जाता है जिससे वह बना था, चेन पर, न कि डेटा स्रोत से — जिसका शुल्क आँकड़ा मापने पर वह कुल निकला जो पिछले स्वैप ने चुकाया, प्रोटोकॉल का हिस्सा मिलाकर, न कि पूल का अपना शुल्क। जिस पंक्ति की कुंजी पढ़ी नहीं जा सकी वह यह बताती है।",

    unavailableHeading: "खोज चलाई नहीं जा सकी",
    rejected: {
      empty: "WETH/USDC जैसी कोई जोड़ी लिखिए, या किसी पूल का पता।",
      length: (min: number, max: number) => `खोज शब्द ${min} और ${max} अक्षरों के बीच होता है।`,
      unsupportedCharacters:
        "खोज शब्द में अक्षर, अंक और वे चिह्न हो सकते हैं जो टिकर के भीतर आते हैं — और कुछ नहीं।",
    },
  },

  report: {
    steps: {
      pool: "पूल का विन्यास पढ़ते हुए",
      snapshot: "पूल की मौजूदा बाज़ार स्थिति पढ़ते हुए",
      history: "पूल का दैनिक कीमत इतिहास पढ़ते हुए",
      volatility: "कीमत कितनी हिली यह मापते हुए",
      band: "कीमत का बैंड बनाते हुए",
      range: "बैंड को उन कीमतों पर बिठाते हुए जिन्हें यह पूल व्यक्त कर सकता है",
      divergence: "उस दायरे की तुलना दोनों टोकन रखे रहने से करते हुए",
      activity: "मापी गई खिड़की में पूल ने क्या किया यह पढ़ते हुए",
    },
    noRangeHeading: "इस पूल के लिए कोई दायरा नहीं",
    stoppedWhile: (step: string) => `यह ${step} रुक गया।`,
    poolSummary: (protocol: string, fee: string, chain: string) =>
      `Uniswap ${protocol} · ${chain} · ${fee}`,
    feePerSwap: (fee: string) => `हर स्वैप पर ${fee} शुल्क`,
    feePlusProtocol: (fee: string, protocol: string) =>
      `हर स्वैप पर ${fee} शुल्क, साथ में प्रोटोकॉल को ${protocol}`,
    noDeclaredFee: "शुल्क हर स्वैप पर इसका hook तय करता है",
    caveatsHeading: (count: number) =>
      count === 1
        ? "इन आँकड़ों पर एक चेतावनी लागू होती है।"
        : `इन आँकड़ों पर ${count} चेतावनियाँ लागू होती हैं।`,
    caveatsAriaLabel: "चेतावनियाँ",

    contentsHeading: "इस पृष्ठ पर",
    contentsLabel: "इस विश्लेषण के खंड",
    rangeHeading: "सुझाया गया कीमत दायरा",
    rangeIntro: (base: string, quote: string) =>
      `इस पूल में कोई पोज़िशन कहाँ सक्रिय रहेगी, एक ${base} की कीमत ${quote} में।`,
    rangeValue: (lower: string, upper: string, quote: string, base: string) =>
      `${lower} – ${upper} ${quote} प्रति ${base}`,
    rangeDistances: (down: string, up: string) =>
      `मौजूदा कीमत से ${down} नीचे और ${up} ऊपर।`,
    rangeMeaning:
      "इन दो कीमतों के बीच एक पोज़िशन पूल के स्वैप शुल्कों में अपना हिस्सा कमाती है। इनसे बाहर वह एक ही टोकन रखती है और कीमत लौटने तक कुछ नहीं कमाती।",
    priceSentence: (base: string, price: string, quote: string) => `1 ${base} = ${price} ${quote}`,
    currentPrice: "मौजूदा कीमत",
    inRangeYes: "मौजूदा कीमत इस दायरे के भीतर है।",
    inRangeNo: "मौजूदा कीमत इस दायरे से बाहर है।",
    inRangeYesNote: "यहाँ खोली गई पोज़िशन तुरंत सक्रिय होगी।",
    inRangeNoNote:
      "यहाँ खोली गई पोज़िशन एक ही टोकन रखेगी और तब तक कुछ नहीं कमाएगी जब तक कीमत भीतर न लौटे।",
    beyondEdges: (below: string, above: string) =>
      `अगर कीमत दायरे से नीचे गिरे तो पोज़िशन अंत में केवल ${below} रखती है; अगर ऊपर चढ़े तो केवल ${above}।`,
    lowerTruncatedNote:
      "निचला किनारा उस सबसे कम कीमत पर रुक जाता है जिसे यह पूल व्यक्त कर सकता है, उससे पहले ही जहाँ बैंड उसे रखता।",
    upperTruncatedNote:
      "ऊपरी किनारा उस सबसे अधिक कीमत पर रुक जाता है जिसे यह पूल व्यक्त कर सकता है, उससे पहले ही जहाँ बैंड उसे रखता।",
    chartLabel: "पिछले महीने की कीमतें सुझाए गए दायरे के सामने",
    chartCaption: (days: string) =>
      `पिछले ${days} दिनों में से हर एक: उसका बंद भाव, और उसके निम्न से उच्च तक का फैलाव। छायांकित बैंड सुझाया गया दायरा है; ठोस रेखा आज की कीमत है।`,
    chartLegend:
      "भरा हुआ बिंदु वह दिन है जो पूरी तरह दायरे के भीतर रहा; खोखला वह जो उससे बाहर गया या कोई किनारा पार किया।",

    basisHeading: "यह दायरा कैसे खींचा गया",
    basisIntro: (base: string, days: string) =>
      `इससे कि पिछले ${days} पूरे दिनों में ${base} की कीमत वास्तव में कितनी हिली — इससे नहीं कि वह आगे कहाँ जाएगी।`,
    dailyMove: "सामान्य दैनिक हलचल",
    dailyMoveNote: "खिड़की भर में एक दिन के कीमत-परिवर्तन का मानक विचलन।",
    horizonMove: (days: string) => `${days} दिनों में`,
    horizonMoveNote:
      "वही हलचल नीचे चुनी गई अवधि पर फैलाई हुई: एक मानक विचलन, दोनों ओर।",
    widthValue: (multiplier: string) => `उसका ${multiplier}×, हर ओर`,
    widthNote:
      "नीचे चुना गया। चौड़ा दायरा कम बार छूटता है, और उस पर फैली वही जमा किसी एक कीमत पर पतली पड़ती है।",
    measuredOver: "किस पर मापा गया",
    measuredOverNote: (returns: string) => `इसमें ${returns} दैनिक परिवर्तन गए।`,
    epilogue:
      "दायरा आज की कीमत पर केंद्रित है और अनुपात के हिसाब से ऊपर-नीचे बराबर दूरी पर खींचा गया है — आधा होना और दुगुना होना एक ही हलचल है — इसीलिए दोनों प्रतिशत अलग निकलते हैं। यह बताता है कि कीमत कितनी हिली है, यह नहीं कि वह कहाँ जाएगी: यह कोई भविष्यवाणी नहीं है, और चौड़ाई कोई विश्वास-स्तर नहीं है। यहाँ कुछ भी पोज़िशन का आकार तय नहीं करता और न यह बताता है कि किस टोकन का कितना जमा करें।",
  },

  technical: {
    heading: "तकनीकी विवरण",
    summary: "वे ticks, ब्लॉक और आँकड़े जिनके सामने ऊपर का पृष्ठ जाँचा जाता है।",
    lowerTick: "निचला tick",
    upperTick: "ऊपरी tick",
    currentTick: "मौजूदा tick",
    sourceReportedTick: (tick: string) => `स्रोत ने ${tick} बताया।`,
    noSourceTick: "स्रोत ने अपना कोई tick नहीं बताया, इसलिए यह रूपांतरण असत्यापित है।",
    tickSpacing: "tick अंतराल",
    tickSpacingNote: (step: string) => `उपयोग योग्य किनारों के बीच ${step} का कीमत-क़दम।`,
    width: "चौड़ाई",
    widthValue: (ticks: string, spacings: string) => `${ticks} ticks · ${spacings} अंतराल`,
    poolPrice: "कीमत जैसी पूल बताता है",
    quotePerBase: (quote: string, base: string) => `${quote} प्रति ${base}`,
    bandLower: "बैंड की निचली सीमा",
    bandUpper: "बैंड की ऊपरी सीमा",
    bandNote: "tick जाल पर बिठाने से पहले, पूल की अपनी दिशा में।",
    annualised: "वार्षिकीकृत अस्थिरता",
    annualisedNote:
      "दैनिक लघुगणकीय प्रतिफलों का प्रतिदर्श मानक विचलन, sqrt(365) से गुणित।",
    coverage: "कवरेज",
    coverageNote: "खिड़की के कितने हिस्से के पीछे लगातार दैनिक कीमतें थीं।",
    sourceBlock: "स्रोत ब्लॉक",
    noBlockTime: "कोई ब्लॉक समय नहीं बताया गया।",
    fetchedAt: "कब लाया गया",
    fetchedAtNote: "उत्तर कब आया, यह नहीं कि वह किसका वर्णन करता है।",
    lowerEdge: "निचला किनारा",
    upperEdge: "ऊपरी किनारा",
    truncated: "काटा गया",
    asAsked: "जैसा माँगा गया",
  },

  explanation: {
    heading: "स्पष्टीकरण",
    pending: "स्पष्टीकरण लिखा जा रहा है…",
    unavailable: "इस विश्लेषण के लिए कोई स्पष्टीकरण उपलब्ध नहीं है।",
    sectionWriting: "अभी लिखा जा रहा है…",
    sectionMissing: "यह हिस्सा लिखा नहीं जा सका।",
    writtenBy: (model: string) => `${model} ने लिखा। ऊपर के आँकड़े नहीं।`,
    sections: {
      whatThisRangeMeans: "इस दायरे का मतलब क्या है",
      ifPriceLeavesTheRange: "अगर कीमत दायरा छोड़ दे",
      whatTheVolatilitySays: "अस्थिरता क्या कहती है",
      whatThisDoesNotCover: "यह किसे शामिल नहीं करता",
    },
  },

  notices: {
    failure: {
      "invalid-pool-address":
        "पूल का पता 0x के बाद 40 हेक्साडेसिमल अक्षरों का होना चाहिए, और वह शून्य पता नहीं हो सकता।",
      "invalid-search-terms":
        "पूल की खोज एक या दो छोटे शब्द लेती है, जो अक्षरों, अंकों और टिकर के भीतर आने वाले चिह्नों से बने हों।",
      "market-data-not-configured": "इस सर्वर पर Uniswap v3 बाज़ार डेटा विन्यस्त नहीं है।",
      "chain-data-not-configured": "इस सर्वर पर चेन से पढ़ना विन्यस्त नहीं है।",
      "explanation-not-configured":
        "यह ऐप्लिकेशन स्पष्टीकरण लिखने के लिए विन्यस्त नहीं है, इसलिए कोई नहीं दिखाया जाता।",
      "market-data-timed-out": "बाज़ार डेटा का अनुरोध समय पूरा होने पर समाप्त हो गया।",
      "market-data-unreachable": "बाज़ार डेटा स्रोत तक नहीं पहुँचा जा सका।",
      "market-data-credentials-rejected":
        "बाज़ार डेटा स्रोत ने विन्यस्त प्रमाणपत्र अस्वीकार कर दिए।",
      "market-data-rate-limited": "बाज़ार डेटा स्रोत की अनुरोध सीमा पार हो गई।",
      "market-data-unreadable": "बाज़ार डेटा स्रोत ने ऐसा उत्तर दिया जो पढ़ा नहीं जा सकता।",
      "market-data-malformed":
        "बाज़ार डेटा स्रोत ने ऐसा उत्तर दिया जिसे यह ऐप्लिकेशन सत्यापित नहीं कर सकता।",
      "market-data-indexing-errors":
        "बाज़ार डेटा स्रोत ने इंडेक्सिंग त्रुटियाँ बताईं, इसलिए उसके आँकड़े सत्यापित नहीं माने जा सकते।",
      "market-data-stale":
        "बाज़ार डेटा स्रोत चेन से इतना पीछे है कि इन आँकड़ों को मौजूदा नहीं माना जा सकता।",
      "market-data-future-block-time":
        "बाज़ार डेटा स्रोत ने इस सर्वर की घड़ी से आगे का ब्लॉक समय बताया, इसलिए उसके आँकड़े सत्यापित नहीं हो सकते।",
      "chain-data-timed-out": "चेन से डेटा का अनुरोध समय पूरा होने पर समाप्त हो गया।",
      "chain-data-unreachable": "चेन के डेटा स्रोत तक नहीं पहुँचा जा सका।",
      "chain-data-credentials-rejected":
        "चेन के डेटा स्रोत ने विन्यस्त प्रमाणपत्र अस्वीकार कर दिए।",
      "chain-data-rate-limited": "चेन के डेटा स्रोत की अनुरोध सीमा पार हो गई।",
      "chain-data-unreadable": "चेन के डेटा स्रोत ने ऐसा उत्तर दिया जो पढ़ा नहीं जा सकता।",
      "chain-data-malformed":
        "चेन के डेटा स्रोत ने ऐसा उत्तर दिया जिसे यह ऐप्लिकेशन सत्यापित नहीं कर सकता।",
      "chain-aggregator-unverified":
        "शेष चेन पर एक सहायक कॉन्ट्रैक्ट के ज़रिए पढ़े जाते हैं, और उसके पते पर मौजूद कोड वह कोड नहीं है जिस पर भरोसा करने के लिए यह ऐप्लिकेशन बनाया गया था, इसलिए उसके ज़रिए कुछ नहीं पढ़ा गया।",
      "pool-not-found":
        "Ethereum मेननेट पर इस पते के लिए कोई Uniswap v3 पूल नहीं मिला।",
      "pool-contract-not-found":
        "Ethereum मेननेट पर इस पते से किसी Uniswap v3 पूल कॉन्ट्रैक्ट ने उत्तर नहीं दिया।",
      "pool-configuration-inconsistent":
        "पूल का वह विन्यास जो उसके दो स्रोतों से जोड़ा गया, सत्यापित नहीं हो सका।",
      "pool-history-insufficient":
        "विश्लेषण के लिए इस पूल के पास अभी पर्याप्त पूरा दैनिक कीमत इतिहास नहीं है।",
      "pool-history-never-traded":
        "यह पूल मौजूद है, पर इसमें कभी कोई अदला-बदली हुई ही नहीं, इसलिए दायरा मापने के लिए कोई दैनिक कीमत नहीं है।",
      "pool-history-dormant":
        "जिस अवधि से ये दैनिक कीमतें पढ़ी जाती हैं, वह शुरू होने से पहले ही इस पूल में लेन-देन रुक गया था, इसलिए दायरा मापने के लिए हाल का कोई इतिहास नहीं है। इंतज़ार करने से यह नहीं बदलेगा — पूल दोबारा इस्तेमाल होने पर ही बदलेगा।",
      "volatility-invalid-input":
        "इस गणना के लिए दिया गया कीमत इतिहास वैध सामान्यीकृत इतिहास नहीं है।",
      "volatility-insufficient-history":
        "अस्थिरता मापने के लिए इस पूल के पास पर्याप्त लगातार दैनिक कीमतें नहीं हैं।",
      "volatility-unverifiable":
        "अस्थिरता की गणना ने ऐसा परिणाम दिया जिसे यह ऐप्लिकेशन सत्यापित नहीं कर सकता।",
      "band-invalid-input":
        "इस कीमत बैंड के लिए दिया गया बाज़ार डेटा वैध नहीं है, या स्नैपशॉट और अस्थिरता अलग-अलग पूलों का वर्णन करते हैं।",
      "band-no-current-price":
        "इस पूल की मौजूदा कीमत उपलब्ध नहीं है, इसलिए कोई कीमत बैंड केंद्रित नहीं किया जा सकता।",
      "band-unverifiable":
        "कीमत बैंड की गणना ने ऐसा परिणाम दिया जिसे यह ऐप्लिकेशन सत्यापित नहीं कर सकता।",
      "range-invalid-input":
        "इस दायरे के लिए दिए गए पूल, कीमत बैंड और स्नैपशॉट वैध नहीं हैं, या वे सब एक ही पूल और एक ही अवलोकन का वर्णन नहीं करते।",
      "range-price-unrepresentable":
        "इस पूल की मौजूदा कीमत उस सीमा से बाहर है जिसे Uniswap व्यक्त कर सकती है, इसलिए उससे कोई पोज़िशन दायरा नहीं बनाया जा सकता।",
      "range-tick-disagreement":
        "स्रोत इस पूल के लिए जो कीमत बताता है और जो स्थिति बताता है, वे एक ही क्षण का वर्णन नहीं करतीं, इसलिए कोई दायरा प्रकाशित नहीं होता।",
      "range-too-narrow":
        "कीमत बैंड उस सबसे छोटे क़दम से भी संकरा है जिसकी यह पूल दो किनारों के बीच अनुमति देता है, इसलिए वह दो अलग पोज़िशन सीमाओं का वर्णन नहीं करता।",
      "range-unverifiable":
        "दायरे की गणना ने ऐसा परिणाम दिया जिसे यह ऐप्लिकेशन सत्यापित नहीं कर सकता।",
      "divergence-unverifiable":
        "रखे रहने से तुलना ने ऐसा परिणाम दिया जिसे यह ऐप्लिकेशन सत्यापित नहीं कर सकता।",
      "activity-unverifiable":
        "पूल की हाल की सक्रियता ने ऐसा परिणाम दिया जिसे यह ऐप्लिकेशन सत्यापित नहीं कर सकता।",
      "fee-rate-unmeasurable":
        "इस पूल ने खिड़की के किसी भी इंडेक्स किए दिन पर कोई कारोबार नहीं किया, इसलिए उसने जो वसूला उससे उसकी दर निकाली नहीं जा सकती।",
      "deposit-share-unpriceable":
        "स्रोत यह मूल्यांकित नहीं करता कि यह पूल क्या रखता है, इसलिए डॉलर में कोई जमा उसमें पोज़िशन में नहीं बदली जा सकती।",
      "deposit-share-no-days":
        "जिस भी दिन का स्रोत उत्तर दे सका, उस हर दिन कीमत इस दायरे से बाहर गई, इसलिए ऐसा कोई दिन नहीं जिस दिन इसमें रखी जमा ने कुछ वसूला होता।",
      "deposit-share-unverifiable":
        "एक जमा ने कितना लिया होता, यह अपनी ही जाँच में खरा नहीं उतरा, इसलिए नहीं दिखाया जाता।",
      "range-order-no-room":
        "यह दायरा इतना संकरा है कि मौजूदा कीमत की किसी भी ओर एकतरफ़ा पोज़िशन नहीं समा सकती।",
      "range-order-unverifiable":
        "इस दायरे के एकतरफ़ा आधे हिस्से अपनी ही जाँच में खरे नहीं उतरे, इसलिए नहीं दिखाए जाते।",
      "swap-depth-no-liquidity":
        "यह पूल अपनी मौजूदा कीमत पर कोई तरलता नहीं बताता, इसलिए यहाँ कीमत आँकने को कोई स्वैप नहीं है।",
      "swap-depth-tick-disagreement":
        "स्रोत का अपना tick इस पूल को दिखाई गई कीमत से अलग कीमत-क़दम में रखता है, इसलिए उसने जो तरलता बताई वह इस क़दम को नहीं सौंपी जा सकती।",
      "swap-depth-unverifiable":
        "एक स्वैप की लागत अपनी ही जाँच में खरी नहीं उतरी, इसलिए नहीं दिखाई जाती।",
      "out-of-sample-insufficient-history":
        "इस पूल के पास इतना इंडेक्स किया इतिहास नहीं है कि अतीत में एक बैंड बिठाया जाए और फिर उसे जाँचने के लिए पूरी एक अवधि के दिन भी बचें।",
      "out-of-sample-unverifiable":
        "नमूने के बाहर की जाँच ने ऐसा परिणाम दिया जिसे यह ऐप्लिकेशन सत्यापित नहीं कर सकता।",
      "hook-directory-unverifiable":
        "इस हफ़्ते के v4 पूलों के hooks अपनी ही जाँच में खरे नहीं उतरे, इसलिए सूची नहीं दिखाई जाती।",
      "positions-manager-unverified":
        "जो कॉन्ट्रैक्ट Uniswap v3 की पोज़िशनें रखता है उसने उस कोड के साथ उत्तर नहीं दिया जिसके सामने यह ऐप्लिकेशन बनाया गया था, इसलिए उसकी कही कोई बात नहीं दिखाई जाती।",
      "positions-unreadable":
        "इस पते की पोज़िशनों के लिए चेन ने उत्तर नहीं दिया, इसलिए कोई नहीं दिखाई जाती — जो कोई पोज़िशन न होने जैसा नहीं है।",
      "positions-unverifiable":
        "इस पते की पोज़िशनें अपनी ही जाँच में खरी नहीं उतरीं, इसलिए नहीं दिखाई जातीं।",
      "holdings-unverifiable":
        "इस पते के पास क्या है, इसने ऐसा परिणाम दिया जिसे यह ऐप्लिकेशन सत्यापित नहीं कर सकता।",
      "explanation-key-rejected":
        "स्पष्टीकरण सेवा ने विन्यस्त कुंजी स्वीकार नहीं की, इसलिए कोई स्पष्टीकरण नहीं दिखाया जाता।",
      "explanation-model-not-permitted":
        "विन्यस्त कुंजी को चुना गया मॉडल इस्तेमाल करने की अनुमति नहीं है, इसलिए कोई स्पष्टीकरण नहीं दिखाया जाता।",
      "explanation-model-unknown":
        "चुना गया मॉडल विन्यस्त कुंजी के लिए उपलब्ध नहीं है, इसलिए कोई स्पष्टीकरण नहीं दिखाया जाता।",
      "explanation-rate-limited":
        "स्पष्टीकरण सेवा इस समय अनुरोध सीमा में है, इसलिए कोई स्पष्टीकरण नहीं दिखाया जाता।",
      "explanation-hourly-cap":
        "यह साइट हर घंटे सीमित संख्या में स्पष्टीकरण लिखती है, और उतने लिखे जा चुके हैं। ऊपर के आँकड़े पूरे हैं; घंटे के भीतर स्पष्टीकरण फिर लिखा जा सकेगा।",
      "explanation-unreachable":
        "स्पष्टीकरण सेवा तक नहीं पहुँचा जा सका, इसलिए कोई स्पष्टीकरण नहीं दिखाया जाता।",
      "explanation-request-refused":
        "स्पष्टीकरण सेवा ने यह अनुरोध अस्वीकार कर दिया, इसलिए कोई स्पष्टीकरण नहीं दिखाया जाता।",
      "explanation-declined":
        "मॉडल ने इस पूल के आँकड़े समझाने से इनकार किया, इसलिए कोई स्पष्टीकरण नहीं दिखाया जाता।",
      "explanation-truncated":
        "स्पष्टीकरण पूरा होने से पहले कट गया, इसलिए वह नहीं दिखाया जाता।",
      "explanation-malformed":
        "स्पष्टीकरण ऐसे रूप में लौटा जिसे यह ऐप्लिकेशन सत्यापित नहीं कर सकता, इसलिए वह नहीं दिखाया जाता।",
    } satisfies Record<DataFailureNotice, string>,

    warning: {
      "block-time-unreported":
        "डेटा स्रोत ने कोई ब्लॉक समय नहीं बताया, इसलिए ये आँकड़े कितने ताज़ा हैं यह सत्यापित नहीं हो सका।",
      "history-window-incomplete":
        "डेटा स्रोत ने इस खिड़की के हर दिन के लिए कीमत नहीं बताई; छूटे हुए दिन अनुमानित नहीं, अनुपस्थित हैं।",
      "volatility-window-incomplete":
        "इस खिड़की के कुछ दिनों की कोई कीमत नहीं थी, इसलिए अस्थिरता खिड़की में समाए दिनों से कम दैनिक प्रतिफलों पर मापी गई है; छूटे दिन अनुमानित नहीं, छोड़े गए।",
      "band-window-incomplete":
        "अस्थिरता खिड़की के कुछ दिनों की कोई कीमत नहीं थी, इसलिए यह बैंड खिड़की में समाए दिनों से कम दैनिक प्रतिफलों पर टिका है।",
      "band-price-block-time-unreported":
        "मौजूदा कीमत के स्रोत ने कोई ब्लॉक समय नहीं बताया, इसलिए वह कितनी ताज़ा है यह स्वतंत्र रूप से सत्यापित नहीं हो सका।",
      "band-volatility-block-time-unreported":
        "अस्थिरता के स्रोत ने कोई ब्लॉक समय नहीं बताया, इसलिए वह कितनी ताज़ा है यह स्वतंत्र रूप से सत्यापित नहीं हो सका।",
      "range-lower-edge-truncated":
        "दायरे का एक किनारा वहीं रुक जाता है जहाँ वे कीमतें ख़त्म होती हैं जिन्हें यह पूल व्यक्त कर सकता है — वह किनारा जहाँ पूल का पहला टोकन सबसे सस्ता है — इसलिए दायरा उतनी दूर नहीं पहुँचता जितनी बैंड पहुँचता। दायरे का पैनल बताता है कि दिखाई गई दिशा में वह कौन-सा किनारा है।",
      "range-upper-edge-truncated":
        "दायरे का एक किनारा वहीं रुक जाता है जहाँ वे कीमतें ख़त्म होती हैं जिन्हें यह पूल व्यक्त कर सकता है — वह किनारा जहाँ पूल का पहला टोकन सबसे महँगा है — इसलिए दायरा उतनी दूर नहीं पहुँचता जितनी बैंड पहुँचता। दायरे का पैनल बताता है कि दिखाई गई दिशा में वह कौन-सा किनारा है।",
      "range-tick-unverified":
        "कीमत के स्रोत ने पूल की अपनी स्थिति नहीं बताई, इसलिए उससे निकलने वाली कीमत को उसके सामने जाँचा नहीं जा सका।",
      "range-excludes-current-price":
        "पूल की मौजूदा कीमत इस दायरे से बाहर है, इसलिए उससे बनी पोज़िशन एक ही टोकन रखेगी और कीमत लौटने तक कुछ नहीं कमाएगी।",
    } satisfies Record<DataWarningNotice, string>,
  },

  rateLimited: {
    title: "बहुत अधिक अनुरोध",
    body: (limit: number) =>
      `यह पृष्ठ हर बार Uniswap का ताज़ा डेटा पढ़ता है, इसलिए यह प्रति मिनट ${limit} विश्लेषण तक सीमित है।`,
    retry: (seconds: number) => `${seconds} सेकंड बाद फिर कोशिश करें।`,
    back: "सलाहकार पर लौटें",
  },

  error: ERROR_COPY.hi,
};
const zh: Dictionary = {
  metadata: {
    title: "LiquidityWise",
    description:
      "一个面向 Uniswap v3 与 v4 流动性策略的教学型 AI 辅助顾问。仅供参考——不构成财务建议。",
    v4Title: "一个 Uniswap v4 资金池 · LiquidityWise",
    v4Description:
      "这一个 Uniswap v4 资金池是什么，以及它的 hook 被允许做什么。",
    holdingsTitle: "一个地址持有什么 · LiquidityWise",
    holdingsDescription:
      "在某个以太坊地址上找到的代币，以及这些代币可以进入的 Uniswap v3 资金池。",
    compareTitle: "费率档并排 · LiquidityWise",
    compareDescription: "一个交易对的所有 Uniswap v3 费率档，用同样的时长、宽度和资金读取。",
    poolTitle: "资金池区间分析 · LiquidityWise",
    poolDescription:
      "为某个以太坊主网 Uniswap v3 资金池给出的价格区间，由它的价格实际走了多远推算而来。",
    hooksTitle: "Uniswap v4 上的 hook · LiquidityWise",
    hooksDescription:
      "本周最活跃的 Uniswap v4 资金池所指定的每一个 hook，以及每一个被允许做什么——都从它自己的地址中读出。"
  },

  preferences: {
    languageLabel: "语言",
    selectLanguage: "选择语言",
    closeLanguages: "关闭",
    /*
     * Said in the reader's own language, at the moment they choose it, rather
     * than left to be discovered paragraph by paragraph. A reader who is told
     * can decide; one who meets it halfway down a page cannot.
     */
    partlyTranslated:
      "这门语言仍在翻译中。菜单、标签和标题已是该语言；较长的说明文字目前仍为英文。",
    themeLabel: "主题",
    themeSystem: "跟随系统",
    themeLight: "浅色",
    themeDark: "深色",
    rangeLabel: "区间偏好",
    rangeIntro:
      "每个资金池打开时所用的时间跨度、宽度和投入金额。自带参数的链接仍然优先；每份分析下方的表单只改变那一页。",
    rangeSave: "保存",
    rangeReset: "忘记",
  },

  disclaimer: {
    ariaLabel: "重要声明",
    title: "教学工具——不构成财务建议。",
    body: "本应用讲解 Uniswap 的运作机制，帮助你思考参数的选择。它不预测价格，不保证任何收益，也无法验证某个智能合约是否安全。提供流动性存在真实风险，包括无常损失以及本金的全部损失。请始终自行核对合约地址，并独立研究。",
  },

  home: {
    badge: "早期基础版本",
    title: "LiquidityWise",
    introBeforeV3: "一个面向 Uniswap ",
    introBetween: " 的教学型顾问，并正在向 ",
    introAfterV4:
      " 延伸。按交易对找到一个资金池，读到一个由该交易对实际走了多远推算出来的价格区间，并用平实的语言把它讲清楚。每一个数字都先被计算并交叉核对，模型才被允许去描述它——而模型永远不被允许说出任何一个数字。",
    workingTodayHeading: "现在就能用的",
    workingTodayBody:
      "按交易对搜索一个资金池，或者粘贴一个 v3 池地址、一个 v4 池 id。你会得到这个池已核验的配置与当前状态、最近一个月的每日价格画在建议区间上的图、这个交易对实际走了多远，以及由此得出的区间——时间跨度和宽度都由你来改。旁边还有：这个池收了多少手续费、实际又收到了多少，它最近这些天相对区间处在什么位置，同一套方法在它从未见过的日子里表现如何，一个仓位相比单纯持有放弃了什么，其他每一种宽度换作它们会怎样，以及——对于一笔由你决定大小的资金——在价格始终停留在区间内的那些日子里，它本可以从所收取的手续费中分到多少。还有把同一个区间反过来读：它的每一半都是一个单边仓位，页面会说明价格若整段穿过，每一半会按什么价格完成转换。以及通过这个池做一笔兑换要付出什么代价——取的是在不假设任何东西的前提下还能定价的最大一笔。再加上一份名录，收录本周最活跃的 v4 资金池所指定的每一个 hook，每一个被允许做什么都从它自己的地址中读出。一个 v4 池还会用平实的话说明它的 hook 被允许做什么，同样读自 hook 自己的地址。一个地址可以被查询：它持有的代币能进入哪些资金池，以及它已经持有的 Uniswap v3 仓位——每一个都附带它覆盖的价格，以及这个池此刻是否落在其中。最后是把这一切用平实语言讲一遍的说明，英文或土耳其文。没有任何模型碰过上述任何一个数字，没有一个数字是为了填补空缺而估出来的，那段文字里也没有地方能放进它自己编的数字。",
    analysePool: "找一个资金池 →",
    methodHeading: "它是怎么工作的",
    methodSteps: [
      {
        step: "已核验的数据",
        detail:
          "资金池的事实来自 Uniswap 子图并在链上读取，从不靠假设。价格会与这个池自己报告的状态交叉核对。",
      },
      {
        step: "确定性的计算",
        detail:
          "波动率、价格带和仓位区间都用纯粹的 TypeScript 计算，所以同一个池永远得出同样的数字。",
      },
      {
        step: "AI 的解读",
        detail:
          "由模型来解释这些数字的含义。交到它手上的数字已经核对过，而它所遵守的约定里没有任何地方能放进一个数字。",
      },
    ],
    coverageHeading: "还没有做的",
    coverage: [
      {
        version: "Uniswap v3",
        features: [
          {
            name: "gas，以及追着价格跑的代价",
            summary:
              "价格离开的区间必须关掉再重开才能跟上它，这要花 gas，也把纸面上的偏离变成了已经兑现的偏离。这里任何地方都没有把它算进去。",
          },
        ],
      },
      {
        version: "Uniswap v4",
        features: [
          {
            name: "一个 hook 实际上做了什么",
            summary:
              "v4 页面会说一个 hook 被允许做什么，因为协议强制的就是这一层，而且它读自 hook 自己的地址。读懂合约代码、说出它拿这些权限做了什么，是另一个问题，本应用不去尝试。",
          },
          {
            name: "TWAMM 式的策略",
            summary:
              "把一笔大单摊到一段时间里执行，而不是一次性撞向某一个价格点上的流动性。其中分析页已经能回答的那一半就在这里：一笔兑换相对当前价格处的流动性要付出什么，以及它最多能给多大一笔兑换定价。把一笔单子排到时间上去执行是 hook 的事，而本应用不对 hook 的行为建模。",
          },
        ],
      },
    ],
    footer:
      "以上这些都还不存在。存在的是这一页上面的全部内容：按名字找到的资金池、经过计算并交叉核对的数字，以及在展示之前已被核验的文字。钱包可以连接，而它被要求提供的只有地址。本应用保存的唯一东西，是读者自己建立的 Telegram 绑定——一个地址和一个对话 id，向机器人发送 /stop 的那一刻即被删除，七天内也会从加密备份中消失——这里也没有任何东西能代你签名或发送交易。",
  },

  pool: {
    back: "← LiquidityWise",
    invalidAddress:
      "那不是一个以太坊地址。地址是 0x 后面正好跟 40 个十六进制字符。",
    loading: "正在读取 Uniswap 的实时数据……",
  },

  /*
   * Facts about the pool, and the sentence that keeps them from being read as
   * something else. The gap between "the pool collected this" and "you would
   * have earned this" is where a reader is likeliest to fill in a number nobody
   * gave them.
   */
  activity: {
    heading: "这个资金池实际做了什么",
    volume24h: "成交量，24 小时",
    volume7d: "成交量，7 天",
    volume30d: "成交量，30 天",
    fees30d: "收取的手续费，30 天",
    feesNote: "整个池子的，由当时流动性处于活跃状态的所有人分享。",
    tvl: "总锁仓价值",
    occupancySentence: (days: string, inside: string, outside: string, crossed: string) =>
      `最近 ${days} 天里，有 ${inside} 天全天都在这个区间内，${outside} 天全天都在区间外，还有 ${crossed} 天越过了某一边。`,
    undeterminedNote:
      "越过某一边的那一天，有一部分时间在区间内、一部分在区间外，而数据来源给出的当日最高价和最低价说不出各占多少。",
    feesWhileInside: "全天都在区间内的那些日子所收取的手续费",
    /*
     * Shown instead of that figure when the pool's hook may take a share of a
     * swap. The fees are still real; what cannot be stated is their relationship
     * to a position, which is the only reason anyone reads the figure.
     */
    feesWithheld: "这个池子不予显示",
    feesWithheldNote:
      "这个池子的 hook 被允许从一笔兑换中抽取一份，而数据来源里没有任何东西能把 hook 的那一份和流动性提供者的那一份分开。上面的手续费是这个池子收取的金额，这是事实；把其中一部分归到这个区间上，则是一个谁也无法核对的、关于某个仓位的说法。",
    inSample:
      "这些正是画出这个区间所依据的同一批日子，所以它们展示的是区间被如何拟合出来的，而不是在检验它是否站得住脚——而且这个区间以今天的价格为中心，一个月前谁也开不出这样一个仓位。请把它们读作这个池子最近的走势与区间的相对位置，而不是一次回测。",
    notYourEarnings:
      "这些都不是一个仓位会赚到的：它们是整个池子收取的。一笔资金本可以从中分到多少——它在这些兑换发生时占活跃流动性的份额——就在正下方那一块，而且即便是那个，也只有手续费，再无其他。",
  },

  /*
   * The half of the fee question this application used to refuse.
   *
   * The refusal was honest while it lasted: the figures above are the pool's,
   * and turning them into a position's needs a size and a share of the active
   * liquidity. Both are read now, so the page answers instead of declining —
   * and every sentence here exists to stop the answer being read as a yield.
   */
  deposit: {
    heading: "一笔资金本可以收到多少",
    unavailable: "对这个池子，算不出一笔资金本可以从那些手续费中分到多少。",
    withheldNote:
      "原因和上面那个数字一样：这里的 hook 可能从兑换中抽走一份，而数据来源没有把它的份额和提供者的份额分开。一个无法归到这个区间上的总额，其中的一部分同样无法归到投进这个区间的一笔资金上。",
    deposited: "投入金额",
    depositedNote: "这一块是按这个金额算出来的。在上面的表单里改它。",
    collected: "它本可以分到的手续费",
    collectedNote: (days: string) => `在价格从未离开区间的那 ${days} 天里。`,
    ofDeposit: "相对投入金额",
    ofDepositNote:
      "这些手续费相对投进去的钱，只针对那些日子，别的日子不算。这不是年化利率，这里也没有任何东西把它变成年化。",
    sentence: (deposit: string, days: string, poolFees: string, yourFees: string) =>
      `在价格从未离开这个区间的那 ${days} 天里，这个池子收取了 ${poolFees} 的手续费。投进这个区间的 ${deposit} 资金本可以分到其中大约 ${yourFees}——按它自己的流动性占那几天里实际处于活跃状态的流动性的份额计算。`,
    unmeasurableNote: (days: string) =>
      `另有 ${days} 天也落在区间内，但数据来源没有公布这些天的手续费或活跃流动性，所以它们没有计入总额。`,
    dilution:
      "投得更多，并不会按比例收到更多。份额是你的流动性除以包括你自己在内的所有人的流动性，所以超过一定规模之后，你新加进去的大部分只是在稀释你已经有的那部分——这也正是为什么可选的金额之间相差一千倍。",
    caveat:
      "只有手续费，只有已经发生过的日子。它假设仓位在每一天都是开着的，而且没有任何东西因它而改变，它也没有说接下来的三十天会付出多少。一个仓位相比单纯持有这两种代币放弃了什么，是这一页更下面的那个对比，两者必须放在一起读。",
  },

  realizedFee: {
    heading: "它实际收取了多少",
    intro:
      "这个池子声明的费率是一个数字。而这里是兑换者实际付出的：用上面同样那批日子，把它反除回去——某一天的手续费除以那一天的成交量。它不需要额外的请求，也不需要 hook 提供任何东西。",
    declared: "声明的费率",
    /** How a stated fee was arrived at, where the protocol takes a cut on top. */
    statedNote: (lp: string, protocol: string) =>
      `${lp} 给流动性提供者，${protocol} 给协议，按 PoolManager 收取它们的方式合起来——这就是一个兑换者所付的，也是上面那些手续费的构成。`,
    noDeclared: "无",
    noDeclaredNote: "这个池子的 key 里没有带费率。它的 hook 每笔兑换各设一个。",
    median: "典型的一天",
    spread: "最低到最高的一天",
    spreadValue: (lowest: string, highest: string) => `${lowest} – ${highest}`,
    aggregate: "整个窗口",
    aggregateNote:
      "整个窗口的手续费除以整个窗口的成交量，所以繁忙的一天比清淡的一天权重更大。",
    daysMeasured: "被测到的天数",
    daysMeasuredNote: (skipped: string) =>
      `窗口里另有 ${skipped} 天没有任何成交，或者缺少某个数字，所以无法从中除出一个费率。`,
    /*
     * The three verdicts. They exist as separate sentences rather than one with
     * a number in it because they are three different things to know, and the
     * one that matters most is the one a single wording would blur.
     */
    verdictMatches:
      "在每一个被测到的日子里，两者都是一致的。声明的费率就是实际收取的费率。",
    verdictDiffers: (differing: string, measured: string) =>
      `两者并不一致。在被测到的 ${measured} 天里，有 ${differing} 天这个池子收取的不是它声明的费率，所以上面那个费率档描述的是这个池子被创建时的样子，而不是一笔兑换的实际代价。`,
    verdictNoneDeclared:
      "没有可供对照的东西：这个池子根本没有声明任何费率。这里的数字是它的 hook 实际设定的。",
    notLpShare:
      "这些都不是最终到达流动性提供者手上的。这个池子的 hook 被允许从一笔兑换中抽取一份，而数据来源没有把 hook 的那一份和提供者的那一份分开。这些数字说的是一笔兑换花了多少，而不是谁收到了它。",
    unavailableHeading: "这个池子收取多少，无法测出",
  },

  outOfSample: {
    heading: "在它从未见过的日子里检验",
    showFolds: "显示每一段",
    intro: (horizon: string) =>
      `上面每一个数字都是对它所描述的那些日子拟合出来的。这里的不是。这套方法被往回退了 ${horizon}，只用那个时点之前的价格重跑了一遍，并以那个时点的价格为中心——那是一个站在当时的人真的能看到的价格。然后把它盖在随后发生的那些日子上，整件事再沿着历史往回重复，能重复多少次就重复多少次。`,
    folds: "检验轮数",
    foldsNote: "历史长度够先拟合出一条价格带、再检验它，这样的次数有多少。",
    fullyInside: "全天在内的天数",
    fullyOutside: "全天在外的天数",
    undetermined: "越过了某一边的天数",
    verdict: (inside: string, measured: string, folds: string) =>
      `在 ${folds} 轮检验中，被测到的 ${measured} 天里有 ${inside} 天完全落在这套方法当时会画出的价格带内。`,
    foldPeriod: "被检验的天数",
    foldVolatility: "拟合出的波动率",
    foldVerdict: "内 / 外 / 越过",
    foldsCaption: "这套方法被检验过的每一段，最早的在前",
    foldColumns:
      "每一行是一轮：它被检验过的天数、它自己那次拟合测出的波动率——不是上面那个数字——以及那些日子相对这次拟合产出的价格带处在什么位置。",
    /*
     * The two sentences that stop a total becoming a claim about the method.
     * Nobody held these bands, and the folds are not independent of each other.
     */
    notIndependent:
      "在一个池子上跑几轮，并不能衡量这套方法多久成立一次，也说不出接下来会发生什么。而且相邻的拟合彼此重叠——一次用 31 个收盘价的拟合，比往前迈一个时间跨度要长——所以这些轮次之间并不互相独立。",
    notHeld:
      "没有人持有过这些价格带。每一条都是这套方法在那一刻本会建议的东西，盖在随后确实发生的价格上——而上面那些日子，也就是建议区间所依据的那些日子，并不是这里这些日子。",
    unavailableHeading: "这个池子无法做样本外检验",
  },

  divergence: {
    heading: "与单纯持有相比",
    intro:
      "在每一个价格上，这个区间里的一个仓位相比单纯持有这两种代币会值多少。这是精确的算术而非估算——但它只计入价格的变动，别的一概不算。它没有说一个仓位会赚到多少手续费，而手续费恰恰就是流动性提供者为承担这个差额所得到的报酬。",
    price: (base: string) => `${base} 的价格`,
    loss: "仓位相对持有",
    entryRow: "这是它的衡量起点——这个池子的当前价格。",
    impermanentNote:
      "这通常被称为无常损失。只有价格回来了它才是“无常”的：在与开仓时不同的价格上关掉的仓位，已经把它兑现了。",
  },

  /*
   * The other thing the same range can be. It was on the front page's list of
   * what this application could not do, and what it needed turned out to be no
   * data at all: a range order's average price is fixed by the protocol's own
   * formulas and falls out of the two bounds already on the page.
   */
  rangeOrder: {
    heading: "透过这个区间卖出与买入",
    intro:
      "上面那个区间是双边的：价格两侧都有钱，只要价格停在两者之间就一直在赚手续费。把它在当前价格处切开，每一半都是一种不同的工具。完全落在价格上方的仓位只持有一种代币、别的什么都没有，当价格向上穿过这条带子时，池子会把那种代币卖成另一种。在价格下方则反过来。这就是所谓的区间挂单，而这个区间的两半都各是一个。",
    selling: (token: string) => `卖出 ${token}`,
    buying: (token: string) => `买入 ${token}`,
    band: "价格带",
    bandNote:
      "这个仓位所处的位置。它的内侧边缘是越过当前价格所在那一格之后的第一个价格步长，所以一开始它一点都不持有它要换成的那种东西。",
    average: "平均价格",
    averageNote: "如果价格整段穿过这条带子，这次转换折算下来是什么价。",
    against: "相对当前价格",
    exact:
      "那个平均值是两个边界的几何平均数——精确如此，而且不管两个价格写成哪个方向都一样。它由协议自己关于一个仓位在带子两端各持有什么的公式推出，而投入的金额会从中约掉：一百美元和一百万美元按同样的价格转换。",
    onlyIfThrough:
      "而且只有价格整段穿过这条带子才成立。中途折返的价格会让这个仓位两种代币各持有一些，根本没有单一的成交价——而那恰恰就是它上面那个区间要做的事，只不过是误打误撞碰上的。",
    notAnOrderBook:
      "这里没有任何东西为这次转换排期，也没有任何东西保证它发生。这不是订单簿：价格永远没走到的一笔单子是再正常不过的结果，而不是失败，这里既没有排队也没有等着的对手方。取而代之的是：当价格在带子内时，这个仓位是在收取这个池子的手续费，而不是在支付它们。",
    unavailable: "这个区间没有可以描述的单边部分。",
  },

  /*
   * The one panel about using a pool rather than providing to it.
   *
   * It exists because nothing else here answers the first question anybody asks
   * of a pool, and it stops where the certainty does: at the edge of the price
   * step, because liquidity beyond it is a thing this application has not read.
   */
  swapDepth: {
    heading: "在这里做一笔兑换要付出什么",
    intro:
      "上面的一切都是关于提供流动性的。这一块是关于使用它的。一个池子的流动性在它所依托的两个价格步长之间是恒定的，所以只要一笔兑换停留在当前价格所在的那一格之内，就能用协议自己的公式给它定价、不必假设任何东西——而再往外一格就不行了，因为另一个仓位的流动性可能从那里开始，而本应用并不读取每一个价格上的流动性。",
    /*
     * "into the pool", because the panel above this one also has a leg called
     * "Selling WETH" and it means something else there: a position that sells as
     * the price passes it, rather than a swap sent now. Two labels reading the
     * same on one page is a reader mistaking one for the other.
     */
    selling: (token: string) => `把 ${token} 卖进这个池子`,
    amount: (amount: string, symbol: string) => `${amount} ${symbol}`,
    largest: "这里能定价的最大一笔兑换",
    largestNote:
      "在价格走到它所在那一格的尽头之前，能投进去多少。这不是上限：更大的一笔照样能成交，只是这一页说不出它的代价。",
    cost: "它放弃了什么",
    costNote: "这笔兑换的平均成交价离屏幕上那个价格有多远。",
    oneSideOnly:
      "只显示了一个方向。价格离它所在那一格的尽头已经近到：另一个方向剩下的余地是个舍入误差而不是一笔兑换，而这一页不会打印它无法核对的数字。",
    geometric:
      "那个平均值是当前价格与这笔兑换结束时价格的几何平均数——和上面那些单边仓位所依据的是同一个恒等式，只是从交易的另一侧看过去。穿过一条带子的兑换支付它；坐在那条带子里的仓位收取它。",
    whyItDiffers:
      "两个方向的规模不一样，是因为价格落在它那一格里的某个位置，而不是正中间。真正值得在不同池子之间比较的是这个规模本身：它是这个市场在价格移动之前能吸收的量，也正是为什么有人会把一笔大单拆成很多小单，而不是一次发出去。",
    hookMayAlter:
      "这个池子的 hook 被允许改变一笔兑换的成本——在每笔兑换发生时重写费率，由它自己而不是池子的曲线给这笔兑换定价，或者在事后从中抽取一份；具体是哪一种，上面的 hook 部分写着。这里的数字是池子的曲线所收取的，只有在 hook 不插手时才成立。这里读到的任何东西都无法说明它是否插手。",
    unavailable: "对这个池子，算不出一笔兑换要付出什么。",
  },

  compare: {
    heading: "这个交易对的所有费率档，并排放在一起",
    intro: (pair: string) =>
      `下面每个 ${pair} 池子都用同样的时长、同样的宽度和同样的资金来读取，所以它们的数字站在同一个基础上。它们描述的是已经过去的日子，而不是将来的日子。v3 池子按费率排列，v4 池子按深度从深到浅排列，下方的说明解释了原因；没有一个是按它本可以赚多少来排名的。`,
    depositFeesNote: (days: string) => `在价格停留在区间内的 ${days} 天里。`,
    daysInside: "完全在区间内的天数",
    daysInsideValue: (inside: string, measured: string) => `${measured} 天中的 ${inside} 天`,
    unavailable: "这个费率档现在读取不到。",
    open: "打开完整分析",
    link: "把费率档并排放在一起",
    onlyOne: (pair: string) =>
      `${pair} 只在一个 v3 池子里交易，没有别的可以放在旁边。`,
    readTogether:
      "手续费只是一半。一个区间相比单纯持有两种代币所放弃的东西，写在每个池子自己的页面上，两者必须一起读。",
  },

  feeTiers: {
    heading: "这个交易对还在哪里交易",
    intro: (pair: string) =>
      `${pair} 在不止一个费率档上交易。每一个都是独立的资金池，有自己的流动性、自己的价格历史和自己的区间——上面那些数字只描述这一个。`,
    onlyOne: (pair: string) =>
      `在以太坊主网上，${pair} 只在这一个费率档上交易。上面的一切都是关于整个交易对的，因为这个交易对就是这一个池子。`,
    thisOne: "你正在读的就是这一个",
    feeTier: "费率档",
    holds: "持有",
    reservesUnread: "这个池子持有什么，无法从链上读出。",
    open: "分析这个费率档",
    /*
     * The sentence the panel exists to carry. A list of pools ordered beside
     * dollar figures invites exactly one conclusion, and it is the wrong one.
     */
    biggerIsNotBetter:
      "一个流动性更多的费率档，只是有更大一群人在分同样那些兑换手续费，而不是一个更好的去处。哪一个适合一个仓位，取决于价格走多远、多久走一次，而那是逐池测量的——所以老老实实的比较办法是把每一个都打开、读它自己的数字。你选的时间跨度和倍数会随链接一起带过去。",
    reservesNote:
      "这些是两个代币合约为每个池子报出的余额，读自链上而不是索引器。索引器自己的数字曾与它们对照过，把实际存在的量高估了 1.3 到 13 倍，所以不予显示。之所以给两个代币数量而不是一个美元数字，是因为这里每一个费率档持有的都是同样两种代币，比较它们不需要给任何东西定价。",
    unavailableHeading: "这个交易对的其他费率档无法读取",

    /*
     * The other protocol. On a v3 page the same two token contracts on v4; on
     * a v4 page, v4's other pools of the pair and then v3's. Both lists say
     * what "same pair" means here — the same two contracts — because ether and
     * wrapped ether are two different tokens to a pool, whatever they are to
     * a person.
     */
    onV3: "在 Uniswap v3 上",
    onV4: "在 Uniswap v4 上",
    v4Intro: (pair: string) =>
      `交易 ${pair} 的那些 v4 资金池——同样的两个合约。一个 v4 交易对可以有很多个池子：费率是任意数值，价格步长是自由的，而且每一个 hook 都会再造出一个。`,
    v4None: (pair: string) => `没有任何 Uniswap v4 资金池用这两个合约交易 ${pair}。`,
    v4OnlyThis: (pair: string) => `在 v4 上，${pair} 只在这一个池子里交易。`,
    v3Intro: (pair: string) => `交易 ${pair} 的那些 v3 资金池——同样的两个代币合约，在各个费率档上。`,
    v3None: (pair: string) => `没有任何 Uniswap v3 资金池用这两个合约交易 ${pair}。`,
    v3NoNative:
      "这个池子持有的是链自己的以太币，而 v3 做不到：v3 的每一种货币都是一个代币合约。与它最接近的那些 v3 池子交易的是包装以太币，对一个池子来说那是另一种代币。",
    depth: "当前价格处的深度",
    depthValue: (ether: string) => `≈ ${ether} ETH`,
    stateUnread: "这个池子的流动性无法从链上读出。",
    hook: "hook",
    noHook: "无 hook",
    hookAltersSwaps: "可能改变一笔兑换的代价",
    priceStep: (step: string) => `步长 ${step}`,
    v4Ordering:
      "按当前价格处的深度排序——也就是这个池子的活跃流动性与价格，读自 PoolManager 的存储——因为一个 v4 交易对大多是些有人初始化之后就撂下的池子，而深度正是能把它们区分开的东西。它说明一笔兑换能动用多少，却完全没说哪个池子更好：更深的池子只是有更大一群人在分同样那些手续费。",
    moreNotShown: (count: string) => `另有 ${count} 个未显示；它们比这些更浅。`,
    v4Unavailable: "这个交易对的 v4 资金池无法读取",
    v3Unavailable: "这个交易对的 v3 资金池无法读取",
  },

  /*
   * The same method at every width the form offers, on one page. The two day
   * counts are different kinds of figure, and the note under the table says
   * which is which: the first is the fit, the second the check.
   */
  widths: {
    heading: "其他几种宽度",
    intro:
      "同一套方法在表单提供的每一种宽度上各跑一遍，这样取舍是看得见的而不是被告知的：更宽的区间能容纳更多的日子，也把同样一笔资金摊到更多价格上——那就是最后一列，而它是协议的算术而非估算。",
    width: "宽度",
    range: "区间",
    recent: (days: string) => `在内，占最近 ${days} 天`,
    unseen: "在内，在它从未见过的日子里",
    insideOf: (inside: string, total: string) => `${total} 天中的 ${inside} 天`,
    unseenNone: "历史不够长",
    feeShare: "在区间内时的手续费份额",
    feeShareValue: (times: string) => `${times}×`,
    chosen: "上面显示的就是这个",
    columnsNote:
      "第一个天数是在每个区间各自所依据的那些日子上数出来的，所以它说的是那种宽度被如何拟合出来，而不是它撑得住撑不住。第二个是上面那项检验，对每一种宽度各跑一遍：把方法往回退一个时间跨度，再盖到随后发生的日子上。",
    /*
     * The one column that is a comparison rather than a reading, and the one
     * most easily read as a promise. It is exact arithmetic about a day inside
     * the range, and it says nothing about the days outside it — which is the
     * half the column beside it measures.
     */
    feeShareNote:
      "最后一列是：在价格停留在那个区间内的一天里，同样一笔资金会分到多少手续费，相对上面显示的那种宽度——所以那一行是 1 倍。这是协议自己的仓位算术而不是估算：更窄的区间把同样的钱变成更多流动性，铺在更少的价格上。它假设这个池子其余的流动性没有变化，而一笔大到足以撼动它的资金不会让这句话继续成立；它也完全没有说价格待在区间外的那些日子。",
    notAdvice:
      "这些没有一个是推荐。更窄的区间在它撑住的那些日子里分到更大的份额，在它没撑住的日子里则什么都分不到，而这两者哪一个更要紧，取决于这个仓位是为了什么——那是这里任何东西都不知道的。",
  },

  parameters: {
    heading: "调整区间",
    apply: "重新计算",
    /*
     * The same words label the figures in "how this range was drawn", so a
     * reader changing one can see which number they are changing.
     */
    horizonLabel: "看多远",
    widthLabel: "多宽",
    depositLabel: "多少",
    days: (days: string) => `${days} 天`,
    sigma: (value: string) => `${value}σ`,
    /** A word for the offered widths; a width typed into the URL gets none. */
    widthChoice: (sigma: string, word: string | null) =>
      word === null ? sigma : `${word}（${sigma}）`,
    widthWords: { tight: "窄", medium: "中等", wide: "宽", veryWide: "很宽" },
    note: "时间跨度说的是把测出来的走势往前摊多远。它不改变测量本身：无论选哪个时间跨度，波动率始终来自最近 30 个完整的日子。宽度则把那个走势乘上一个倍数；更宽的区间被离开的次数更少，而它不是一个置信水平。",
    fellBack:
      "所请求的内容有一部分无法读取，所以在那些地方用了默认值。实际用到的时间跨度和宽度显示在上面。",
    preferenceHint:
      "这只改变本页。要改变每个资金池打开时的参数，请使用页眉里的区间偏好。",
  },

  holdings: {
    heading: "这个地址持有什么",
    intro:
      "在这个地址上找到的代币，以及它们可以进入的资金池。除非你在下方要求 Telegram 提醒，这里不存储任何东西；而地址本身是公开信息——任何人去查，看到的都是同一份清单。",
    forAddress: "地址",
    loading: "正在向各个代币合约询问这个地址持有什么……",
    /*
     * The sentence that keeps the answer honest. Nothing can list an address's
     * tokens, so the width of the search is part of the answer.
     */
    howItLooked: (tokens: string, v3Pools: string, v4Pools: string | null) =>
      `一个代币的余额存放在这个代币自己的合约里，所以并不存在一份“某地址拥有什么”的清单——只有可以被逐个询问的代币。这次询问了其中 ${tokens} 个：以太坊主网上成交最活跃的 ${v3Pools} 个 Uniswap v3 资金池里的每一种代币${v4Pools === null ? "" : `，以及最近七天成交最多的 ${v4Pools} 个 v4 资金池里的每一种货币，其中也包括链自己的以太币`}。持有在这个集合之外的东西，之所以没有出现在这一页上，并不是因为这个地址没有它。`,
    /*
     * Said out loud when the v4 net could not be cast, because a page that
     * listed only v3 pools and said nothing would read as "no v4 pool takes
     * what you hold", which nobody checked.
     */
    v4NotSearched:
      "没有搜索 Uniswap v4 资金池：它们的清单读不出来。以太币和 v4 资金池的各种货币没有出现在这一页上，原因仅此而已。",
    /** A row's protocol, beside its fee. The names are the protocol's own and are not translated. */
    hookTag: "hook",
    holdingsHeading: "找到的代币",
    nothingFound:
      "被检查的代币里，没有一种在这个地址上被找到。这和一个空钱包不是一回事——请看上面这次搜索是怎么做的。",
    poolsHeading: "这些代币可以进入的资金池",
    bothSides: "两边你都持有",
    oneSide: "你只持有一边",
    bothSidesNote:
      "这个池子的两种代币都在这个地址上找到了，所以在这里建仓不需要先做兑换。",
    oneSideNote:
      "这个池子的两种代币中找到了一种。在这里建仓还需要另一边，也就是要把你持有的一部分换掉。",
    moreNotShown: (count: string) =>
      `另有 ${count} 个未显示。上面这些是其中成交最活跃的，按数据来源报告的顺序排列——那是一个关于某个池子有多忙的说法，除此之外什么也不是。`,
    analyse: "分析这个资金池",
    notAdvice:
      "这是一份“可以做什么”的清单，不是一份“值得做什么”的清单。这些池子里哪一个适合什么，取决于每个池子自己页面上的那些数字，以及这个仓位是为了什么——这两件事这份清单都不知道。",
    unavailableHeading: "这个地址无法读取",
    invalidAddress: "那不是一个以太坊地址，所以什么都没有去查。",
    noAddress: "在首页连接一个钱包，这一页就会显示它持有什么。",
  },

  v4: {
    heading: "一个 Uniswap v4 资金池",
    intro:
      "从它自己的 key 读出来的、关于这个池子是什么。一个 v4 池子不是一份独立的合约：它住在同一个 PoolManager 里面，由定义它的五样东西的哈希来命名——两种货币、费率、价格步长，以及 hook。",
    poolId: "池 id",
    pair: "货币",
    fee: "费率",
    /*
     * Read from the pool's own key on the chain — the log that created it —
     * and never from the indexer, whose figure was measured to be the total
     * fee of the latest swap rather than the key's fee.
     */
    feeNote: (swap: string, lp: string, protocol: string) =>
      `读自链上这个池子自己的 key。一笔兑换支付 ${swap}：其中 ${lp} 给流动性提供者，另外还有 ${protocol} 给协议。`,
    feeNoteNoProtocol:
      "读自链上这个池子自己的 key。协议在此之上不另外抽取，所以这就是一笔兑换所支付的。",
    dynamicFee: "由 hook 逐笔兑换设定",
    dynamicFeeNote:
      "这个池子的 key 里带的是动态费率标志而不是一个费率，所以一笔兑换的代价由 hook 在它发生的那一刻决定。这次读取没有观察到任何一笔，这里也没有可以报告的费率。",
    /*
     * A list row for a pool whose key the chain did not answer for. The fee is
     * a fact about the pool that this read does not have, and nothing else —
     * not the indexer's figure — stands in for it.
     */
    feeUnread: "费率未读出",
    feeUnreadNote:
      "这个池子的费率存放在它被创建时的 key 里、在链上，而这次读取没能取到它。别的东西都不能替代它。",
    protocolFee: "协议费",
    protocolFeeNone: "无",
    protocolFeeNote:
      "在这个池子的费率之上，由协议在每一笔兑换中另外抽取。由治理设定，读自链上这个池子的状态。",
    protocolFeeByDirection: (token0: string, token1: string) =>
      `按方向不同而不同：卖出 ${token0} 时是前一个，卖出 ${token1} 时是后一个。`,
    priceStep: "价格步长",
    priceStepNote: (spacing: string) =>
      `在这个池子里，一个仓位的两条边缘所能放置的最细步长——也就是它 ${spacing} 的 tick 间距。在 v4 里它是这个池子 key 的一部分，所以和 v3 不同，不需要另外调用合约。`,
    nativeCurrency: "原生以太币",
    nativeCurrencyNote:
      "这里的零地址不是一个漏填的字段。v4 允许一个池子持有链自己的以太币而不是一个包装代币，这里就是这种情况。",
    hookHeading: "这个 hook",
    noHook: "这个池子在运行时没有 hook。",
    noHookNote:
      "没有任何东西伴随它的兑换或存取运行，所以它的行为和一个 v3 池子一样。",
    hookMay: "它被允许做什么",
    /*
     * One sentence per permission, under the moment a reader can picture it
     * at, with the protocol's own names folded away beneath. The names say
     * where in the protocol's code a hook is called; what a reader needs is
     * what that lets it do to a swap, a deposit or a withdrawal of theirs.
     * Every sentence is a "may": the address grants the moment, not the act.
     */
    permissionTopics: {
      swaps: "围绕兑换",
      liquidity: "围绕存入与取出",
      creation: "在这个池子被创建时",
      donations: "围绕捐赠",
    } satisfies Record<HookTopic, string>,
    permissionWords: {
      beforeSwap:
        "在每一笔兑换之前运行，它可以在此拒绝这笔兑换，并且在费率为动态的池子上，设定这笔兑换要付多少。",
      afterSwap: "在每一笔兑换之后运行，它在此仍然可以拒绝这笔兑换。",
      beforeSwapReturnsDelta:
        "在池子给一笔兑换定价之前，从中取走代币，或者投入它自己的代币——所以这里的一笔兑换不一定沿着这个池子自己的曲线走。",
      afterSwapReturnsDelta: "在池子给一笔兑换定价之后，从中抽取一份。",
      beforeAddLiquidity: "在每一次存入之前运行，它可以在此拒绝这次存入。",
      afterAddLiquidity: "在每一次存入之后运行，它在此仍然可以拒绝这次存入。",
      afterAddLiquidityReturnsDelta:
        "在一次存入进行时从中取走代币，或者往里面追加代币。",
      beforeRemoveLiquidity: "在每一次取出之前运行，它可以在此拒绝这次取出。",
      afterRemoveLiquidity: "在每一次取出之后运行，它在此仍然可以拒绝这次取出。",
      afterRemoveLiquidityReturnsDelta:
        "在一次取出进行时从中抽取一份，或者往里面追加代币。",
      beforeInitialize: "在这个池子被创建之前运行一次。那已经发生过了。",
      afterInitialize: "在这个池子被创建之后运行一次。那已经发生过了。",
      beforeDonate:
        "在向这个池子的提供者捐赠之前运行，它可以在此拒绝这次捐赠。",
      afterDonate:
        "在向这个池子的提供者捐赠之后运行，它在此仍然可以拒绝这次捐赠。",
    } satisfies Record<HookPermission, string>,
    noPermissions:
      "围绕兑换、存取或捐赠都没有任何权限：协议在这些时刻一个都不会调用它。像这样的 hook 仍然能做的，是为一个费率为动态的池子设定费率。",
    permissionNames: "协议对这些东西自己的叫法",
    /*
     * The other side of the swap warning. A hook that runs when a provider
     * withdraws can refuse the withdrawal — a hook that reverts reverts the
     * withdrawal with it — and one holding the returns-delta flag can take a
     * share of what comes out. Said above the list, like the swap warning,
     * for the reader who stops reading.
     */
    withdrawalWarning: (share: boolean): string =>
      share
        ? "当一个提供者取出时，这个 hook 会运行。它被允许拒绝一次取出，也被允许从取出的东西里抽取一份。它究竟有没有这样做过，从这里是无从得知的。"
        : "当一个提供者取出时，这个 hook 会运行，并且被允许拒绝一次取出。它究竟有没有这样做过，从这里是无从得知的。",
    /*
     * The sentence this whole page exists to carry. A hook's permissions are not
     * stored anywhere — the address is the permission list — so this is the one
     * claim about a hook that can be made without trusting somebody.
     */
    hookAddressIsThePermission:
      "这些都是从这个 hook 自己的地址里读出来的。v4 不把一个 hook 的权限存放在任何地方：一个 hook 被部署到某个地址上，这个地址的最后十四个比特就拼写出 PoolManager 会调用哪些回调，而 PoolManager 检查的是这些比特，并不去问合约。所以这里说的是这个 hook 可以做什么，绝不是它做了什么——一个被允许在每笔兑换上重写费率的 hook，完全可能永远返回同一个费率，而那从这里是无从得知的。",
    alterSwapWarning:
      "这个 hook 被允许改变一笔兑换的成本或收益。任何从价格历史推出来的数字——一个建议区间、一个费率档、一个与单纯持有的对比——都假设这个池子按它声明的收费、按曲线所说的支付。在这里这两个假设都不安全，而这一切在一串价格序列里都看不见。",
    /*
     * Replaced the line saying there was no analysis, on the day there was one.
     * What it has to do now is harder: say why a band drawn from price history
     * is as true here as anywhere, without letting that cover the fees, which
     * are the part a hook can move.
     */
    analysisScope:
      "下面是区间分析。这个区间来自已经发生过的价格，所以它在这里和在一个没有 hook 的池子上一样成立——hook 没法追溯地改变价格走到过哪里。hook 能改变的是一笔兑换的代价，所以这个池子实际收取的费率，是从它收到了多少测出来的，而不是取自上面那个费率。",
    unavailableHeading: "这个资金池无法读取",
    invalidId:
      "那不是一个 v4 池 id。一个 v4 池子由一个 32 字节的哈希来命名——0x 后面跟 64 个十六进制字符——而不是由一个合约地址来命名。",
    noId: "粘贴一个 v4 池 id，就能看到这个池子是什么、它的 hook 可以做什么。",
    loading: "正在从索引器和链上读取这个 v4 资金池……",
  },

  /*
   * The page a reader reaches by following something that is not here: an old
   * link, a typo, an address pasted into the path instead of the box. The
   * framework's own answer is an unstyled English line, which on a site
   * published in two languages is the one screen that forgets which it is in.
   */
  notFound: {
    title: "这里没有页面",
    body: "你跟过来的这个地址，没有指向本应用提供的任何东西。一个资金池是通过它的地址、或者对 v4 来说通过它的 id 打开的——这两者都填进搜索框，而不是填进路径里。",
    search: "找一个资金池 →",
  },

  /*
   * The directory, and the line it will not cross.
   *
   * Every sentence here is about what the protocol enforces, because that is the
   * only thing about a hook this application can check. A name, a category, a
   * "verified" badge — all of them would be somebody's claim republished, and
   * the reader would have no way to tell which parts of the page were which.
   */
  hooks: {
    heading: "正在 Uniswap v4 上运行的那些 hook",
    loading: "正在读取本周最活跃的 v4 资金池……",
    intro:
      "每一个 v4 资金池都可以指定一个 hook：一份合约，PoolManager 会在一笔兑换、一次存入、一次取出中的固定时刻调用它。至于是哪些时刻，那不是谁作出的承诺。它被挖进了这个 hook 的地址里——低十四位就是那份清单，而协议拒绝为清单之外的任何事去调用这份合约。",
    onlyPermissions:
      "这就是这一页所知道的全部，而它之所以值得知道，恰恰因为它是被强制执行的而不是被声称的。一个 hook 拿这项权限做了什么，写在它的代码里。本应用不读代码，也不保存任何人背书过的 hook 名单——那两样都会是它无法核对的说法，却摆在它能核对的数字旁边。",
    /*
     * Phrased so no count is followed by a noun that would have to agree with
     * it. A list of one pool is not a case this page will meet — the week's
     * busiest days name hundreds — but "1 pools" is the kind of sentence that
     * only ever appears in front of somebody.
     */
    window: (pools: string, hooked: string, hookless: string) =>
      `读自本周最活跃的那些 v4 日子里的资金池——共 ${pools} 个。其中 ${hooked} 个指定了 hook；${hookless} 个没有指定，行为和一个 v3 池子一样。`,
    ordering:
      "按这些池子里有多少个运行着各个 hook 来排序。那是一个池子数量，除此之外什么也不是：跑在很多池子上的 hook，只是有人用它部署了很多池子。",
    runs: (count: string) => `运行在其中 ${count} 个上`,
    poolsHeading: "它在哪里运行",
    moreNotShown: (count: string) => `另有 ${count} 个`,
    none: "本周最活跃的那些 v4 日子里，没有任何池子指定了 hook。",
    unavailable: "本周的 v4 资金池无法读取，所以没有名录可以显示。",
    fromHome: "查看每一个 hook →",
  },

  /*
   * The one panel here that describes somebody's own money.
   *
   * It says so, and it says what that does and does not mean: the same list is
   * public, anybody can read it for any address, and nothing about it is kept.
   */
  positions: {
    heading: "这个地址已经持有的仓位",
    intro:
      "上面的一切都是这个地址可以做什么——它的代币能打开哪些池子。这一块则是它已经做了什么。两个协议的仓位都是被某一份合约持有的一个代币，而这两份合约都会被问到每一个代币是什么。v3 那一份还能列出一个地址名下的代币；v4 那一份不能，所以那份清单来自索引器，而其中每一个 id 都会被放回链上，去问它归谁所有。",
    none: "这个地址不持有任何一个协议的 Uniswap 仓位代币。",
    noneOpen:
      "这个地址持有的每一个仓位代币都已经关闭了。已关闭的那个是一张“曾经有过一个仓位”的凭据，而不是一个仓位。",
    counts: (held: string, open: string, closed: string) =>
      `${held} 个仓位代币，其中 ${open} 个里面还有流动性，${closed} 个已经关闭。`,
    inRange: "此刻正在赚取",
    outOfRange: "在它的区间之外",
    rangeUnknown: "这里还没有人做过兑换",
    analyse: "分析这个资金池 →",
    /*
     * Read from the pool's own fee accounting and differenced, not estimated.
     * Deliberately not a rate: it says what has accrued, not over how long or
     * at what pace, because neither follows from the figure.
     */
    feesEarned: (amount0: string, symbol0: string, amount1: string, symbol1: string) =>
      `已赚到但尚未取出：${amount0} ${symbol0} 和 ${amount1} ${symbol1}。`,
    feesNone: "目前还没有赚到可以取出的东西。",
    feesUnread: "它赚到了多少，无法读出。",
    everyPrice: "这个池子能表达的每一个价格",
    moreNotShown: (count: string) => `另有 ${count} 个是开着的，没有列在这里。`,
    readCap: (read: string, held: string) =>
      `${held} 个里读了 ${read} 个。其余的不在这一页上，这是这一页的限制，而不是这个地址的限制。`,
    /*
     * Two protocols mean two ways to fail. The counts beside this cover the
     * other protocol only, and saying so is the difference between a partial
     * answer and a wrong one.
     */
    unreadProtocol: (protocol: string) =>
      `这次没能读出 Uniswap ${protocol} 的仓位，所以这里的每一个数字都只关乎另一个协议。`,
    unavailable: "这个地址的仓位无法读取。",
    publicNote:
      "一个仓位的所有者在链上，所以这份清单是公开的：任何人都能为同一个地址读出同样的一份，而且它没有透露任何这个地址不曾因为持有这些代币而公开过的东西。除非你在下方要求 Telegram 提醒，这里不存储任何东西；这一页上也没有任何数字是估值——一个区间不是一个仓位值多少钱。",
  },

  wallet: {
    heading: "连接一个钱包",
    intro:
      "连接一个钱包，这一页就能看到这个地址持有哪些代币，并把这些代币可以进入的资金池显示给你。它读取地址；在这里，对一个钱包的要求仅此而已。",
    connect: "连接钱包",
    connecting: "正在等待钱包……",
    connectedAs: "已连接为",
    showHoldings: "显示它持有什么",
    forget: "忘掉这个地址",
    /*
     * The sentence that replaced "never connects a wallet". The half that is
     * still true is the half worth keeping, and it is the half that matters.
     */
    readOnly:
      "只读。本应用向钱包索取的是它的地址，从不索取签名：这里没有任何代码能签署一条消息或发送一笔交易，两次访问之间也不存储任何关于钱包的东西。",
    notices: {
      "wallet-not-found":
        "在这个浏览器里没有找到钱包。浏览器钱包扩展会放一个进去；没有它，这一页上什么都不会变。",
      "wallet-request-declined":
        "这个请求在钱包里被拒绝了。什么都没有读取，也什么都没有发送。",
      "wallet-request-failed":
        "无法向这个钱包索取地址。什么都没有读取，也什么都没有发送。",
      "wallet-no-account":
        "钱包作出了回应但没有给出地址，这通常意味着它被锁住了，或者没有选中任何账户。",
    },
  },

  telegram: {
    heading: "Telegram 提醒",
    intro:
      "当这个地址的某个仓位接近它的区间边缘、离开区间或重新回到区间内时，通过 Telegram 获知。按钮会把你带到本站的机器人；在那里按下“开始”，那个对话就会与这个地址绑定。保存的只有这个地址和对话的数字 id——别的什么都没有——你向机器人发送 /stop 或在这里忘记绑定的那一刻，两者都会从服务器上删除，并在七天内从它的加密备份中消失。检查的频率取决于运行它的服务器。",
    connect: "连接 Telegram",
    connected: (address: string) => `这个浏览器已绑定：正在关注 ${address}。`,
    pending: "绑定等待中：在 Telegram 里打开机器人的对话并按下“开始”。",
    forget: "忘记绑定",
    notConfigured: "这台服务器上没有设置 Telegram 提醒。",
    publicNote:
      "关注一个地址不需要拥有它——仓位是公开的，提醒说的也不会超出这份清单所说的。机器人读取链上数据并发送消息；它无法签署或发送任何东西。",
    linked: (address: string) =>
      `已绑定。当 ${address} 的某个仓位接近区间边缘、离开区间或回到区间内时，你会在这里收到消息。发送 /stop 结束。`,
    unknownStart:
      "这个链接无法识别或已过期。请在网站上再按一次“连接 Telegram”。",
    alreadyClaimed:
      "这个链接已被另一个对话使用。请在网站上再按一次“连接 Telegram”获取新的链接。",
    stopped: "已停止。这个对话现在不再关注任何东西。记录已从服务器删除，七天内也会从加密备份中消失。",
    nothingToStop: "这个对话本来就没有关注任何东西。",
    help:
      "这个机器人只关注你在网站上绑定的地址，也只在某个仓位接近区间边缘、离开或重新进入它的区间时说话。发送 /stop 结束。",
    storeDown: "现在无法检查绑定。请一分钟后再试。",
    left: (pair: string, protocol: string, range: string) =>
      `⚠️ ${pair}（${protocol}）已离开它的区间：${range}。在价格回来之前，它只持有一种代币，什么也赚不到。`,
    nearing: (pair: string, protocol: string, range: string, price: string, edge: string) =>
      `⏳ ${pair}（${protocol}）已接近它的区间边缘：${range}。当前价格为 ${price}；越过 ${edge} 后，它将只持有一种代币，什么也赚不到。`,
    entered: (pair: string, protocol: string, range: string) =>
      `✅ ${pair}（${protocol}）回到了它的区间内：${range}。又在赚取了。`,
    opened: (pair: string, protocol: string, range: string) => `新仓位：${pair}（${protocol}），${range}。`,
    closed: (protocol: string, tokenId: string) => `已关闭：${protocol} 仓位 #${tokenId}。`,
    footer:
      "仅供参考——不构成财务建议。读自公开的链上数据；这里没有任何东西能代你操作。",
  },

  search: {
    label: "一个交易对、一个 v3 池地址，或一个 v4 池 id",
    placeholder: "WETH/USDC",
    help: "输入一个像 WETH/USDC 这样的交易对，粘贴一份 v3 池合约的地址，或者粘贴一个 v4 池 id——也就是一个 v4 池子被命名所用的那个 32 字节哈希。只读：本应用从不签署任何东西，也从不发送交易。",
    submit: "查找资金池",

    heading: "匹配的 Uniswap v3 资金池",
    resultsFor: (terms: string) => `代币与 ${terms} 匹配的资金池。`,
    empty: (terms: string) =>
      `以太坊主网上没有任何 Uniswap v3 资金池的代币与 ${terms} 匹配。`,
    emptyHint: "请检查拼写，或者直接粘贴该池的地址。",

    /*
     * The v4 list, beneath the v3 one. Two lists rather than one merged list,
     * because they are ordered by different numbers — what a pool holds, and
     * what its active liquidity is worth — and one order over both would be
     * comparing them.
     */
    v4Heading: "匹配的 Uniswap v4 资金池",
    v4Empty: (terms: string) =>
      `以太坊主网上没有任何 Uniswap v4 资金池的货币与 ${terms} 匹配。`,
    v4Depth: "当前价格处的深度",
    v4DepthValue: (ether: string) => `≈ ${ether} ETH`,
    v4DepthNote:
      "这个池子此刻的活跃流动性值多少，读自 PoolManager 自己的存储——不是这个池子持有什么，那是任何 v4 池子都不会自行报告的。",
    v4StateUnread: "这个池子的流动性无法从链上读出。",
    v4Hook: "Hook",
    v4NoHook: "无",
    v4HookAltersSwaps: "可能改变一笔兑换的代价",
    v4Ordering:
      "名字与你所搜索的完全一致的池子排在最前。之后的顺序按每个池子在其当前价格处的深度——也就是它的活跃流动性与价格，读自 PoolManager 的存储，并用数据来源推导出的价格换算到同一把尺子上。这不是这个池子持有什么：每一个 v4 池子的代币都一起躺在同一个 PoolManager 里，链上没有任何东西按池子报告它们。索引器自己的流动性数字曾与链上对照过，在其中一个最活跃的池子上差了百分之十五，这就是它不被采用的原因。",

    /*
     * The ordering is the one claim a list makes, so it is stated rather than
     * left to be inferred from the order itself.
     */
    ordering:
      "名字与你所搜索的完全一致的池子排在最前。之后的顺序按每个池子实际持有什么——读自代币合约本身，并用数据来源推导出的价格换算到同一把尺子上。它以前按数据来源报告的各池锁仓价值排序，而那个数字错得足以把这份清单重新排一遍：曾有一个池子被以九百万美元的报告流动性发布在这里，而它的合约里只有九千。",
    windowing:
      "这份清单取自数据来源针对你的搜索词报告为成交最活跃的那些池子，而一个清淡到落在那个集合之外的池子，根本走不到上面那个排序里。这就是“在一个来源选择返回的东西里做排名”这件事老老实实的边界：一个持有很多但很少成交的池子，可能根本不在这一页上。",
    dormantNote:
      "一个月内没有任何活动的资金池不会列出。区间是从最近一个月的价格画出来的，没有这一个月的池子无从画起——打开它也只会告诉你这一点。",
    /*
     * The v4 window is not the terms. The source cannot answer a search over
     * every v4 pool before this page stops waiting — measured, not assumed —
     * so the search runs over the week's busiest pool-days, and a page that
     * did not say so would let a reader conclude a pool does not exist.
     */
    v4Windowing:
      "这份清单取自最近七天在以太坊主网上成交最多的那些 v4 资金池——最活跃的一千个“池子·日”，合起来是几百个池子——而比这更清淡的池子走不到这一页上。数据来源没法在这一页停止等待之前，答完一次横跨每一个 v4 池子的搜索，所以这个窗口是按近期活跃度划的，而不是按你的搜索词划的：一个存在但本周没有成交的池子，不在这里。",
    /*
     * The sentence that does the real work on this page. Search is what lets
     * someone reach a pool they did not go looking for.
     */
    symbolWarning:
      "一个符号来自这个代币自己的合约，而部署一个自称 USDC 的代币不花一分钱。每个交易对下面的合约地址，才是把两种代币区分开的东西。",

    feeTier: "费率档",
    holds: "持有",
    reservesUnread: "这个池子持有什么，无法从链上读出。",
    moreNotShown: (count: string) =>
      `另有 ${count} 个未显示。上面这些是其中成交最活跃的，按数据来源报告的顺序排列——那是一个关于某个池子有多忙的说法，除此之外什么也不是。`,
    analyse: "分析这个资金池",
    /** Under the v4 list: where each row's fee came from, and why the row can say it was not read. */
    v4FeeNote:
      "每个池子的费率读自链上它被创建时的 key，而不是读自数据来源——数据来源那个费率数字曾被测出是最近一笔兑换所付的总额、包含协议抽成在内，并不是这个池子自己的费率。key 读不出来的那一行会明说。",

    unavailableHeading: "这次搜索无法执行",
    rejected: {
      empty: "输入一个像 WETH/USDC 这样的交易对，或者一个池地址。",
      length: (min: number, max: number) =>
        `一个搜索词的长度在 ${min} 到 ${max} 个字符之间。`,
      unsupportedCharacters:
        "一个搜索词可以包含字母、数字，以及出现在代币符号里的那些标记——别的都不行。",
    },
  },

  report: {
    steps: {
      pool: "读取这个池子的配置",
      snapshot: "读取这个池子当前的市场状态",
      history: "读取这个池子的每日价格历史",
      volatility: "测量价格走了多少",
      band: "构建价格带",
      range: "把价格带对齐到这个池子能表达的价格上",
      divergence: "把这个区间与持有两种代币作对比",
      activity: "读取这个池子在所测窗口内做了什么",
    },
    noRangeHeading: "这个池子没有区间",
    stoppedWhile: (step: string) => `这件事在${step}时停了下来。`,
    poolSummary: (protocol: string, fee: string, chain: string) =>
      `Uniswap ${protocol} · ${chain} · ${fee}`,
    feePerSwap: (fee: string) => `每笔兑换收取 ${fee} 手续费`,
    /** A v4 pool whose protocol takes a cut on top of the pool's own fee. */
    feePlusProtocol: (fee: string, protocol: string) =>
      `每笔兑换收取 ${fee} 手续费，另加 ${protocol} 给协议`,
    /** Stands where the fee would, for a v4 pool whose hook sets one per swap. */
    noDeclaredFee: "费率由它的 hook 在每笔兑换上设定",
    caveatsHeading: (count: number) =>
      count === 1 ? "有一条附注适用于这些数字。" : `有 ${count} 条附注适用于这些数字。`,
    caveatsAriaLabel: "附注",

    /*
     * The range, as two prices. Every price on the page is written the way
     * round that makes it at least one — one unit of the dearer token, priced
     * in the cheaper — and the intro says which token that is, so the figures
     * under it can be read without a second thought. The ticks those prices
     * encode are in the technical details at the end, where a reader who
     * wants to check them can, and a reader who does not is never made to.
     */
    contentsHeading: "本页内容",
    contentsLabel: "这份分析的各个部分",
    rangeHeading: "建议价格区间",
    rangeIntro: (base: string, quote: string) =>
      `这个池子里的一个仓位会在哪里处于活跃状态，以 1 ${base} 折合多少 ${quote} 来表示。`,
    rangeValue: (lower: string, upper: string, quote: string, base: string) =>
      `${lower} – ${upper} ${quote}/${base}`,
    rangeDistances: (down: string, up: string) =>
      `比当前价格低 ${down}，高 ${up}。`,
    rangeMeaning:
      "在这两个价格之间，一个仓位赚取它在这个池子兑换手续费中的份额。在它们之外，它只持有一种代币，并且在价格回来之前什么也赚不到。",
    priceSentence: (base: string, price: string, quote: string) => `1 ${base} = ${price} ${quote}`,
    currentPrice: "当前价格",
    inRangeYes: "当前价格落在这个区间内。",
    inRangeNo: "当前价格落在这个区间之外。",
    inRangeYesNote: "在这里开的仓位会立刻处于活跃状态。",
    inRangeNoNote:
      "在这里开的仓位只会持有一种代币，并且在价格回到区间内之前什么也赚不到。",
    beyondEdges: (below: string, above: string) =>
      `如果价格跌到区间下方，这个仓位最后只持有 ${below}；如果涨到区间上方，则只持有 ${above}。`,
    lowerTruncatedNote:
      "下边缘停在了这个池子能表达的最低价格上，没能走到价格带本会把它放到的位置。",
    upperTruncatedNote:
      "上边缘停在了这个池子能表达的最高价格上，没能走到价格带本会把它放到的位置。",
    /*
     * The month drawn through the range. The caption says what each mark is,
     * once, in the words the page uses for the same things; the day counts a
     * few panels down are the same days, counted.
     */
    chartLabel: "最近一个月的价格与建议区间的对照",
    chartCaption: (days: string) =>
      `最近 ${days} 天中的每一天：它的收盘价，以及从当日最低到当日最高的跨度。阴影带是建议区间；实线是今天的价格。`,
    chartLegend:
      "实心点表示这一天全天都留在区间内；空心点表示它离开了区间或越过了某一边。",

    /*
     * Where the range came from, in the words a reader has: how much the price
     * moves on a typical day, and what that comes to over the horizon. The
     * standard deviation is named in the notes, not in the labels.
     */
    basisHeading: "这个区间是怎么画出来的",
    basisIntro: (base: string, days: string) =>
      `来自 ${base} 的价格在最近 ${days} 个完整的日子里实际走了多少——而不是来自对它接下来往哪走的预测。`,
    dailyMove: "典型的单日波动",
    dailyMoveNote: "在这个窗口内，一天价格变化的标准差。",
    horizonMove: (days: string) => `在 ${days} 天里`,
    horizonMoveNote:
      "把同样的波动摊到下面所选的时间跨度上：一个标准差，上下各一个。",
    widthValue: (multiplier: string) => `上下各为其 ${multiplier} 倍`,
    widthNote:
      "在下面选择。更宽的区间被离开的次数更少，而摊在上面的同样一笔资金，在任何单个价格上都更薄。",
    measuredOver: "测量范围",
    measuredOverNote: (returns: string) => `有 ${returns} 个单日变化进入了计算。`,
    epilogue:
      "这个区间以今天的价格为中心，并按比例向上和向下画出同样的距离——减半和翻倍是同一种幅度——这也是那两个百分比不一样的原因。它描述的是价格已经走了多远，而不是它会走到哪里：它不是预测，宽度也不是置信水平。这里没有任何东西为一个仓位定规模，也没有说该存入多少哪一种代币。",
  },

  /*
   * Everything a reader checking the page against the chain would want, and
   * nothing a reader opening a position needs: the ticks the prices encode,
   * the blocks the figures were read at, the figures in the pool's own
   * direction. Folded away at the end of the report.
   */
  technical: {
    heading: "技术细节",
    summary: "上面这一页所对照核查的那些 tick、区块和数字。",
    lowerTick: "下边 tick",
    upperTick: "上边 tick",
    currentTick: "当前 tick",
    sourceReportedTick: (tick: string) => `数据来源报的是 ${tick}。`,
    noSourceTick:
      "数据来源没有报出它自己的 tick，所以这次换算未经核验。",
    tickSpacing: "tick 间距",
    tickSpacingNote: (step: string) => `可用边缘之间 ${step} 的价格步长。`,
    width: "宽度",
    widthValue: (ticks: string, spacings: string) => `${ticks} 个 tick · ${spacings} 个间距`,
    poolPrice: "这个池子自己报的价格",
    quotePerBase: (quote: string, base: string) => `${quote}/${base}`,
    bandLower: "价格带下界",
    bandUpper: "价格带上界",
    bandNote: "对齐到 tick 网格之前的值，按这个池子自己的方向。",
    annualised: "年化波动率",
    annualisedNote:
      "每日对数收益率的样本标准差，乘以 sqrt(365) 放大。",
    coverage: "覆盖率",
    coverageNote: "这个窗口里有多少是有连续每日价格支撑的。",
    sourceBlock: "来源区块",
    noBlockTime: "没有报出区块时间。",
    fetchedAt: "取得于",
    fetchedAtNote: "这是响应到达的时间，而不是它所描述的时间。",
    lowerEdge: "下边缘",
    upperEdge: "上边缘",
    truncated: "已截断",
    asAsked: "与所请求的一致",
  },

  explanation: {
    heading: "说明",
    pending: "正在撰写说明……",
    unavailable: "这份分析没有可用的说明。",
    /*
     * The two states a single paragraph can be in while the rest of the answer
     * is still arriving. Both keep the heading, so the reading order stays put
     * rather than the sections below jumping as each one lands.
     */
    sectionWriting: "仍在撰写中……",
    sectionMissing: "这一部分没能写出来。",
    /*
     * Names the author, and draws the line. Prose written by a model sitting
     * under figures that were computed and cross-checked should say which is
     * which, or a reader is entitled to assume the same hand produced both.
     */
    writtenBy: (model: string) => `由 ${model} 撰写。上面那些数字不是。`,
    sections: {
      whatThisRangeMeans: "这个区间意味着什么",
      ifPriceLeavesTheRange: "如果价格离开了这个区间",
      whatTheVolatilitySays: "波动率说明了什么",
      whatThisDoesNotCover: "这份说明没有涵盖什么",
    },
  },

  /*
   * Every sentence this application says about a read that did not go well.
   *
   * They lived in the data layer until search made a second language matter:
   * an adapter raised an English sentence and it travelled, unchanged, to a page
   * being read in Turkish. Now the adapter raises a code and the wording is
   * here, where all the other wording is.
   *
   * `satisfies` is what keeps this honest. Add a code to `notices.ts` and this
   * object stops compiling until it says something about it, in both languages.
   */
  notices: {
    failure: {
      "invalid-pool-address":
        "池地址必须是 0x 后面跟 40 个十六进制字符，而且不能是零地址。",
      "invalid-search-terms":
        "一次资金池搜索接受一到两个短的搜索词，由字母、数字，以及出现在代币符号里的那些标记组成。",
      "market-data-not-configured":
        "这台服务器上没有配置 Uniswap v3 的行情数据。",
      "chain-data-not-configured":
        "这台服务器上没有配置链上读取。",
      "explanation-not-configured":
        "本应用没有被配置为撰写说明，所以不显示任何说明。",
      "market-data-timed-out":
        "行情数据请求超时。",
      "market-data-unreachable":
        "无法连接到行情数据来源。",
      "market-data-credentials-rejected":
        "行情数据来源拒绝了所配置的凭据。",
      "market-data-rate-limited":
        "超出了行情数据来源的速率限制。",
      "market-data-unreadable":
        "行情数据来源返回了一个无法读取的响应。",
      "market-data-malformed":
        "行情数据来源返回了一个本应用无法核验的响应。",
      "market-data-indexing-errors":
        "行情数据来源报告了索引错误，所以它的数字不能当作已核验的。",
      "market-data-stale":
        "行情数据来源落后链太多，这些数字不能当作是当前的。",
      "market-data-future-block-time":
        "行情数据来源报出的区块时间比这台服务器的时钟还靠前，所以它的数字无法核验。",
      "chain-data-timed-out":
        "链上数据请求超时。",
      "chain-data-unreachable":
        "无法连接到链上数据来源。",
      "chain-data-credentials-rejected":
        "链上数据来源拒绝了所配置的凭据。",
      "chain-data-rate-limited":
        "超出了链上数据来源的速率限制。",
      "chain-data-unreadable":
        "链上数据来源返回了一个无法读取的响应。",
      "chain-data-malformed":
        "链上数据来源返回了一个本应用无法核验的响应。",
      "chain-aggregator-unverified":
        "余额是通过链上的一份辅助合约读取的，而那个地址上的代码不是本应用当初信任的那份代码，所以没有通过它读取任何东西。",
      "pool-not-found":
        "在以太坊主网上，没有为这个地址找到任何 Uniswap v3 资金池。",
      "pool-contract-not-found":
        "在以太坊主网上，这个地址上没有任何 Uniswap v3 池合约作出回应。",
      "pool-configuration-inconsistent":
        "从两个来源拼出来的池配置无法核验。",
      "pool-history-insufficient":
        "这个池子还没有足够多的完整每日价格历史可供分析。",
      "pool-history-never-traded":
        "这个池子存在，但从未发生过任何兑换，所以没有可用来测量区间的每日价格。",
      "pool-history-dormant":
        "这个池子在读取这些每日价格的那段时间开始之前就停止了交易，所以没有可用来测量区间的近期历史。等待不会改变这一点——只有池子重新被使用才会。",
      "volatility-invalid-input":
        "为这次计算提供的价格历史，不是一份有效的规范化历史。",
      "volatility-insufficient-history":
        "这个池子没有足够多连续的每日价格来测量波动率。",
      "volatility-unverifiable":
        "波动率计算得出了一个本应用无法核验的结果。",
      "band-invalid-input":
        "为这条价格带提供的行情数据无效，或者快照和波动率描述的不是同一个池子。",
      "band-no-current-price":
        "这个池子的当前价格不可用，所以无法为一条价格带定中心。",
      "band-unverifiable":
        "价格带计算得出了一个本应用无法核验的结果。",
      "range-invalid-input":
        "为这个区间提供的池子、价格带和快照无效，或者它们描述的不全是同一个池子和同一次观测。",
      "range-price-unrepresentable":
        "这个池子的当前价格落在 Uniswap 所能表达的范围之外，所以无法由它构建任何仓位区间。",
      "range-tick-disagreement":
        "数据来源为这个池子报出的价格和它报出的状态描述的不是同一个时刻，所以不发布任何区间。",
      "range-too-narrow":
        "这条价格带比这个池子允许的两条边缘之间最小的步长还要窄，所以它并不描述两条互不相同的仓位边界。",
      "range-unverifiable":
        "区间计算得出了一个本应用无法核验的结果。",
      "divergence-unverifiable":
        "与持有的对比得出了一个本应用无法核验的结果。",
      "activity-unverifiable":
        "这个池子近期的活动得出了一个本应用无法核验的结果。",
      "fee-rate-unmeasurable":
        "在这个窗口里被索引到的每一天，这个池子都没有任何成交，所以无法从它收到的金额中除出它收取的费率。",
      "deposit-share-unpriceable":
        "数据来源没有为这个池子持有的东西定价，所以无法把一笔以美元计的资金换算成这里的一个仓位。",
      "deposit-share-no-days":
        "在数据来源能作答的每一天里，价格都离开了这个区间，所以没有哪一天投在其中的资金本可以收到什么。",
      "deposit-share-unverifiable":
        "一笔资金本可以分到多少，没有通过它自己的检查，所以不予显示。",
      "range-order-no-room":
        "这个区间太窄了，在当前价格的任何一侧都容不下一个单边仓位。",
      "range-order-unverifiable":
        "这个区间的两个单边部分没有通过它们自己的检查，所以不予显示。",
      "swap-depth-no-liquidity":
        "这个池子在它的当前价格处报告没有流动性，所以这里没有可以定价的兑换。",
      "swap-depth-tick-disagreement":
        "数据来源自己的 tick 把这个池子放在了与所显示价格不同的价格步长里，所以它报出的流动性不能归到这一格上。",
      "swap-depth-unverifiable":
        "一笔兑换要付出什么，没有通过它自己的检查，所以不予显示。",
      "out-of-sample-insufficient-history":
        "这个池子被索引到的历史不够长，无法既在过去拟合出一条价格带，又留下一个完整时间跨度的日子来检验它。",
      "out-of-sample-unverifiable":
        "样本外检验得出了一个本应用无法核验的结果。",
      "hook-directory-unverifiable":
        "本周这些 v4 资金池的 hook 没有通过它们自己的检查，所以不显示这份名录。",
      "positions-manager-unverified":
        "持有 Uniswap v3 仓位的那份合约，回应时给出的代码不是本应用当初据以构建的那份，所以它说的任何东西都不予显示。",
      "positions-unreadable":
        "链没有为这个地址的仓位作出回应，所以一个也不显示——这和“一个都没有持有”不是一回事。",
      "positions-unverifiable":
        "这个地址的仓位没有通过它们自己的检查，所以不予显示。",
      "holdings-unverifiable":
        "这个地址持有什么，得出了一个本应用无法核验的结果。",
      "explanation-key-rejected":
        "说明服务不接受所配置的密钥，所以不显示任何说明。",
      "explanation-model-not-permitted":
        "所配置的密钥没有被允许使用所选的模型，所以不显示任何说明。",
      "explanation-model-unknown":
        "所选的模型对所配置的密钥不可用，所以不显示任何说明。",
      "explanation-rate-limited":
        "说明服务此刻处于速率限制中，所以不显示任何说明。",
      "explanation-hourly-cap":
        "本站每小时只写有限数量的说明，这个数量已经用完。上面的数字是完整的；一小时内可以再次写说明。",
      "explanation-unreachable":
        "无法连接到说明服务，所以不显示任何说明。",
      "explanation-request-refused":
        "说明服务拒绝了这个请求，所以不显示任何说明。",
      "explanation-declined":
        "模型谢绝解释这个池子的数字，所以不显示任何说明。",
      "explanation-truncated":
        "这段说明在写完之前就被截断了，所以不予显示。",
      "explanation-malformed":
        "这段说明返回时的形式是本应用无法核验的，所以不予显示。",
    } satisfies Record<DataFailureNotice, string>,

    warning: {
      "block-time-unreported":
        "数据来源没有报出区块时间，所以无法核验这些数字有多新。",
      "history-window-incomplete":
        "数据来源没有为这个窗口里的每一天都报出价格；缺失的那些日子是缺着的，而不是估出来的。",
      "volatility-window-incomplete":
        "这个窗口里有些日子没有价格，所以波动率是用比窗口所覆盖的更少的单日收益率测出来的；缺失的那些日子被跳过了，而不是估出来的。",
      "band-window-incomplete":
        "波动率窗口里有些日子没有价格，所以这条价格带所依据的单日收益率比窗口所覆盖的要少。",
      "band-price-block-time-unreported":
        "当前价格的来源没有报出区块时间，所以无法独立核验它有多新。",
      "band-volatility-block-time-unreported":
        "波动率的来源没有报出区块时间，所以无法独立核验它有多新。",
      /*
       * Neither names an edge. The codes name the pool's edges, and the page
       * writes its prices the reader's way round, which can be the other way —
       * so the sentence points at the range panel, which says which edge in
       * the direction shown.
       */
      "range-lower-edge-truncated":
        "这个区间的一条边缘停在了这个池子所能表达的价格的尽头——也就是这个池子第一种代币最便宜的那一边——所以这个区间没有伸到价格带本会到达的地方。区间那一块会说明，在所显示的方向上那是哪一条边缘。",
      "range-upper-edge-truncated":
        "这个区间的一条边缘停在了这个池子所能表达的价格的尽头——也就是这个池子第一种代币最贵的那一边——所以这个区间没有伸到价格带本会到达的地方。区间那一块会说明，在所显示的方向上那是哪一条边缘。",
      "range-tick-unverified":
        "价格来源没有报出这个池子自己的状态，所以由它推出的价格无法与之对照核验。",
      "range-excludes-current-price":
        "这个池子的当前价格落在这个区间之外，所以由它建出的仓位只会持有一种代币，并且在价格回来之前什么也赚不到。",
    } satisfies Record<DataWarningNotice, string>,
  },

  rateLimited: {
    title: "请求过多",
    body: (limit: number) =>
      `这一页每次访问都会读取 Uniswap 的实时数据，所以它被限制为每分钟 ${limit} 次分析。`,
    retry: (seconds: number) => `请在 ${seconds} 秒后重试。`,
    back: "返回顾问首页",
  },

  error: ERROR_COPY.zh,
};

const ru: Dictionary = {
  metadata: {
    title: "LiquidityWise",
    description:
      "Учебный советник по стратегиям ликвидности Uniswap v3 и v4 с помощью ИИ. Только пояснения — не финансовый совет.",
    v4Title: "Пул Uniswap v4 · LiquidityWise",
    v4Description:
      "Что представляет собой один пул Uniswap v4 и что его hook имеет право делать.",
    holdingsTitle: "Что держит адрес · LiquidityWise",
    holdingsDescription:
      "Токены, найденные на одном адресе Ethereum, и пулы Uniswap v3, в которые они могут войти.",
    compareTitle: "Уровни комиссии рядом · LiquidityWise",
    compareDescription: "Все уровни комиссии Uniswap v3 одной пары, прочитанные с тем же горизонтом, шириной и вкладом.",
    poolTitle: "Анализ диапазона пула · LiquidityWise",
    poolDescription:
      "Ценовой диапазон для одного пула Uniswap v3 в основной сети Ethereum, выведенный из того, насколько его цена действительно двигалась.",
    hooksTitle: "Hook’и в Uniswap v4 · LiquidityWise",
    hooksDescription:
      "Каждый hook, который называют самые активные пулы Uniswap v4 недели, и что каждому из них разрешено делать — прочитано из его собственного адреса."
  },

  preferences: {
    languageLabel: "Язык",
    selectLanguage: "Выбрать язык",
    closeLanguages: "Закрыть",
    /*
     * Said in the reader's own language, at the moment they choose it, rather
     * than left to be discovered paragraph by paragraph. A reader who is told
     * can decide; one who meets it halfway down a page cannot.
     */
    partlyTranslated:
      "Этот язык ещё переводится. Меню, подписи и заголовки уже на нём; длинные пояснения пока на английском.",
    themeLabel: "Тема",
    themeSystem: "Как в системе",
    themeLight: "Светлая",
    themeDark: "Тёмная",
    /*
     * The band every pool opens at, set once in the header rather than on
     * every pool. A link naming its own band still wins over it.
     */
    rangeLabel: "Настройки диапазона",
    rangeIntro:
      "Горизонт, ширина и сумма, с которыми открывается каждый пул. Ссылка со своими значениями всё равно главнее, а форма под каждым анализом меняет только ту страницу.",
    rangeSave: "Сохранить",
    rangeReset: "Забыть",
  },

  disclaimer: {
    ariaLabel: "Важное предупреждение",
    title: "Учебный инструмент — не финансовый совет.",
    body: "Это приложение объясняет, как устроен Uniswap, и помогает продумать выбор параметров. Оно не предсказывает цены, не гарантирует доходность и не может проверить, безопасен ли смарт-контракт. Предоставление ликвидности несёт реальные риски, включая непостоянные потери и полную потерю средств. Всегда проверяйте адреса контрактов сами и делайте собственное исследование.",
  },

  home: {
    badge: "Ранняя основа",
    title: "LiquidityWise",
    introBeforeV3: "Учебный советник по Uniswap ",
    introBetween: ", растущий в сторону ",
    introAfterV4:
      ". Найдите пул по его паре, посмотрите ценовой диапазон, выведенный из того, насколько эта пара действительно двигалась, и получите объяснение простыми словами. Каждая цифра вычисляется и перепроверяется прежде, чем модели разрешат её описать, — а называть цифры модели не разрешено никогда.",
    workingTodayHeading: "Что работает сегодня",
    workingTodayBody:
      "Найдите пул по паре или вставьте адрес пула v3 либо id пула v4. Вы получите проверенную конфигурацию пула и его текущее состояние, дневные цены за последний месяц, наложенные на предлагаемый диапазон, то, насколько пара действительно двигалась, и вытекающий отсюда диапазон — причём горизонт и ширину вы меняете сами. Рядом: сколько пул брал комиссии и сколько собрал на самом деле, как его недавние дни легли относительно диапазона, что тот же метод дал на днях, которых он не видел, что позиция теряет по сравнению с простым хранением, что дала бы каждая из других ширин и — для суммы, которую вы задаёте сами, — сколько она забрала бы из комиссий, начисленных в дни, когда цена не выходила за диапазон. И тот же диапазон, прочитанный наоборот: каждая его половина — односторонняя позиция, и страница говорит, по какой цене каждая из них конвертировала бы, если цена прошла бы её насквозь. Сколько стоит своп через пул — для самого крупного, который можно оценить, ничего не предполагая. И каталог всех hook’ов, которые называют самые активные пулы v4 недели, с тем, что каждому разрешено, прочитанным из его собственного адреса. Страница пула v4 тоже говорит простыми словами, что разрешено его hook’у, читая это из адреса самого hook’а. Адрес можно проверить на пулы, в которые могут войти его токены, и на позиции Uniswap v3, которые он уже держит, — каждая с ценами, которые она покрывает, и с тем, внутри них ли пул сейчас. А затем объяснение всего этого простыми словами. Ни одна из этих цифр не проходит через модель, ни одна не оценена наугад ради заполнения пробела, и в тексте попросту негде появиться собственной цифре.",
    analysePool: "Найти пул →",
    methodHeading: "Как это работает",
    methodSteps: [
      {
        step: "Проверенные данные",
        detail:
          "Факты о пуле берутся из субграфов Uniswap и читаются в сети, а не предполагаются. Цена сверяется с состоянием, которое пул сообщает о себе сам.",
      },
      {
        step: "Детерминированные расчёты",
        detail:
          "Волатильность, ценовая полоса и диапазон позиции считаются на обычном TypeScript, поэтому один и тот же пул всегда даёт одни и те же числа.",
      },
      {
        step: "Толкование ИИ",
        detail:
          "Модель объясняет, что эти цифры значат. Ей передают их уже проверенными, и в формате её ответа просто нет места для числа.",
      },
    ],
    coverageHeading: "Ещё не сделано",
    coverage: [
      {
        version: "Uniswap v3",
        features: [
          {
            name: "Gas и цена того, чтобы следовать за ценой",
            summary:
              "Диапазон, который цена покинула, нужно закрыть и открыть заново, чтобы идти за ней, а это стоит gas и превращает расхождение на бумаге в уже состоявшееся. Ничего из этого здесь нигде не учтено.",
          },
        ],
      },
      {
        version: "Uniswap v4",
        features: [
          {
            name: "Что hook делает на самом деле",
            summary:
              "Страница v4 говорит, что hook’у разрешено, потому что именно это протокол принуждает исполнять и именно это читается из адреса самого hook’а. Прочитать контракт и сказать, что он делает с этими правами, — другая задача, и это приложение за неё не берётся.",
          },
          {
            name: "Стратегии в духе TWAMM",
            summary:
              "Растянуть крупный ордер во времени вместо того, чтобы исполнить его об одну точку ликвидности. Та половина, на которую страница анализа уже отвечает, здесь есть: сколько стоит своп против ликвидности на текущей цене и насколько крупный своп вообще поддаётся оценке. Расписать ордер во времени — работа hook’а, а поведение hook’ов это приложение не моделирует.",
          },
        ],
      },
    ],
    footer:
      "Ничего из перечисленного выше пока нет. Есть всё, что выше по этой странице: пул, найденный по имени, вычисленные и перепроверенные цифры и текст, проверенный до того, как его показали. Кошелёк можно подключить, и всё, о чём его просят, — это адрес. Единственное, что это приложение хранит, — связь с Telegram, которую читатель создаёт сам: адрес рядом с идентификатором чата, и оба удаляются, как только он отправит боту /stop, а из зашифрованных резервных копий — в течение семи дней. И ничто здесь не может подписать или отправить транзакцию от вашего имени.",
  },

  pool: {
    back: "← LiquidityWise",
    invalidAddress:
      "Это не адрес Ethereum. Адрес — это 0x и ровно 40 шестнадцатеричных символов после него.",
    loading: "Читаем свежие данные Uniswap…",
  },

  /*
   * Facts about the pool, and the sentence that keeps them from being read as
   * something else. The gap between "the pool collected this" and "you would
   * have earned this" is where a reader is likeliest to fill in a number nobody
   * gave them.
   */
  activity: {
    heading: "Что пул делал на самом деле",
    volume24h: "Объём, 24 ч",
    volume7d: "Объём, 7 дн.",
    volume30d: "Объём, 30 дн.",
    fees30d: "Начислено комиссий, 30 дн.",
    feesNote: "Всего пула, поделено между всеми, чья ликвидность была активна.",
    tvl: "Всего заблокировано",
    occupancySentence: (days: string, inside: string, outside: string, crossed: string) =>
      `Из последних ${days} дн. ${inside} прошли целиком внутри этого диапазона, ${outside} — целиком снаружи, и ${crossed} пересекли границу.`,
    undeterminedNote:
      "День, пересёкший границу, часть себя провёл внутри, а часть снаружи, и дневные максимум с минимумом от источника не говорят, сколько пришлось на каждую часть.",
    feesWhileInside: "Комиссии за дни, целиком прошедшие внутри",
    /*
     * Shown instead of that figure when the pool's hook may take a share of a
     * swap. The fees are still real; what cannot be stated is their relationship
     * to a position, which is the only reason anyone reads the figure.
     */
    feesWithheld: "Для этого пула не показано",
    feesWithheldNote:
      "Hook’у этого пула разрешено забирать долю свопа, и ничто в источнике не отделяет долю hook’а от доли поставщиков ликвидности. Комиссии выше — это то, что начислил пул, и это факт; привязать часть из них к этому диапазону значило бы утверждать о позиции то, чего никто не может проверить.",
    inSample:
      "Это те же самые дни, по которым диапазон и построен, поэтому они показывают, как он подогнан, а не проверяют, держится ли он, — и диапазон центрирован на сегодняшней цене, которую месяц назад никто не мог открыть. Читайте их как положение недавнего движения пула относительно диапазона, а не как бэктест.",
    notYourEarnings:
      "Ничто из этого не заработок позиции: это то, что начислил весь пул. Сколько из этого забрал бы вклад — его доля в ликвидности, активной в моменты свопов, — в блоке прямо ниже, и даже там речь только о комиссиях и ни о чём больше.",
  },

  /*
   * The half of the fee question this application used to refuse.
   *
   * The refusal was honest while it lasted: the figures above are the pool's,
   * and turning them into a position's needs a size and a share of the active
   * liquidity. Both are read now, so the page answers instead of declining —
   * and every sentence here exists to stop the answer being read as a yield.
   */
  deposit: {
    heading: "Сколько собрал бы вклад",
    unavailable: "Для этого пула нельзя вычислить, сколько из этих комиссий забрал бы вклад.",
    withheldNote:
      "По той же причине, что и цифра выше: здешний hook может забирать долю свопа, и источник не отделяет его долю от доли поставщиков. Часть суммы, которую нельзя отнести к этому диапазону, нельзя отнести и к вкладу в него.",
    deposited: "Вклад",
    depositedNote: "Размер, для которого всё это посчитано. Измените его в форме выше.",
    collected: "Комиссии, которые он забрал бы",
    collectedNote: (days: string) => `За ${days} дн., когда цена не выходила за диапазон.`,
    ofDeposit: "От вклада",
    ofDepositNote:
      "Эти комиссии относительно вложенных денег, за те дни и ни за какие другие. Это не годовая ставка, и ничто здесь её в годовую не превращает.",
    sentence: (deposit: string, days: string, poolFees: string, yourFees: string) =>
      `За ${days} дн., когда цена не выходила за этот диапазон, пул начислил комиссий на ${poolFees}. Вклад ${deposit}, размещённый в диапазоне, забрал бы из них около ${yourFees} — по своей ликвидности как доле в той ликвидности, что была активна в каждый из этих дней.`,
    unmeasurableNote: (days: string) =>
      `Ещё ${days} дн. пришлись на диапазон, но источник не опубликовал по ним ни комиссий, ни активной ликвидности, поэтому в сумму они не вошли.`,
    dilution:
      "Больший вклад не собирает пропорционально больше. Доля — это ваша ликвидность к общей, включая вашу собственную, поэтому начиная с некоторого размера большая часть добавленного разводняет то, что у вас уже есть. Именно поэтому предлагаемые суммы различаются в тысячу раз.",
    caveat:
      "Только комиссии и только уже прошедшие дни. Предполагается, что позиция была открыта каждый из них и что ничто не сдвинулось ей в ответ; о том, сколько заплатят следующие тридцать дней, здесь не сказано ничего. Что позиция теряет по сравнению с простым хранением двух токенов — это сравнение ниже на этой же странице, и читать их нужно вместе.",
  },

  realizedFee: {
    heading: "Сколько он брал на самом деле",
    intro:
      "Комиссия, которую пул объявляет, — одно число. А здесь то, что на самом деле платили те, кто делал свопы, вычисленное обратно из тех же дней, что и цифры выше: комиссии за день, делённые на объём того дня. Для этого не нужно ни дополнительного запроса, ни чего-либо от hook’а.",
    declared: "Объявленная комиссия",
    /** How a stated fee was arrived at, where the protocol takes a cut on top. */
    statedNote: (lp: string, protocol: string) =>
      `${lp} поставщикам ликвидности и ${protocol} протоколу, сложенные так, как их берёт PoolManager, — это и платит тот, кто делает своп, и из этого состоят комиссии выше.`,
    noDeclared: "Нет",
    noDeclaredNote: "В ключе этого пула комиссии нет. Его hook задаёт её на каждый своп.",
    median: "Обычный день",
    spread: "От самого низкого дня до самого высокого",
    spreadValue: (lowest: string, highest: string) => `${lowest} – ${highest}`,
    aggregate: "Всё окно",
    aggregateNote:
      "Комиссии за окно, делённые на объём за окно, — поэтому оживлённый день весит больше тихого.",
    daysMeasured: "Измерено дней",
    daysMeasuredNote: (skipped: string) =>
      `Ещё в окне было дней без единой сделки или без нужной цифры: ${skipped}. Ставку из них вывести нельзя.`,
    /*
     * The three verdicts. They exist as separate sentences rather than one with
     * a number in it because they are three different things to know, and the
     * one that matters most is the one a single wording would blur.
     */
    verdictMatches:
      "Они совпадают в каждый измеренный день. Объявленная ставка и есть та, которую брали.",
    verdictDiffers: (differing: string, measured: string) =>
      `Они не совпадают. В ${differing} из ${measured} измеренных дней пул брал не свою объявленную ставку, так что уровень выше описывает, с чем пул создали, а не сколько стоит своп.`,
    verdictNoneDeclared:
      "Сравнивать не с чем: этот пул вообще не объявляет ставки. Цифры здесь — то, что фактически задал его hook.",
    notLpShare:
      "Ничто из этого не доходит до поставщика ликвидности как есть. Hook’у этого пула разрешено забирать долю свопа, а источник не отделяет долю hook’а от доли поставщиков. Эти цифры говорят, сколько стоил своп, а не кто это получил.",
    unavailableHeading: "Сколько берёт этот пул, измерить не удалось",
  },

  outOfSample: {
    heading: "Проверено на днях, которых он не видел",
    showFolds: "Показать каждый отрезок",
    intro: (horizon: string) =>
      `Каждая цифра выше подогнана к тем дням, которые описывает. Эти — нет. Метод отступили назад на ${horizon}, прогнали заново только по ценам до этой точки и центрировали на цене в той точке — той, которую человек, стоящий там, действительно увидел бы. Затем наложили на последовавшие дни и повторили всё это вглубь истории столько раз, сколько в ней поместилось.`,
    folds: "Прогонов",
    foldsNote: "Сколько раз в истории хватило места построить полосу, а потом проверить её.",
    fullyInside: "Дней целиком внутри",
    fullyOutside: "Дней целиком снаружи",
    undetermined: "Дней, пересёкших границу",
    verdict: (inside: string, measured: string, folds: string) =>
      `За ${folds} прогонов ${inside} из ${measured} дней прошли целиком внутри полосы, которую построил бы этот метод.`,
    foldPeriod: "Проверено дней",
    foldVolatility: "Подогнанная волатильность",
    foldVerdict: "Внутри / снаружи / пересекли",
    foldsCaption: "Каждый отрезок, на котором проверяли метод, начиная с самого раннего",
    foldColumns:
      "Каждая строка — один прогон: дни, на которых его проверяли, волатильность, измеренная его собственной подгонкой (не цифра выше), и то, как эти дни легли относительно полосы, которую дала та подгонка.",
    /*
     * The two sentences that stop a total becoming a claim about the method.
     * Nobody held these bands, and the folds are not independent of each other.
     */
    notIndependent:
      "Несколько прогонов на одном пуле — не мера того, как часто метод срабатывает, и они ничего не говорят о том, что будет дальше. К тому же соседние подгонки перекрываются: подгонка по 31 закрытию длиннее, чем шаг в один горизонт, — так что прогоны не независимы друг от друга.",
    notHeld:
      "Этих полос никто не держал. Каждая — то, что метод предложил бы в тот момент, наложенное на цены, которые затем случились; а дни выше, по которым построен предлагаемый диапазон, — не эти дни.",
    unavailableHeading: "Этот пул не удалось проверить вне выборки",
  },

  divergence: {
    heading: "В сравнении с простым хранением",
    intro:
      "Сколько позиция в этом диапазоне стоила бы по сравнению с простым хранением двух токенов — при каждой цене. Точная арифметика, а не оценка, — но она считает только движение цены и ничего больше. Она ничего не говорит о комиссиях, которые заработала бы позиция, а комиссии — это ровно то, чем поставщику ликвидности платят за эту разницу.",
    price: (base: string) => `Цена ${base}`,
    loss: "Позиция против хранения",
    entryRow: "Цена, от которой всё это отсчитывается, — текущая цена пула.",
    impermanentNote:
      "Это то, что обычно называют непостоянными потерями. Непостоянны они только если цена вернётся: позиция, закрытая не по той цене, по которой открывалась, их уже зафиксировала.",
  },

  /*
   * The other thing the same range can be. It was on the front page's list of
   * what this application could not do, and what it needed turned out to be no
   * data at all: a range order's average price is fixed by the protocol's own
   * formulas and falls out of the two bounds already on the page.
   */
  rangeOrder: {
    heading: "Продажа и покупка сквозь диапазон",
    intro:
      "Диапазон выше двусторонний: деньги по обе стороны от цены, зарабатывающие комиссии, пока цена держится между ними. Разрежьте его по цене — и каждая половина окажется другим инструментом. Позиция, целиком лежащая выше цены, держит один токен и больше ничего, и пул продаёт этот токен за другой по мере того, как цена поднимается сквозь полосу. Ниже цены всё наоборот. Это и есть диапазонный ордер, и обе половины этого диапазона — именно он.",
    selling: (token: string) => `Продажа ${token}`,
    buying: (token: string) => `Покупка ${token}`,
    band: "Полоса",
    bandNote:
      "Где лежит позиция. Её внутренняя граница — первый ценовой шаг за тем, в котором находится цена, так что вначале она не держит ничего из того, во что переводит.",
    average: "Средняя цена",
    averageNote: "По какой цене выходит конвертация, если цена пройдёт всю полосу.",
    against: "Относительно текущей цены",
    exact:
      "Это среднее — среднее геометрическое двух границ, причём точно и независимо от того, в какую сторону записаны цены. Оно следует из собственных формул протокола о том, что позиция держит на каждом конце своей полосы, и вложенная сумма из него сокращается: сто долларов и миллион конвертируются по одной и той же цене.",
    onlyIfThrough:
      "И только если цена пройдёт всю полосу. Та, что развернётся внутри, оставит позицию с обоими токенами и вообще без единой цены — а это ровно то, для чего нужен диапазон выше, только полученное случайно.",
    notAnOrderBook:
      "Ничто здесь не назначает конвертацию по расписанию и ничто её не гарантирует. Это не книга заявок: ордер, до которого цена не дошла, — обычный исход, а не сбой, и здесь нет ни очереди, ни ждущей встречной стороны. Вместо этого позиция собирает комиссии пула, пока цена внутри полосы, а не платит их.",
    unavailable: "У этого диапазона нет односторонней половины, которую можно описать.",
  },

  /*
   * The one panel about using a pool rather than providing to it.
   *
   * It exists because nothing else here answers the first question anybody asks
   * of a pool, and it stops where the certainty does: at the edge of the price
   * step, because liquidity beyond it is a thing this application has not read.
   */
  swapDepth: {
    heading: "Сколько здесь стоит своп",
    intro:
      "Всё выше — о том, как предоставлять ликвидность. Это — о том, как ею пользоваться. Ликвидность пула постоянна между ценовыми шагами, на которых он построен, поэтому своп, не выходящий за шаг, в котором стоит цена, можно оценить по собственным формулам протокола, ничего не предполагая; а на шаг дальше — уже нельзя, потому что там может начинаться ликвидность другой позиции, а это приложение не читает ликвидность на каждой цене.",
    /*
     * "into the pool", because the panel above this one also has a leg called
     * "Selling WETH" and it means something else there: a position that sells as
     * the price passes it, rather than a swap sent now. Two labels reading the
     * same on one page is a reader mistaking one for the other.
     */
    selling: (token: string) => `Продажа ${token} в пул`,
    amount: (amount: string, symbol: string) => `${amount} ${symbol}`,
    largest: "Самый крупный своп, оценимый здесь",
    largestNote:
      "Сколько войдёт прежде, чем цена дойдёт до конца шага, в котором стоит. Это не предел: своп крупнее пройдёт, просто эта страница не скажет, во сколько он обойдётся.",
    cost: "Чем он жертвует",
    costNote: "Насколько средняя цена свопа отстоит от цены на экране.",
    oneSideOnly:
      "Показано только одно направление. Цена стоит достаточно близко к концу своего шага, чтобы место в другую сторону было ошибкой округления, а не свопом, и эта страница не станет печатать цифру, которую не может проверить.",
    geometric:
      "Это среднее — среднее геометрическое нынешней цены и цены, на которой своп закончится: то же тождество, на котором держатся односторонние позиции выше, только увиденное с другой стороны сделки. Своп, проходящий сквозь полосу, его платит; позиция, лежащая в этой полосе, его получает.",
    whyItDiffers:
      "Два направления не равны по размеру, потому что цена стоит где-то внутри своего шага, а не посередине. Сравнивать между пулами стоит сам этот размер: он и есть то, что рынок поглощает, прежде чем сдвинуться, и именно поэтому крупный ордер разбивают на мелкие вместо того, чтобы отправить разом.",
    hookMayAlter:
      "Hook’у этого пула разрешено менять то, сколько стоит своп: переписывать комиссию при каждом свопе, самому назначать цену свопа вместо кривой пула или забирать долю после; какое из этого — сказано выше, в разделе о hook’е. Цифры здесь — то, что берёт кривая пула, и они верны, только если hook не вмешивается. Ничто из прочитанного здесь не может сказать, вмешивается ли он.",
    unavailable: "Для этого пула нельзя вычислить, сколько стоил бы своп.",
  },

  compare: {
    heading: "Все уровни комиссии этой пары рядом",
    intro: (pair: string) =>
      `Каждый пул ${pair} ниже прочитан с тем же горизонтом, той же шириной и тем же вкладом, так что их цифры стоят на одной основе. Они описывают уже прошедшие дни, а не будущие. Пулы v3 идут в порядке комиссии, а пулы v4 — от самого глубокого, как объясняет примечание под ними; ни один не ранжирован по тому, сколько он принёс бы.`,
    depositFeesNote: (days: string) => `За ${days} дн., когда цена оставалась внутри диапазона.`,
    daysInside: "Дни целиком внутри диапазона",
    daysInsideValue: (inside: string, measured: string) => `${inside} из ${measured}`,
    unavailable: "Этот уровень сейчас не удалось прочитать.",
    open: "Открыть полный разбор",
    link: "Поставить уровни рядом",
    onlyOne: (pair: string) =>
      `${pair} торгуется только в одном пуле v3, так что рядом поставить нечего.`,
    readTogether:
      "Комиссии — это половина. Что диапазон теряет по сравнению с простым хранением двух токенов, есть на странице каждого пула, и читать это нужно вместе.",
  },

  feeTiers: {
    heading: "Где ещё торгуется эта пара",
    intro: (pair: string) =>
      `${pair} торгуется не на одном уровне комиссии. Каждый — отдельный пул со своей ликвидностью, своей историей цен и своим диапазоном; цифры выше описывают только этот.`,
    onlyOne: (pair: string) =>
      `В основной сети Ethereum ${pair} торгуется только на этом уровне комиссии. Всё выше относится ко всей паре, потому что пара — это и есть один этот пул.`,
    thisOne: "Вы читаете про этот",
    feeTier: "Уровень комиссии",
    holds: "Держит",
    reservesUnread: "Что держит этот пул, не удалось прочитать из сети.",
    open: "Разобрать этот уровень",
    /*
     * The sentence the panel exists to carry. A list of pools ordered beside
     * dollar figures invites exactly one conclusion, and it is the wrong one.
     */
    biggerIsNotBetter:
      "Уровень с большей ликвидностью — это большая толпа, делящая те же комиссии со свопов, а не место получше. Какой подходит позиции, зависит от того, насколько далеко и как часто ходит цена, а это измеряется по каждому пулу отдельно — поэтому честный способ сравнить их — открыть каждый и прочитать его собственные цифры. Выбранные вами горизонт и множитель переходят по ссылке вместе с вами.",
    reservesNote:
      "Это остатки, которые два контракта токенов сообщают по каждому пулу, прочитанные из сети, а не у индексатора. Цифру индексатора сверили с ними: она завышает то, что там есть, в 1,3–13 раз, поэтому её здесь нет. Две суммы токенов, а не одна долларовая, потому что каждый уровень здесь держит те же два токена и ничего не нужно оценивать, чтобы их сравнить.",
    unavailableHeading: "Другие уровни комиссии этой пары не удалось прочитать",

    /*
     * The other protocol. On a v3 page the same two token contracts on v4; on
     * a v4 page, v4's other pools of the pair and then v3's. Both lists say
     * what "same pair" means here — the same two contracts — because ether and
     * wrapped ether are two different tokens to a pool, whatever they are to
     * a person.
     */
    onV3: "В Uniswap v3",
    onV4: "В Uniswap v4",
    v4Intro: (pair: string) =>
      `Пулы v4, торгующие ${pair}, — те же два контракта. Пара в v4 может быть множеством пулов: комиссия — любое число, ценовой шаг свободен, и каждый hook создаёт ещё один.`,
    v4None: (pair: string) => `Ни один пул Uniswap v4 не торгует ${pair} этими двумя контрактами.`,
    v4OnlyThis: (pair: string) => `В v4 ${pair} торгуется только в этом пуле.`,
    v3Intro: (pair: string) => `Пулы v3, торгующие ${pair}, — те же два контракта токенов, на каждом уровне комиссии.`,
    v3None: (pair: string) => `Ни один пул Uniswap v3 не торгует ${pair} этими двумя контрактами.`,
    v3NoNative:
      "Этот пул держит собственный эфир сети, а v3 так не умеет: каждая валюта в v3 — это контракт токена. Ближайшие к нему пулы v3 торгуют обёрнутым эфиром, а для пула это другой токен.",
    depth: "Глубина на текущей цене",
    depthValue: (ether: string) => `≈ ${ether} ETH`,
    stateUnread: "Ликвидность пула не удалось прочитать из сети.",
    hook: "hook",
    noHook: "без hook",
    hookAltersSwaps: "может изменить цену свопа",
    priceStep: (step: string) => `шаг ${step}`,
    v4Ordering:
      "Упорядочено по глубине на текущей цене — активной ликвидности пула и его цене, прочитанным из хранилища PoolManager, — потому что пара в v4 состоит в основном из пулов, которые кто-то создал и бросил, а глубина как раз их и различает. Она говорит, на сколько может опереться своп, и ничего не говорит о том, какой пул лучше: пул глубже — это большая толпа, делящая те же комиссии.",
    moreNotShown: (count: string) => `Ещё не показано: ${count}. Они мельче этих.`,
    v4Unavailable: "Пулы v4 этой пары не удалось прочитать",
    v3Unavailable: "Пулы v3 этой пары не удалось прочитать",
  },

  /*
   * The same method at every width the form offers, on one page. The two day
   * counts are different kinds of figure, and the note under the table says
   * which is which: the first is the fit, the second the check.
   */
  widths: {
    heading: "Другие ширины",
    intro:
      "Тот же метод при каждой ширине, которую предлагает форма, чтобы компромисс было видно, а не пересказано: более широкий диапазон вмещает больше дней и растягивает тот же вклад на большее число цен — это последний столбец, и он арифметика протокола, а не оценка.",
    width: "Ширина",
    range: "Диапазон",
    recent: (days: string) => `Внутри, из последних ${days} дн.`,
    unseen: "Внутри, в дни, которых он не видел",
    insideOf: (inside: string, total: string) => `${inside} из ${total}`,
    unseenNone: "истории не хватает",
    feeShare: "Доля комиссий, пока внутри",
    feeShareValue: (times: string) => `${times}×`,
    chosen: "показано выше",
    columnsNote:
      "Первый счёт — по тем дням, из которых каждый диапазон и построен, так что он говорит, как эта ширина подогнана, а не как она держалась. Второй — та самая проверка выше, прогнанная для каждой ширины: метод отступили на горизонт назад и наложили на последовавшие дни.",
    /*
     * The one column that is a comparison rather than a reading, and the one
     * most easily read as a promise. It is exact arithmetic about a day inside
     * the range, and it says nothing about the days outside it — which is the
     * half the column beside it measures.
     */
    feeShareNote:
      "Последний столбец — сколько тот же вклад забрал бы из комиссий, начисленных в день, когда цена держится внутри этого диапазона, относительно ширины, показанной выше; поэтому у неё стоит единица. Это собственная позиционная арифметика протокола, а не оценка: более узкий диапазон превращает те же деньги в большую ликвидность на меньшем числе цен. Она предполагает, что остальная ликвидность пула не изменилась, — чего вклад, достаточно крупный, чтобы её сдвинуть, не оставил бы верным, — и ничего не говорит о днях, которые цена проводит снаружи.",
    notAdvice:
      "Ни одна из них не рекомендация. Более узкий диапазон забирает большую долю в дни, когда держится, и совсем ничего в дни, когда нет; а что из этого важнее, зависит от того, для чего нужна позиция, — чего здесь не знает ничто.",
  },

  parameters: {
    heading: "Изменить диапазон",
    apply: "Пересчитать",
    /*
     * The same words label the figures in "how this range was drawn", so a
     * reader changing one can see which number they are changing.
     */
    horizonLabel: "Насколько вперёд",
    widthLabel: "Насколько широко",
    depositLabel: "Сколько",
    days: (days: string) => `${days} дн.`,
    sigma: (value: string) => `${value}σ`,
    /** A word for the offered widths; a width typed into the URL gets none. */
    widthChoice: (sigma: string, word: string | null) =>
      word === null ? sigma : `${word} (${sigma})`,
    widthWords: { tight: "Узкий", medium: "Средний", wide: "Широкий", veryWide: "Очень широкий" },
    note: "Горизонт говорит, насколько далеко вперёд раскладывается измеренное движение. Само измерение он не меняет: волатильность всегда берётся из последних 30 завершённых дней, какой бы горизонт ни выбрали. Ширина умножает это движение; более широкий диапазон покидают реже, и это не доверительный уровень.",
    fellBack:
      "Часть запрошенного не удалось прочитать, поэтому там подставлено значение по умолчанию. Горизонт и ширина, которые в итоге использованы, показаны выше.",
    /** Under the form: which of the two things that set a band this one is. */
    preferenceHint:
      "Это меняет только эту страницу. Чтобы изменить, с чем открывается каждый пул, воспользуйтесь настройками диапазона в шапке.",
  },

  holdings: {
    heading: "Что держит этот адрес",
    intro:
      "Токены, найденные на этом адресе, и пулы, в которые они могут войти. Здесь ничего не хранится, если вы не попросите уведомления в Telegram ниже, а сам адрес — публичная информация: тот же список виден любому, кто его посмотрит.",
    forAddress: "Адрес",
    loading: "Спрашиваем контракты токенов, что держит этот адрес…",
    /*
     * The sentence that keeps the answer honest. Nothing can list an address's
     * tokens, so the width of the search is part of the answer.
     */
    howItLooked: (tokens: string, v3Pools: string, v4Pools: string | null) =>
      `Баланс токена живёт внутри контракта самого токена, поэтому списка того, чем владеет адрес, не существует — есть только токены, которые можно спросить по одному. Спросили ${tokens}: каждый токен из ${v3Pools} самых торгуемых пулов Uniswap v3 в основной сети Ethereum${v4Pools === null ? "" : `, и каждую валюту из ${v4Pools} пулов v4, торговавших больше всего за последние семь дней, включая собственный эфир сети`}. Если что-то держится вне этого набора, оно отсутствует на этой странице не потому, что адрес этого не держит.`,
    /*
     * Said out loud when the v4 net could not be cast, because a page that
     * listed only v3 pools and said nothing would read as "no v4 pool takes
     * what you hold", which nobody checked.
     */
    v4NotSearched:
      "Пулы Uniswap v4 не искали: их список не удалось прочитать. Эфир и валюты пулов v4 отсутствуют на этой странице по этой причине и ни по какой другой.",
    /** A row's protocol, beside its fee. The names are the protocol's own and are not translated. */
    hookTag: "hook",
    holdingsHeading: "Найденные токены",
    nothingFound:
      "Ни один из проверенных токенов на этом адресе не найден. Это не то же самое, что пустой кошелёк, — смотрите выше, как был устроен поиск.",
    poolsHeading: "Пулы, в которые могут войти эти токены",
    bothSides: "У вас обе стороны",
    oneSide: "У вас одна сторона",
    bothSidesNote:
      "Оба токена этого пула нашлись на адресе, так что позиции здесь не нужен предварительный своп.",
    oneSideNote:
      "Нашёлся один из двух токенов этого пула. Позиции здесь нужна и вторая сторона, а значит — обменять часть того, что у вас есть.",
    moreNotShown: (count: string) =>
      `Ещё не показано: ${count}. Выше — самые торгуемые из них, в том порядке, в каком их сообщает источник данных, а это утверждение о том, насколько пул оживлён, и ни о чём больше.`,
    analyse: "Разобрать этот пул",
    notAdvice:
      "Это список того, что возможно, а не того, что стоит делать. Какой из этих пулов для чего подходит, зависит от цифр на собственной странице каждого пула и от того, для чего нужна позиция, — а ни того, ни другого этот список не знает.",
    unavailableHeading: "Этот адрес не удалось прочитать",
    invalidAddress: "Это не адрес Ethereum, поэтому ничего не искали.",
    noAddress: "Подключите кошелёк на главной странице, и здесь появится то, что он держит.",
  },

  v4: {
    heading: "Пул Uniswap v4",
    intro:
      "Что представляет собой этот пул, прочитанное из его собственного ключа. Пул v4 — не отдельный контракт: он живёт внутри одного PoolManager и называется хешем пяти вещей, которые его определяют, — двух валют, комиссии, ценового шага и hook’а.",
    poolId: "id пула",
    pair: "Валюты",
    fee: "Комиссия",
    /*
     * Read from the pool's own key on the chain — the log that created it —
     * and never from the indexer, whose figure was measured to be the total
     * fee of the latest swap rather than the key's fee.
     */
    feeNote: (swap: string, lp: string, protocol: string) =>
      `Прочитано из собственного ключа пула в сети. Своп платит ${swap}: из них ${lp} поставщикам ликвидности и ${protocol} протоколу сверху.`,
    feeNoteNoProtocol:
      "Прочитано из собственного ключа пула в сети. Протокол сверху ничего не берёт, так что это и есть то, что платит своп.",
    dynamicFee: "Задаёт hook, на каждый своп",
    dynamicFeeNote:
      "В ключе этого пула вместо комиссии стоит флаг динамической комиссии, так что цену свопа решает hook в момент, когда своп происходит. Это чтение ни одного не застало, и сообщать здесь нечего.",
    /*
     * A list row for a pool whose key the chain did not answer for. The fee is
     * a fact about the pool that this read does not have, and nothing else —
     * not the indexer's figure — stands in for it.
     */
    feeUnread: "комиссия не прочитана",
    feeUnreadNote:
      "Комиссия пула живёт в ключе, с которым его создали, в сети, и это чтение не смогло её получить. Ничто другое её не заменяет.",
    protocolFee: "Комиссия протокола",
    protocolFeeNone: "Нет",
    protocolFeeNote:
      "Берётся протоколом поверх комиссии пула, на каждом свопе. Задаётся управлением и читается из состояния пула в сети.",
    protocolFeeByDirection: (token0: string, token1: string) =>
      `Различается по направлению: первая — когда продают ${token0}, вторая — когда ${token1}.`,
    priceStep: "Ценовой шаг",
    priceStepNote: (spacing: string) =>
      `Самый мелкий шаг, с которым в этом пуле можно ставить границы позиции, — его tick spacing, равный ${spacing}. В v4 это часть ключа пула, поэтому, в отличие от v3, отдельный вызов контракта не нужен.`,
    nativeCurrency: "Собственный эфир",
    nativeCurrencyNote:
      "Нулевой адрес здесь — не пропущенное поле. v4 позволяет пулу держать собственный эфир сети вместо обёрнутого токена, и это именно такой случай.",
    hookHeading: "Hook",
    noHook: "Этот пул работает без hook’а.",
    noHookNote:
      "Рядом с его свопами и вкладами ничего не выполняется, так что он ведёт себя как пул v3.",
    hookMay: "Что ему разрешено делать",
    /*
     * One sentence per permission, under the moment a reader can picture it
     * at, with the protocol's own names folded away beneath. The names say
     * where in the protocol's code a hook is called; what a reader needs is
     * what that lets it do to a swap, a deposit or a withdrawal of theirs.
     * Every sentence is a "may": the address grants the moment, not the act.
     */
    permissionTopics: {
      swaps: "Вокруг свопов",
      liquidity: "Вокруг вкладов и изъятий",
      creation: "Когда пул создавали",
      donations: "Вокруг пожертвований",
    } satisfies Record<HookTopic, string>,
    permissionWords: {
      beforeSwap:
        "Выполняется перед каждым свопом, где может отказать свопу и — в пуле с динамической комиссией — задать, сколько этот своп заплатит.",
      afterSwap: "Выполняется после каждого свопа, где всё ещё может отказать свопу.",
      beforeSwapReturnsDelta:
        "Забрать токены из свопа или вложить свои прежде, чем пул его оценит, — так что своп здесь не обязан идти по собственной кривой пула.",
      afterSwapReturnsDelta: "Забрать долю свопа после того, как пул его оценил.",
      beforeAddLiquidity: "Выполняется перед каждым вкладом, где может отказать вкладу.",
      afterAddLiquidity: "Выполняется после каждого вклада, где всё ещё может отказать вкладу.",
      afterAddLiquidityReturnsDelta:
        "Забрать токены из вклада в момент его внесения или добавить к нему свои.",
      beforeRemoveLiquidity: "Выполняется перед каждым изъятием, где может отказать изъятию.",
      afterRemoveLiquidity: "Выполняется после каждого изъятия, где всё ещё может отказать изъятию.",
      afterRemoveLiquidityReturnsDelta:
        "Забрать долю изъятия в момент, когда оно происходит, или добавить к нему токены.",
      beforeInitialize: "Выполняется один раз, перед созданием пула. Это уже произошло.",
      afterInitialize: "Выполняется один раз, после создания пула. Это уже произошло.",
      beforeDonate:
        "Выполняется перед пожертвованием поставщикам пула, где может отказать пожертвованию.",
      afterDonate:
        "Выполняется после пожертвования поставщикам пула, где всё ещё может ему отказать.",
    } satisfies Record<HookPermission, string>,
    noPermissions:
      "Ничего вокруг свопов, вкладов или пожертвований: ни в один из этих моментов протокол его не вызывает. Что такой hook всё же может — задать комиссию пулу, у которого она динамическая.",
    permissionNames: "Собственные названия протокола для всего этого",
    /*
     * The other side of the swap warning. A hook that runs when a provider
     * withdraws can refuse the withdrawal — a hook that reverts reverts the
     * withdrawal with it — and one holding the returns-delta flag can take a
     * share of what comes out. Said above the list, like the swap warning,
     * for the reader who stops reading.
     */
    withdrawalWarning: (share: boolean): string =>
      share
        ? "Этот hook выполняется, когда поставщик изымает средства. Ему разрешено отказать в изъятии и забрать долю изымаемого. Делает ли он это когда-нибудь — отсюда узнать нельзя."
        : "Этот hook выполняется, когда поставщик изымает средства, и ему разрешено отказать в изъятии. Делает ли он это когда-нибудь — отсюда узнать нельзя.",
    /*
     * The sentence this whole page exists to carry. A hook's permissions are not
     * stored anywhere — the address is the permission list — so this is the one
     * claim about a hook that can be made without trusting somebody.
     */
    hookAddressIsThePermission:
      "Всё это прочитано из собственного адреса hook’а. v4 нигде не хранит его прав: hook разворачивают по адресу, последние четырнадцать бит которого и составляют список того, какие обратные вызовы сделает PoolManager, а PoolManager проверяет эти биты, а не спрашивает контракт. Поэтому здесь сказано, что hook’у можно, и никогда — что он делает: тот, кому разрешено переписывать комиссию на каждом свопе, может всегда возвращать одну и ту же, и отсюда этого не узнать.",
    alterSwapWarning:
      "Этому hook’у разрешено менять то, сколько своп стоит или сколько он приносит. Любая цифра, выведенная из истории цен, — предлагаемый диапазон, уровень комиссии, сравнение с простым хранением — предполагает, что пул берёт столько, сколько объявил, и платит столько, сколько говорит кривая. Здесь ни то, ни другое предположение не безопасно, и в ряду цен этого не видно.",
    /*
     * Replaced the line saying there was no analysis, on the day there was one.
     * What it has to do now is harder: say why a band drawn from price history
     * is as true here as anywhere, without letting that cover the fees, which
     * are the part a hook can move.
     */
    analysisScope:
      "Ниже — анализ диапазона. Диапазон выведен из уже случившихся цен, поэтому здесь он верен ровно настолько же, насколько в пуле без hook’а: задним числом hook не может изменить, куда ходила цена. Что hook может изменить — это цену свопа, поэтому ставка, которую брал этот пул, измерена из того, что он собрал, а не взята из комиссии выше.",
    unavailableHeading: "Этот пул не удалось прочитать",
    invalidId:
      "Это не id пула v4. Пул v4 называется 32-байтовым хешем — 0x и 64 шестнадцатеричных символа, — а не адресом контракта.",
    noId: "Вставьте id пула v4, чтобы увидеть, что это за пул и что можно его hook’у.",
    loading: "Читаем этот пул v4 — у индексатора и в сети…",
  },

  /*
   * The page a reader reaches by following something that is not here: an old
   * link, a typo, an address pasted into the path instead of the box. The
   * framework's own answer is an unstyled English line, which on a site
   * published in two languages is the one screen that forgets which it is in.
   */
  notFound: {
    title: "Здесь нет страницы",
    body: "Адрес, по которому вы пришли, не называет ничего из того, что это приложение отдаёт. Пул открывается по его адресу или, для v4, по его id, и оба вводятся в поле поиска, а не в путь.",
    search: "Найти пул →",
  },

  /*
   * The directory, and the line it will not cross.
   *
   * Every sentence here is about what the protocol enforces, because that is the
   * only thing about a hook this application can check. A name, a category, a
   * "verified" badge — all of them would be somebody's claim republished, and
   * the reader would have no way to tell which parts of the page were which.
   */
  hooks: {
    heading: "Hook’и, работающие в Uniswap v4",
    loading: "Читаем самые оживлённые пулы v4 за неделю…",
    intro:
      "Каждый пул v4 может назвать hook — контракт, который PoolManager вызывает в определённые моменты свопа, вклада, изъятия. Какие именно это моменты — не чьё-то обещание. Это вмайнено в адрес hook’а: младшие четырнадцать бит и есть тот список, и протокол отказывается вызывать контракт ради чего-либо за его пределами.",
    onlyPermissions:
      "Это всё, что знает эта страница, и знать это стоит именно потому, что оно принуждается к исполнению, а не заявляется. Что hook делает со своим правом — в его коде. Это приложение кода не читает и не держит списка hook’ов, за которых кто-то поручился: и то, и другое было бы утверждением, которое оно не может проверить, рядом с цифрами, которые может.",
    /*
     * Phrased so no count is followed by a noun that would have to agree with
     * it. A list of one pool is not a case this page will meet — the week's
     * busiest days name hundreds — but "1 pools" is the kind of sentence that
     * only ever appears in front of somebody.
     */
    window: (pools: string, hooked: string, hookless: string) =>
      `Прочитано из пулов самых оживлённых дней v4 этой недели, всего их ${pools}. Hook называют ${hooked}; не называют ${hookless} — они ведут себя как пул v3.`,
    ordering:
      "Упорядочено по тому, в скольких из этих пулов работает каждый hook. Это счёт пулов и ничего больше: hook во многих из них — это hook, с которым кто-то развернул много пулов.",
    runs: (count: string) => `Работает в ${count} из них`,
    poolsHeading: "Где он работает",
    moreNotShown: (count: string) => `и ещё ${count}`,
    none: "Ни один пул в самых оживлённых днях v4 этой недели не называет hook.",
    unavailable: "Пулы v4 за неделю не удалось прочитать, поэтому каталог показать нечем.",
    fromHome: "Посмотреть все hook’и →",
  },

  /*
   * The one panel here that describes somebody's own money.
   *
   * It says so, and it says what that does and does not mean: the same list is
   * public, anybody can read it for any address, and nothing about it is kept.
   */
  positions: {
    heading: "Позиции, которые этот адрес уже держит",
    intro:
      "Всё выше — то, что этот адрес мог бы сделать: какие пулы открывают его токены. А это — то, что он уже сделал. Позиция любого из протоколов — это токен, который держит один контракт, и оба контракта спрашивают, что представляет собой каждый токен. Контракт v3 умеет ещё и перечислить токены адреса; контракт v4 не умеет, поэтому тот список приходит от индексатора, и каждый id из него возвращают в сеть, у которой спрашивают, кому он принадлежит.",
    none: "Этот адрес не держит токенов позиций Uniswap ни одного из протоколов.",
    noneOpen:
      "Все токены позиций, которые держит этот адрес, закрыты. Закрытый — это квитанция о позиции, которая была, а не позиция.",
    counts: (held: string, open: string, closed: string) =>
      `Токенов позиций: ${held}; из них с оставшейся ликвидностью — ${open}, закрытых — ${closed}.`,
    inRange: "Сейчас зарабатывает",
    outOfRange: "Вне своего диапазона",
    rangeUnknown: "Здесь ещё никто не делал свопов",
    analyse: "Разобрать этот пул →",
    /*
     * Read from the pool's own fee accounting and differenced, not estimated.
     * Deliberately not a rate: it says what has accrued, not over how long or
     * at what pace, because neither follows from the figure.
     */
    feesEarned: (amount0: string, symbol0: string, amount1: string, symbol1: string) =>
      `Заработано и ещё не выведено: ${amount0} ${symbol0} и ${amount1} ${symbol1}.`,
    feesNone: "Пока нечего выводить.",
    feesUnread: "Сколько он заработал, прочитать не удалось.",
    everyPrice: "Все цены, которые этот пул может выразить",
    moreNotShown: (count: string) => `Ещё открыто и не перечислено здесь: ${count}.`,
    readCap: (read: string, held: string) =>
      `Прочитано ${read} из ${held}. Остальных на этой странице нет, и это ограничение страницы, а не адреса.`,
    /*
     * Two protocols mean two ways to fail. The counts beside this cover the
     * other protocol only, and saying so is the difference between a partial
     * answer and a wrong one.
     */
    unreadProtocol: (protocol: string) =>
      `Позиции Uniswap ${protocol} в этот раз прочитать не удалось, поэтому каждая цифра здесь — только о другом протоколе.`,
    unavailable: "Позиции этого адреса не удалось прочитать.",
    publicNote:
      "Владелец позиции записан в сети, поэтому этот список публичен: любой может прочитать такой же для того же адреса, и он не говорит ничего, чего этот адрес уже не опубликовал бы, держа эти токены. Здесь ничего не хранится, если вы не попросите уведомления в Telegram ниже, и ни одна цифра на этой странице не является оценкой стоимости: диапазон — это не то, сколько стоит позиция.",
  },

  wallet: {
    heading: "Подключить кошелёк",
    intro:
      "Подключите кошелёк, и эта страница увидит, какие токены держит адрес, и покажет пулы, в которые эти токены могут войти. Она читает адрес; больше от кошелька здесь ничего не просят.",
    connect: "Подключить кошелёк",
    connecting: "Ждём кошелёк…",
    connectedAs: "Подключён как",
    showHoldings: "Показать, что он держит",
    forget: "Забыть этот адрес",
    /*
     * The sentence that replaced "never connects a wallet". The half that is
     * still true is the half worth keeping, and it is the half that matters.
     */
    readOnly:
      "Только чтение. Это приложение просит у кошелька адрес и никогда — подпись: здесь нет кода, способного подписать сообщение или отправить транзакцию, и между визитами о кошельке ничего не сохраняется.",
    notices: {
      "wallet-not-found":
        "В этом браузере кошелёк не найден. Его ставит расширение-кошелёк; без него на этой странице ничего не изменится.",
      "wallet-request-declined":
        "Запрос отклонили в кошельке. Ничего не прочитано и ничего не отправлено.",
      "wallet-request-failed":
        "У кошелька не удалось спросить адрес. Ничего не прочитано и ничего не отправлено.",
      "wallet-no-account":
        "Кошелёк ответил без адреса, а это обычно значит, что он заблокирован или в нём не выбран счёт.",
    },
  },

  /*
   * The alerts: what the site says about them, and what the bot says. Kept
   * together because the bot's sentences are this interface's sentences,
   * delivered somewhere else, and they have to agree with the page a reader
   * links from.
   */
  telegram: {
    heading: "Уведомления в Telegram",
    intro:
      "Узнавать в Telegram, когда одна из позиций этого адреса приближается к краю своего диапазона, выходит за него или возвращается в него. Кнопка ведёт к боту этого сайта; нажатие «Старт» там привязывает тот чат к этому адресу. Хранятся адрес и числовой идентификатор чата — и больше ничего, — и оба удаляются с сервера, как только вы отправите боту /stop или забудете связь здесь, а из его зашифрованных резервных копий — в течение семи дней. Как часто идёт проверка, зависит от сервера, на котором всё это работает.",
    connect: "Подключить Telegram",
    connected: (address: string) => `Этот браузер связан: за ${address} следим.`,
    pending: "Связь ждёт: откройте чат бота в Telegram и нажмите «Старт».",
    forget: "Забыть связь",
    notConfigured: "На этом сервере уведомления в Telegram не настроены.",
    publicNote:
      "Чтобы следить за адресом, не нужно им владеть: позиции публичны, и уведомление не скажет ничего, чего не говорит этот список. Бот читает сеть и отправляет сообщение; подписать или отправить что-либо он не может.",
    linked: (address: string) =>
      `Связано. Здесь вы узнаете, когда позиция на ${address} приблизится к краю диапазона, выйдет за него или вернётся в него. Чтобы прекратить, отправьте /stop.`,
    unknownStart:
      "Эта ссылка неизвестна или истекла. Нажмите «Подключить Telegram» на сайте ещё раз.",
    alreadyClaimed:
      "Эту ссылку уже использовал другой чат. Нажмите «Подключить Telegram» на сайте ещё раз, чтобы получить новую.",
    stopped: "Остановлено. Этот чат больше ни за чем не следит. Запись удалена с сервера, а из зашифрованных резервных копий исчезнет в течение семи дней.",
    nothingToStop: "Этот чат ни за чем не следил.",
    help:
      "Этот бот следит только за адресом, который вы связали на сайте, и говорит только тогда, когда позиция приближается к краю своего диапазона, выходит за него или возвращается в него. Чтобы прекратить, отправьте /stop.",
    storeDown: "Связь сейчас не удалось проверить. Попробуйте через минуту.",
    left: (pair: string, protocol: string, range: string) =>
      `⚠️ ${pair} (${protocol}) вышла за свой диапазон: ${range}. Она держит один токен и ничего не зарабатывает, пока цена не вернётся.`,
    nearing: (pair: string, protocol: string, range: string, price: string, edge: string) =>
      `⏳ ${pair} (${protocol}) приближается к краю своего диапазона: ${range}. Цена сейчас ${price}; за пределами ${edge} она будет держать один токен и ничего не зарабатывать.`,
    entered: (pair: string, protocol: string, range: string) =>
      `✅ ${pair} (${protocol}) снова внутри своего диапазона: ${range}. Она опять зарабатывает.`,
    opened: (pair: string, protocol: string, range: string) => `Новая позиция: ${pair} (${protocol}), ${range}.`,
    closed: (protocol: string, tokenId: string) => `Закрыта: позиция ${protocol} № ${tokenId}.`,
    footer:
      "Только информация — не финансовый совет. Прочитано из публичных данных сети; ничто здесь не может действовать за вас.",
  },

  search: {
    label: "Пара, адрес пула v3 или id пула v4",
    placeholder: "WETH/USDC",
    help: "Введите пару вроде WETH/USDC, вставьте адрес контракта пула v3 или вставьте id пула v4 — 32-байтовый хеш, которым называется пул v4. Только чтение: это приложение ничего не подписывает и никогда не отправляет транзакций.",
    submit: "Найти пулы",

    heading: "Подходящие пулы Uniswap v3",
    resultsFor: (terms: string) => `Пулы, токены которых совпадают с ${terms}.`,
    empty: (terms: string) =>
      `Ни у одного пула Uniswap v3 в основной сети Ethereum нет токена, совпадающего с ${terms}.`,
    emptyHint: "Проверьте написание или вставьте адрес пула, если он у вас есть.",

    /*
     * The v4 list, beneath the v3 one. Two lists rather than one merged list,
     * because they are ordered by different numbers — what a pool holds, and
     * what its active liquidity is worth — and one order over both would be
     * comparing them.
     */
    v4Heading: "Подходящие пулы Uniswap v4",
    v4Empty: (terms: string) =>
      `Ни у одного пула Uniswap v4 в основной сети Ethereum нет валюты, совпадающей с ${terms}.`,
    v4Depth: "Глубина на текущей цене",
    v4DepthValue: (ether: string) => `≈ ${ether} ETH`,
    v4DepthNote:
      "Сколько прямо сейчас стоит активная ликвидность пула, прочитанная из собственного хранилища PoolManager, — а не то, что пул держит, чего ни один пул v4 сам о себе не сообщает.",
    v4StateUnread: "Ликвидность пула не удалось прочитать из сети.",
    v4Hook: "Hook",
    v4NoHook: "нет",
    v4HookAltersSwaps: "может изменить цену свопа",
    v4Ordering:
      "Сначала идут пулы, названные ровно тем, что вы искали. Дальше порядок следует за глубиной каждого пула на его текущей цене — активной ликвидностью и ценой, прочитанными из хранилища PoolManager и приведёнными к одной шкале по ценам, которые выводит источник данных. Это не то, что пул держит: токены всех пулов v4 лежат в одном PoolManager вместе, и ничто в сети не сообщает их по пулам. Собственную цифру ликвидности у индексатора сверили с сетью: на одном из самых оживлённых пулов она разошлась на пятнадцать процентов, поэтому её не используют.",

    /*
     * The ordering is the one claim a list makes, so it is stated rather than
     * left to be inferred from the order itself.
     */
    ordering:
      "Сначала идут пулы, названные ровно тем, что вы искали. Дальше порядок следует за тем, что каждый пул действительно держит, прочитанным у самих контрактов токенов и приведённым к одной шкале по ценам, которые выводит источник данных. Раньше он следовал за стоимостью, которую источник сообщает как заблокированную в каждом пуле, и эта цифра ошибалась достаточно, чтобы переставить этот список: один пул публиковался здесь с девятью миллионами долларов заявленной ликвидности, тогда как его контракты держали девять тысяч.",
    windowing:
      "Этот список берётся из пулов, которые источник данных называет самыми торгуемыми по вашему запросу, и пул, достаточно тихий, чтобы не попасть в этот набор, до упорядочивания выше вообще не доходит. Это честный предел ранжирования внутри того, что источник решил вернуть: пул, который держит очень много, но торгует редко, может на этой странице отсутствовать.",
    /*
     * The other thing the list leaves out, and why. Said beside the window
     * note because it is the same kind of fact: a pool can be missing from
     * this page for a reason that is not "it does not exist".
     */
    dormantNote:
      "Пул, в котором месяц ничего не происходило, в список не попадает. Диапазон строится по ценам последнего месяца, а пулу без такого месяца строить его не из чего — открыв его, вы услышали бы только это.",
    /*
     * The v4 window is not the terms. The source cannot answer a search over
     * every v4 pool before this page stops waiting — measured, not assumed —
     * so the search runs over the week's busiest pool-days, and a page that
     * did not say so would let a reader conclude a pool does not exist.
     */
    v4Windowing:
      "Этот список берётся из пулов v4, которые за последние семь дней торговали больше всего в основной сети Ethereum, — тысячи самых оживлённых «пул-дней», а это несколько сотен пулов; пул тише этого до этой страницы не доходит. Источник не успевает ответить на поиск по всем пулам v4 прежде, чем эта страница перестанет ждать, поэтому окно задано недавней активностью, а не вашим запросом: пул, который существует, но на этой неделе не торговал, сюда не попадёт.",
    /*
     * The sentence that does the real work on this page. Search is what lets
     * someone reach a pool they did not go looking for.
     */
    symbolWarning:
      "Символ приходит из контракта самого токена, а развернуть токен, называющий себя USDC, не стоит ничего. Отличают два токена друг от друга адреса контрактов под каждой парой.",

    feeTier: "Уровень комиссии",
    holds: "Держит",
    reservesUnread: "Что держит этот пул, не удалось прочитать из сети.",
    moreNotShown: (count: string) =>
      `Ещё не показано: ${count}. Выше — самые торгуемые из них, в том порядке, в каком их сообщает источник данных, а это утверждение о том, насколько пул оживлён, и ни о чём больше.`,
    analyse: "Разобрать этот пул",
    /** Under the v4 list: where each row's fee came from, and why the row can say it was not read. */
    v4FeeNote:
      "Комиссия каждого пула прочитана из ключа, с которым его создали, в сети, а не у источника данных: его цифру комиссии измерили и выяснили, что это полная сумма, уплаченная последним свопом, включая долю протокола, а не собственная комиссия пула. Строка, ключ которой прочитать не удалось, так и говорит.",

    unavailableHeading: "Поиск не удалось выполнить",
    rejected: {
      empty: "Введите пару вроде WETH/USDC или адрес пула.",
      length: (min: number, max: number) =>
        `Поисковый запрос — от ${min} до ${max} символов.`,
      unsupportedCharacters:
        "Поисковый запрос может состоять из букв, цифр и знаков, встречающихся внутри тикеров, — и ничего больше.",
    },
  },

  report: {
    steps: {
      pool: "чтения конфигурации пула",
      snapshot: "чтения текущего рыночного состояния пула",
      history: "чтения дневной истории цен пула",
      volatility: "измерения того, насколько двигалась цена",
      band: "построения ценовой полосы",
      range: "укладывания полосы на цены, которые этот пул может выразить",
      divergence: "сравнения этого диапазона с хранением двух токенов",
      activity: "чтения того, что пул делал за измеренное окно",
    },
    noRangeHeading: "Для этого пула диапазона нет",
    stoppedWhile: (step: string) => `Всё остановилось на этапе ${step}.`,
    poolSummary: (protocol: string, fee: string, chain: string) =>
      `Uniswap ${protocol} · ${chain} · ${fee}`,
    feePerSwap: (fee: string) => `комиссия ${fee} на каждом свопе`,
    /** A v4 pool whose protocol takes a cut on top of the pool's own fee. */
    feePlusProtocol: (fee: string, protocol: string) =>
      `комиссия ${fee} на каждом свопе плюс ${protocol} протоколу`,
    /** Stands where the fee would, for a v4 pool whose hook sets one per swap. */
    noDeclaredFee: "комиссию задаёт его hook на каждом свопе",
    caveatsHeading: (count: number) =>
      count === 1 ? "К этим цифрам относится одна оговорка." : `Оговорок, относящихся к этим цифрам: ${count}.`,
    caveatsAriaLabel: "Оговорки",

    /*
     * The range, as two prices. Every price on the page is written the way
     * round that makes it at least one — one unit of the dearer token, priced
     * in the cheaper — and the intro says which token that is, so the figures
     * under it can be read without a second thought. The ticks those prices
     * encode are in the technical details at the end, where a reader who
     * wants to check them can, and a reader who does not is never made to.
     */
    contentsHeading: "На этой странице",
    contentsLabel: "Разделы этого анализа",
    rangeHeading: "Предлагаемый ценовой диапазон",
    rangeIntro: (base: string, quote: string) =>
      `Где позиция в этом пуле была бы активна, в пересчёте на цену одного ${base} в ${quote}.`,
    rangeValue: (lower: string, upper: string, quote: string, base: string) =>
      `${lower} – ${upper} ${quote} за ${base}`,
    rangeDistances: (down: string, up: string) =>
      `На ${down} ниже и на ${up} выше текущей цены.`,
    rangeMeaning:
      "Между этими двумя ценами позиция зарабатывает свою долю комиссий пула со свопов. За их пределами она держит один токен и не зарабатывает ничего, пока цена не вернётся.",
    priceSentence: (base: string, price: string, quote: string) => `1 ${base} = ${price} ${quote}`,
    currentPrice: "Текущая цена",
    inRangeYes: "Текущая цена внутри этого диапазона.",
    inRangeNo: "Текущая цена вне этого диапазона.",
    inRangeYesNote: "Позиция, открытая здесь, была бы активна сразу.",
    inRangeNoNote:
      "Позиция, открытая здесь, держала бы один токен и не зарабатывала бы ничего, пока цена не вернётся внутрь.",
    beyondEdges: (below: string, above: string) =>
      `Если цена упадёт ниже диапазона, позиция останется только с ${below}; если поднимется выше — только с ${above}.`,
    lowerTruncatedNote:
      "Нижняя граница упирается в самую низкую цену, которую этот пул может выразить, не дойдя туда, куда её поставила бы полоса.",
    upperTruncatedNote:
      "Верхняя граница упирается в самую высокую цену, которую этот пул может выразить, не дойдя туда, куда её поставила бы полоса.",
    /*
     * The month drawn through the range. The caption says what each mark is,
     * once, in the words the page uses for the same things; the day counts a
     * few panels down are the same days, counted.
     */
    chartLabel: "Цены последнего месяца на фоне предлагаемого диапазона",
    chartCaption: (days: string) =>
      `Каждый из последних ${days} дн.: его закрытие и размах от минимума до максимума. Затенённая полоса — предлагаемый диапазон; сплошная линия — сегодняшняя цена.`,
    chartLegend:
      "Закрашенная точка — день, целиком прошедший внутри диапазона; полая — день, который его покинул или пересёк границу.",

    /*
     * Where the range came from, in the words a reader has: how much the price
     * moves on a typical day, and what that comes to over the horizon. The
     * standard deviation is named in the notes, not in the labels.
     */
    basisHeading: "Как построен этот диапазон",
    basisIntro: (base: string, days: string) =>
      `Из того, насколько цена ${base} действительно двигалась за последние ${days} завершённых дн., — а не из прогноза о том, куда она пойдёт дальше.`,
    dailyMove: "Обычное дневное движение",
    dailyMoveNote: "Стандартное отклонение изменения цены за сутки, по всему окну.",
    horizonMove: (days: string) => `За ${days} дн.`,
    horizonMoveNote:
      "То же движение, растянутое на горизонт, выбранный ниже: одно стандартное отклонение в каждую сторону.",
    widthValue: (multiplier: string) => `${multiplier}× от этого, в каждую сторону`,
    widthNote:
      "Выбирается ниже. Более широкий диапазон покидают реже, а тот же вклад, растянутый по нему, тоньше на любой отдельной цене.",
    measuredOver: "Измерено по",
    measuredOverNote: (returns: string) => `В расчёт вошло суточных изменений: ${returns}.`,
    epilogue:
      "Диапазон центрирован на сегодняшней цене и отложен на одинаковое расстояние вверх и вниз в отношениях — вдвое меньше и вдвое больше это одно и то же движение, — поэтому два процента и различаются. Он описывает, насколько цена двигалась, а не куда она пойдёт: это не прогноз, и ширина — не доверительный уровень. Ничто здесь не определяет размер позиции и не говорит, сколько какого токена вносить.",
  },

  /*
   * Everything a reader checking the page against the chain would want, and
   * nothing a reader opening a position needs: the ticks the prices encode,
   * the blocks the figures were read at, the figures in the pool's own
   * direction. Folded away at the end of the report.
   */
  technical: {
    heading: "Технические подробности",
    summary: "Тики, блоки и цифры, по которым сверена страница выше.",
    lowerTick: "Нижний тик",
    upperTick: "Верхний тик",
    currentTick: "Текущий тик",
    sourceReportedTick: (tick: string) => `Источник сообщил ${tick}.`,
    noSourceTick:
      "Источник не сообщил собственного тика, поэтому этот пересчёт не проверен.",
    tickSpacing: "Шаг тиков",
    tickSpacingNote: (step: string) => `Ценовой шаг ${step} между допустимыми границами.`,
    width: "Ширина",
    widthValue: (ticks: string, spacings: string) => `${ticks} тиков · ${spacings} шагов`,
    poolPrice: "Цена так, как её даёт пул",
    quotePerBase: (quote: string, base: string) => `${quote} за ${base}`,
    bandLower: "Нижняя граница полосы",
    bandUpper: "Верхняя граница полосы",
    bandNote: "До укладывания на сетку тиков, в собственном направлении пула.",
    annualised: "Годовая волатильность",
    annualisedNote:
      "Выборочное стандартное отклонение дневных логарифмических доходностей, умноженное на sqrt(365).",
    coverage: "Покрытие",
    coverageNote: "Какая часть окна была обеспечена подряд идущими дневными ценами.",
    sourceBlock: "Блок источника",
    noBlockTime: "Время блока не сообщено.",
    fetchedAt: "Получено в",
    fetchedAtNote: "Когда пришёл ответ, а не то, что он описывает.",
    lowerEdge: "Нижняя граница",
    upperEdge: "Верхняя граница",
    truncated: "Обрезано",
    asAsked: "Как запрошено",
  },

  explanation: {
    heading: "Объяснение",
    pending: "Пишем объяснение…",
    unavailable: "Для этого анализа объяснения нет.",
    /*
     * The two states a single paragraph can be in while the rest of the answer
     * is still arriving. Both keep the heading, so the reading order stays put
     * rather than the sections below jumping as each one lands.
     */
    sectionWriting: "Ещё пишется…",
    sectionMissing: "Эту часть написать не удалось.",
    /*
     * Names the author, and draws the line. Prose written by a model sitting
     * under figures that were computed and cross-checked should say which is
     * which, or a reader is entitled to assume the same hand produced both.
     */
    writtenBy: (model: string) => `Написано моделью ${model}. Цифры выше — нет.`,
    sections: {
      whatThisRangeMeans: "Что означает этот диапазон",
      ifPriceLeavesTheRange: "Если цена выйдет за диапазон",
      whatTheVolatilitySays: "О чём говорит волатильность",
      whatThisDoesNotCover: "Чего это объяснение не охватывает",
    },
  },

  /*
   * Every sentence this application says about a read that did not go well.
   *
   * They lived in the data layer until search made a second language matter:
   * an adapter raised an English sentence and it travelled, unchanged, to a page
   * being read in Turkish. Now the adapter raises a code and the wording is
   * here, where all the other wording is.
   *
   * `satisfies` is what keeps this honest. Add a code to `notices.ts` and this
   * object stops compiling until it says something about it, in both languages.
   */
  notices: {
    failure: {
      "invalid-pool-address":
        "Адрес пула должен быть 0x и 40 шестнадцатеричных символов после него, и он не может быть нулевым адресом.",
      "invalid-search-terms":
        "Поиск пула принимает одно или два коротких слова из букв, цифр и знаков, встречающихся внутри тикеров.",
      "market-data-not-configured":
        "Рыночные данные Uniswap v3 на этом сервере не настроены.",
      "chain-data-not-configured":
        "Чтение из сети на этом сервере не настроено.",
      "explanation-not-configured":
        "Это приложение не настроено писать объяснения, поэтому объяснения нет.",
      "market-data-timed-out":
        "Запрос рыночных данных не уложился во время.",
      "market-data-unreachable":
        "До источника рыночных данных не удалось достучаться.",
      "market-data-credentials-rejected":
        "Источник рыночных данных отверг настроенные учётные данные.",
      "market-data-rate-limited":
        "Превышен предел запросов к источнику рыночных данных.",
      "market-data-unreadable":
        "Источник рыночных данных вернул ответ, который не удалось прочитать.",
      "market-data-malformed":
        "Источник рыночных данных вернул ответ, который это приложение не может проверить.",
      "market-data-indexing-errors":
        "Источник рыночных данных сообщил об ошибках индексации, поэтому его цифры нельзя считать проверенными.",
      "market-data-stale":
        "Источник рыночных данных отстаёт от сети слишком сильно, чтобы считать эти цифры сегодняшними.",
      "market-data-future-block-time":
        "Источник рыночных данных сообщил время блока, опережающее часы этого сервера, поэтому его цифры нельзя проверить.",
      "chain-data-timed-out":
        "Запрос данных из сети не уложился во время.",
      "chain-data-unreachable":
        "До источника данных из сети не удалось достучаться.",
      "chain-data-credentials-rejected":
        "Источник данных из сети отверг настроенные учётные данные.",
      "chain-data-rate-limited":
        "Превышен предел запросов к источнику данных из сети.",
      "chain-data-unreadable":
        "Источник данных из сети вернул ответ, который не удалось прочитать.",
      "chain-data-malformed":
        "Источник данных из сети вернул ответ, который это приложение не может проверить.",
      "chain-aggregator-unverified":
        "Остатки читаются через вспомогательный контракт в сети, а код по его адресу — не тот код, которому это приложение было научено доверять, поэтому через него ничего не читали.",
      "pool-not-found":
        "Для этого адреса в основной сети Ethereum не найдено ни одного пула Uniswap v3.",
      "pool-contract-not-found":
        "По этому адресу в основной сети Ethereum не ответил ни один контракт пула Uniswap v3.",
      "pool-configuration-inconsistent":
        "Конфигурацию пула, собранную из двух его источников, не удалось проверить.",
      "pool-history-insufficient":
        "У этого пула пока недостаточно завершённой дневной истории цен, чтобы его анализировать.",
      "pool-history-never-traded":
        "Этот пул существует, но в нём никогда не было ни одного обмена, поэтому нет дневных цен, по которым можно измерить диапазон.",
      "pool-history-dormant":
        "Этот пул перестал торговаться до начала периода, из которого читаются эти дневные цены, поэтому недавней истории для измерения диапазона нет. Ожидание этого не изменит — изменит только то, что пулом снова начнут пользоваться.",
      "volatility-invalid-input":
        "История цен, поданная для этого расчёта, не является корректной нормализованной историей.",
      "volatility-insufficient-history":
        "У этого пула недостаточно подряд идущих дневных цен, чтобы измерить волатильность.",
      "volatility-unverifiable":
        "Расчёт волатильности дал результат, который это приложение не может проверить.",
      "band-invalid-input":
        "Рыночные данные, поданные для этой ценовой полосы, некорректны, либо снимок и волатильность описывают разные пулы.",
      "band-no-current-price":
        "Текущая цена этого пула недоступна, поэтому ценовую полосу не на чем центрировать.",
      "band-unverifiable":
        "Расчёт ценовой полосы дал результат, который это приложение не может проверить.",
      "range-invalid-input":
        "Пул, ценовая полоса и снимок, поданные для этого диапазона, некорректны, либо они описывают не один и тот же пул и не одно и то же наблюдение.",
      "range-price-unrepresentable":
        "Текущая цена этого пула лежит вне диапазона, который Uniswap может выразить, поэтому построить из неё диапазон позиции нельзя.",
      "range-tick-disagreement":
        "Цена, которую источник сообщает по этому пулу, и состояние, которое он сообщает, описывают разные моменты, поэтому диапазон не публикуется.",
      "range-too-narrow":
        "Ценовая полоса уже наименьшего шага, который этот пул допускает между двумя границами, поэтому она не описывает двух различных границ позиции.",
      "range-unverifiable":
        "Расчёт диапазона дал результат, который это приложение не может проверить.",
      "divergence-unverifiable":
        "Сравнение с хранением дало результат, который это приложение не может проверить.",
      "activity-unverifiable":
        "Недавняя активность пула дала результат, который это приложение не может проверить.",
      "fee-rate-unmeasurable":
        "Этот пул не торговал ни в один проиндексированный день окна, поэтому ставку, которую он берёт, нельзя вывести из того, что он собрал.",
      "deposit-share-unpriceable":
        "Источник не оценивает то, что держит этот пул, поэтому вклад в долларах нельзя превратить в позицию в нём.",
      "deposit-share-no-days":
        "Цена выходила за этот диапазон в каждый день, по которому источник мог ответить, поэтому нет дня, в который вклад в него что-нибудь собрал бы.",
      "deposit-share-unverifiable":
        "Сколько забрал бы вклад — не прошло собственную проверку, поэтому не показано.",
      "range-order-no-room":
        "Этот диапазон слишком узок, чтобы вместить одностороннюю позицию хоть с какой-то стороны от текущей цены.",
      "range-order-unverifiable":
        "Односторонние половины этого диапазона не прошли собственную проверку, поэтому не показаны.",
      "swap-depth-no-liquidity":
        "Этот пул сообщает об отсутствии ликвидности на своей текущей цене, поэтому здесь нет свопа, который можно оценить.",
      "swap-depth-tick-disagreement":
        "Собственный тик источника помещает этот пул в другой ценовой шаг, чем показанная цена, поэтому сообщённую им ликвидность нельзя отнести к этому шагу.",
      "swap-depth-unverifiable":
        "Сколько стоил бы своп — не прошло собственную проверку, поэтому не показано.",
      "out-of-sample-insufficient-history":
        "У этого пула недостаточно проиндексированной истории, чтобы подогнать полосу в прошлом и при этом оставить целый горизонт дней для её проверки.",
      "out-of-sample-unverifiable":
        "Проверка вне выборки дала результат, который это приложение не может проверить.",
      "hook-directory-unverifiable":
        "Hook’и пулов v4 этой недели не прошли собственную проверку, поэтому каталог не показан.",
      "positions-manager-unverified":
        "Контракт, который держит позиции Uniswap v3, ответил не тем кодом, под который это приложение было написано, поэтому ничего из сказанного им не показано.",
      "positions-unreadable":
        "Сеть не ответила о позициях этого адреса, поэтому не показана ни одна, — а это не то же самое, что не держать ни одной.",
      "positions-unverifiable":
        "Позиции этого адреса не прошли собственную проверку, поэтому не показаны.",
      "holdings-unverifiable":
        "То, что держит этот адрес, дало результат, который это приложение не может проверить.",
      "explanation-key-rejected":
        "Служба объяснений не приняла настроенный ключ, поэтому объяснение не показано.",
      "explanation-model-not-permitted":
        "Настроенному ключу не разрешено пользоваться выбранной моделью, поэтому объяснение не показано.",
      "explanation-model-unknown":
        "Выбранная модель недоступна настроенному ключу, поэтому объяснение не показано.",
      "explanation-rate-limited":
        "Служба объяснений сейчас ограничивает частоту запросов, поэтому объяснение не показано.",
      "explanation-hourly-cap":
        "Этот сайт пишет ограниченное число объяснений в час, и столько уже написано. Цифры выше полные; в течение часа объяснение снова можно будет написать.",
      "explanation-unreachable":
        "До службы объяснений не удалось достучаться, поэтому объяснение не показано.",
      "explanation-request-refused":
        "Служба объяснений отклонила этот запрос, поэтому объяснение не показано.",
      "explanation-declined":
        "Модель отказалась объяснять цифры этого пула, поэтому объяснение не показано.",
      "explanation-truncated":
        "Объяснение оборвалось, не дойдя до конца, поэтому оно не показано.",
      "explanation-malformed":
        "Объяснение вернулось в виде, который это приложение не может проверить, поэтому оно не показано.",
    } satisfies Record<DataFailureNotice, string>,

    warning: {
      "block-time-unreported":
        "Источник данных не сообщил времени блока, поэтому насколько свежи эти цифры, проверить не удалось.",
      "history-window-incomplete":
        "Источник данных сообщил цену не за каждый день этого окна; недостающие дни именно отсутствуют, а не оценены.",
      "volatility-window-incomplete":
        "У части дней этого окна цены не было, поэтому волатильность измерена по меньшему числу суточных доходностей, чем охватывает окно; недостающие дни пропущены, а не оценены.",
      "band-window-incomplete":
        "У части дней в окне волатильности цены не было, поэтому эта полоса опирается на меньшее число суточных доходностей, чем охватывает окно.",
      "band-price-block-time-unreported":
        "Источник текущей цены не сообщил времени блока, поэтому её свежесть нельзя проверить независимо.",
      "band-volatility-block-time-unreported":
        "Источник волатильности не сообщил времени блока, поэтому её свежесть нельзя проверить независимо.",
      /*
       * Neither names an edge. The codes name the pool's edges, and the page
       * writes its prices the reader's way round, which can be the other way —
       * so the sentence points at the range panel, which says which edge in
       * the direction shown.
       */
      "range-lower-edge-truncated":
        "Одна граница диапазона упирается туда, где кончаются цены, которые этот пул может выразить, — в ту сторону, где первый токен пула дешевле всего, — поэтому диапазон не дотягивается туда, куда дотянулась бы полоса. Какая это граница в показанном направлении, сказано в блоке диапазона.",
      "range-upper-edge-truncated":
        "Одна граница диапазона упирается туда, где кончаются цены, которые этот пул может выразить, — в ту сторону, где первый токен пула дороже всего, — поэтому диапазон не дотягивается туда, куда дотянулась бы полоса. Какая это граница в показанном направлении, сказано в блоке диапазона.",
      "range-tick-unverified":
        "Источник цены не сообщил собственного состояния пула, поэтому выводимую из него цену не с чем было сверить.",
      "range-excludes-current-price":
        "Текущая цена пула лежит вне этого диапазона, поэтому построенная из него позиция держала бы один токен и не зарабатывала бы ничего, пока цена не вернётся.",
    } satisfies Record<DataWarningNotice, string>,
  },

  rateLimited: {
    title: "Слишком много запросов",
    body: (limit: number) =>
      `Эта страница читает свежие данные Uniswap при каждом посещении, поэтому она ограничена: анализов в минуту — не больше ${limit}.`,
    retry: (seconds: number) => `Попробуйте снова через ${seconds} с.`,
    back: "Вернуться к советнику",
  },

  error: ERROR_COPY.ru,
};

const pt: Dictionary = {
  metadata: {
    title: "LiquidityWise",
    description:
      "Um orientador educativo, assistido por IA, para estratégias de liquidez no Uniswap v3 e v4. Apenas orientação — não é recomendação financeira.",
    v4Title: "Um pool do Uniswap v4 · LiquidityWise",
    v4Description:
      "O que é um pool do Uniswap v4 e o que o hook dele tem permissão para fazer.",
    holdingsTitle: "O que um endereço tem · LiquidityWise",
    holdingsDescription:
      "Os tokens encontrados em um endereço Ethereum e os pools do Uniswap v3 em que eles podem entrar.",
    compareTitle: "Níveis de taxa lado a lado · LiquidityWise",
    compareDescription: "Todos os níveis de taxa do Uniswap v3 de um par, lidos com o mesmo horizonte, largura e depósito.",
    poolTitle: "Análise da faixa de um pool · LiquidityWise",
    poolDescription:
      "Uma faixa de preço para um pool do Uniswap v3 na rede principal do Ethereum, tirada de quanto o preço dele realmente andou.",
    hooksTitle: "Os hooks do Uniswap v4 · LiquidityWise",
    hooksDescription:
      "Cada hook citado pelos pools do Uniswap v4 mais movimentados da semana, e o que cada um tem permissão para fazer — lido do próprio endereço dele."
  },

  preferences: {
    languageLabel: "Idioma",
    selectLanguage: "Escolher idioma",
    closeLanguages: "Fechar",
    /*
     * Said in the reader's own language, at the moment they choose it, rather
     * than left to be discovered paragraph by paragraph. A reader who is told
     * can decide; one who meets it halfway down a page cannot.
     */
    partlyTranslated:
      "Este idioma ainda está sendo traduzido. Os menus, rótulos e títulos já estão nele; as explicações mais longas continuam em inglês.",
    themeLabel: "Tema",
    themeSystem: "Do sistema",
    themeLight: "Claro",
    themeDark: "Escuro",
    /*
     * The band every pool opens at, set once in the header rather than on
     * every pool. A link naming its own band still wins over it.
     */
    rangeLabel: "Preferências de faixa",
    rangeIntro:
      "O horizonte, a largura e o valor com que cada pool abre. Um link que traz os seus próprios continua tendo precedência, e o formulário abaixo de cada análise muda só aquela página.",
    rangeSave: "Salvar",
    rangeReset: "Esquecer",
  },

  disclaimer: {
    ariaLabel: "Aviso importante",
    title: "Ferramenta educativa — não é recomendação financeira.",
    body: "Este aplicativo explica como o Uniswap funciona e ajuda a pensar na escolha dos parâmetros. Ele não prevê preços, não garante retorno e não consegue verificar se um contrato inteligente é seguro. Fornecer liquidez tem riscos reais, inclusive perda impermanente e perda total do dinheiro. Confira você mesmo os endereços dos contratos e faça sua própria pesquisa.",
  },

  home: {
    badge: "Base inicial",
    title: "LiquidityWise",
    introBeforeV3: "Um orientador educativo para o Uniswap ",
    introBetween: ", crescendo em direção ao ",
    introAfterV4:
      ". Encontre um pool pelo par, veja uma faixa de preço calculada a partir de quanto esse par realmente andou e leia a explicação em linguagem simples. Todo número é calculado e conferido antes de um modelo ter permissão para descrevê-lo — e o modelo nunca tem permissão para dizer um número.",
    workingTodayHeading: "O que já funciona",
    workingTodayBody:
      "Busque um pool pelo par, ou cole o endereço de um pool v3 ou o id de um pool v4. Você recebe a configuração verificada do pool e o estado atual dele, o último mês de preços diários desenhado sobre uma faixa sugerida, quanto o par realmente andou e a faixa que sai disso — com o horizonte e a largura nas suas mãos. Ao lado: quanto o pool cobrou e quanto de fato recolheu, como os dias recentes dele ficaram em relação à faixa, o que o mesmo método fez em dias que ele nunca viu, o que uma posição abre mão em comparação com simplesmente segurar, o que cada uma das outras larguras teria feito e — para um valor de depósito que você define — quanto ele teria ficado das taxas cobradas nos dias em que o preço não saiu da faixa. E a mesma faixa lida ao contrário: cada metade dela é uma posição de um lado só, e a página diz a que preço cada uma converteria se o preço a atravessasse. Quanto custa um swap pelo pool, para o maior que dá para precificar sem supor nada. E um diretório de cada hook citado pelos pools v4 mais movimentados da semana, com o que cada um tem permissão para fazer, lido do próprio endereço dele. Uma página de pool v4 também diz, em palavras simples, o que o hook dele pode fazer, lendo isso do endereço do próprio hook. Dá para consultar um endereço para ver os pools em que os tokens dele podem entrar e as posições Uniswap v3 que ele já tem — cada uma com os preços que cobre e se o pool está dentro deles agora. E então uma explicação de tudo isso em linguagem simples. Nenhum modelo encosta em nenhum desses números, nenhum deles é estimado para tapar buraco, e o texto não tem onde colocar um número próprio.",
    analysePool: "Encontrar um pool →",
    methodHeading: "Como funciona",
    methodSteps: [
      {
        step: "Dados verificados",
        detail:
          "Os fatos do pool vêm dos subgraphs do Uniswap e são lidos na rede, nunca supostos. O preço é conferido contra o estado que o próprio pool informa sobre si.",
      },
      {
        step: "Contas determinísticas",
        detail:
          "A volatilidade, a banda de preço e a faixa da posição são calculadas em TypeScript puro, então o mesmo pool sempre dá os mesmos números.",
      },
      {
        step: "Interpretação por IA",
        detail:
          "Um modelo explica o que esses números querem dizer. Ele os recebe já conferidos, e o contrato sob o qual responde não tem onde colocar um número.",
      },
    ],
    coverageHeading: "Ainda não feito",
    coverage: [
      {
        version: "Uniswap v3",
        features: [
          {
            name: "Gas e o custo de correr atrás do preço",
            summary:
              "Uma faixa que o preço deixou precisa ser fechada e reaberta para acompanhá-lo, o que custa gas e transforma uma divergência no papel em uma já realizada. Nada disso é contado em lugar nenhum aqui.",
          },
        ],
      },
      {
        version: "Uniswap v4",
        features: [
          {
            name: "O que um hook realmente faz",
            summary:
              "Uma página v4 diz o que um hook tem permissão para fazer, porque é isso que o protocolo impõe e é isso que se lê do endereço do próprio hook. Ler o contrato para dizer o que ele faz com essas permissões é outro problema, e este aplicativo não tenta resolvê-lo.",
          },
          {
            name: "Estratégias no estilo TWAMM",
            summary:
              "Espalhar uma ordem grande ao longo do tempo em vez de executá-la contra um único ponto de liquidez. A metade disso que uma página de análise já responde está aqui: quanto custa um swap contra a liquidez no preço atual e de que tamanho é o maior swap que dá para precificar. Agendar uma ordem ao longo do tempo é trabalho de um hook, e este aplicativo não modela o comportamento de hooks.",
          },
        ],
      },
    ],
    footer:
      "Nada do que está acima existe ainda. O que existe é tudo o que está mais acima nesta página: um pool encontrado pelo nome, números calculados e conferidos e um texto verificado antes de ser mostrado. Dá para conectar uma carteira, e tudo o que se pede a ela é o endereço. A única coisa que este aplicativo guarda é um vínculo com o Telegram que o próprio leitor cria — um endereço ao lado de um id de conversa, que é apagado no instante em que ele manda /stop ao bot e sai dos backups criptografados em até sete dias — e nada aqui consegue assinar nem enviar uma transação em seu nome.",
  },

  pool: {
    back: "← LiquidityWise",
    invalidAddress:
      "Isso não é um endereço Ethereum. Um endereço é 0x seguido de exatamente 40 caracteres hexadecimais.",
    loading: "Lendo os dados ao vivo do Uniswap…",
  },

  /*
   * Facts about the pool, and the sentence that keeps them from being read as
   * something else. The gap between "the pool collected this" and "you would
   * have earned this" is where a reader is likeliest to fill in a number nobody
   * gave them.
   */
  activity: {
    heading: "O que o pool realmente fez",
    volume24h: "Volume, 24 h",
    volume7d: "Volume, 7 dias",
    volume30d: "Volume, 30 dias",
    fees30d: "Taxas cobradas, 30 dias",
    feesNote: "Do pool inteiro, divididas entre todos cuja liquidez estava ativa.",
    tvl: "Valor total bloqueado",
    occupancySentence: (days: string, inside: string, outside: string, crossed: string) =>
      `Dos últimos ${days} dias, ${inside} ficaram inteiramente dentro desta faixa, ${outside} ficaram inteiramente fora dela e ${crossed} cruzaram uma borda.`,
    undeterminedNote:
      "Um dia que cruzou uma borda passou parte dele dentro e parte fora, e a máxima e a mínima diárias da fonte não dizem quanto foi de cada.",
    feesWhileInside: "Taxas cobradas nos dias inteiramente dentro",
    /*
     * Shown instead of that figure when the pool's hook may take a share of a
     * swap. The fees are still real; what cannot be stated is their relationship
     * to a position, which is the only reason anyone reads the figure.
     */
    feesWithheld: "Não mostrado para este pool",
    feesWithheldNote:
      "O hook deste pool tem permissão para ficar com uma parte do swap, e nada na fonte separa a parte do hook da parte de quem fornece liquidez. As taxas acima são o que o pool cobrou, e isso é um fato; amarrar uma fração delas a esta faixa seria afirmar algo sobre uma posição que ninguém consegue conferir.",
    inSample:
      "Estes são os mesmos dias de que a faixa foi tirada, então eles mostram como ela foi ajustada e não testam se ela se sustenta — e a faixa está centrada no preço de hoje, que ninguém teria como ter aberto um mês atrás. Leia isso como a posição do movimento recente do pool em relação à faixa, não como um backtest.",
    notYourEarnings:
      "Nada disso é o que uma posição ganharia: é o que o pool inteiro cobrou. Quanto um depósito teria ficado disso — a parte dele na liquidez ativa enquanto os swaps aconteciam — está no bloco logo abaixo, e mesmo ali são taxas e nada mais.",
  },

  /*
   * The half of the fee question this application used to refuse.
   *
   * The refusal was honest while it lasted: the figures above are the pool's,
   * and turning them into a position's needs a size and a share of the active
   * liquidity. Both are read now, so the page answers instead of declining —
   * and every sentence here exists to stop the answer being read as a yield.
   */
  deposit: {
    heading: "Quanto um depósito teria recolhido",
    unavailable: "Para este pool não dá para calcular quanto um depósito teria ficado dessas taxas.",
    withheldNote:
      "Pelo mesmo motivo do número acima: um hook aqui pode ficar com uma parte do swap, e nada na fonte separa a parte dele da de quem fornece. Uma fração de um total que não pode ser atribuído a esta faixa também não pode ser atribuída a um depósito nela.",
    deposited: "Depósito",
    depositedNote: "O tamanho para o qual isso foi calculado. Mude no formulário acima.",
    collected: "Taxas que ele teria ficado",
    collectedNote: (days: string) =>
      `Ao longo dos ${days} ${days === "1" ? "dia" : "dias"} em que o preço nunca saiu da faixa.`,
    ofDeposit: "Sobre o depósito",
    ofDepositNote:
      "Essas taxas em relação ao dinheiro aplicado, naqueles dias e em nenhum outro. Não é uma taxa anual, e nada aqui a transforma em uma.",
    sentence: (deposit: string, days: string, poolFees: string, yourFees: string) =>
      `Nos ${days} ${days === "1" ? "dia" : "dias"} em que o preço nunca saiu desta faixa, o pool cobrou ${poolFees} em taxas. Um depósito de ${deposit} colocado na faixa teria ficado com cerca de ${yourFees} disso — pela própria liquidez dele como parte da liquidez que esteve de fato ativa em cada um desses dias.`,
    unmeasurableNote: (days: string) =>
      `Outros ${days} ${days === "1" ? "dia ficou" : "dias ficaram"} dentro da faixa, mas a fonte não publicou taxas nem liquidez ativa para eles, então não entram no total.`,
    dilution:
      "Um depósito maior não recolhe proporcionalmente mais. A parte é a sua liquidez sobre a de todo mundo, incluindo a sua, então a partir de certo tamanho a maior parte do que você acrescenta dilui o que você já tem — e é por isso que os valores oferecidos estão a um fator de mil um do outro.",
    caveat:
      "Só taxas, e só dias que já aconteceram. Supõe que a posição esteve aberta em cada um deles e que nada se mexeu em reação a ela, e não diz nada sobre quanto os próximos trinta dias vão pagar. O que uma posição abre mão em comparação com simplesmente segurar os dois tokens é a comparação mais abaixo nesta página, e as duas precisam ser lidas juntas.",
  },

  realizedFee: {
    heading: "Quanto ele cobrou de verdade",
    intro:
      "A taxa que o pool declara é um número só. Isto aqui é o que quem fez swap pagou de fato, dividido de volta a partir dos mesmos dias dos números acima: as taxas de um dia sobre o volume daquele dia. Não precisa de requisição extra nem de nada vindo do hook.",
    declared: "Taxa declarada",
    /** How a stated fee was arrived at, where the protocol takes a cut on top. */
    statedNote: (lp: string, protocol: string) =>
      `${lp} para quem fornece liquidez e ${protocol} para o protocolo, somados do jeito que o PoolManager os cobra — que é o que quem faz swap paga, e é disso que as taxas acima são feitas.`,
    noDeclared: "Nenhuma",
    noDeclaredNote: "A chave deste pool não traz taxa. O hook dele define uma a cada swap.",
    median: "Dia típico",
    spread: "Do dia mais baixo ao mais alto",
    spreadValue: (lowest: string, highest: string) => `${lowest} – ${highest}`,
    aggregate: "Janela inteira",
    aggregateNote:
      "As taxas da janela sobre o volume da janela, então um dia movimentado pesa mais que um dia parado.",
    daysMeasured: "Dias medidos",
    daysMeasuredNote: (skipped: string) =>
      `Mais ${skipped} ${skipped === "1" ? "dia na janela não negociou" : "dias na janela não negociaram"} nada, ou estavam sem algum número, então não dava para tirar uma taxa deles.`,
    /*
     * The three verdicts. They exist as separate sentences rather than one with
     * a number in it because they are three different things to know, and the
     * one that matters most is the one a single wording would blur.
     */
    verdictMatches:
      "Elas batem em todos os dias medidos. A taxa declarada é a taxa que foi cobrada.",
    verdictDiffers: (differing: string, measured: string) =>
      `Elas não batem. Em ${differing} de ${measured} dias medidos o pool cobrou algo diferente da taxa que declara, então o nível acima descreve com o que o pool foi criado e não quanto custa um swap.`,
    verdictNoneDeclared:
      "Não há com o que comparar: este pool não declara taxa nenhuma. Os números aqui são o que o hook dele de fato definiu.",
    notLpShare:
      "Nada disso é o que chega a quem fornece liquidez. O hook deste pool tem permissão para ficar com uma parte do swap, e a fonte não separa a parte do hook da de quem fornece. O que esses números dizem é quanto um swap custou, não quem recebeu.",
    unavailableHeading: "Não foi possível medir quanto este pool cobra",
  },

  outOfSample: {
    heading: "Testado em dias que ele nunca viu",
    showFolds: "Mostrar cada trecho",
    intro: (horizon: string) =>
      `Todo número acima está ajustado aos dias que descreve. Estes não estão. O método foi recuado em ${horizon}, rodado de novo só sobre os preços anteriores àquele ponto e centrado no preço daquele ponto — um que alguém parado ali teria mesmo visto. Depois foi sobreposto aos dias que vieram a seguir, e tudo isso foi repetido para trás na história tantas vezes quantas couberam.`,
    folds: "Rodadas",
    foldsNote: "Quantas vezes a história teve espaço para ajustar uma banda e depois testá-la.",
    fullyInside: "Dias inteiramente dentro",
    fullyOutside: "Dias inteiramente fora",
    undetermined: "Dias que cruzaram uma borda",
    verdict: (inside: string, measured: string, folds: string) =>
      `Ao longo de ${folds} rodadas, ${inside} de ${measured} dias ficaram inteiramente dentro da banda que este método teria desenhado.`,
    foldPeriod: "Dias conferidos",
    foldVolatility: "Volatilidade ajustada",
    foldVerdict: "Dentro / fora / cruzaram",
    foldsCaption: "Cada trecho em que o método foi testado, do mais antigo para o mais recente",
    foldColumns:
      "Cada linha é uma rodada: os dias em que foi conferida, a volatilidade que o próprio ajuste dela mediu — não o número acima — e como esses dias ficaram em relação à banda que aquele ajuste produziu.",
    /*
     * The two sentences that stop a total becoming a claim about the method.
     * Nobody held these bands, and the folds are not independent of each other.
     */
    notIndependent:
      "Algumas rodadas em um pool não medem com que frequência o método se sustenta, e não dizem nada sobre o que vem depois. Ajustes consecutivos também se sobrepõem — um ajuste de 31 fechamentos é mais longo que um passo de um horizonte — então as rodadas não são independentes entre si.",
    notHeld:
      "Ninguém segurou essas bandas. Cada uma é o que o método teria sugerido naquele momento, sobreposta a preços que então aconteceram — e os dias acima, de que a faixa sugerida foi tirada, não são estes dias.",
    unavailableHeading: "Não foi possível conferir este pool fora da amostra",
  },

  divergence: {
    heading: "Comparado com simplesmente segurar",
    intro:
      "Quanto uma posição nesta faixa valeria em comparação com simplesmente segurar os dois tokens, a cada preço. Aritmética exata e não uma estimativa — mas ela conta o movimento do preço e nada mais. Não diz nada sobre as taxas que uma posição ganharia, e taxas são exatamente o que se paga a quem fornece liquidez por essa diferença.",
    price: (base: string) => `Preço de ${base}`,
    loss: "Posição contra segurar",
    entryRow: "O preço a partir do qual isso é medido — o preço atual do pool.",
    impermanentNote:
      "É isso que costuma ser chamado de perda impermanente. Ela só é impermanente se o preço voltar: uma posição fechada a um preço diferente daquele em que foi aberta já a realizou.",
  },

  /*
   * The other thing the same range can be. It was on the front page's list of
   * what this application could not do, and what it needed turned out to be no
   * data at all: a range order's average price is fixed by the protocol's own
   * formulas and falls out of the two bounds already on the page.
   */
  rangeOrder: {
    heading: "Vendendo e comprando através da faixa",
    intro:
      "A faixa acima tem dois lados: dinheiro dos dois lados do preço, ganhando taxas enquanto o preço ficar entre eles. Corte-a no preço e cada metade vira um instrumento diferente. Uma posição inteiramente acima do preço segura um token e mais nada, e o pool vende esse token pelo outro conforme o preço sobe através da banda. Abaixo do preço acontece o contrário. É isso que é uma ordem por faixa, e as duas metades desta faixa são exatamente isso.",
    selling: (token: string) => `Vendendo ${token}`,
    buying: (token: string) => `Comprando ${token}`,
    band: "Banda",
    bandNote:
      "Onde a posição fica. A borda interna dela é o primeiro passo de preço depois daquele em que o preço está, então ela começa sem nada daquilo em que está se convertendo.",
    average: "Preço médio",
    averageNote: "A que preço a conversão sai, se o preço atravessar a banda inteira.",
    against: "Em relação ao preço atual",
    exact:
      "Essa média é a média geométrica das duas bordas — exatamente, e em qualquer ordem em que os preços estejam escritos. Ela sai das próprias fórmulas do protocolo sobre o que uma posição segura em cada ponta da banda dela, e o valor aplicado se cancela: cem dólares e um milhão convertem ao mesmo preço.",
    onlyIfThrough:
      "E só se o preço atravessar a banda inteira. Um que volte para dentro deixa a posição com um pouco de cada, a preço nenhum em particular — que é justamente para o que serve a faixa acima dela, só que alcançado por acaso.",
    notAnOrderBook:
      "Nada aqui agenda a conversão e nada a garante. Isto não é um livro de ofertas: uma ordem que o preço nunca alcança é o desfecho comum e não uma falha, e não existe fila nem contraparte esperando. O que existe, em vez disso, é que a posição recolhe as taxas do pool enquanto o preço está dentro da banda, em vez de pagá-las.",
    unavailable: "Esta faixa não tem metade de um lado só para descrever.",
  },

  /*
   * The one panel about using a pool rather than providing to it.
   *
   * It exists because nothing else here answers the first question anybody asks
   * of a pool, and it stops where the certainty does: at the edge of the price
   * step, because liquidity beyond it is a thing this application has not read.
   */
  swapDepth: {
    heading: "Quanto custa um swap aqui",
    intro:
      "Tudo acima é sobre fornecer liquidez. Isto é sobre usá-la. A liquidez de um pool é constante entre os passos de preço sobre os quais ele é construído, então um swap que fica dentro do passo em que o preço está pode ser precificado pelas próprias fórmulas do protocolo sem supor nada — e um passo adiante não pode, porque ali a liquidez de outra posição pode começar e este aplicativo não lê a liquidez em cada preço.",
    /*
     * "into the pool", because the panel above this one also has a leg called
     * "Selling WETH" and it means something else there: a position that sells as
     * the price passes it, rather than a swap sent now. Two labels reading the
     * same on one page is a reader mistaking one for the other.
     */
    selling: (token: string) => `Vendendo ${token} para o pool`,
    amount: (amount: string, symbol: string) => `${amount} ${symbol}`,
    largest: "Maior swap precificável aqui",
    largestNote:
      "Quanto entra antes de o preço chegar ao fim do passo em que está. Não é um limite: um swap maior funciona, e esta página não tem como dizer quanto ele custa.",
    cost: "Do que ele abre mão",
    costNote: "A que distância a média do swap fica do preço que está na tela.",
    oneSideOnly:
      "Só uma direção é mostrada. O preço está perto o bastante do fim do passo dele para que o espaço no outro sentido seja um erro de arredondamento e não um swap, e esta página não imprime um número que não consegue conferir.",
    geometric:
      "Essa média é a média geométrica do preço agora e do preço em que o swap termina — a mesma identidade em que se apoiam as posições de um lado só acima, vista do outro lado da negociação. Um swap que atravessa uma banda a paga; uma posição que está nessa banda a recebe.",
    whyItDiffers:
      "As duas direções não têm o mesmo tamanho porque o preço está em algum ponto dentro do passo dele e não no meio. O que vale comparar entre pools é o tamanho em si: é o que este mercado absorve antes de se mexer, e é a razão pela qual se quebra uma ordem grande em várias pequenas em vez de mandá-la de uma vez.",
    hookMayAlter:
      "O hook deste pool tem permissão para mudar quanto um swap custa — reescrever a taxa a cada swap, dar ele mesmo o preço do swap no lugar da curva do pool, ou ficar com uma parte depois; a seção do hook, acima, diz qual. Os números aqui são o que a curva do pool cobra, e só valem se o hook não interferir. Nada do que foi lido aqui consegue dizer se ele interfere.",
    unavailable: "Para este pool não dá para calcular quanto um swap custaria.",
  },

  compare: {
    heading: "Todos os níveis de taxa deste par, lado a lado",
    intro: (pair: string) =>
      `Cada pool ${pair} abaixo foi lido com o mesmo horizonte, a mesma largura e o mesmo depósito, então os números deles ficam na mesma base. Eles descrevem dias que já passaram, não os que vêm. Os pools v3 estão na ordem da taxa e os v4 do mais profundo para o menos, como explica a nota abaixo deles — nenhum está classificado pelo que teria rendido.`,
    depositFeesNote: (days: string) => `Nos ${days} dias em que o preço ficou dentro da faixa.`,
    daysInside: "Dias inteiros dentro da faixa",
    daysInsideValue: (inside: string, measured: string) => `${inside} de ${measured}`,
    unavailable: "Não deu para ler este nível agora.",
    open: "Abrir a análise completa",
    link: "Colocar os níveis lado a lado",
    onlyOne: (pair: string) =>
      `${pair} só é negociado em um pool v3, então não há nada para colocar ao lado.`,
    readTogether:
      "As taxas são metade da história. O que uma faixa abre mão em relação a simplesmente segurar os dois tokens está na página de cada pool, e as duas coisas precisam ser lidas juntas.",
  },

  feeTiers: {
    heading: "Onde mais este par é negociado",
    intro: (pair: string) =>
      `${pair} é negociado em mais de um nível de taxa. Cada um é um pool separado, com a própria liquidez, o próprio histórico de preços e a própria faixa — os números acima descrevem só este.`,
    onlyOne: (pair: string) =>
      `${pair} é negociado só neste nível de taxa na rede principal do Ethereum. Tudo acima vale para o par inteiro, porque o par é este único pool.`,
    thisOne: "Você está lendo sobre este",
    feeTier: "Nível de taxa",
    holds: "Tem",
    reservesUnread: "Não foi possível ler da rede o que este pool tem.",
    open: "Analisar este nível",
    /*
     * The sentence the panel exists to carry. A list of pools ordered beside
     * dollar figures invites exactly one conclusion, and it is the wrong one.
     */
    biggerIsNotBetter:
      "Um nível com mais liquidez é uma multidão maior dividindo as mesmas taxas de swap, não um lugar melhor. Qual deles serve a uma posição depende de quanto o preço anda e com que frequência, e isso se mede pool a pool — então o jeito honesto de compará-los é abrir cada um e ler os números dele. O horizonte e o multiplicador que você escolheu vão junto com o link.",
    reservesNote:
      "Estes são os saldos que os dois contratos de token informam para cada pool, lidos da rede e não de um indexador. O número do próprio indexador foi medido contra eles e exagera o que existe ali entre 1,3 e 13 vezes, então não é mostrado. Duas quantidades de token em vez de um valor em dólares, porque todo nível aqui tem os mesmos dois tokens e nada precisa ser precificado para compará-los.",
    unavailableHeading: "Não foi possível ler os outros níveis de taxa do par",

    /*
     * The other protocol. On a v3 page the same two token contracts on v4; on
     * a v4 page, v4's other pools of the pair and then v3's. Both lists say
     * what "same pair" means here — the same two contracts — because ether and
     * wrapped ether are two different tokens to a pool, whatever they are to
     * a person.
     */
    onV3: "No Uniswap v3",
    onV4: "No Uniswap v4",
    v4Intro: (pair: string) =>
      `Os pools v4 que negociam ${pair} — os mesmos dois contratos. Um par no v4 pode ser muitos pools: a taxa é qualquer número, o passo de preço é livre, e cada hook cria mais um.`,
    v4None: (pair: string) => `Nenhum pool do Uniswap v4 negocia ${pair} com estes dois contratos.`,
    v4OnlyThis: (pair: string) => `No v4, ${pair} é negociado só neste pool.`,
    v3Intro: (pair: string) => `Os pools v3 que negociam ${pair} — os mesmos dois contratos de token, em cada nível de taxa.`,
    v3None: (pair: string) => `Nenhum pool do Uniswap v3 negocia ${pair} com estes dois contratos.`,
    v3NoNative:
      "Este pool tem o ether da própria rede, e o v3 não consegue: toda moeda no v3 é um contrato de token. Os pools v3 mais próximos dele negociam ether empacotado, que para um pool é outro token.",
    depth: "Profundidade no preço atual",
    depthValue: (ether: string) => `≈ ${ether} ETH`,
    stateUnread: "Não foi possível ler da rede a liquidez do pool.",
    hook: "hook",
    noHook: "sem hook",
    hookAltersSwaps: "pode mudar quanto custa um swap",
    priceStep: (step: string) => `passo ${step}`,
    v4Ordering:
      "Ordenado pela profundidade no preço atual — a liquidez ativa do pool e o preço dele, lidos do armazenamento do PoolManager — porque um par no v4 é em boa parte feito de pools que alguém criou e abandonou, e a profundidade é o que distingue uns dos outros. Ela diz de quanto um swap pode se valer, e nada sobre qual pool é melhor: um pool mais fundo é uma multidão maior dividindo as mesmas taxas.",
    moreNotShown: (count: string) => `Mais ${count} não são mostrados; são mais rasos que estes.`,
    v4Unavailable: "Não foi possível ler os pools v4 do par",
    v3Unavailable: "Não foi possível ler os pools v3 do par",
  },

  /*
   * The same method at every width the form offers, on one page. The two day
   * counts are different kinds of figure, and the note under the table says
   * which is which: the first is the fit, the second the check.
   */
  widths: {
    heading: "As outras larguras",
    intro:
      "O mesmo método em cada largura que o formulário oferece, para que a troca seja vista em vez de contada: uma faixa mais larga abriga mais dias e espalha o mesmo depósito por mais preços — que é a última coluna, e é aritmética do protocolo e não uma estimativa.",
    width: "Largura",
    range: "Faixa",
    recent: (days: string) => `Dentro, dos últimos ${days} dias`,
    unseen: "Dentro, em dias que ele nunca viu",
    insideOf: (inside: string, total: string) => `${inside} de ${total}`,
    unseenNone: "histórico insuficiente",
    feeShare: "Parte das taxas enquanto dentro",
    feeShareValue: (times: string) => `${times}×`,
    chosen: "mostrado acima",
    columnsNote:
      "A primeira contagem é sobre os dias de que cada faixa foi tirada, então ela diz como aquela largura foi ajustada e não como ela se sustentou. A segunda é a conferência acima, rodada para cada largura: o método recuado um horizonte e sobreposto aos dias que vieram depois.",
    /*
     * The one column that is a comparison rather than a reading, and the one
     * most easily read as a promise. It is exact arithmetic about a day inside
     * the range, and it says nothing about the days outside it — which is the
     * half the column beside it measures.
     */
    feeShareNote:
      "A última coluna é quanto o mesmo depósito ficaria das taxas cobradas num dia em que o preço fica dentro daquela faixa, em relação à largura mostrada acima — por isso aquela marca um. É a própria aritmética de posições do protocolo e não uma estimativa: uma faixa mais estreita transforma o mesmo dinheiro em mais liquidez sobre menos preços. Ela supõe que o resto da liquidez do pool não mudou, o que um depósito grande o bastante para movê-la não deixaria verdadeiro, e não diz nada sobre os dias que o preço passa fora.",
    notAdvice:
      "Nenhuma delas é recomendação. Uma faixa mais estreita fica com uma parte maior nos dias em que se sustenta e com nada nos dias em que não, e qual dos dois importa mais depende de para que serve a posição — coisa que nada aqui sabe.",
  },

  parameters: {
    heading: "Mudar a faixa",
    apply: "Recalcular",
    /*
     * The same words label the figures in "how this range was drawn", so a
     * reader changing one can see which number they are changing.
     */
    horizonLabel: "Até quando à frente",
    widthLabel: "Quão larga",
    depositLabel: "Quanto",
    days: (days: string) => `${days} ${days === "1" ? "dia" : "dias"}`,
    sigma: (value: string) => `${value}σ`,
    /** A word for the offered widths; a width typed into the URL gets none. */
    widthChoice: (sigma: string, word: string | null) =>
      word === null ? sigma : `${word} (${sigma})`,
    widthWords: { tight: "Estreita", medium: "Média", wide: "Larga", veryWide: "Muito larga" },
    note: "O horizonte diz até onde à frente o movimento medido é estendido. Ele não muda a medição: a volatilidade sempre vem dos últimos 30 dias completos, qualquer que seja o horizonte escolhido. A largura multiplica esse movimento; uma faixa mais larga é deixada com menos frequência, e não é um nível de confiança.",
    fellBack:
      "Parte do que foi pedido não pôde ser lida, então ali foi usado o valor padrão. O horizonte e a largura realmente usados estão mostrados acima.",
    /** Under the form: which of the two things that set a band this one is. */
    preferenceHint:
      "Isto muda esta página. Para mudar com o que cada pool abre, use as preferências de faixa no cabeçalho.",
  },

  holdings: {
    heading: "O que este endereço tem",
    intro:
      "Os tokens encontrados neste endereço e os pools em que eles podem entrar. Nada aqui é guardado, a menos que você peça os avisos por Telegram abaixo, e o endereço é informação pública — a mesma lista fica visível para qualquer um que o consulte.",
    forAddress: "Endereço",
    loading: "Perguntando aos contratos dos tokens o que este endereço tem…",
    /*
     * The sentence that keeps the answer honest. Nothing can list an address's
     * tokens, so the width of the search is part of the answer.
     */
    howItLooked: (tokens: string, v3Pools: string, v4Pools: string | null) =>
      `O saldo de um token mora dentro do contrato do próprio token, então não existe uma lista do que um endereço possui — só tokens que podem ser perguntados, um de cada vez. Foram perguntados ${tokens} deles: cada token dos ${v3Pools} pools do Uniswap v3 mais negociados na rede principal do Ethereum${v4Pools === null ? "" : `, e cada moeda dos ${v4Pools} pools v4 que mais negociaram nos últimos sete dias, incluindo o ether da própria rede`}. Se algo é mantido fora desse conjunto, ele não falta nesta página porque o endereço não o tenha.`,
    /*
     * Said out loud when the v4 net could not be cast, because a page that
     * listed only v3 pools and said nothing would read as "no v4 pool takes
     * what you hold", which nobody checked.
     */
    v4NotSearched:
      "Os pools do Uniswap v4 não foram pesquisados: não foi possível ler a lista deles. O ether e as moedas dos pools v4 estão ausentes desta página por esse motivo e por nenhum outro.",
    /** A row's protocol, beside its fee. The names are the protocol's own and are not translated. */
    hookTag: "hook",
    holdingsHeading: "Tokens encontrados",
    nothingFound:
      "Nenhum dos tokens conferidos foi encontrado neste endereço. Isso não é o mesmo que uma carteira vazia — veja acima como a busca foi feita.",
    poolsHeading: "Pools em que estes tokens podem entrar",
    bothSides: "Você tem os dois lados",
    oneSide: "Você tem um lado",
    bothSidesNote:
      "Os dois tokens deste pool foram encontrados no endereço, então uma posição aqui não precisa de swap antes.",
    oneSideNote:
      "Um dos dois tokens deste pool foi encontrado. Uma posição aqui precisa também do outro lado, o que significa trocar parte do que você tem.",
    moreNotShown: (count: string) =>
      `Mais ${count} não são mostrados. Os acima são os mais negociados entre eles, na ordem em que a fonte de dados informa — o que é uma afirmação sobre o quanto um pool é movimentado e sobre nada mais.`,
    analyse: "Analisar este pool",
    notAdvice:
      "Esta é uma lista do que é possível, não uma lista do que vale a pena fazer. Qual destes pools serve a quê depende dos números na página de cada pool e de para que serve a posição — e esta lista não sabe nem uma coisa nem outra.",
    unavailableHeading: "Não foi possível ler este endereço",
    invalidAddress: "Isso não é um endereço Ethereum, então nada foi consultado.",
    noAddress: "Conecte uma carteira na página inicial e esta página mostrará o que ela tem.",
  },

  v4: {
    heading: "Um pool do Uniswap v4",
    intro:
      "O que este pool é, lido da chave dele. Um pool v4 não é um contrato próprio: ele mora dentro de um PoolManager e é nomeado por um hash das cinco coisas que o definem — as duas moedas, a taxa, o passo de preço e o hook.",
    poolId: "id do pool",
    pair: "Moedas",
    fee: "Taxa",
    /*
     * Read from the pool's own key on the chain — the log that created it —
     * and never from the indexer, whose figure was measured to be the total
     * fee of the latest swap rather than the key's fee.
     */
    feeNote: (swap: string, lp: string, protocol: string) =>
      `Lido da chave do próprio pool na rede. Um swap paga ${swap}: destes, ${lp} para quem fornece liquidez e ${protocol} para o protocolo por cima.`,
    feeNoteNoProtocol:
      "Lido da chave do próprio pool na rede. O protocolo não pega nada por cima, então isto é o que um swap paga.",
    dynamicFee: "Definida pelo hook, a cada swap",
    dynamicFeeNote:
      "A chave deste pool traz a marca de taxa dinâmica em vez de uma taxa, então quanto um swap custa é decidido pelo hook no momento em que ele acontece. Esta leitura não presenciou nenhum, e não há taxa aqui para informar.",
    /*
     * A list row for a pool whose key the chain did not answer for. The fee is
     * a fact about the pool that this read does not have, and nothing else —
     * not the indexer's figure — stands in for it.
     */
    feeUnread: "taxa não lida",
    feeUnreadNote:
      "A taxa do pool mora na chave com que ele foi criado, na rede, e esta leitura não conseguiu buscá-la. Nada mais serve de substituto.",
    protocolFee: "Taxa do protocolo",
    protocolFeeNone: "Nenhuma",
    protocolFeeNote:
      "Cobrada pelo protocolo por cima da taxa do pool, em cada swap. Definida pela governança e lida do estado do pool na rede.",
    protocolFeeByDirection: (token0: string, token1: string) =>
      `Varia conforme a direção: a primeira quando ${token0} é vendido, a segunda quando é ${token1}.`,
    priceStep: "Passo de preço",
    priceStepNote: (spacing: string) =>
      `O passo mais fino em que as bordas de uma posição podem ser colocadas neste pool — o espaçamento de ticks dele, de ${spacing}. No v4 isso faz parte da chave do pool, então, ao contrário do v3, não precisa de uma chamada de contrato separada.`,
    nativeCurrency: "Ether nativo",
    nativeCurrencyNote:
      "O endereço zero aqui não é um campo faltando. O v4 deixa um pool ter o ether da própria rede em vez de um token empacotado, e é isso que está acontecendo.",
    hookHeading: "O hook",
    noHook: "Este pool funciona sem hook.",
    noHookNote:
      "Nada roda junto com os swaps nem com os depósitos dele, então ele se comporta como um pool v3.",
    hookMay: "O que ele tem permissão para fazer",
    /*
     * One sentence per permission, under the moment a reader can picture it
     * at, with the protocol's own names folded away beneath. The names say
     * where in the protocol's code a hook is called; what a reader needs is
     * what that lets it do to a swap, a deposit or a withdrawal of theirs.
     * Every sentence is a "may": the address grants the moment, not the act.
     */
    permissionTopics: {
      swaps: "Em torno dos swaps",
      liquidity: "Em torno de depósitos e retiradas",
      creation: "Quando o pool foi criado",
      donations: "Em torno de doações",
    } satisfies Record<HookTopic, string>,
    permissionWords: {
      beforeSwap:
        "Roda antes de cada swap, quando pode recusar o swap e, num pool com taxa dinâmica, definir quanto aquele swap paga.",
      afterSwap: "Roda depois de cada swap, quando ainda pode recusar o swap.",
      beforeSwapReturnsDelta:
        "Tirar tokens de um swap, ou colocar os dele, antes de o pool precificá-lo — então um swap aqui não precisa seguir a curva do próprio pool.",
      afterSwapReturnsDelta: "Ficar com uma parte de um swap depois de o pool tê-lo precificado.",
      beforeAddLiquidity: "Roda antes de cada depósito, quando pode recusar o depósito.",
      afterAddLiquidity: "Roda depois de cada depósito, quando ainda pode recusar o depósito.",
      afterAddLiquidityReturnsDelta:
        "Tirar tokens de um depósito no momento em que ele é feito, ou acrescentar tokens a ele.",
      beforeRemoveLiquidity: "Roda antes de cada retirada, quando pode recusar a retirada.",
      afterRemoveLiquidity: "Roda depois de cada retirada, quando ainda pode recusar a retirada.",
      afterRemoveLiquidityReturnsDelta:
        "Ficar com uma parte de uma retirada no momento em que ela é feita, ou acrescentar tokens a ela.",
      beforeInitialize: "Roda uma vez, antes de o pool ser criado. Isso já aconteceu.",
      afterInitialize: "Roda uma vez, depois de o pool ser criado. Isso já aconteceu.",
      beforeDonate:
        "Roda antes de uma doação a quem fornece ao pool, quando pode recusar a doação.",
      afterDonate:
        "Roda depois de uma doação a quem fornece ao pool, quando ainda pode recusar a doação.",
    } satisfies Record<HookPermission, string>,
    noPermissions:
      "Nada em torno de swaps, depósitos ou doações: o protocolo não o chama em nenhum desses momentos. O que um hook assim ainda pode fazer é definir a taxa de um pool cuja taxa é dinâmica.",
    permissionNames: "Os nomes que o próprio protocolo dá a isso",
    /*
     * The other side of the swap warning. A hook that runs when a provider
     * withdraws can refuse the withdrawal — a hook that reverts reverts the
     * withdrawal with it — and one holding the returns-delta flag can take a
     * share of what comes out. Said above the list, like the swap warning,
     * for the reader who stops reading.
     */
    withdrawalWarning: (share: boolean): string =>
      share
        ? "Este hook roda quando quem fornece retira. Ele tem permissão para recusar uma retirada e para ficar com uma parte do que é retirado. Se alguma vez faz isso, não dá para saber daqui."
        : "Este hook roda quando quem fornece retira, e tem permissão para recusar uma retirada. Se alguma vez faz isso, não dá para saber daqui.",
    /*
     * The sentence this whole page exists to carry. A hook's permissions are not
     * stored anywhere — the address is the permission list — so this is the one
     * claim about a hook that can be made without trusting somebody.
     */
    hookAddressIsThePermission:
      "Isto é lido do endereço do próprio hook. O v4 não guarda as permissões de um hook em lugar nenhum: um hook é publicado em um endereço cujos últimos catorze bits soletram quais retornos de chamada o PoolManager vai acionar, e o PoolManager confere esses bits em vez de perguntar ao contrato. Então isto diz o que o hook pode fazer, nunca o que ele faz — um que tem permissão para reescrever a taxa em cada swap pode sempre devolver a mesma taxa, e daqui não dá para saber.",
    alterSwapWarning:
      "Este hook tem permissão para mudar quanto um swap custa ou paga. Qualquer número tirado do histórico de preços — uma faixa sugerida, um nível de taxa, uma comparação com simplesmente segurar — supõe que o pool cobra o que diz e paga o que a curva diz. Nenhuma das duas suposições é segura aqui, e nada disso aparece numa série de preços.",
    /*
     * Replaced the line saying there was no analysis, on the day there was one.
     * What it has to do now is harder: say why a band drawn from price history
     * is as true here as anywhere, without letting that cover the fees, which
     * are the part a hook can move.
     */
    analysisScope:
      "Abaixo está a análise da faixa. A faixa vem de preços que já aconteceram, então ela vale aqui exatamente como vale para um pool sem hook — um hook não consegue mudar retroativamente por onde o preço andou. O que um hook consegue mudar é quanto custa um swap, então a taxa que este pool cobrou é medida a partir do que ele recolheu, e não tirada da taxa acima.",
    unavailableHeading: "Não foi possível ler este pool",
    invalidId:
      "Isso não é um id de pool v4. Um pool v4 é nomeado por um hash de 32 bytes — 0x seguido de 64 caracteres hexadecimais — e não por um endereço de contrato.",
    noId: "Cole um id de pool v4 para ver o que o pool é e o que o hook dele pode fazer.",
    loading: "Lendo este pool v4, no indexador e na rede…",
  },

  /*
   * The page a reader reaches by following something that is not here: an old
   * link, a typo, an address pasted into the path instead of the box. The
   * framework's own answer is an unstyled English line, which on a site
   * published in two languages is the one screen that forgets which it is in.
   */
  notFound: {
    title: "Não há página aqui",
    body: "O endereço que você seguiu não nomeia nada do que este aplicativo serve. Chega-se a um pool pelo endereço dele ou, no v4, pelo id — e os dois vão no campo de busca, não no caminho.",
    search: "Encontrar um pool →",
  },

  /*
   * The directory, and the line it will not cross.
   *
   * Every sentence here is about what the protocol enforces, because that is the
   * only thing about a hook this application can check. A name, a category, a
   * "verified" badge — all of them would be somebody's claim republished, and
   * the reader would have no way to tell which parts of the page were which.
   */
  hooks: {
    heading: "Os hooks rodando no Uniswap v4",
    loading: "Lendo os pools v4 mais movimentados da semana…",
    intro:
      "Todo pool v4 pode citar um hook: um contrato que o PoolManager chama em momentos fixos de um swap, de um depósito, de uma retirada. Quais momentos não é uma promessa que alguém faça. Isso está minerado no endereço do hook — os catorze bits mais baixos são a lista, e o protocolo se recusa a chamar o contrato para qualquer coisa fora dela.",
    onlyPermissions:
      "Isso é tudo o que esta página sabe, e vale a pena saber justamente porque é imposto e não apenas alegado. O que um hook faz com uma permissão está no código dele. Este aplicativo não lê código e não mantém nenhuma lista de hooks por quem alguém tenha respondido — as duas coisas seriam uma afirmação que ele não consegue conferir, ao lado de números que consegue.",
    /*
     * Phrased so no count is followed by a noun that would have to agree with
     * it. A list of one pool is not a case this page will meet — the week's
     * busiest days name hundreds — but "1 pools" is the kind of sentence that
     * only ever appears in front of somebody.
     */
    window: (pools: string, hooked: string, hookless: string) =>
      `Lido dos pools dos dias v4 mais movimentados desta semana, no total de ${pools}. Citam um hook: ${hooked}; não citam nenhum: ${hookless}, e se comportam como um pool v3.`,
    ordering:
      "Ordenado por em quantos desses pools cada hook roda. Isso é uma contagem de pools e nada mais: um hook em muitos deles é um hook com que alguém publicou muitos pools.",
    runs: (count: string) => `Roda em ${count} deles`,
    poolsHeading: "Onde ele roda",
    moreNotShown: (count: string) => `e mais ${count}`,
    none: "Nenhum pool dos dias v4 mais movimentados desta semana cita um hook.",
    unavailable: "Não foi possível ler os pools v4 da semana, então não há diretório para mostrar.",
    fromHome: "Ver todos os hooks →",
  },

  /*
   * The one panel here that describes somebody's own money.
   *
   * It says so, and it says what that does and does not mean: the same list is
   * public, anybody can read it for any address, and nothing about it is kept.
   */
  positions: {
    heading: "Posições que este endereço já tem",
    intro:
      "Tudo acima é o que este endereço poderia fazer — que pools os tokens dele abrem. Isto é o que ele já fez. Uma posição de qualquer um dos protocolos é um token guardado por um contrato, e os dois contratos são perguntados sobre o que é cada token. O do v3 também consegue listar os tokens de um endereço; o do v4 não, então aquela lista vem de um indexador e cada id dela é levado de volta à rede, a quem se pergunta de quem é.",
    none: "Este endereço não tem tokens de posição do Uniswap, de nenhum dos dois protocolos.",
    noneOpen:
      "Todo token de posição que este endereço tem já foi fechado. Um fechado é o recibo de uma posição que existiu, não uma posição.",
    counts: (held: string, open: string, closed: string) =>
      `${held} tokens de posição, dos quais ${open} ainda têm liquidez dentro e ${closed} foram fechados.`,
    inRange: "Ganhando agora",
    outOfRange: "Fora da faixa dela",
    rangeUnknown: "Ninguém fez swap aqui",
    analyse: "Analisar este pool →",
    /*
     * Read from the pool's own fee accounting and differenced, not estimated.
     * Deliberately not a rate: it says what has accrued, not over how long or
     * at what pace, because neither follows from the figure.
     */
    feesEarned: (amount0: string, symbol0: string, amount1: string, symbol1: string) =>
      `Ganho e ainda não retirado: ${amount0} ${symbol0} e ${amount1} ${symbol1}.`,
    feesNone: "Ainda não há nada ganho para retirar.",
    feesUnread: "Não foi possível ler quanto ela ganhou.",
    everyPrice: "Todo preço que este pool consegue exprimir",
    moreNotShown: (count: string) => `Mais ${count} estão abertas e não listadas aqui.`,
    readCap: (read: string, held: string) =>
      `Foram lidas ${read} de ${held}. As demais não estão nesta página, e isso é um limite da página e não do endereço.`,
    /*
     * Two protocols mean two ways to fail. The counts beside this cover the
     * other protocol only, and saying so is the difference between a partial
     * answer and a wrong one.
     */
    unreadProtocol: (protocol: string) =>
      `Desta vez não foi possível ler as posições Uniswap ${protocol}, então todo número aqui é sobre o outro protocolo apenas.`,
    unavailable: "Não foi possível ler as posições deste endereço.",
    publicNote:
      "O dono de uma posição está na rede, então esta lista é pública: qualquer um consegue ler a mesma para o mesmo endereço, e ela não diz nada que este endereço já não tenha publicado ao ter estes tokens. Nada aqui é guardado, a menos que você peça os avisos por Telegram abaixo, e nenhum número desta página é uma avaliação — uma faixa não é quanto vale uma posição.",
  },

  wallet: {
    heading: "Conectar uma carteira",
    intro:
      "Conecte uma carteira e esta página consegue ver quais tokens o endereço tem e mostrar os pools em que esses tokens podem entrar. Ela lê o endereço; é só isso que se pede a uma carteira aqui.",
    connect: "Conectar carteira",
    connecting: "Esperando a carteira…",
    connectedAs: "Conectado como",
    showHoldings: "Mostrar o que ela tem",
    forget: "Esquecer este endereço",
    /*
     * The sentence that replaced "never connects a wallet". The half that is
     * still true is the half worth keeping, and it is the half that matters.
     */
    readOnly:
      "Somente leitura. Este aplicativo pede o endereço a uma carteira e nunca uma assinatura: não existe aqui código capaz de assinar uma mensagem ou enviar uma transação, e nada sobre a carteira é guardado entre visitas.",
    notices: {
      "wallet-not-found":
        "Nenhuma carteira foi encontrada neste navegador. Uma extensão de carteira coloca uma ali; sem ela, nada nesta página muda.",
      "wallet-request-declined":
        "O pedido foi recusado na carteira. Nada foi lido e nada foi enviado.",
      "wallet-request-failed":
        "Não foi possível pedir um endereço à carteira. Nada foi lido e nada foi enviado.",
      "wallet-no-account":
        "A carteira respondeu sem um endereço, o que normalmente quer dizer que ela está bloqueada ou sem conta selecionada.",
    },
  },

  /*
   * The alerts: what the site says about them, and what the bot says. Kept
   * together because the bot's sentences are this interface's sentences,
   * delivered somewhere else, and they have to agree with the page a reader
   * links from.
   */
  telegram: {
    heading: "Avisos no Telegram",
    intro:
      "Ser avisado, no Telegram, quando uma das posições deste endereço chegar perto da borda da faixa dela, sair dela ou voltar para dentro. O botão leva ao bot deste site; apertar Iniciar lá liga aquela conversa a este endereço. O que fica guardado é o endereço e o id numérico da conversa — nada mais — e os dois são apagados do servidor no instante em que você mandar /stop ao bot ou esquecer o vínculo aqui, e dos backups criptografados dele em até sete dias. Com que frequência a conferência acontece depende do servidor em que isto roda.",
    connect: "Conectar o Telegram",
    connected: (address: string) => `Este navegador está vinculado: ${address} está sendo acompanhado.`,
    pending: "O vínculo está esperando: abra a conversa do bot no Telegram e aperte Iniciar.",
    forget: "Esquecer o vínculo",
    notConfigured: "Os avisos por Telegram não estão configurados neste servidor.",
    publicNote:
      "Não é preciso ser dono de um endereço para acompanhá-lo — as posições são públicas, e um aviso não diz nada que esta lista já não diga. O bot lê a rede e manda uma mensagem; ele não consegue assinar nem enviar nada.",
    linked: (address: string) =>
      `Vinculado. Você saberá por aqui quando uma posição em ${address} chegar perto da borda da faixa dela, sair dela ou voltar. Mande /stop para encerrar.`,
    unknownStart:
      "Esse vínculo não é conhecido ou expirou. Aperte “Conectar o Telegram” no site outra vez.",
    alreadyClaimed:
      "Esse vínculo já foi usado por outra conversa. Aperte “Conectar o Telegram” no site outra vez para receber um novo.",
    stopped: "Encerrado. Esta conversa não acompanha mais nada. O registro foi apagado do servidor e sai dos backups criptografados em até sete dias.",
    nothingToStop: "Esta conversa não estava acompanhando nada.",
    help:
      "Este bot só acompanha o endereço que você vinculou no site, e só fala quando uma posição chega perto da borda da faixa dela, sai dela ou volta para dentro. Mande /stop para encerrar.",
    storeDown: "Não foi possível conferir o vínculo agora. Tente de novo daqui a um minuto.",
    left: (pair: string, protocol: string, range: string) =>
      `⚠️ ${pair} (${protocol}) saiu da faixa dela: ${range}. Ela está com um token só e não ganha nada até o preço voltar.`,
    nearing: (pair: string, protocol: string, range: string, price: string, edge: string) =>
      `⏳ ${pair} (${protocol}) está perto da borda da faixa dela: ${range}. O preço está em ${price}; além de ${edge} ela fica com um token só e não ganha nada.`,
    entered: (pair: string, protocol: string, range: string) =>
      `✅ ${pair} (${protocol}) voltou para dentro da faixa dela: ${range}. Está ganhando de novo.`,
    opened: (pair: string, protocol: string, range: string) => `Nova posição: ${pair} (${protocol}), ${range}.`,
    closed: (protocol: string, tokenId: string) => `Fechada: posição ${protocol} nº ${tokenId}.`,
    footer:
      "Apenas informação — não é recomendação financeira. Lido de dados públicos da rede; nada aqui consegue agir por você.",
  },

  search: {
    label: "Um par, um endereço de pool v3 ou um id de pool v4",
    placeholder: "WETH/USDC",
    help: "Digite um par como WETH/USDC, cole o endereço de um contrato de pool v3 ou cole um id de pool v4 — o hash de 32 bytes pelo qual um pool v4 é nomeado. Somente leitura: este aplicativo nunca assina nada e nunca envia uma transação.",
    submit: "Encontrar pools",

    heading: "Pools do Uniswap v3 correspondentes",
    resultsFor: (terms: string) => `Pools cujos tokens correspondem a ${terms}.`,
    empty: (terms: string) =>
      `Nenhum pool do Uniswap v3 na rede principal do Ethereum tem um token correspondente a ${terms}.`,
    emptyHint: "Confira a grafia, ou cole o endereço do pool se você o tiver.",

    /*
     * The v4 list, beneath the v3 one. Two lists rather than one merged list,
     * because they are ordered by different numbers — what a pool holds, and
     * what its active liquidity is worth — and one order over both would be
     * comparing them.
     */
    v4Heading: "Pools do Uniswap v4 correspondentes",
    v4Empty: (terms: string) =>
      `Nenhum pool do Uniswap v4 na rede principal do Ethereum tem uma moeda correspondente a ${terms}.`,
    v4Depth: "Profundidade no preço atual",
    v4DepthValue: (ether: string) => `≈ ${ether} ETH`,
    v4DepthNote:
      "Quanto vale agora a liquidez ativa do pool, lida do próprio armazenamento do PoolManager — e não o que o pool tem, coisa que nenhum pool v4 informa por conta própria.",
    v4StateUnread: "Não foi possível ler da rede a liquidez do pool.",
    v4Hook: "Hook",
    v4NoHook: "nenhum",
    v4HookAltersSwaps: "pode mudar quanto custa um swap",
    v4Ordering:
      "Pools chamados exatamente pelo que você buscou vêm primeiro. Depois disso a ordem segue a profundidade de cada pool no preço atual dele — a liquidez ativa e o preço, lidos do armazenamento do PoolManager e postos numa escala só usando os preços que a fonte de dados deriva. Não é o que o pool tem: os tokens de todos os pools v4 ficam juntos no mesmo PoolManager, e nada na rede os informa por pool. O número de liquidez do próprio indexador foi conferido contra a rede e estava quinze por cento errado em um dos pools mais movimentados, e é por isso que não é usado.",

    /*
     * The ordering is the one claim a list makes, so it is stated rather than
     * left to be inferred from the order itself.
     */
    ordering:
      "Pools chamados exatamente pelo que você buscou vêm primeiro. Depois disso a ordem segue o que cada pool de fato tem, lido dos próprios contratos dos tokens e posto numa escala só usando os preços que a fonte de dados deriva. Antes ela seguia o valor que a fonte informa como bloqueado em cada pool, e esse número estava errado o bastante para reordenar esta lista: um pool foi publicado aqui com nove milhões de dólares de liquidez informada enquanto os contratos dele tinham nove mil.",
    windowing:
      "Esta lista é tirada dos pools que a fonte de dados informa como os mais negociados para os seus termos, e um pool parado o bastante para ficar fora desse conjunto nunca chega à ordenação acima. Esse é o limite honesto de classificar dentro do que uma fonte decidiu devolver: um pool que tem muita coisa mas negocia pouco pode estar ausente desta página.",
    /*
     * The other thing the list leaves out, and why. Said beside the window
     * note because it is the same kind of fact: a pool can be missing from
     * this page for a reason that is not "it does not exist".
     */
    dormantNote:
      "Um pool em que nada aconteceu por um mês não é listado. A faixa é tirada do último mês de preços, e um pool sem esse mês não tem de onde tirá-la — abri-lo só diria isso.",
    /*
     * The v4 window is not the terms. The source cannot answer a search over
     * every v4 pool before this page stops waiting — measured, not assumed —
     * so the search runs over the week's busiest pool-days, and a page that
     * did not say so would let a reader conclude a pool does not exist.
     */
    v4Windowing:
      "Esta lista é tirada dos pools v4 que mais negociaram na rede principal do Ethereum nos últimos sete dias — os mil pares pool-dia mais movimentados, que dão algumas centenas de pools — e um pool mais parado que isso nunca chega a esta página. A fonte não consegue responder a uma busca em todos os pools v4 antes de esta página parar de esperar, então a janela é por atividade recente e não pelos seus termos: um pool que existe mas não negociou esta semana não está aqui.",
    /*
     * The sentence that does the real work on this page. Search is what lets
     * someone reach a pool they did not go looking for.
     */
    symbolWarning:
      "Um símbolo vem do contrato do próprio token, e publicar um token que se chama USDC não custa nada. Os endereços de contrato embaixo de cada par são o que distingue dois tokens.",

    feeTier: "Nível de taxa",
    holds: "Tem",
    reservesUnread: "Não foi possível ler da rede o que este pool tem.",
    moreNotShown: (count: string) =>
      `Mais ${count} não são mostrados. Os acima são os mais negociados entre eles, na ordem em que a fonte de dados informa — o que é uma afirmação sobre o quanto um pool é movimentado e sobre nada mais.`,
    analyse: "Analisar este pool",
    /** Under the v4 list: where each row's fee came from, and why the row can say it was not read. */
    v4FeeNote:
      "A taxa de cada pool é lida da chave com que ele foi criado, na rede, e não da fonte de dados — cujo número de taxa foi medido e se mostrou ser o total que o último swap pagou, corte do protocolo incluído, e não a taxa do próprio pool. Uma linha cuja chave não pôde ser lida diz isso.",

    unavailableHeading: "Não foi possível rodar a busca",
    rejected: {
      empty: "Digite um par como WETH/USDC, ou um endereço de pool.",
      length: (min: number, max: number) =>
        `Um termo de busca tem entre ${min} e ${max} caracteres.`,
      unsupportedCharacters:
        "Um termo de busca pode ter letras, dígitos e os sinais que aparecem dentro de tickers — e nada mais.",
    },
  },

  report: {
    steps: {
      pool: "a configuração do pool era lida",
      snapshot: "o estado de mercado atual do pool era lido",
      history: "o histórico diário de preços do pool era lido",
      volatility: "se media quanto o preço andou",
      band: "a banda de preço era construída",
      range: "a banda era encaixada nos preços que este pool consegue exprimir",
      divergence: "essa faixa era comparada com segurar os dois tokens",
      activity: "se lia o que o pool fez na janela medida",
    },
    noRangeHeading: "Sem faixa para este pool",
    stoppedWhile: (step: string) => `Isto parou enquanto ${step}.`,
    poolSummary: (protocol: string, fee: string, chain: string) =>
      `Uniswap ${protocol} · ${chain} · ${fee}`,
    feePerSwap: (fee: string) => `taxa de ${fee} em cada swap`,
    /** A v4 pool whose protocol takes a cut on top of the pool's own fee. */
    feePlusProtocol: (fee: string, protocol: string) =>
      `taxa de ${fee} em cada swap, mais ${protocol} para o protocolo`,
    /** Stands where the fee would, for a v4 pool whose hook sets one per swap. */
    noDeclaredFee: "taxa definida pelo hook dele em cada swap",
    caveatsHeading: (count: number) =>
      count === 1 ? "Uma ressalva se aplica a estes números." : `${count} ressalvas se aplicam a estes números.`,
    caveatsAriaLabel: "Ressalvas",

    /*
     * The range, as two prices. Every price on the page is written the way
     * round that makes it at least one — one unit of the dearer token, priced
     * in the cheaper — and the intro says which token that is, so the figures
     * under it can be read without a second thought. The ticks those prices
     * encode are in the technical details at the end, where a reader who
     * wants to check them can, and a reader who does not is never made to.
     */
    contentsHeading: "Nesta página",
    contentsLabel: "As seções desta análise",
    rangeHeading: "Faixa de preço sugerida",
    rangeIntro: (base: string, quote: string) =>
      `Onde uma posição neste pool estaria ativa, como o preço de um ${base} em ${quote}.`,
    rangeValue: (lower: string, upper: string, quote: string, base: string) =>
      `${lower} – ${upper} ${quote} por ${base}`,
    rangeDistances: (down: string, up: string) =>
      `${down} abaixo e ${up} acima do preço atual.`,
    rangeMeaning:
      "Entre estes dois preços uma posição ganha a parte dela nas taxas de swap do pool. Fora deles ela fica com um token só e não ganha nada até o preço voltar.",
    priceSentence: (base: string, price: string, quote: string) => `1 ${base} = ${price} ${quote}`,
    currentPrice: "Preço atual",
    inRangeYes: "O preço atual está dentro desta faixa.",
    inRangeNo: "O preço atual está fora desta faixa.",
    inRangeYesNote: "Uma posição aberta aqui estaria ativa imediatamente.",
    inRangeNoNote:
      "Uma posição aberta aqui ficaria com um token só e não ganharia nada até o preço voltar para dentro.",
    beyondEdges: (below: string, above: string) =>
      `Se o preço cair abaixo da faixa, a posição acaba só com ${below}; se subir acima dela, só com ${above}.`,
    lowerTruncatedNote:
      "A borda de baixo para no preço mais baixo que este pool consegue exprimir, aquém de onde a banda a teria colocado.",
    upperTruncatedNote:
      "A borda de cima para no preço mais alto que este pool consegue exprimir, aquém de onde a banda a teria colocado.",
    /*
     * The month drawn through the range. The caption says what each mark is,
     * once, in the words the page uses for the same things; the day counts a
     * few panels down are the same days, counted.
     */
    chartLabel: "Os preços do último mês sobre a faixa sugerida",
    chartCaption: (days: string) =>
      `Cada um dos últimos ${days} dias: o fechamento dele e o intervalo da mínima à máxima. A banda sombreada é a faixa sugerida; a linha cheia é o preço de hoje.`,
    chartLegend:
      "Um ponto cheio é um dia que ficou inteiramente dentro da faixa; um vazado é um que a deixou ou cruzou uma borda.",

    /*
     * Where the range came from, in the words a reader has: how much the price
     * moves on a typical day, and what that comes to over the horizon. The
     * standard deviation is named in the notes, not in the labels.
     */
    basisHeading: "Como esta faixa foi traçada",
    basisIntro: (base: string, days: string) =>
      `A partir de quanto o preço de ${base} realmente andou nos últimos ${days} dias completos — e não de uma previsão de para onde ele vai.`,
    dailyMove: "Movimento diário típico",
    dailyMoveNote: "O desvio padrão da variação de preço de um dia, ao longo da janela.",
    horizonMove: (days: string) => `Em ${days} ${days === "1" ? "dia" : "dias"}`,
    horizonMoveNote:
      "O mesmo movimento esticado pelo horizonte escolhido abaixo: um desvio padrão para cada lado.",
    widthValue: (multiplier: string) => `${multiplier}× isso, para cada lado`,
    widthNote:
      "Escolhida abaixo. Uma faixa mais larga é deixada com menos frequência, e o mesmo depósito espalhado por ela fica mais fino em qualquer preço isolado.",
    measuredOver: "Medido sobre",
    measuredOverNote: (returns: string) => `Entraram nisto ${returns} variações diárias.`,
    epilogue:
      "A faixa está centrada no preço de hoje e traçada à mesma distância para cima e para baixo em termos de razão — cair pela metade e dobrar são o mesmo movimento —, e é por isso que as duas porcentagens diferem. Ela descreve quanto o preço andou, não para onde ele vai: não é previsão, e a largura não é um nível de confiança. Nada aqui dimensiona uma posição nem diz quanto depositar de cada token.",
  },

  /*
   * Everything a reader checking the page against the chain would want, and
   * nothing a reader opening a position needs: the ticks the prices encode,
   * the blocks the figures were read at, the figures in the pool's own
   * direction. Folded away at the end of the report.
   */
  technical: {
    heading: "Detalhes técnicos",
    summary: "Os ticks, blocos e números contra os quais a página acima é conferida.",
    lowerTick: "Tick de baixo",
    upperTick: "Tick de cima",
    currentTick: "Tick atual",
    sourceReportedTick: (tick: string) => `A fonte informou ${tick}.`,
    noSourceTick:
      "A fonte não informou um tick próprio, então esta conversão não está verificada.",
    tickSpacing: "Espaçamento de ticks",
    tickSpacingNote: (step: string) => `Um passo de preço de ${step} entre bordas utilizáveis.`,
    width: "Largura",
    widthValue: (ticks: string, spacings: string) => `${ticks} ticks · ${spacings} espaçamentos`,
    poolPrice: "Preço como o pool o cota",
    quotePerBase: (quote: string, base: string) => `${quote} por ${base}`,
    bandLower: "Limite inferior da banda",
    bandUpper: "Limite superior da banda",
    bandNote: "Antes de encaixar na grade de ticks, na direção do próprio pool.",
    annualised: "Volatilidade anualizada",
    annualisedNote:
      "Desvio padrão amostral dos retornos logarítmicos diários, multiplicado por sqrt(365).",
    coverage: "Cobertura",
    coverageNote: "Quanto da janela teve preços diários consecutivos por trás.",
    sourceBlock: "Bloco da fonte",
    noBlockTime: "Nenhum horário de bloco informado.",
    fetchedAt: "Buscado em",
    fetchedAtNote: "Quando a resposta chegou, não o que ela descreve.",
    lowerEdge: "Borda de baixo",
    upperEdge: "Borda de cima",
    truncated: "Truncada",
    asAsked: "Como pedida",
  },

  explanation: {
    heading: "Explicação",
    pending: "Escrevendo a explicação…",
    unavailable: "Não há explicação disponível para esta análise.",
    /*
     * The two states a single paragraph can be in while the rest of the answer
     * is still arriving. Both keep the heading, so the reading order stays put
     * rather than the sections below jumping as each one lands.
     */
    sectionWriting: "Ainda sendo escrita…",
    sectionMissing: "Não foi possível escrever esta parte.",
    /*
     * Names the author, and draws the line. Prose written by a model sitting
     * under figures that were computed and cross-checked should say which is
     * which, or a reader is entitled to assume the same hand produced both.
     */
    writtenBy: (model: string) => `Escrito por ${model}. Os números acima não.`,
    sections: {
      whatThisRangeMeans: "O que esta faixa quer dizer",
      ifPriceLeavesTheRange: "Se o preço sair da faixa",
      whatTheVolatilitySays: "O que a volatilidade diz",
      whatThisDoesNotCover: "O que isto não cobre",
    },
  },

  /*
   * Every sentence this application says about a read that did not go well.
   *
   * They lived in the data layer until search made a second language matter:
   * an adapter raised an English sentence and it travelled, unchanged, to a page
   * being read in Turkish. Now the adapter raises a code and the wording is
   * here, where all the other wording is.
   *
   * `satisfies` is what keeps this honest. Add a code to `notices.ts` and this
   * object stops compiling until it says something about it, in both languages.
   */
  notices: {
    failure: {
      "invalid-pool-address":
        "O endereço do pool precisa ser 0x seguido de 40 caracteres hexadecimais, e não pode ser o endereço zero.",
      "invalid-search-terms":
        "Uma busca de pool aceita um ou dois termos curtos feitos de letras, dígitos e os sinais que aparecem dentro de tickers.",
      "market-data-not-configured":
        "Os dados de mercado do Uniswap v3 não estão configurados neste servidor.",
      "chain-data-not-configured":
        "As leituras na rede não estão configuradas neste servidor.",
      "explanation-not-configured":
        "Este aplicativo não está configurado para escrever explicações, então nenhuma é mostrada.",
      "market-data-timed-out":
        "A requisição de dados de mercado estourou o tempo.",
      "market-data-unreachable":
        "Não foi possível alcançar a fonte de dados de mercado.",
      "market-data-credentials-rejected":
        "A fonte de dados de mercado recusou as credenciais configuradas.",
      "market-data-rate-limited":
        "O limite de requisições da fonte de dados de mercado foi ultrapassado.",
      "market-data-unreadable":
        "A fonte de dados de mercado devolveu uma resposta ilegível.",
      "market-data-malformed":
        "A fonte de dados de mercado devolveu uma resposta que este aplicativo não consegue verificar.",
      "market-data-indexing-errors":
        "A fonte de dados de mercado informou erros de indexação, então os números dela não podem ser tratados como verificados.",
      "market-data-stale":
        "A fonte de dados de mercado está atrasada demais em relação à rede para estes números serem tratados como atuais.",
      "market-data-future-block-time":
        "A fonte de dados de mercado informou um horário de bloco à frente do relógio deste servidor, então os números dela não podem ser verificados.",
      "chain-data-timed-out":
        "A requisição de dados na rede estourou o tempo.",
      "chain-data-unreachable":
        "Não foi possível alcançar a fonte de dados na rede.",
      "chain-data-credentials-rejected":
        "A fonte de dados na rede recusou as credenciais configuradas.",
      "chain-data-rate-limited":
        "O limite de requisições da fonte de dados na rede foi ultrapassado.",
      "chain-data-unreadable":
        "A fonte de dados na rede devolveu uma resposta ilegível.",
      "chain-data-malformed":
        "A fonte de dados na rede devolveu uma resposta que este aplicativo não consegue verificar.",
      "chain-aggregator-unverified":
        "Os saldos são lidos por um contrato auxiliar na rede, e o código no endereço dele não é o código em que este aplicativo foi feito para confiar, então nada foi lido por ele.",
      "pool-not-found":
        "Nenhum pool do Uniswap v3 foi encontrado para este endereço na rede principal do Ethereum.",
      "pool-contract-not-found":
        "Nenhum contrato de pool do Uniswap v3 respondeu neste endereço na rede principal do Ethereum.",
      "pool-configuration-inconsistent":
        "Não foi possível verificar a configuração do pool montada a partir das duas fontes dele.",
      "pool-history-insufficient":
        "Este pool ainda não tem histórico diário de preços completo o bastante para ser analisado.",
      "pool-history-never-traded":
        "Este pool existe, mas nunca houve nenhuma troca nele, então não há preços diários para medir uma faixa.",
      "pool-history-dormant":
        "Este pool parou de ser negociado antes de começar o período de onde estes preços diários são lidos, então não há histórico recente para medir uma faixa. Esperar não vai mudar isso — só mudaria se o pool voltasse a ser usado.",
      "volatility-invalid-input":
        "O histórico de preços fornecido para este cálculo não é um histórico normalizado válido.",
      "volatility-insufficient-history":
        "Este pool não tem preços diários consecutivos suficientes para medir a volatilidade.",
      "volatility-unverifiable":
        "O cálculo de volatilidade produziu um resultado que este aplicativo não consegue verificar.",
      "band-invalid-input":
        "Os dados de mercado fornecidos para esta banda de preço não são válidos, ou o instantâneo e a volatilidade descrevem pools diferentes.",
      "band-no-current-price":
        "O preço atual deste pool não está disponível, então não há onde centrar uma banda de preço.",
      "band-unverifiable":
        "O cálculo da banda de preço produziu um resultado que este aplicativo não consegue verificar.",
      "range-invalid-input":
        "O pool, a banda de preço e o instantâneo fornecidos para esta faixa não são válidos, ou não descrevem todos o mesmo pool e a mesma observação.",
      "range-price-unrepresentable":
        "O preço atual deste pool fica fora do intervalo que o Uniswap consegue exprimir, então não dá para construir uma faixa de posição a partir dele.",
      "range-tick-disagreement":
        "O preço que a fonte informa para este pool e o estado que ela informa não descrevem o mesmo momento, então nenhuma faixa é publicada.",
      "range-too-narrow":
        "A banda de preço é mais estreita que o menor passo que este pool permite entre duas bordas, então ela não descreve duas fronteiras de posição distintas.",
      "range-unverifiable":
        "O cálculo da faixa produziu um resultado que este aplicativo não consegue verificar.",
      "divergence-unverifiable":
        "A comparação com segurar produziu um resultado que este aplicativo não consegue verificar.",
      "activity-unverifiable":
        "A atividade recente do pool produziu um resultado que este aplicativo não consegue verificar.",
      "fee-rate-unmeasurable":
        "Este pool não negociou em nenhum dia indexado da janela, então a taxa que ele cobra não pode ser deduzida do que ele recolheu.",
      "deposit-share-unpriceable":
        "A fonte não precifica o que este pool tem, então um depósito em dólares não pode ser transformado numa posição nele.",
      "deposit-share-no-days":
        "O preço saiu desta faixa em todos os dias que a fonte conseguiu responder, então não há dia em que um depósito nela tivesse recolhido algo.",
      "deposit-share-unverifiable":
        "Quanto um depósito teria ficado não passou na própria conferência, então não é mostrado.",
      "range-order-no-room":
        "Esta faixa é estreita demais para abrigar uma posição de um lado só em qualquer um dos lados do preço atual.",
      "range-order-unverifiable":
        "As metades de um lado só desta faixa não passaram na própria conferência, então não são mostradas.",
      "swap-depth-no-liquidity":
        "Este pool informa não ter liquidez no preço atual dele, então não há swap aqui para precificar.",
      "swap-depth-tick-disagreement":
        "O tick da própria fonte coloca este pool num passo de preço diferente do preço mostrado, então a liquidez que ela informou não pode ser atribuída a este passo.",
      "swap-depth-unverifiable":
        "Quanto um swap custaria não passou na própria conferência, então não é mostrado.",
      "out-of-sample-insufficient-history":
        "Este pool não tem histórico indexado suficiente para ajustar uma banda no passado e ainda sobrar um horizonte inteiro de dias para conferi-la.",
      "out-of-sample-unverifiable":
        "A conferência fora da amostra produziu um resultado que este aplicativo não consegue verificar.",
      "hook-directory-unverifiable":
        "Os hooks dos pools v4 desta semana não passaram na própria conferência, então o diretório não é mostrado.",
      "positions-manager-unverified":
        "O contrato que guarda as posições do Uniswap v3 não respondeu com o código contra o qual este aplicativo foi escrito, então nada do que ele disse é mostrado.",
      "positions-unreadable":
        "A rede não respondeu sobre as posições deste endereço, então nenhuma é mostrada — o que não é o mesmo que não ter nenhuma.",
      "positions-unverifiable":
        "As posições deste endereço não passaram na própria conferência, então não são mostradas.",
      "holdings-unverifiable":
        "O que este endereço tem produziu um resultado que este aplicativo não consegue verificar.",
      "explanation-key-rejected":
        "O serviço de explicações não aceitou a chave configurada, então nenhuma explicação é mostrada.",
      "explanation-model-not-permitted":
        "A chave configurada não tem permissão para usar o modelo escolhido, então nenhuma explicação é mostrada.",
      "explanation-model-unknown":
        "O modelo escolhido não está disponível para a chave configurada, então nenhuma explicação é mostrada.",
      "explanation-rate-limited":
        "O serviço de explicações está limitando requisições agora, então nenhuma explicação é mostrada.",
      "explanation-hourly-cap":
        "Este site escreve um número limitado de explicações por hora, e esse número já foi atingido. Os números acima estão completos; dentro de uma hora a explicação poderá ser escrita de novo.",
      "explanation-unreachable":
        "Não foi possível alcançar o serviço de explicações, então nenhuma explicação é mostrada.",
      "explanation-request-refused":
        "O serviço de explicações recusou esta requisição, então nenhuma explicação é mostrada.",
      "explanation-declined":
        "O modelo se recusou a explicar os números deste pool, então nenhuma explicação é mostrada.",
      "explanation-truncated":
        "A explicação foi cortada antes de ficar completa, então não é mostrada.",
      "explanation-malformed":
        "A explicação voltou numa forma que este aplicativo não consegue verificar, então não é mostrada.",
    } satisfies Record<DataFailureNotice, string>,

    warning: {
      "block-time-unreported":
        "A fonte de dados não informou um horário de bloco, então não foi possível verificar o quanto estes números são atuais.",
      "history-window-incomplete":
        "A fonte de dados não informou um preço para cada dia desta janela; os dias que faltam estão ausentes, não estimados.",
      "volatility-window-incomplete":
        "Alguns dias desta janela não tiveram preço, então a volatilidade é medida com menos retornos diários do que a janela cobre; os dias que faltam foram pulados, não estimados.",
      "band-window-incomplete":
        "Alguns dias da janela de volatilidade não tiveram preço, então esta banda se apoia em menos retornos diários do que a janela cobre.",
      "band-price-block-time-unreported":
        "A fonte do preço atual não informou um horário de bloco, então o quanto ele é atual não pôde ser verificado de forma independente.",
      "band-volatility-block-time-unreported":
        "A fonte da volatilidade não informou um horário de bloco, então o quanto ela é atual não pôde ser verificado de forma independente.",
      /*
       * Neither names an edge. The codes name the pool's edges, and the page
       * writes its prices the reader's way round, which can be the other way —
       * so the sentence points at the range panel, which says which edge in
       * the direction shown.
       */
      "range-lower-edge-truncated":
        "Uma borda da faixa para onde terminam os preços que este pool consegue exprimir — a borda em que o primeiro token do pool está mais barato —, então a faixa não chega tão longe quanto a banda chegaria. O bloco da faixa diz qual borda é essa na direção mostrada.",
      "range-upper-edge-truncated":
        "Uma borda da faixa para onde terminam os preços que este pool consegue exprimir — a borda em que o primeiro token do pool está mais caro —, então a faixa não chega tão longe quanto a banda chegaria. O bloco da faixa diz qual borda é essa na direção mostrada.",
      "range-tick-unverified":
        "A fonte do preço não informou o estado do próprio pool, então o preço que ela implica não pôde ser conferido contra ele.",
      "range-excludes-current-price":
        "O preço atual do pool fica fora desta faixa, então uma posição construída a partir dela ficaria com um token só e não ganharia nada até o preço voltar.",
    } satisfies Record<DataWarningNotice, string>,
  },

  rateLimited: {
    title: "Requisições demais",
    body: (limit: number) =>
      `Esta página lê dados ao vivo do Uniswap a cada visita, então está limitada a ${limit} análises por minuto.`,
    retry: (seconds: number) => `Tente de novo em ${seconds} s.`,
    back: "Voltar ao orientador",
  },

  error: ERROR_COPY.pt,
};

const zhHant: Dictionary = {
  metadata: {
    title: "LiquidityWise",
    description:
      "一個面向 Uniswap v3 與 v4 流動性策略的教學型 AI 輔助顧問。僅供參考——不構成財務建議。",
    v4Title: "一個 Uniswap v4 資金池 · LiquidityWise",
    v4Description:
      "這一個 Uniswap v4 資金池是什麼，以及它的 hook 被允許做什麼。",
    holdingsTitle: "一個地址持有什麼 · LiquidityWise",
    holdingsDescription:
      "在某個以太坊地址上找到的代幣，以及這些代幣可以進入的 Uniswap v3 資金池。",
    compareTitle: "費率檔並排 · LiquidityWise",
    compareDescription: "一個交易對的所有 Uniswap v3 費率檔，用同樣的時長、寬度和資金讀取。",
    poolTitle: "資金池區間分析 · LiquidityWise",
    poolDescription:
      "為某個以太坊主網 Uniswap v3 資金池給出的價格區間，由它的價格實際走了多遠推算而來。",
    hooksTitle: "Uniswap v4 上的 hook · LiquidityWise",
    hooksDescription:
      "本週最活躍的 Uniswap v4 資金池所指定的每一個 hook，以及每一個被允許做什麼——都從它自己的地址中讀出。"
  },

  preferences: {
    languageLabel: "語言",
    selectLanguage: "選擇語言",
    closeLanguages: "關閉",
    /*
     * Said in the reader's own language, at the moment they choose it, rather
     * than left to be discovered paragraph by paragraph. A reader who is told
     * can decide; one who meets it halfway down a page cannot.
     */
    partlyTranslated:
      "這門語言仍在翻譯中。選單、標籤和標題已是該語言；較長的說明文字目前仍為英文。",
    themeLabel: "主題",
    themeSystem: "跟隨系統",
    themeLight: "淺色",
    themeDark: "深色",
    rangeLabel: "區間偏好",
    rangeIntro:
      "每個資金池開啟時所用的時間跨度、寬度和投入金額。自帶參數的連結仍然優先；每份分析下方的表單只改變那一頁。",
    rangeSave: "儲存",
    rangeReset: "忘記",
  },

  disclaimer: {
    ariaLabel: "重要聲明",
    title: "教學工具——不構成財務建議。",
    body: "本應用講解 Uniswap 的運作機制，幫助你思考參數的選擇。它不預測價格，不保證任何收益，也無法驗證某個智慧合約是否安全。提供流動性存在真實風險，包括無常損失以及本金的全部損失。請始終自行核對合約地址，並獨立研究。",
  },

  home: {
    badge: "早期基礎版本",
    title: "LiquidityWise",
    introBeforeV3: "一個面向 Uniswap ",
    introBetween: " 的教學型顧問，並正在向 ",
    introAfterV4:
      " 延伸。按交易對找到一個資金池，讀到一個由該交易對實際走了多遠推算出來的價格區間，並用平實的語言把它講清楚。每一個數字都先被計算並交叉核對，模型才被允許去描述它——而模型永遠不被允許說出任何一個數字。",
    workingTodayHeading: "現在就能用的",
    workingTodayBody:
      "按交易對搜尋一個資金池，或者貼上一個 v3 池地址、一個 v4 池 id。你會得到這個池已核驗的配置與當前狀態、最近一個月的每日價格畫在建議區間上的圖、這個交易對實際走了多遠，以及由此得出的區間——時間跨度和寬度都由你來改。旁邊還有：這個池收了多少手續費、實際又收到了多少，它最近這些天相對區間處在什麼位置，同一套方法在它從未見過的日子裡表現如何，一個倉位相比單純持有放棄了什麼，其他每一種寬度換作它們會怎樣，以及——對於一筆由你決定大小的資金——在價格始終停留在區間內的那些日子裡，它本可以從所收取的手續費中分到多少。還有把同一個區間反過來讀：它的每一半都是一個單邊倉位，頁面會說明價格若整段穿過，每一半會按什麼價格完成轉換。以及通過這個池做一筆兌換要付出什麼代價——取的是在不假設任何東西的前提下還能定價的最大一筆。再加上一份名錄，收錄本週最活躍的 v4 資金池所指定的每一個 hook，每一個被允許做什麼都從它自己的地址中讀出。一個 v4 池還會用平實的話說明它的 hook 被允許做什麼，同樣讀自 hook 自己的地址。一個地址可以被查詢：它持有的代幣能進入哪些資金池，以及它已經持有的 Uniswap v3 倉位——每一個都附帶它覆蓋的價格，以及這個池此刻是否落在其中。最後是把這一切用平實語言講一遍的說明，英文或土耳其文。沒有任何模型碰過上述任何一個數字，沒有一個數字是為了填補空缺而估出來的，那段文字裡也沒有地方能放進它自己編的數字。",
    analysePool: "找一個資金池 →",
    methodHeading: "它是怎麼工作的",
    methodSteps: [
      {
        step: "已核驗的資料",
        detail:
          "資金池的事實來自 Uniswap 子圖並在鏈上讀取，從不靠假設。價格會與這個池自己報告的狀態交叉核對。",
      },
      {
        step: "確定性的計算",
        detail:
          "波動率、價格帶和倉位區間都用純粹的 TypeScript 計算，所以同一個池永遠得出同樣的數字。",
      },
      {
        step: "AI 的解讀",
        detail:
          "由模型來解釋這些數字的含義。交到它手上的數字已經核對過，而它所遵守的約定裡沒有任何地方能放進一個數字。",
      },
    ],
    coverageHeading: "還沒有做的",
    coverage: [
      {
        version: "Uniswap v3",
        features: [
          {
            name: "gas，以及追著價格跑的代價",
            summary:
              "價格離開的區間必須關掉再重開才能跟上它，這要花 gas，也把紙面上的偏離變成了已經兌現的偏離。這裡任何地方都沒有把它算進去。",
          },
        ],
      },
      {
        version: "Uniswap v4",
        features: [
          {
            name: "一個 hook 實際上做了什麼",
            summary:
              "v4 頁面會說一個 hook 被允許做什麼，因為協議強制的就是這一層，而且它讀自 hook 自己的地址。讀懂合約程式碼、說出它拿這些權限做了什麼，是另一個問題，本應用不去嘗試。",
          },
          {
            name: "TWAMM 式的策略",
            summary:
              "把一筆大單攤到一段時間裡執行，而不是一次性撞向某一個價格點上的流動性。其中分析頁已經能回答的那一半就在這裡：一筆兌換相對當前價格處的流動性要付出什麼，以及它最多能給多大一筆兌換定價。把一筆單子排到時間上去執行是 hook 的事，而本應用不對 hook 的行為建模。",
          },
        ],
      },
    ],
    footer:
      "以上這些都還不存在。存在的是這一頁上面的全部內容：按名字找到的資金池、經過計算並交叉核對的數字，以及在展示之前已被核驗的文字。錢包可以連接，而它被要求提供的只有地址。本應用儲存的唯一東西，是讀者自己建立的 Telegram 綁定——一個地址和一個對話 id，向機器人傳送 /stop 的那一刻即被刪除，七天內也會從加密備份中消失——這裡也沒有任何東西能代你簽名或傳送交易。",
  },

  pool: {
    back: "← LiquidityWise",
    invalidAddress:
      "那不是一個以太坊地址。地址是 0x 後面正好跟 40 個十六進位制字元。",
    loading: "正在讀取 Uniswap 的即時資料……",
  },

  /*
   * Facts about the pool, and the sentence that keeps them from being read as
   * something else. The gap between "the pool collected this" and "you would
   * have earned this" is where a reader is likeliest to fill in a number nobody
   * gave them.
   */
  activity: {
    heading: "這個資金池實際做了什麼",
    volume24h: "成交量，24 小時",
    volume7d: "成交量，7 天",
    volume30d: "成交量，30 天",
    fees30d: "收取的手續費，30 天",
    feesNote: "整個池子的，由當時流動性處於活躍狀態的所有人分享。",
    tvl: "總鎖倉價值",
    occupancySentence: (days: string, inside: string, outside: string, crossed: string) =>
      `最近 ${days} 天裡，有 ${inside} 天全天都在這個區間內，${outside} 天全天都在區間外，還有 ${crossed} 天越過了某一邊。`,
    undeterminedNote:
      "越過某一邊的那一天，有一部分時間在區間內、一部分在區間外，而資料來源給出的當日最高價和最低價說不出各佔多少。",
    feesWhileInside: "全天都在區間內的那些日子所收取的手續費",
    /*
     * Shown instead of that figure when the pool's hook may take a share of a
     * swap. The fees are still real; what cannot be stated is their relationship
     * to a position, which is the only reason anyone reads the figure.
     */
    feesWithheld: "這個池子不予顯示",
    feesWithheldNote:
      "這個池子的 hook 被允許從一筆兌換中抽取一份，而資料來源裡沒有任何東西能把 hook 的那一份和流動性提供者的那一份分開。上面的手續費是這個池子收取的金額，這是事實；把其中一部分歸到這個區間上，則是一個誰也無法核對的、關於某個倉位的說法。",
    inSample:
      "這些正是畫出這個區間所依據的同一批日子，所以它們展示的是區間被如何擬合出來的，而不是在檢驗它是否站得住腳——而且這個區間以今天的價格為中心，一個月前誰也開不出這樣一個倉位。請把它們讀作這個池子最近的走勢與區間的相對位置，而不是一次回測。",
    notYourEarnings:
      "這些都不是一個倉位會賺到的：它們是整個池子收取的。一筆資金本可以從中分到多少——它在這些兌換發生時佔活躍流動性的份額——就在正下方那一塊，而且即便是那個，也只有手續費，再無其他。",
  },

  /*
   * The half of the fee question this application used to refuse.
   *
   * The refusal was honest while it lasted: the figures above are the pool's,
   * and turning them into a position's needs a size and a share of the active
   * liquidity. Both are read now, so the page answers instead of declining —
   * and every sentence here exists to stop the answer being read as a yield.
   */
  deposit: {
    heading: "一筆資金本可以收到多少",
    unavailable: "對這個池子，算不出一筆資金本可以從那些手續費中分到多少。",
    withheldNote:
      "原因和上面那個數字一樣：這裡的 hook 可能從兌換中抽走一份，而資料來源沒有把它的份額和提供者的份額分開。一個無法歸到這個區間上的總額，其中的一部分同樣無法歸到投進這個區間的一筆資金上。",
    deposited: "投入金額",
    depositedNote: "這一塊是按這個金額算出來的。在上面的表單裡改它。",
    collected: "它本可以分到的手續費",
    collectedNote: (days: string) => `在價格從未離開區間的那 ${days} 天裡。`,
    ofDeposit: "相對投入金額",
    ofDepositNote:
      "這些手續費相對投進去的錢，只針對那些日子，別的日子不算。這不是年化利率，這裡也沒有任何東西把它變成年化。",
    sentence: (deposit: string, days: string, poolFees: string, yourFees: string) =>
      `在價格從未離開這個區間的那 ${days} 天裡，這個池子收取了 ${poolFees} 的手續費。投進這個區間的 ${deposit} 資金本可以分到其中大約 ${yourFees}——按它自己的流動性佔那幾天裡實際處於活躍狀態的流動性的份額計算。`,
    unmeasurableNote: (days: string) =>
      `另有 ${days} 天也落在區間內，但資料來源沒有公佈這些天的手續費或活躍流動性，所以它們沒有計入總額。`,
    dilution:
      "投得更多，並不會按比例收到更多。份額是你的流動性除以包括你自己在內的所有人的流動性，所以超過一定規模之後，你新加進去的大部分只是在稀釋你已經有的那部分——這也正是為什麼可選的金額之間相差一千倍。",
    caveat:
      "只有手續費，只有已經發生過的日子。它假設倉位在每一天都是開著的，而且沒有任何東西因它而改變，它也沒有說接下來的三十天會付出多少。一個倉位相比單純持有這兩種代幣放棄了什麼，是這一頁更下面的那個對比，兩者必須放在一起讀。",
  },

  realizedFee: {
    heading: "它實際收取了多少",
    intro:
      "這個池子聲明的費率是一個數字。而這裡是兌換者實際付出的：用上面同樣那批日子，把它反除回去——某一天的手續費除以那一天的成交量。它不需要額外的請求，也不需要 hook 提供任何東西。",
    declared: "聲明的費率",
    /** How a stated fee was arrived at, where the protocol takes a cut on top. */
    statedNote: (lp: string, protocol: string) =>
      `${lp} 給流動性提供者，${protocol} 給協議，按 PoolManager 收取它們的方式合起來——這就是一個兌換者所付的，也是上面那些手續費的構成。`,
    noDeclared: "無",
    noDeclaredNote: "這個池子的 key 裡沒有帶費率。它的 hook 每筆兌換各設一個。",
    median: "典型的一天",
    spread: "最低到最高的一天",
    spreadValue: (lowest: string, highest: string) => `${lowest} – ${highest}`,
    aggregate: "整個窗口",
    aggregateNote:
      "整個窗口的手續費除以整個窗口的成交量，所以繁忙的一天比清淡的一天權重更大。",
    daysMeasured: "被測到的天數",
    daysMeasuredNote: (skipped: string) =>
      `窗口裡另有 ${skipped} 天沒有任何成交，或者缺少某個數字，所以無法從中除出一個費率。`,
    /*
     * The three verdicts. They exist as separate sentences rather than one with
     * a number in it because they are three different things to know, and the
     * one that matters most is the one a single wording would blur.
     */
    verdictMatches:
      "在每一個被測到的日子裡，兩者都是一致的。聲明的費率就是實際收取的費率。",
    verdictDiffers: (differing: string, measured: string) =>
      `兩者並不一致。在被測到的 ${measured} 天裡，有 ${differing} 天這個池子收取的不是它聲明的費率，所以上面那個費率檔描述的是這個池子被建立時的樣子，而不是一筆兌換的實際代價。`,
    verdictNoneDeclared:
      "沒有可供對照的東西：這個池子根本沒有聲明任何費率。這裡的數字是它的 hook 實際設定的。",
    notLpShare:
      "這些都不是最終到達流動性提供者手上的。這個池子的 hook 被允許從一筆兌換中抽取一份，而資料來源沒有把 hook 的那一份和提供者的那一份分開。這些數字說的是一筆兌換花了多少，而不是誰收到了它。",
    unavailableHeading: "這個池子收取多少，無法測出",
  },

  outOfSample: {
    heading: "在它從未見過的日子裡檢驗",
    showFolds: "顯示每一段",
    intro: (horizon: string) =>
      `上面每一個數字都是對它所描述的那些日子擬合出來的。這裡的不是。這套方法被往回退了 ${horizon}，只用那個時點之前的價格重跑了一遍，並以那個時點的價格為中心——那是一個站在當時的人真的能看到的價格。然後把它蓋在隨後發生的那些日子上，整件事再沿著歷史往回重複，能重複多少次就重複多少次。`,
    folds: "檢驗輪數",
    foldsNote: "歷史長度夠先擬合出一條價格帶、再檢驗它，這樣的次數有多少。",
    fullyInside: "全天在內的天數",
    fullyOutside: "全天在外的天數",
    undetermined: "越過了某一邊的天數",
    verdict: (inside: string, measured: string, folds: string) =>
      `在 ${folds} 輪檢驗中，被測到的 ${measured} 天裡有 ${inside} 天完全落在這套方法當時會畫出的價格帶內。`,
    foldPeriod: "被檢驗的天數",
    foldVolatility: "擬合出的波動率",
    foldVerdict: "內 / 外 / 越過",
    foldsCaption: "這套方法被檢驗過的每一段，最早的在前",
    foldColumns:
      "每一行是一輪：它被檢驗過的天數、它自己那次擬合測出的波動率——不是上面那個數字——以及那些日子相對這次擬合產出的價格帶處在什麼位置。",
    /*
     * The two sentences that stop a total becoming a claim about the method.
     * Nobody held these bands, and the folds are not independent of each other.
     */
    notIndependent:
      "在一個池子上跑幾輪，並不能衡量這套方法多久成立一次，也說不出接下來會發生什麼。而且相鄰的擬合彼此重疊——一次用 31 個收盤價的擬合，比往前邁一個時間跨度要長——所以這些輪次之間並不互相獨立。",
    notHeld:
      "沒有人持有過這些價格帶。每一條都是這套方法在那一刻本會建議的東西，蓋在隨後確實發生的價格上——而上面那些日子，也就是建議區間所依據的那些日子，並不是這裡這些日子。",
    unavailableHeading: "這個池子無法做樣本外檢驗",
  },

  divergence: {
    heading: "與單純持有相比",
    intro:
      "在每一個價格上，這個區間裡的一個倉位相比單純持有這兩種代幣會值多少。這是精確的算術而非估算——但它只計入價格的變動，別的一概不算。它沒有說一個倉位會賺到多少手續費，而手續費恰恰就是流動性提供者為承擔這個差額所得到的報酬。",
    price: (base: string) => `${base} 的價格`,
    loss: "倉位相對持有",
    entryRow: "這是它的衡量起點——這個池子的當前價格。",
    impermanentNote:
      "這通常被稱為無常損失。只有價格回來了它才是「無常」的：在與開倉時不同的價格上關掉的倉位，已經把它兌現了。",
  },

  /*
   * The other thing the same range can be. It was on the front page's list of
   * what this application could not do, and what it needed turned out to be no
   * data at all: a range order's average price is fixed by the protocol's own
   * formulas and falls out of the two bounds already on the page.
   */
  rangeOrder: {
    heading: "透過這個區間賣出與買入",
    intro:
      "上面那個區間是雙邊的：價格兩側都有錢，只要價格停在兩者之間就一直在賺手續費。把它在當前價格處切開，每一半都是一種不同的工具。完全落在價格上方的倉位只持有一種代幣、別的什麼都沒有，當價格向上穿過這條帶子時，池子會把那種代幣賣成另一種。在價格下方則反過來。這就是所謂的區間掛單，而這個區間的兩半都各是一個。",
    selling: (token: string) => `賣出 ${token}`,
    buying: (token: string) => `買入 ${token}`,
    band: "價格帶",
    bandNote:
      "這個倉位所處的位置。它的內側邊緣是越過當前價格所在那一格之後的第一個價格步長，所以一開始它一點都不持有它要換成的那種東西。",
    average: "平均價格",
    averageNote: "如果價格整段穿過這條帶子，這次轉換折算下來是什麼價。",
    against: "相對當前價格",
    exact:
      "那個平均值是兩個邊界的幾何平均數——精確如此，而且不管兩個價格寫成哪個方向都一樣。它由協議自己關於一個倉位在帶子兩端各持有什麼的公式推出，而投入的金額會從中約掉：一百美元和一百萬美元按同樣的價格轉換。",
    onlyIfThrough:
      "而且只有價格整段穿過這條帶子才成立。中途折返的價格會讓這個倉位兩種代幣各持有一些，根本沒有單一的成交價——而那恰恰就是它上面那個區間要做的事，只不過是誤打誤撞碰上的。",
    notAnOrderBook:
      "這裡沒有任何東西為這次轉換排期，也沒有任何東西保證它發生。這不是訂單簿：價格永遠沒走到的一筆單子是再正常不過的結果，而不是失敗，這裡既沒有排隊也沒有等著的對手方。取而代之的是：當價格在帶子內時，這個倉位是在收取這個池子的手續費，而不是在支付它們。",
    unavailable: "這個區間沒有可以描述的單邊部分。",
  },

  /*
   * The one panel about using a pool rather than providing to it.
   *
   * It exists because nothing else here answers the first question anybody asks
   * of a pool, and it stops where the certainty does: at the edge of the price
   * step, because liquidity beyond it is a thing this application has not read.
   */
  swapDepth: {
    heading: "在這裡做一筆兌換要付出什麼",
    intro:
      "上面的一切都是關於提供流動性的。這一塊是關於使用它的。一個池子的流動性在它所依託的兩個價格步長之間是恆定的，所以只要一筆兌換停留在當前價格所在的那一格之內，就能用協議自己的公式給它定價、不必假設任何東西——而再往外一格就不行了，因為另一個倉位的流動性可能從那裡開始，而本應用並不讀取每一個價格上的流動性。",
    /*
     * "into the pool", because the panel above this one also has a leg called
     * "Selling WETH" and it means something else there: a position that sells as
     * the price passes it, rather than a swap sent now. Two labels reading the
     * same on one page is a reader mistaking one for the other.
     */
    selling: (token: string) => `把 ${token} 賣進這個池子`,
    amount: (amount: string, symbol: string) => `${amount} ${symbol}`,
    largest: "這裡能定價的最大一筆兌換",
    largestNote:
      "在價格走到它所在那一格的盡頭之前，能投進去多少。這不是上限：更大的一筆照樣能成交，只是這一頁說不出它的代價。",
    cost: "它放棄了什麼",
    costNote: "這筆兌換的平均成交價離螢幕上那個價格有多遠。",
    oneSideOnly:
      "只顯示了一個方向。價格離它所在那一格的盡頭已經近到：另一個方向剩下的餘地是個捨入誤差而不是一筆兌換，而這一頁不會列印它無法核對的數字。",
    geometric:
      "那個平均值是當前價格與這筆兌換結束時價格的幾何平均數——和上面那些單邊倉位所依據的是同一個恆等式，只是從交易的另一側看過去。穿過一條帶子的兌換支付它；坐在那條帶子裡的倉位收取它。",
    whyItDiffers:
      "兩個方向的規模不一樣，是因為價格落在它那一格裡的某個位置，而不是正中間。真正值得在不同池子之間比較的是這個規模本身：它是這個市場在價格移動之前能吸收的量，也正是為什麼有人會把一筆大單拆成很多小單，而不是一次發出去。",
    hookMayAlter:
      "這個池子的 hook 被允許改變一筆兌換的成本——在每筆兌換發生時重寫費率，由它自己而不是池子的曲線給這筆兌換定價，或者在事後從中抽取一份；具體是哪一種，上面的 hook 部分寫著。這裡的數字是池子的曲線所收取的，只有在 hook 不插手時才成立。這裡讀到的任何東西都無法說明它是否插手。",
    unavailable: "對這個池子，算不出一筆兌換要付出什麼。",
  },

  compare: {
    heading: "這個交易對的所有費率檔，並排放在一起",
    intro: (pair: string) =>
      `下面每個 ${pair} 池子都用同樣的時長、同樣的寬度和同樣的資金來讀取，所以它們的數字站在同一個基礎上。它們描述的是已經過去的日子，而不是將來的日子。v3 池子按費率排列，v4 池子按深度從深到淺排列，下方的說明解釋了原因；沒有一個是按它本可以賺多少來排名的。`,
    depositFeesNote: (days: string) => `在價格停留在區間內的 ${days} 天裡。`,
    daysInside: "完全在區間內的天數",
    daysInsideValue: (inside: string, measured: string) => `${measured} 天中的 ${inside} 天`,
    unavailable: "這個費率檔現在讀取不到。",
    open: "打開完整分析",
    link: "把費率檔並排放在一起",
    onlyOne: (pair: string) =>
      `${pair} 只在一個 v3 池子裡交易，沒有別的可以放在旁邊。`,
    readTogether:
      "手續費只是一半。一個區間相比單純持有兩種代幣所放棄的東西，寫在每個池子自己的頁面上，兩者必須一起讀。",
  },

  feeTiers: {
    heading: "這個交易對還在哪裡交易",
    intro: (pair: string) =>
      `${pair} 在不止一個費率檔上交易。每一個都是獨立的資金池，有自己的流動性、自己的價格歷史和自己的區間——上面那些數字只描述這一個。`,
    onlyOne: (pair: string) =>
      `在以太坊主網上，${pair} 只在這一個費率檔上交易。上面的一切都是關於整個交易對的，因為這個交易對就是這一個池子。`,
    thisOne: "你正在讀的就是這一個",
    feeTier: "費率檔",
    holds: "持有",
    reservesUnread: "這個池子持有什麼，無法從鏈上讀出。",
    open: "分析這個費率檔",
    /*
     * The sentence the panel exists to carry. A list of pools ordered beside
     * dollar figures invites exactly one conclusion, and it is the wrong one.
     */
    biggerIsNotBetter:
      "一個流動性更多的費率檔，只是有更大一群人在分同樣那些兌換手續費，而不是一個更好的去處。哪一個適合一個倉位，取決於價格走多遠、多久走一次，而那是逐池測量的——所以老老實實的比較辦法是把每一個都開啟、讀它自己的數字。你選的時間跨度和倍數會隨連結一起帶過去。",
    reservesNote:
      "這些是兩個代幣合約為每個池子報出的餘額，讀自鏈上而不是索引器。索引器自己的數字曾與它們對照過，把實際存在的量高估了 1.3 到 13 倍，所以不予顯示。之所以給兩個代幣數量而不是一個美元數字，是因為這裡每一個費率檔持有的都是同樣兩種代幣，比較它們不需要給任何東西定價。",
    unavailableHeading: "這個交易對的其他費率檔無法讀取",

    /*
     * The other protocol. On a v3 page the same two token contracts on v4; on
     * a v4 page, v4's other pools of the pair and then v3's. Both lists say
     * what "same pair" means here — the same two contracts — because ether and
     * wrapped ether are two different tokens to a pool, whatever they are to
     * a person.
     */
    onV3: "在 Uniswap v3 上",
    onV4: "在 Uniswap v4 上",
    v4Intro: (pair: string) =>
      `交易 ${pair} 的那些 v4 資金池——同樣的兩個合約。一個 v4 交易對可以有很多個池子：費率是任意數值，價格步長是自由的，而且每一個 hook 都會再造出一個。`,
    v4None: (pair: string) => `沒有任何 Uniswap v4 資金池用這兩個合約交易 ${pair}。`,
    v4OnlyThis: (pair: string) => `在 v4 上，${pair} 只在這一個池子裡交易。`,
    v3Intro: (pair: string) => `交易 ${pair} 的那些 v3 資金池——同樣的兩個代幣合約，在各個費率檔上。`,
    v3None: (pair: string) => `沒有任何 Uniswap v3 資金池用這兩個合約交易 ${pair}。`,
    v3NoNative:
      "這個池子持有的是鏈自己的以太幣，而 v3 做不到：v3 的每一種貨幣都是一個代幣合約。與它最接近的那些 v3 池子交易的是包裝以太幣，對一個池子來說那是另一種代幣。",
    depth: "當前價格處的深度",
    depthValue: (ether: string) => `≈ ${ether} ETH`,
    stateUnread: "這個池子的流動性無法從鏈上讀出。",
    hook: "hook",
    noHook: "無 hook",
    hookAltersSwaps: "可能改變一筆兌換的代價",
    priceStep: (step: string) => `步長 ${step}`,
    v4Ordering:
      "按當前價格處的深度排序——也就是這個池子的活躍流動性與價格，讀自 PoolManager 的儲存——因為一個 v4 交易對大多是些有人初始化之後就撂下的池子，而深度正是能把它們區分開的東西。它說明一筆兌換能動用多少，卻完全沒說哪個池子更好：更深的池子只是有更大一群人在分同樣那些手續費。",
    moreNotShown: (count: string) => `另有 ${count} 個未顯示；它們比這些更淺。`,
    v4Unavailable: "這個交易對的 v4 資金池無法讀取",
    v3Unavailable: "這個交易對的 v3 資金池無法讀取",
  },

  /*
   * The same method at every width the form offers, on one page. The two day
   * counts are different kinds of figure, and the note under the table says
   * which is which: the first is the fit, the second the check.
   */
  widths: {
    heading: "其他幾種寬度",
    intro:
      "同一套方法在表單提供的每一種寬度上各跑一遍，這樣取捨是看得見的而不是被告知的：更寬的區間能容納更多的日子，也把同樣一筆資金攤到更多價格上——那就是最後一列，而它是協議的算術而非估算。",
    width: "寬度",
    range: "區間",
    recent: (days: string) => `在內，佔最近 ${days} 天`,
    unseen: "在內，在它從未見過的日子裡",
    insideOf: (inside: string, total: string) => `${total} 天中的 ${inside} 天`,
    unseenNone: "歷史不夠長",
    feeShare: "在區間內時的手續費份額",
    feeShareValue: (times: string) => `${times}×`,
    chosen: "上面顯示的就是這個",
    columnsNote:
      "第一個天數是在每個區間各自所依據的那些日子上數出來的，所以它說的是那種寬度被如何擬合出來，而不是它撐得住撐不住。第二個是上面那項檢驗，對每一種寬度各跑一遍：把方法往回退一個時間跨度，再蓋到隨後發生的日子上。",
    /*
     * The one column that is a comparison rather than a reading, and the one
     * most easily read as a promise. It is exact arithmetic about a day inside
     * the range, and it says nothing about the days outside it — which is the
     * half the column beside it measures.
     */
    feeShareNote:
      "最後一列是：在價格停留在那個區間內的一天裡，同樣一筆資金會分到多少手續費，相對上面顯示的那種寬度——所以那一行是 1 倍。這是協議自己的倉位算術而不是估算：更窄的區間把同樣的錢變成更多流動性，鋪在更少的價格上。它假設這個池子其餘的流動性沒有變化，而一筆大到足以撼動它的資金不會讓這句話繼續成立；它也完全沒有說價格待在區間外的那些日子。",
    notAdvice:
      "這些沒有一個是推薦。更窄的區間在它撐住的那些日子裡分到更大的份額，在它沒撐住的日子裡則什麼都分不到，而這兩者哪一個更要緊，取決於這個倉位是為了什麼——那是這裡任何東西都不知道的。",
  },

  parameters: {
    heading: "調整區間",
    apply: "重新計算",
    /*
     * The same words label the figures in "how this range was drawn", so a
     * reader changing one can see which number they are changing.
     */
    horizonLabel: "看多遠",
    widthLabel: "多寬",
    depositLabel: "多少",
    days: (days: string) => `${days} 天`,
    sigma: (value: string) => `${value}σ`,
    /** A word for the offered widths; a width typed into the URL gets none. */
    widthChoice: (sigma: string, word: string | null) =>
      word === null ? sigma : `${word}（${sigma}）`,
    widthWords: { tight: "窄", medium: "中等", wide: "寬", veryWide: "很寬" },
    note: "時間跨度說的是把測出來的走勢往前攤多遠。它不改變測量本身：無論選哪個時間跨度，波動率始終來自最近 30 個完整的日子。寬度則把那個走勢乘上一個倍數；更寬的區間被離開的次數更少，而它不是一個置信水平。",
    fellBack:
      "所請求的內容有一部分無法讀取，所以在那些地方用了預設值。實際用到的時間跨度和寬度顯示在上面。",
    preferenceHint:
      "這隻改變本頁。要改變每個資金池開啟時的參數，請使用頁首裡的區間偏好。",
  },

  holdings: {
    heading: "這個地址持有什麼",
    intro:
      "在這個地址上找到的代幣，以及它們可以進入的資金池。除非你在下方要求 Telegram 提醒，這裡不儲存任何東西；而地址本身是公開資訊——任何人去查，看到的都是同一份清單。",
    forAddress: "地址",
    loading: "正在向各個代幣合約詢問這個地址持有什麼……",
    /*
     * The sentence that keeps the answer honest. Nothing can list an address's
     * tokens, so the width of the search is part of the answer.
     */
    howItLooked: (tokens: string, v3Pools: string, v4Pools: string | null) =>
      `一個代幣的餘額存放在這個代幣自己的合約裡，所以並不存在一份「某地址擁有什麼」的清單——只有可以被逐個詢問的代幣。這次詢問了其中 ${tokens} 個：以太坊主網上成交最活躍的 ${v3Pools} 個 Uniswap v3 資金池裡的每一種代幣${v4Pools === null ? "" : `，以及最近七天成交最多的 ${v4Pools} 个 v4 资金池里的每一种货币，其中也包括链自己的以太币`}。持有在這個集合之外的東西，之所以沒有出現在這一頁上，並不是因為這個地址沒有它。`,
    /*
     * Said out loud when the v4 net could not be cast, because a page that
     * listed only v3 pools and said nothing would read as "no v4 pool takes
     * what you hold", which nobody checked.
     */
    v4NotSearched:
      "沒有搜尋 Uniswap v4 資金池：它們的清單讀不出來。以太幣和 v4 資金池的各種貨幣沒有出現在這一頁上，原因僅此而已。",
    /** A row's protocol, beside its fee. The names are the protocol's own and are not translated. */
    hookTag: "hook",
    holdingsHeading: "找到的代幣",
    nothingFound:
      "被檢查的代幣裡，沒有一種在這個地址上被找到。這和一個空錢包不是一回事——請看上面這次搜尋是怎麼做的。",
    poolsHeading: "這些代幣可以進入的資金池",
    bothSides: "兩邊你都持有",
    oneSide: "你只持有一邊",
    bothSidesNote:
      "這個池子的兩種代幣都在這個地址上找到了，所以在這裡建倉不需要先做兌換。",
    oneSideNote:
      "這個池子的兩種代幣中找到了一種。在這裡建倉還需要另一邊，也就是要把你持有的一部分換掉。",
    moreNotShown: (count: string) =>
      `另有 ${count} 個未顯示。上面這些是其中成交最活躍的，按資料來源報告的順序排列——那是一個關於某個池子有多忙的說法，除此之外什麼也不是。`,
    analyse: "分析這個資金池",
    notAdvice:
      "這是一份「可以做什麼」的清單，不是一份「值得做什麼」的清單。這些池子裡哪一個適合什麼，取決於每個池子自己頁面上的那些數字，以及這個倉位是為了什麼——這兩件事這份清單都不知道。",
    unavailableHeading: "這個地址無法讀取",
    invalidAddress: "那不是一個以太坊地址，所以什麼都沒有去查。",
    noAddress: "在首頁連接一個錢包，這一頁就會顯示它持有什麼。",
  },

  v4: {
    heading: "一個 Uniswap v4 資金池",
    intro:
      "從它自己的 key 讀出來的、關於這個池子是什麼。一個 v4 池子不是一份獨立的合約：它住在同一個 PoolManager 裡面，由定義它的五樣東西的雜湊來命名——兩種貨幣、費率、價格步長，以及 hook。",
    poolId: "池 id",
    pair: "貨幣",
    fee: "費率",
    /*
     * Read from the pool's own key on the chain — the log that created it —
     * and never from the indexer, whose figure was measured to be the total
     * fee of the latest swap rather than the key's fee.
     */
    feeNote: (swap: string, lp: string, protocol: string) =>
      `讀自鏈上這個池子自己的 key。一筆兌換支付 ${swap}：其中 ${lp} 給流動性提供者，另外還有 ${protocol} 給協議。`,
    feeNoteNoProtocol:
      "讀自鏈上這個池子自己的 key。協議在此之上不另外抽取，所以這就是一筆兌換所支付的。",
    dynamicFee: "由 hook 逐筆兌換設定",
    dynamicFeeNote:
      "這個池子的 key 裡帶的是動態費率標誌而不是一個費率，所以一筆兌換的代價由 hook 在它發生的那一刻決定。這次讀取沒有觀察到任何一筆，這裡也沒有可以報告的費率。",
    /*
     * A list row for a pool whose key the chain did not answer for. The fee is
     * a fact about the pool that this read does not have, and nothing else —
     * not the indexer's figure — stands in for it.
     */
    feeUnread: "費率未讀出",
    feeUnreadNote:
      "這個池子的費率存放在它被建立時的 key 裡、在鏈上，而這次讀取沒能取到它。別的東西都不能替代它。",
    protocolFee: "協議費",
    protocolFeeNone: "無",
    protocolFeeNote:
      "在這個池子的費率之上，由協議在每一筆兌換中另外抽取。由治理設定，讀自鏈上這個池子的狀態。",
    protocolFeeByDirection: (token0: string, token1: string) =>
      `按方向不同而不同：賣出 ${token0} 時是前一個，賣出 ${token1} 時是後一個。`,
    priceStep: "價格步長",
    priceStepNote: (spacing: string) =>
      `在這個池子裡，一個倉位的兩條邊緣所能放置的最細步長——也就是它 ${spacing} 的 tick 間距。在 v4 裡它是這個池子 key 的一部分，所以和 v3 不同，不需要另外呼叫合約。`,
    nativeCurrency: "原生以太幣",
    nativeCurrencyNote:
      "這裡的零地址不是一個漏填的欄位。v4 允許一個池子持有鏈自己的以太幣而不是一個包裝代幣，這裡就是這種情況。",
    hookHeading: "這個 hook",
    noHook: "這個池子在執行時沒有 hook。",
    noHookNote:
      "沒有任何東西伴隨它的兌換或存取執行，所以它的行為和一個 v3 池子一樣。",
    hookMay: "它被允許做什麼",
    /*
     * One sentence per permission, under the moment a reader can picture it
     * at, with the protocol's own names folded away beneath. The names say
     * where in the protocol's code a hook is called; what a reader needs is
     * what that lets it do to a swap, a deposit or a withdrawal of theirs.
     * Every sentence is a "may": the address grants the moment, not the act.
     */
    permissionTopics: {
      swaps: "圍繞兌換",
      liquidity: "圍繞存入與取出",
      creation: "在這個池子被建立時",
      donations: "圍繞捐贈",
    } satisfies Record<HookTopic, string>,
    permissionWords: {
      beforeSwap:
        "在每一筆兌換之前執行，它可以在此拒絕這筆兌換，並且在費率為動態的池子上，設定這筆兌換要付多少。",
      afterSwap: "在每一筆兌換之後執行，它在此仍然可以拒絕這筆兌換。",
      beforeSwapReturnsDelta:
        "在池子給一筆兌換定價之前，從中取走代幣，或者投入它自己的代幣——所以這裡的一筆兌換不一定沿著這個池子自己的曲線走。",
      afterSwapReturnsDelta: "在池子給一筆兌換定價之後，從中抽取一份。",
      beforeAddLiquidity: "在每一次存入之前執行，它可以在此拒絕這次存入。",
      afterAddLiquidity: "在每一次存入之後執行，它在此仍然可以拒絕這次存入。",
      afterAddLiquidityReturnsDelta:
        "在一次存入進行時從中取走代幣，或者往裡面追加代幣。",
      beforeRemoveLiquidity: "在每一次取出之前執行，它可以在此拒絕這次取出。",
      afterRemoveLiquidity: "在每一次取出之後執行，它在此仍然可以拒絕這次取出。",
      afterRemoveLiquidityReturnsDelta:
        "在一次取出進行時從中抽取一份，或者往裡面追加代幣。",
      beforeInitialize: "在這個池子被建立之前執行一次。那已經發生過了。",
      afterInitialize: "在這個池子被建立之後執行一次。那已經發生過了。",
      beforeDonate:
        "在向這個池子的提供者捐贈之前執行，它可以在此拒絕這次捐贈。",
      afterDonate:
        "在向這個池子的提供者捐贈之後執行，它在此仍然可以拒絕這次捐贈。",
    } satisfies Record<HookPermission, string>,
    noPermissions:
      "圍繞兌換、存取或捐贈都沒有任何權限：協議在這些時刻一個都不會呼叫它。像這樣的 hook 仍然能做的，是為一個費率為動態的池子設定費率。",
    permissionNames: "協議對這些東西自己的叫法",
    /*
     * The other side of the swap warning. A hook that runs when a provider
     * withdraws can refuse the withdrawal — a hook that reverts reverts the
     * withdrawal with it — and one holding the returns-delta flag can take a
     * share of what comes out. Said above the list, like the swap warning,
     * for the reader who stops reading.
     */
    withdrawalWarning: (share: boolean): string =>
      share
        ? "當一個提供者取出時，這個 hook 會執行。它被允許拒絕一次取出，也被允許從取出的東西裡抽取一份。它究竟有沒有這樣做過，從這裡是無從得知的。"
        : "當一個提供者取出時，這個 hook 會執行，並且被允許拒絕一次取出。它究竟有沒有這樣做過，從這裡是無從得知的。",
    /*
     * The sentence this whole page exists to carry. A hook's permissions are not
     * stored anywhere — the address is the permission list — so this is the one
     * claim about a hook that can be made without trusting somebody.
     */
    hookAddressIsThePermission:
      "這些都是從這個 hook 自己的地址裡讀出來的。v4 不把一個 hook 的權限存放在任何地方：一個 hook 被部署到某個地址上，這個地址的最後十四個位元就拼寫出 PoolManager 會呼叫哪些回調，而 PoolManager 檢查的是這些位元，並不去問合約。所以這裡說的是這個 hook 可以做什麼，絕不是它做了什麼——一個被允許在每筆兌換上重寫費率的 hook，完全可能永遠返回同一個費率，而那從這裡是無從得知的。",
    alterSwapWarning:
      "這個 hook 被允許改變一筆兌換的成本或收益。任何從價格歷史推出來的數字——一個建議區間、一個費率檔、一個與單純持有的對比——都假設這個池子按它聲明的收費、按曲線所說的支付。在這裡這兩個假設都不安全，而這一切在一串價格序列裡都看不見。",
    /*
     * Replaced the line saying there was no analysis, on the day there was one.
     * What it has to do now is harder: say why a band drawn from price history
     * is as true here as anywhere, without letting that cover the fees, which
     * are the part a hook can move.
     */
    analysisScope:
      "下面是區間分析。這個區間來自已經發生過的價格，所以它在這裡和在一個沒有 hook 的池子上一樣成立——hook 沒法追溯地改變價格走到過哪裡。hook 能改變的是一筆兌換的代價，所以這個池子實際收取的費率，是從它收到了多少測出來的，而不是取自上面那個費率。",
    unavailableHeading: "這個資金池無法讀取",
    invalidId:
      "那不是一個 v4 池 id。一個 v4 池子由一個 32 位元組的雜湊來命名——0x 後面跟 64 個十六進位制字元——而不是由一個合約地址來命名。",
    noId: "貼上一個 v4 池 id，就能看到這個池子是什麼、它的 hook 可以做什麼。",
    loading: "正在從索引器和鏈上讀取這個 v4 資金池……",
  },

  /*
   * The page a reader reaches by following something that is not here: an old
   * link, a typo, an address pasted into the path instead of the box. The
   * framework's own answer is an unstyled English line, which on a site
   * published in two languages is the one screen that forgets which it is in.
   */
  notFound: {
    title: "這裡沒有頁面",
    body: "你跟過來的這個地址，沒有指向本應用提供的任何東西。一個資金池是通過它的地址、或者對 v4 來說通過它的 id 開啟的——這兩者都填進搜尋框，而不是填進路徑裡。",
    search: "找一個資金池 →",
  },

  /*
   * The directory, and the line it will not cross.
   *
   * Every sentence here is about what the protocol enforces, because that is the
   * only thing about a hook this application can check. A name, a category, a
   * "verified" badge — all of them would be somebody's claim republished, and
   * the reader would have no way to tell which parts of the page were which.
   */
  hooks: {
    heading: "正在 Uniswap v4 上執行的那些 hook",
    loading: "正在讀取本週最活躍的 v4 資金池……",
    intro:
      "每一個 v4 資金池都可以指定一個 hook：一份合約，PoolManager 會在一筆兌換、一次存入、一次取出中的固定時刻呼叫它。至於是哪些時刻，那不是誰作出的承諾。它被挖進了這個 hook 的地址裡——低十四位就是那份清單，而協議拒絕為清單之外的任何事去呼叫這份合約。",
    onlyPermissions:
      "這就是這一頁所知道的全部，而它之所以值得知道，恰恰因為它是被強制執行的而不是被聲稱的。一個 hook 拿這項權限做了什麼，寫在它的程式碼裡。本應用不讀程式碼，也不儲存任何人背書過的 hook 名單——那兩樣都會是它無法核對的說法，卻擺在它能核對的數字旁邊。",
    /*
     * Phrased so no count is followed by a noun that would have to agree with
     * it. A list of one pool is not a case this page will meet — the week's
     * busiest days name hundreds — but "1 pools" is the kind of sentence that
     * only ever appears in front of somebody.
     */
    window: (pools: string, hooked: string, hookless: string) =>
      `讀自本週最活躍的那些 v4 日子裡的資金池——共 ${pools} 個。其中 ${hooked} 個指定了 hook；${hookless} 個沒有指定，行為和一個 v3 池子一樣。`,
    ordering:
      "按這些池子裡有多少個執行著各個 hook 來排序。那是一個池子數量，除此之外什麼也不是：跑在很多池子上的 hook，只是有人用它部署了很多池子。",
    runs: (count: string) => `執行在其中 ${count} 個上`,
    poolsHeading: "它在哪裡執行",
    moreNotShown: (count: string) => `另有 ${count} 個`,
    none: "本週最活躍的那些 v4 日子裡，沒有任何池子指定了 hook。",
    unavailable: "本週的 v4 資金池無法讀取，所以沒有名錄可以顯示。",
    fromHome: "檢視每一個 hook →",
  },

  /*
   * The one panel here that describes somebody's own money.
   *
   * It says so, and it says what that does and does not mean: the same list is
   * public, anybody can read it for any address, and nothing about it is kept.
   */
  positions: {
    heading: "這個地址已經持有的倉位",
    intro:
      "上面的一切都是這個地址可以做什麼——它的代幣能開啟哪些池子。這一塊則是它已經做了什麼。兩個協議的倉位都是被某一份合約持有的一個代幣，而這兩份合約都會被問到每一個代幣是什麼。v3 那一份還能列出一個地址名下的代幣；v4 那一份不能，所以那份清單來自索引器，而其中每一個 id 都會被放回鏈上，去問它歸誰所有。",
    none: "這個地址不持有任何一個協議的 Uniswap 倉位代幣。",
    noneOpen:
      "這個地址持有的每一個倉位代幣都已經關閉了。已關閉的那個是一張「曾經有過一個倉位」的憑據，而不是一個倉位。",
    counts: (held: string, open: string, closed: string) =>
      `${held} 個倉位代幣，其中 ${open} 個裡面還有流動性，${closed} 個已經關閉。`,
    inRange: "此刻正在賺取",
    outOfRange: "在它的區間之外",
    rangeUnknown: "這裡還沒有人做過兌換",
    analyse: "分析這個資金池 →",
    /*
     * Read from the pool's own fee accounting and differenced, not estimated.
     * Deliberately not a rate: it says what has accrued, not over how long or
     * at what pace, because neither follows from the figure.
     */
    feesEarned: (amount0: string, symbol0: string, amount1: string, symbol1: string) =>
      `已賺到但尚未取出：${amount0} ${symbol0} 和 ${amount1} ${symbol1}。`,
    feesNone: "目前還沒有賺到可以取出的東西。",
    feesUnread: "它賺到了多少，無法讀出。",
    everyPrice: "這個池子能表達的每一個價格",
    moreNotShown: (count: string) => `另有 ${count} 個是開著的，沒有列在這裡。`,
    readCap: (read: string, held: string) =>
      `${held} 個裡讀了 ${read} 個。其餘的不在這一頁上，這是這一頁的限制，而不是這個地址的限制。`,
    /*
     * Two protocols mean two ways to fail. The counts beside this cover the
     * other protocol only, and saying so is the difference between a partial
     * answer and a wrong one.
     */
    unreadProtocol: (protocol: string) =>
      `這次沒能讀出 Uniswap ${protocol} 的倉位，所以這裡的每一個數字都只關乎另一個協議。`,
    unavailable: "這個地址的倉位無法讀取。",
    publicNote:
      "一個倉位的所有者在鏈上，所以這份清單是公開的：任何人都能為同一個地址讀出同樣的一份，而且它沒有透露任何這個地址不曾因為持有這些代幣而公開過的東西。除非你在下方要求 Telegram 提醒，這裡不儲存任何東西；這一頁上也沒有任何數字是估值——一個區間不是一個倉位值多少錢。",
  },

  wallet: {
    heading: "連接一個錢包",
    intro:
      "連接一個錢包，這一頁就能看到這個地址持有哪些代幣，並把這些代幣可以進入的資金池顯示給你。它讀取地址；在這裡，對一個錢包的要求僅此而已。",
    connect: "連接錢包",
    connecting: "正在等待錢包……",
    connectedAs: "已連接為",
    showHoldings: "顯示它持有什麼",
    forget: "忘掉這個地址",
    /*
     * The sentence that replaced "never connects a wallet". The half that is
     * still true is the half worth keeping, and it is the half that matters.
     */
    readOnly:
      "唯讀。本應用向錢包索取的是它的地址，從不索取簽名：這裡沒有任何程式碼能簽署一條訊息或傳送一筆交易，兩次訪問之間也不儲存任何關於錢包的東西。",
    notices: {
      "wallet-not-found":
        "在這個瀏覽器裡沒有找到錢包。瀏覽器錢包擴展會放一個進去；沒有它，這一頁上什麼都不會變。",
      "wallet-request-declined":
        "這個請求在錢包裡被拒絕了。什麼都沒有讀取，也什麼都沒有傳送。",
      "wallet-request-failed":
        "無法向這個錢包索取地址。什麼都沒有讀取，也什麼都沒有傳送。",
      "wallet-no-account":
        "錢包作出了回應但沒有給出地址，這通常意味著它被鎖住了，或者沒有選中任何帳戶。",
    },
  },

  telegram: {
    heading: "Telegram 提醒",
    intro:
      "當這個地址的某個倉位接近它的區間邊緣、離開區間或重新回到區間內時，通過 Telegram 獲知。按鈕會把你帶到本站的機器人；在那裡按下「開始」，那個對話就會與這個地址綁定。儲存的只有這個地址和對話的數字 id——別的什麼都沒有——你向機器人傳送 /stop 或在這裡忘記綁定的那一刻，兩者都會從伺服器上刪除，並在七天內從它的加密備份中消失。檢查的頻率取決於執行它的伺服器。",
    connect: "連接 Telegram",
    connected: (address: string) => `這個瀏覽器已綁定：正在關注 ${address}。`,
    pending: "綁定等待中：在 Telegram 裡開啟機器人的對話並按下「開始」。",
    forget: "忘記綁定",
    notConfigured: "這臺伺服器上沒有設定 Telegram 提醒。",
    publicNote:
      "關注一個地址不需要擁有它——倉位是公開的，提醒說的也不會超出這份清單所說的。機器人讀取鏈上資料併傳送訊息；它無法簽署或傳送任何東西。",
    linked: (address: string) =>
      `已綁定。當 ${address} 的某個倉位接近區間邊緣、離開區間或回到區間內時，你會在這裡收到訊息。傳送 /stop 結束。`,
    unknownStart:
      "這個連結無法識別或已過期。請在網站上再按一次「連接 Telegram」。",
    alreadyClaimed:
      "這個連結已被另一個對話使用。請在網站上再按一次「連接 Telegram」獲取新的連結。",
    stopped: "已停止。這個對話現在不再關注任何東西。記錄已從伺服器刪除，七天內也會從加密備份中消失。",
    nothingToStop: "這個對話本來就沒有關注任何東西。",
    help:
      "這個機器人只關注你在網站上綁定的地址，也只在某個倉位接近區間邊緣、離開或重新進入它的區間時說話。傳送 /stop 結束。",
    storeDown: "現在無法檢查綁定。請一分鐘後再試。",
    left: (pair: string, protocol: string, range: string) =>
      `⚠️ ${pair}（${protocol}）已離開它的區間：${range}。在價格回來之前，它只持有一種代幣，什麼也賺不到。`,
    nearing: (pair: string, protocol: string, range: string, price: string, edge: string) =>
      `⏳ ${pair}（${protocol}）已接近它的區間邊緣：${range}。目前價格為 ${price}；越過 ${edge} 後，它將只持有一種代幣，什麼也賺不到。`,
    entered: (pair: string, protocol: string, range: string) =>
      `✅ ${pair}（${protocol}）回到了它的區間內：${range}。又在賺取了。`,
    opened: (pair: string, protocol: string, range: string) => `新倉位：${pair}（${protocol}），${range}。`,
    closed: (protocol: string, tokenId: string) => `已關閉：${protocol} 倉位 #${tokenId}。`,
    footer:
      "僅供參考——不構成財務建議。讀自公開的鏈上資料；這裡沒有任何東西能代你操作。",
  },

  search: {
    label: "一個交易對、一個 v3 池地址，或一個 v4 池 id",
    placeholder: "WETH/USDC",
    help: "輸入一個像 WETH/USDC 這樣的交易對，貼上一份 v3 池合約的地址，或者貼上一個 v4 池 id——也就是一個 v4 池子被命名所用的那個 32 位元組雜湊。唯讀：本應用從不簽署任何東西，也從不傳送交易。",
    submit: "查詢資金池",

    heading: "匹配的 Uniswap v3 資金池",
    resultsFor: (terms: string) => `代幣與 ${terms} 匹配的資金池。`,
    empty: (terms: string) =>
      `以太坊主網上沒有任何 Uniswap v3 資金池的代幣與 ${terms} 匹配。`,
    emptyHint: "請檢查拼寫，或者直接貼上該池的地址。",

    /*
     * The v4 list, beneath the v3 one. Two lists rather than one merged list,
     * because they are ordered by different numbers — what a pool holds, and
     * what its active liquidity is worth — and one order over both would be
     * comparing them.
     */
    v4Heading: "匹配的 Uniswap v4 資金池",
    v4Empty: (terms: string) =>
      `以太坊主網上沒有任何 Uniswap v4 資金池的貨幣與 ${terms} 匹配。`,
    v4Depth: "當前價格處的深度",
    v4DepthValue: (ether: string) => `≈ ${ether} ETH`,
    v4DepthNote:
      "這個池子此刻的活躍流動性值多少，讀自 PoolManager 自己的儲存——不是這個池子持有什麼，那是任何 v4 池子都不會自行報告的。",
    v4StateUnread: "這個池子的流動性無法從鏈上讀出。",
    v4Hook: "Hook",
    v4NoHook: "無",
    v4HookAltersSwaps: "可能改變一筆兌換的代價",
    v4Ordering:
      "名字與你所搜尋的完全一致的池子排在最前。之後的順序按每個池子在其當前價格處的深度——也就是它的活躍流動性與價格，讀自 PoolManager 的儲存，並用資料來源推匯出的價格換算到同一把尺子上。這不是這個池子持有什麼：每一個 v4 池子的代幣都一起躺在同一個 PoolManager 裡，鏈上沒有任何東西按池子報告它們。索引器自己的流動性數字曾與鏈上對照過，在其中一個最活躍的池子上差了百分之十五，這就是它不被採用的原因。",

    /*
     * The ordering is the one claim a list makes, so it is stated rather than
     * left to be inferred from the order itself.
     */
    ordering:
      "名字與你所搜尋的完全一致的池子排在最前。之後的順序按每個池子實際持有什麼——讀自代幣合約本身，並用資料來源推匯出的價格換算到同一把尺子上。它以前按資料來源報告的各池鎖倉價值排序，而那個數字錯得足以把這份清單重新排一遍：曾有一個池子被以九百萬美元的報告流動性發布在這裡，而它的合約裡只有九千。",
    windowing:
      "這份清單取自資料來源針對你的搜尋詞報告為成交最活躍的那些池子，而一個清淡到落在那個集合之外的池子，根本走不到上面那個排序裡。這就是「在一個來源選擇返回的東西裡做排名」這件事老老實實的邊界：一個持有很多但很少成交的池子，可能根本不在這一頁上。",
    dormantNote:
      "一個月內沒有任何活動的資金池不會列出。區間是從最近一個月的價格畫出來的，沒有這一個月的池子無從畫起——開啟它也只會告訴你這一點。",
    /*
     * The v4 window is not the terms. The source cannot answer a search over
     * every v4 pool before this page stops waiting — measured, not assumed —
     * so the search runs over the week's busiest pool-days, and a page that
     * did not say so would let a reader conclude a pool does not exist.
     */
    v4Windowing:
      "這份清單取自最近七天在以太坊主網上成交最多的那些 v4 資金池——最活躍的一千個「池子·日」，合起來是幾百個池子——而比這更清淡的池子走不到這一頁上。資料來源沒法在這一頁停止等待之前，答完一次橫跨每一個 v4 池子的搜尋，所以這個窗口是按近期活躍度劃的，而不是按你的搜尋詞劃的：一個存在但本週沒有成交的池子，不在這裡。",
    /*
     * The sentence that does the real work on this page. Search is what lets
     * someone reach a pool they did not go looking for.
     */
    symbolWarning:
      "一個符號來自這個代幣自己的合約，而部署一個自稱 USDC 的代幣不花一分錢。每個交易對下面的合約地址，才是把兩種代幣區分開的東西。",

    feeTier: "費率檔",
    holds: "持有",
    reservesUnread: "這個池子持有什麼，無法從鏈上讀出。",
    moreNotShown: (count: string) =>
      `另有 ${count} 個未顯示。上面這些是其中成交最活躍的，按資料來源報告的順序排列——那是一個關於某個池子有多忙的說法，除此之外什麼也不是。`,
    analyse: "分析這個資金池",
    /** Under the v4 list: where each row's fee came from, and why the row can say it was not read. */
    v4FeeNote:
      "每個池子的費率讀自鏈上它被建立時的 key，而不是讀自資料來源——資料來源那個費率數字曾被測出是最近一筆兌換所付的總額、包含協議抽成在內，並不是這個池子自己的費率。key 讀不出來的那一行會明說。",

    unavailableHeading: "這次搜尋無法執行",
    rejected: {
      empty: "輸入一個像 WETH/USDC 這樣的交易對，或者一個池地址。",
      length: (min: number, max: number) =>
        `一個搜尋詞的長度在 ${min} 到 ${max} 個字元之間。`,
      unsupportedCharacters:
        "一個搜尋詞可以包含字母、數字，以及出現在代幣符號裡的那些標記——別的都不行。",
    },
  },

  report: {
    steps: {
      pool: "讀取這個池子的配置",
      snapshot: "讀取這個池子當前的市場狀態",
      history: "讀取這個池子的每日價格歷史",
      volatility: "測量價格走了多少",
      band: "構建價格帶",
      range: "把價格帶對齊到這個池子能表達的價格上",
      divergence: "把這個區間與持有兩種代幣作對比",
      activity: "讀取這個池子在所測窗口內做了什麼",
    },
    noRangeHeading: "這個池子沒有區間",
    stoppedWhile: (step: string) => `這件事在${step}時停了下來。`,
    poolSummary: (protocol: string, fee: string, chain: string) =>
      `Uniswap ${protocol} · ${chain} · ${fee}`,
    feePerSwap: (fee: string) => `每筆兌換收取 ${fee} 手續費`,
    /** A v4 pool whose protocol takes a cut on top of the pool's own fee. */
    feePlusProtocol: (fee: string, protocol: string) =>
      `每筆兌換收取 ${fee} 手續費，另加 ${protocol} 給協議`,
    /** Stands where the fee would, for a v4 pool whose hook sets one per swap. */
    noDeclaredFee: "費率由它的 hook 在每筆兌換上設定",
    caveatsHeading: (count: number) =>
      count === 1 ? "有一條附註適用於這些數字。" : `有 ${count} 條附註適用於這些數字。`,
    caveatsAriaLabel: "附註",

    /*
     * The range, as two prices. Every price on the page is written the way
     * round that makes it at least one — one unit of the dearer token, priced
     * in the cheaper — and the intro says which token that is, so the figures
     * under it can be read without a second thought. The ticks those prices
     * encode are in the technical details at the end, where a reader who
     * wants to check them can, and a reader who does not is never made to.
     */
    contentsHeading: "本頁內容",
    contentsLabel: "這份分析的各個部分",
    rangeHeading: "建議價格區間",
    rangeIntro: (base: string, quote: string) =>
      `這個池子裡的一個倉位會在哪裡處於活躍狀態，以 1 ${base} 摺合多少 ${quote} 來表示。`,
    rangeValue: (lower: string, upper: string, quote: string, base: string) =>
      `${lower} – ${upper} ${quote}/${base}`,
    rangeDistances: (down: string, up: string) =>
      `比當前價格低 ${down}，高 ${up}。`,
    rangeMeaning:
      "在這兩個價格之間，一個倉位賺取它在這個池子兌換手續費中的份額。在它們之外，它只持有一種代幣，並且在價格回來之前什麼也賺不到。",
    priceSentence: (base: string, price: string, quote: string) => `1 ${base} = ${price} ${quote}`,
    currentPrice: "當前價格",
    inRangeYes: "當前價格落在這個區間內。",
    inRangeNo: "當前價格落在這個區間之外。",
    inRangeYesNote: "在這裡開的倉位會立刻處於活躍狀態。",
    inRangeNoNote:
      "在這裡開的倉位只會持有一種代幣，並且在價格回到區間內之前什麼也賺不到。",
    beyondEdges: (below: string, above: string) =>
      `如果價格跌到區間下方，這個倉位最後只持有 ${below}；如果漲到區間上方，則只持有 ${above}。`,
    lowerTruncatedNote:
      "下邊緣停在了這個池子能表達的最低價格上，沒能走到價格帶本會把它放到的位置。",
    upperTruncatedNote:
      "上邊緣停在了這個池子能表達的最高價格上，沒能走到價格帶本會把它放到的位置。",
    /*
     * The month drawn through the range. The caption says what each mark is,
     * once, in the words the page uses for the same things; the day counts a
     * few panels down are the same days, counted.
     */
    chartLabel: "最近一個月的價格與建議區間的對照",
    chartCaption: (days: string) =>
      `最近 ${days} 天中的每一天：它的收盤價，以及從當日最低到當日最高的跨度。陰影帶是建議區間；實線是今天的價格。`,
    chartLegend:
      "實心點表示這一天全天都留在區間內；空心點表示它離開了區間或越過了某一邊。",

    /*
     * Where the range came from, in the words a reader has: how much the price
     * moves on a typical day, and what that comes to over the horizon. The
     * standard deviation is named in the notes, not in the labels.
     */
    basisHeading: "這個區間是怎麼畫出來的",
    basisIntro: (base: string, days: string) =>
      `來自 ${base} 的價格在最近 ${days} 個完整的日子裡實際走了多少——而不是來自對它接下來往哪走的預測。`,
    dailyMove: "典型的單日波動",
    dailyMoveNote: "在這個窗口內，一天價格變化的標準差。",
    horizonMove: (days: string) => `在 ${days} 天裡`,
    horizonMoveNote:
      "把同樣的波動攤到下面所選的時間跨度上：一個標準差，上下各一個。",
    widthValue: (multiplier: string) => `上下各為其 ${multiplier} 倍`,
    widthNote:
      "在下面選擇。更寬的區間被離開的次數更少，而攤在上面的同樣一筆資金，在任何單個價格上都更薄。",
    measuredOver: "測量範圍",
    measuredOverNote: (returns: string) => `有 ${returns} 個單日變化進入了計算。`,
    epilogue:
      "這個區間以今天的價格為中心，並按比例向上和向下畫出同樣的距離——減半和翻倍是同一種幅度——這也是那兩個百分比不一樣的原因。它描述的是價格已經走了多遠，而不是它會走到哪裡：它不是預測，寬度也不是置信水平。這裡沒有任何東西為一個倉位定規模，也沒有說該存入多少哪一種代幣。",
  },

  /*
   * Everything a reader checking the page against the chain would want, and
   * nothing a reader opening a position needs: the ticks the prices encode,
   * the blocks the figures were read at, the figures in the pool's own
   * direction. Folded away at the end of the report.
   */
  technical: {
    heading: "技術細節",
    summary: "上面這一頁所對照核查的那些 tick、區塊和數字。",
    lowerTick: "下邊 tick",
    upperTick: "上邊 tick",
    currentTick: "當前 tick",
    sourceReportedTick: (tick: string) => `資料來源報的是 ${tick}。`,
    noSourceTick:
      "資料來源沒有報出它自己的 tick，所以這次換算未經核驗。",
    tickSpacing: "tick 間距",
    tickSpacingNote: (step: string) => `可用邊緣之間 ${step} 的價格步長。`,
    width: "寬度",
    widthValue: (ticks: string, spacings: string) => `${ticks} 個 tick · ${spacings} 個間距`,
    poolPrice: "這個池子自己報的價格",
    quotePerBase: (quote: string, base: string) => `${quote}/${base}`,
    bandLower: "價格帶下界",
    bandUpper: "價格帶上界",
    bandNote: "對齊到 tick 網格之前的值，按這個池子自己的方向。",
    annualised: "年化波動率",
    annualisedNote:
      "每日對數收益率的樣本標準差，乘以 sqrt(365) 放大。",
    coverage: "覆蓋率",
    coverageNote: "這個窗口裡有多少是有連續每日價格支撐的。",
    sourceBlock: "來源區塊",
    noBlockTime: "沒有報出區塊時間。",
    fetchedAt: "取得於",
    fetchedAtNote: "這是響應到達的時間，而不是它所描述的時間。",
    lowerEdge: "下邊緣",
    upperEdge: "上邊緣",
    truncated: "已截斷",
    asAsked: "與所請求的一致",
  },

  explanation: {
    heading: "說明",
    pending: "正在撰寫說明……",
    unavailable: "這份分析沒有可用的說明。",
    /*
     * The two states a single paragraph can be in while the rest of the answer
     * is still arriving. Both keep the heading, so the reading order stays put
     * rather than the sections below jumping as each one lands.
     */
    sectionWriting: "仍在撰寫中……",
    sectionMissing: "這一部分沒能寫出來。",
    /*
     * Names the author, and draws the line. Prose written by a model sitting
     * under figures that were computed and cross-checked should say which is
     * which, or a reader is entitled to assume the same hand produced both.
     */
    writtenBy: (model: string) => `由 ${model} 撰寫。上面那些數字不是。`,
    sections: {
      whatThisRangeMeans: "這個區間意味著什麼",
      ifPriceLeavesTheRange: "如果價格離開了這個區間",
      whatTheVolatilitySays: "波動率說明了什麼",
      whatThisDoesNotCover: "這份說明沒有涵蓋什麼",
    },
  },

  /*
   * Every sentence this application says about a read that did not go well.
   *
   * They lived in the data layer until search made a second language matter:
   * an adapter raised an English sentence and it travelled, unchanged, to a page
   * being read in Turkish. Now the adapter raises a code and the wording is
   * here, where all the other wording is.
   *
   * `satisfies` is what keeps this honest. Add a code to `notices.ts` and this
   * object stops compiling until it says something about it, in both languages.
   */
  notices: {
    failure: {
      "invalid-pool-address":
        "池地址必須是 0x 後面跟 40 個十六進位制字元，而且不能是零地址。",
      "invalid-search-terms":
        "一次資金池搜尋接受一到兩個短的搜尋詞，由字母、數字，以及出現在代幣符號裡的那些標記組成。",
      "market-data-not-configured":
        "這臺伺服器上沒有配置 Uniswap v3 的行情資料。",
      "chain-data-not-configured":
        "這臺伺服器上沒有配置鏈上讀取。",
      "explanation-not-configured":
        "本應用沒有被配置為撰寫說明，所以不顯示任何說明。",
      "market-data-timed-out":
        "行情資料請求超時。",
      "market-data-unreachable":
        "無法連接到行情資料來源。",
      "market-data-credentials-rejected":
        "行情資料來源拒絕了所配置的憑據。",
      "market-data-rate-limited":
        "超出了行情資料來源的速率限制。",
      "market-data-unreadable":
        "行情資料來源返回了一個無法讀取的響應。",
      "market-data-malformed":
        "行情資料來源返回了一個本應用無法核驗的響應。",
      "market-data-indexing-errors":
        "行情資料來源報告了索引錯誤，所以它的數字不能當作已核驗的。",
      "market-data-stale":
        "行情資料來源落後鏈太多，這些數字不能當作是當前的。",
      "market-data-future-block-time":
        "行情資料來源報出的區塊時間比這臺伺服器的時鐘還靠前，所以它的數字無法核驗。",
      "chain-data-timed-out":
        "鏈上資料請求超時。",
      "chain-data-unreachable":
        "無法連接到鏈上資料來源。",
      "chain-data-credentials-rejected":
        "鏈上資料來源拒絕了所配置的憑據。",
      "chain-data-rate-limited":
        "超出了鏈上資料來源的速率限制。",
      "chain-data-unreadable":
        "鏈上資料來源返回了一個無法讀取的響應。",
      "chain-data-malformed":
        "鏈上資料來源返回了一個本應用無法核驗的響應。",
      "chain-aggregator-unverified":
        "餘額是通過鏈上的一份輔助合約讀取的，而那個地址上的程式碼不是本應用當初信任的那份程式碼，所以沒有通過它讀取任何東西。",
      "pool-not-found":
        "在以太坊主網上，沒有為這個地址找到任何 Uniswap v3 資金池。",
      "pool-contract-not-found":
        "在以太坊主網上，這個地址上沒有任何 Uniswap v3 池合約作出回應。",
      "pool-configuration-inconsistent":
        "從兩個來源拼出來的池配置無法核驗。",
      "pool-history-insufficient":
        "這個池子還沒有足夠多的完整每日價格歷史可供分析。",
      "pool-history-never-traded":
        "這個池子存在，但從未發生過任何兌換，所以沒有可用來測量區間的每日價格。",
      "pool-history-dormant":
        "這個池子在讀取這些每日價格的那段期間開始之前就停止了交易，所以沒有可用來測量區間的近期歷史。等待不會改變這一點——只有池子重新被使用才會。",
      "volatility-invalid-input":
        "為這次計算提供的價格歷史，不是一份有效的規範化歷史。",
      "volatility-insufficient-history":
        "這個池子沒有足夠多連續的每日價格來測量波動率。",
      "volatility-unverifiable":
        "波動率計算得出了一個本應用無法核驗的結果。",
      "band-invalid-input":
        "為這條價格帶提供的行情資料無效，或者快照和波動率描述的不是同一個池子。",
      "band-no-current-price":
        "這個池子的當前價格不可用，所以無法為一條價格帶定中心。",
      "band-unverifiable":
        "價格帶計算得出了一個本應用無法核驗的結果。",
      "range-invalid-input":
        "為這個區間提供的池子、價格帶和快照無效，或者它們描述的不全是同一個池子和同一次觀測。",
      "range-price-unrepresentable":
        "這個池子的當前價格落在 Uniswap 所能表達的範圍之外，所以無法由它構建任何倉位區間。",
      "range-tick-disagreement":
        "資料來源為這個池子報出的價格和它報出的狀態描述的不是同一個時刻，所以不發佈任何區間。",
      "range-too-narrow":
        "這條價格帶比這個池子允許的兩條邊緣之間最小的步長還要窄，所以它並不描述兩條互不相同的倉位邊界。",
      "range-unverifiable":
        "區間計算得出了一個本應用無法核驗的結果。",
      "divergence-unverifiable":
        "與持有的對比得出了一個本應用無法核驗的結果。",
      "activity-unverifiable":
        "這個池子近期的活動得出了一個本應用無法核驗的結果。",
      "fee-rate-unmeasurable":
        "在這個窗口裡被索引到的每一天，這個池子都沒有任何成交，所以無法從它收到的金額中除出它收取的費率。",
      "deposit-share-unpriceable":
        "資料來源沒有為這個池子持有的東西定價，所以無法把一筆以美元計的資金換算成這裡的一個倉位。",
      "deposit-share-no-days":
        "在資料來源能作答的每一天裡，價格都離開了這個區間，所以沒有哪一天投在其中的資金本可以收到什麼。",
      "deposit-share-unverifiable":
        "一筆資金本可以分到多少，沒有通過它自己的檢查，所以不予顯示。",
      "range-order-no-room":
        "這個區間太窄了，在當前價格的任何一側都容不下一個單邊倉位。",
      "range-order-unverifiable":
        "這個區間的兩個單邊部分沒有通過它們自己的檢查，所以不予顯示。",
      "swap-depth-no-liquidity":
        "這個池子在它的當前價格處報告沒有流動性，所以這裡沒有可以定價的兌換。",
      "swap-depth-tick-disagreement":
        "資料來源自己的 tick 把這個池子放在了與所顯示價格不同的價格步長裡，所以它報出的流動性不能歸到這一格上。",
      "swap-depth-unverifiable":
        "一筆兌換要付出什麼，沒有通過它自己的檢查，所以不予顯示。",
      "out-of-sample-insufficient-history":
        "這個池子被索引到的歷史不夠長，無法既在過去擬合出一條價格帶，又留下一個完整時間跨度的日子來檢驗它。",
      "out-of-sample-unverifiable":
        "樣本外檢驗得出了一個本應用無法核驗的結果。",
      "hook-directory-unverifiable":
        "本週這些 v4 資金池的 hook 沒有通過它們自己的檢查，所以不顯示這份名錄。",
      "positions-manager-unverified":
        "持有 Uniswap v3 倉位的那份合約，回應時給出的程式碼不是本應用當初據以構建的那份，所以它說的任何東西都不予顯示。",
      "positions-unreadable":
        "鏈沒有為這個地址的倉位作出回應，所以一個也不顯示——這和「一個都沒有持有」不是一回事。",
      "positions-unverifiable":
        "這個地址的倉位沒有通過它們自己的檢查，所以不予顯示。",
      "holdings-unverifiable":
        "這個地址持有什麼，得出了一個本應用無法核驗的結果。",
      "explanation-key-rejected":
        "說明服務不接受所配置的金鑰，所以不顯示任何說明。",
      "explanation-model-not-permitted":
        "所配置的金鑰沒有被允許使用所選的模型，所以不顯示任何說明。",
      "explanation-model-unknown":
        "所選的模型對所配置的金鑰不可用，所以不顯示任何說明。",
      "explanation-rate-limited":
        "說明服務此刻處於速率限制中，所以不顯示任何說明。",
      "explanation-hourly-cap":
        "本站每小時只寫有限數量的說明，這個數量已經用完。上面的數字是完整的；一小時內可以再次寫說明。",
      "explanation-unreachable":
        "無法連接到說明服務，所以不顯示任何說明。",
      "explanation-request-refused":
        "說明服務拒絕了這個請求，所以不顯示任何說明。",
      "explanation-declined":
        "模型謝絕解釋這個池子的數字，所以不顯示任何說明。",
      "explanation-truncated":
        "這段說明在寫完之前就被截斷了，所以不予顯示。",
      "explanation-malformed":
        "這段說明返回時的形式是本應用無法核驗的，所以不予顯示。",
    } satisfies Record<DataFailureNotice, string>,

    warning: {
      "block-time-unreported":
        "資料來源沒有報出區塊時間，所以無法核驗這些數字有多新。",
      "history-window-incomplete":
        "資料來源沒有為這個窗口裡的每一天都報出價格；缺失的那些日子是缺著的，而不是估出來的。",
      "volatility-window-incomplete":
        "這個窗口裡有些日子沒有價格，所以波動率是用比窗口所覆蓋的更少的單日收益率測出來的；缺失的那些日子被跳過了，而不是估出來的。",
      "band-window-incomplete":
        "波動率窗口裡有些日子沒有價格，所以這條價格帶所依據的單日收益率比窗口所覆蓋的要少。",
      "band-price-block-time-unreported":
        "當前價格的來源沒有報出區塊時間，所以無法獨立核驗它有多新。",
      "band-volatility-block-time-unreported":
        "波動率的來源沒有報出區塊時間，所以無法獨立核驗它有多新。",
      /*
       * Neither names an edge. The codes name the pool's edges, and the page
       * writes its prices the reader's way round, which can be the other way —
       * so the sentence points at the range panel, which says which edge in
       * the direction shown.
       */
      "range-lower-edge-truncated":
        "這個區間的一條邊緣停在了這個池子所能表達的價格的盡頭——也就是這個池子第一種代幣最便宜的那一邊——所以這個區間沒有伸到價格帶本會到達的地方。區間那一塊會說明，在所顯示的方向上那是哪一條邊緣。",
      "range-upper-edge-truncated":
        "這個區間的一條邊緣停在了這個池子所能表達的價格的盡頭——也就是這個池子第一種代幣最貴的那一邊——所以這個區間沒有伸到價格帶本會到達的地方。區間那一塊會說明，在所顯示的方向上那是哪一條邊緣。",
      "range-tick-unverified":
        "價格來源沒有報出這個池子自己的狀態，所以由它推出的價格無法與之對照核驗。",
      "range-excludes-current-price":
        "這個池子的當前價格落在這個區間之外，所以由它建出的倉位只會持有一種代幣，並且在價格回來之前什麼也賺不到。",
    } satisfies Record<DataWarningNotice, string>,
  },

  rateLimited: {
    title: "請求過多",
    body: (limit: number) =>
      `這一頁每次訪問都會讀取 Uniswap 的即時資料，所以它被限制為每分鐘 ${limit} 次分析。`,
    retry: (seconds: number) => `請在 ${seconds} 秒後重試。`,
    back: "返回顧問首頁",
  },

  error: ERROR_COPY["zh-Hant"],
};
const dictionaries: Record<Locale, Dictionary> = {
  en,
  tr,
  de,
  es,
  ar,
  hi,
  zh,
  ru,
  pt,
  "zh-Hant": zhHant,
};

export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale];

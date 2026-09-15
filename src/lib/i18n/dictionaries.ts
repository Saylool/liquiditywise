import type { DataFailureNotice, DataWarningNotice } from "../../schemas/notices";
import type { Locale } from "./locales";

/*
 * Every string the interface shows, in both published languages.
 *
 * `Dictionary` is inferred from the English entry, so the Turkish one is checked
 * against it by the compiler: a key added on one side and forgotten on the other
 * is a build error rather than an English word surfacing mid-sentence.
 *
 * Interpolated text is a function rather than a template with placeholders. A
 * placeholder string has to be split and rejoined at the call site, which is
 * where word order gets lost — and word order is exactly what differs between
 * these two languages.
 *
 * Not here: the warnings and failure messages the data layer produces. Those are
 * fixed sentences by design, and turning them into codes the interface resolves
 * is a change to that layer rather than to this one.
 */

const en = {
  metadata: {
    title: "Uniswap Strategy Advisor",
    description:
      "An educational AI-assisted advisor for Uniswap v3 and v4 liquidity strategies. Guidance only — not financial advice.",
    v4Title: "A Uniswap v4 pool · Uniswap Strategy Advisor",
    v4Description:
      "What one Uniswap v4 pool is, and what its hook is permitted to do.",
    holdingsTitle: "What an address holds · Uniswap Strategy Advisor",
    holdingsDescription:
      "The tokens found at one Ethereum address, and the Uniswap v3 pools they can go into.",
    poolTitle: "Pool range analysis · Uniswap Strategy Advisor",
    poolDescription:
      "Historical-volatility price band for one Ethereum mainnet Uniswap v3 pool, aligned onto the pool's tick grid.",
  },

  preferences: {
    languageLabel: "Language",
    themeLabel: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
  },

  disclaimer: {
    ariaLabel: "Important disclaimer",
    title: "Educational tool — not financial advice.",
    body: "This application explains Uniswap mechanics and helps you reason about parameter choices. It does not predict prices, does not guarantee returns, and cannot verify that any smart contract is safe. Liquidity provision carries real risk, including impermanent loss and total loss of funds. Always verify contract addresses and do your own research.",
  },

  home: {
    badge: "Early foundation",
    title: "Uniswap Strategy Advisor",
    introBeforeV3: "An educational advisor for Uniswap ",
    introBetween: ", growing towards ",
    introAfterV4:
      ". Find a pool by its pair, read a price range worked out from how far that pair has actually moved, and get it explained in plain language. Every figure is computed and cross-checked before a model is allowed to describe it — and the model is never allowed to state one.",
    workingTodayHeading: "Working today",
    workingTodayBody:
      "Search for a pool by its pair, or paste the pool's address. Read its verified configuration and current market state, its last 30 completed days of closing prices, historical volatility, a log-symmetric price band, and the Uniswap tick range that band aligns onto — then read a plain-language explanation of all of it, in English or Turkish. No AI touches any of those figures, none of them is estimated to fill a gap, and the model that writes the prose has nowhere to put a number of its own.",
    analysePool: "Find a pool →",
    methodHeading: "How it works",
    methodSteps: [
      {
        step: "Verified data",
        detail:
          "Pool facts are fetched from Uniswap subgraphs and read on-chain, never assumed. The price is cross-checked against the tick the pool reports for itself.",
      },
      {
        step: "Deterministic maths",
        detail:
          "Volatility, the price band and the tick range are computed in plain TypeScript, so the same pool always yields the same numbers.",
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
            name: "Fees and impermanent loss",
            summary:
              "What a position would earn, and what it would give up by holding through a move. The explanation says plainly that it models neither — which is honest, and is also the question most people arrive with.",
          },
          {
            name: "Fee tier selection",
            summary:
              "Comparing the available fee tiers for a pair against how that pair actually trades.",
          },
          {
            name: "Range orders",
            summary:
              "Using a one-sided position to convert between two tokens as price moves through a band.",
          },
        ],
      },
      {
        version: "Uniswap v4",
        features: [
          {
            name: "Hook discovery",
            summary:
              "Finding published hooks relevant to a goal, with their limitations stated plainly.",
          },
          {
            name: "Dynamic fee hooks",
            summary:
              "Understanding when a fee that responds to market conditions is worth the added complexity.",
          },
          {
            name: "TWAMM-style strategies",
            summary:
              "Spreading a large order over time instead of executing it against a single point of liquidity.",
          },
        ],
      },
    ],
    footer:
      "None of the above exists yet. What does is everything higher up this page: a pool found by name, figures computed and cross-checked, and prose that is verified before it is shown. A wallet can be connected, and all that is asked of it is its address — there is no persistence and no account anywhere in the codebase, and nothing here can sign or send a transaction on your behalf.",
  },

  pool: {
    back: "← Uniswap Strategy Advisor",
    invalidAddress:
      "That is not an Ethereum address. An address is 0x followed by exactly 40 hexadecimal characters.",
    loading: "Reading live Uniswap data…",
  },

  /*
   * The controls that change the band. The field labels are not here: they are
   * `report.horizon` and `report.multiplier`, the same words the figures are
   * labelled with a few lines above, so a reader changing one can see which
   * number they are changing.
   */
  /*
   * The one figure here that owes nothing to a data source, and the one most
   * likely to be read as half an answer — so the text says what it leaves out
   * before it says anything else.
   */
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
    occupancyHeading: "How these days sat against the range",
    fullyInside: "Days entirely inside",
    fullyOutside: "Days entirely outside",
    undetermined: "Days that crossed an edge",
    undeterminedNote:
      "The source publishes a daily high and low, so a day that spent part of itself inside cannot be split without intraday data this does not fetch.",
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
      "These are the same days the range was measured from, so this describes how the band was fitted rather than testing how it holds up. The range is also centred on today's price, which nobody could have opened a month ago. Read it as how the pool's recent movement sits against the range being suggested, not as a backtest.",
    notYourEarnings:
      "None of this is what a position would earn. That would be these fees multiplied by your share of the liquidity active in the range while the swaps happened — a share this application does not read, for a deposit it will not size. There is no yield figure here on purpose.",
  },

  realizedFee: {
    heading: "What it actually charged",
    intro:
      "The rate above is what the pool declares. This is what swappers paid, divided back out of the same days the figures above are measured over: a day's fees over that day's volume. It costs no extra request and needs to know nothing about the hook.",
    declared: "Declared rate",
    noDeclared: "None",
    noDeclaredNote: "This pool's key carries no fee. Its hook sets one per swap.",
    median: "Median day",
    spread: "Cheapest to dearest day",
    spreadValue: (lowest: string, highest: string) => `${lowest} – ${highest}`,
    aggregate: "Over the whole window",
    aggregateNote:
      "The window's fees over the window's volume, so a day that traded a hundred times as much has a hundred times the say.",
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
    heading: "The same method, on days it never saw",
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
    heading: "Against simply holding",
    intro:
      "What a position in this range would be worth compared with holding the two tokens, at each price. Exact arithmetic rather than an estimate — but it counts price movement and nothing else. It says nothing about the fees a position would earn, and fees are precisely what a liquidity provider is paid for this difference.",
    price: "Price",
    loss: "Versus holding",
    entryRow: "The price this is measured from — the pool's current price.",
    impermanentNote:
      "This is what is usually called impermanent loss. It is only impermanent if price comes back: a position closed at a price other than the one it opened at has realised it.",
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
  },

  parameters: {
    heading: "Change the range",
    apply: "Recalculate",
    days: (days: string) => `${days} days`,
    sigma: (value: string) => `${value}σ`,
    note: "The horizon says how far the measured movement is laid forward. It does not change the measurement: volatility always comes from the last 30 completed days, whichever horizon is chosen. A larger multiplier makes the range wider, and is not a confidence level.",
    fellBack:
      "Part of what was asked for could not be read, so the default was used where that happened. The horizon and multiplier actually used are shown above.",
  },

  holdings: {
    heading: "What this address holds",
    intro:
      "The tokens found at this address, and the pools they can go into. Nothing here is stored, and the address is public information — the same list is visible to anyone who looks it up.",
    forAddress: "Address",
    /*
     * The sentence that keeps the answer honest. Nothing can list an address's
     * tokens, so the width of the search is part of the answer.
     */
    howItLooked: (tokens: string, v3Pools: string, v4Pools: string | null) =>
      `A token's balance lives inside the token's own contract, so there is no list of what an address owns — only tokens that can be asked, one at a time. This asked ${tokens} of them: every token in the ${v3Pools} most-traded Uniswap v3 pools on Ethereum mainnet${v4Pools === null ? "" : `, and every currency in the ${v4Pools} most-traded v4 pools, the chain's own ether among them`}. Something held outside that set is not missing from this page because the address does not hold it.`,
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
      "What this pool is, read from its own key. A v4 pool is not a contract of its own: it lives inside one PoolManager and is named by a hash of the five things that define it — the two currencies, the fee, the tick spacing, and the hook.",
    poolId: "Pool id",
    pair: "Currencies",
    fee: "Fee",
    dynamicFee: "Set by the hook, per swap",
    dynamicFeeNote:
      "This pool's key carries the dynamic-fee flag instead of a fee, so what a swap costs is decided by the hook at the moment it happens. This read did not observe one, and there is no fee here to report.",
    tickSpacing: "Tick spacing",
    tickSpacingNote:
      "Part of the pool's key in v4, so unlike v3 it needs no separate contract call.",
    nativeCurrency: "Native ether",
    nativeCurrencyNote:
      "The zero address here is not a missing field. v4 lets a pool hold the chain's own ether rather than a wrapped token, and that is what this is.",
    hookHeading: "The hook",
    noHook: "This pool runs without a hook.",
    noHookNote:
      "Nothing runs alongside its swaps or its deposits, so it behaves the way a v3 pool does.",
    hookMay: "What it is permitted to do",
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
      "Below is the range analysis. The band and the ticks come from prices that already happened, so they hold here exactly as they do for a pool with no hook — a hook cannot retroactively change where price went. What a hook can change is what a swap costs, so the rate this pool charged is measured from what it collected rather than taken from the fee above.",
    unavailableHeading: "This pool could not be read",
    invalidId:
      "That is not a v4 pool id. A v4 pool is named by a 32-byte hash — 0x followed by 64 hexadecimal characters — not by a contract address.",
    noId: "Paste a v4 pool id to see what the pool is and what its hook may do.",
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
      "Read-only. This application asks a wallet for its address and never for a signature: there is no code here that can sign a message or send a transaction, and nothing is stored between visits.",
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
      volatility: "measuring historical volatility",
      band: "building the price band",
      range: "aligning the band onto the pool's tick grid",
      divergence: "comparing that range against holding the two tokens",
      activity: "reading what the pool did over the measured window",
    },
    noRangeHeading: "No range for this pool",
    stoppedWhile: (step: string) => `This stopped while ${step}.`,
    poolSummary: (protocol: string, feeTier: string, tickSpacing: string) =>
      `Uniswap ${protocol} on Ethereum mainnet · ${feeTier} fee tier · tick spacing ${tickSpacing}`,
    /** Stands where a fee tier would, for a v4 pool whose hook sets one per swap. */
    noDeclaredFee: "no fixed",
    caveatsHeading: (count: number) =>
      count === 1 ? "One caveat applies to these figures." : `${count} caveats apply to these figures.`,
    caveatsAriaLabel: "Caveats",

    rangeHeading: "Suggested tick range",
    lowerTick: "Lower tick",
    upperTick: "Upper tick",
    priceAt: (price: string, quote: string, base: string) =>
      `Price ${price} ${quote} per ${base}`,
    width: "Width",
    widthValue: (ticks: string) => `${ticks} ticks`,
    widthNote: (spacings: string, tickSpacing: string) =>
      `${spacings} spacings of ${tickSpacing}`,
    inRange: "Currently in range",
    yes: "Yes",
    no: "No",
    inRangeNote: "The pool's current tick sits inside these bounds.",
    outOfRangeNote:
      "A position here would hold a single token and earn nothing until price returns.",
    lowerEdge: "Lower edge",
    upperEdge: "Upper edge",
    truncated: "Truncated",
    asAsked: "As asked",
    lowerTruncatedNote: "Stopped at the lowest tick this pool accepts.",
    upperTruncatedNote: "Stopped at the highest tick this pool accepts.",

    currentStateHeading: "Current state",
    tokenPrice: (symbol: string) => `${symbol} price`,
    quotePerBase: (quote: string, base: string) => `${quote} per ${base}`,
    currentTick: "Current tick",
    sourceReportedTick: (tick: string) => `Source reported ${tick}.`,
    noSourceTick:
      "The source reported no tick of its own, so this conversion is unverified.",
    tvl: "Total value locked",
    sourceBlock: "Source block",
    noBlockTime: "No block time reported.",
    fetchedAt: "Fetched at",
    fetchedAtNote: "When the response arrived, not what it describes.",

    volatilityHeading: "Historical volatility",
    annualised: "Annualised",
    annualisedNote:
      "Sample standard deviation of daily log returns, scaled by sqrt(365).",
    daily: "Daily",
    window: "Window",
    windowNote: (returns: string) => `${returns} usable daily returns.`,
    coverage: "Coverage",
    coverageNote: "How much of the window had consecutive daily prices behind it.",

    bandHeading: "Price band this range came from",
    horizon: "Horizon",
    horizonValue: (days: string) => `${days} days`,
    horizonNote: "How far ahead the band is scaled.",
    multiplier: "Multiplier",
    multiplierNote: "Horizon standard deviations, not a confidence level.",
    lowerBound: "Lower bound",
    upperBound: "Upper bound",
    downside: "Downside",
    downsideNote: "Distance from the current price to the lower bound.",
    upside: "Upside",
    upsideNote: "Distance from the current price to the upper bound.",

    epilogue:
      "The band is symmetric in log space, which makes it deliberately asymmetric in percentage terms: a move down to half price and a move up to double price are the same distance in logs, and only one of them is “50%”. It assumes no expected return, describes how far price has moved historically, and is not a forecast. The multiplier is not a confidence level. Nothing here sizes a position or says how much of either token to deposit.",
  },

  explanation: {
    heading: "Explanation",
    pending: "Writing the explanation…",
    unavailable: "No explanation is available for this analysis.",
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
      "pool-not-found":
        "No Uniswap v3 pool was found for this address on Ethereum mainnet.",
      "pool-contract-not-found":
        "No Uniswap v3 pool contract answered at this address on Ethereum mainnet.",
      "pool-configuration-inconsistent":
        "The pool configuration assembled from its two sources could not be verified.",
      "pool-history-insufficient":
        "This pool does not have enough completed daily price history to analyse yet.",
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
        "This pool's current price lies outside the range Uniswap can express as a tick, so no position range can be built from it.",
      "range-tick-disagreement":
        "The source's own tick for this pool does not match the tick its price implies for these token decimals, so no range is published.",
      "range-too-narrow":
        "The price band is narrower than one tick spacing on this pool, so it does not describe two distinct position boundaries.",
      "range-unverifiable":
        "The tick range calculation produced a result this application cannot verify.",
      "divergence-unverifiable":
        "The comparison against holding produced a result this application cannot verify.",
      "activity-unverifiable":
        "The pool's recent activity produced a result this application cannot verify.",
      "fee-rate-unmeasurable":
        "This pool traded nothing on any indexed day of the window, so the rate it charges cannot be divided out of what it collected.",
      "out-of-sample-insufficient-history":
        "This pool does not have enough indexed history to fit a band in the past and still have a full horizon of days to check it against.",
      "out-of-sample-unverifiable":
        "The out-of-sample check produced a result this application cannot verify.",
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
      "range-lower-edge-truncated":
        "The lower edge stops at the lowest tick this pool accepts, so the range does not reach as far down as the band.",
      "range-upper-edge-truncated":
        "The upper edge stops at the highest tick this pool accepts, so the range does not reach as far up as the band.",
      "range-tick-unverified":
        "The price source did not report the pool's own tick, so the converted tick could not be checked against it.",
      "range-excludes-current-price":
        "The pool's current tick lies outside this range, so a position built from it would hold a single token and earn nothing until price returns.",
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
};

export type Dictionary = typeof en;

const tr: Dictionary = {
  metadata: {
    title: "Uniswap Strateji Danışmanı",
    description:
      "Uniswap v3 ve v4 likidite stratejileri için eğitim amaçlı, yapay zekâ destekli bir danışman. Yalnızca bilgilendirme — yatırım tavsiyesi değildir.",
    v4Title: "Bir Uniswap v4 havuzu · Uniswap Strateji Danışmanı",
    v4Description:
      "Bir Uniswap v4 havuzunun ne olduğu ve hook'unun neye izinli olduğu.",
    holdingsTitle: "Bir adres ne tutuyor · Uniswap Strateji Danışmanı",
    holdingsDescription:
      "Bir Ethereum adresinde bulunan tokenlar ve girebilecekleri Uniswap v3 havuzları.",
    poolTitle: "Havuz aralığı analizi · Uniswap Strateji Danışmanı",
    poolDescription:
      "Bir Ethereum mainnet Uniswap v3 havuzu için tarihsel volatiliteye dayalı fiyat bandı, havuzun tick ızgarasına hizalanmış hâliyle.",
  },

  preferences: {
    languageLabel: "Dil",
    themeLabel: "Tema",
    themeSystem: "Sistem",
    themeLight: "Açık",
    themeDark: "Koyu",
  },

  disclaimer: {
    ariaLabel: "Önemli uyarı",
    title: "Eğitim aracı — yatırım tavsiyesi değildir.",
    body: "Bu uygulama Uniswap mekaniklerini açıklar ve parametre seçimleri üzerine düşünmene yardım eder. Fiyat tahmini yapmaz, getiri garantisi vermez ve hiçbir akıllı sözleşmenin güvenli olduğunu doğrulayamaz. Likidite sağlamak, geçici kayıp ve paranın tamamının kaybı dahil gerçek riskler taşır. Sözleşme adreslerini daima kendin doğrula ve kendi araştırmanı yap.",
  },

  home: {
    badge: "Erken aşama",
    title: "Uniswap Strateji Danışmanı",
    introBeforeV3: "Uniswap ",
    introBetween: " için, ",
    introAfterV4:
      "'e doğru büyüyen eğitim amaçlı bir danışman. Havuzu paritesinden bul, o paritenin geçmişte gerçekte ne kadar hareket ettiğinden çıkarılmış bir fiyat aralığını oku, ve bunun ne anlama geldiğini gündelik dille öğren. Her sayı, bir model onu anlatmaya başlamadan önce hesaplanır ve çapraz doğrulanır — modelin ise bir sayı yazmasına hiç izin verilmez.",
    workingTodayHeading: "Bugün çalışan kısım",
    workingTodayBody:
      "Havuzu paritesinden ara, ya da havuzun adresini yapıştır. Doğrulanmış yapılandırmasını ve güncel piyasa durumunu, tamamlanmış son 30 günün kapanış fiyatlarını, tarihsel volatiliteyi, log-simetrik bir fiyat bandını ve o bandın hizalandığı Uniswap tick aralığını gör — sonra hepsinin gündelik dille açıklamasını oku, Türkçe ya da İngilizce. Bu sayıların hiçbirine yapay zekâ dokunmuyor, hiçbiri bir boşluğu doldurmak için tahmin edilmiyor, ve metni yazan modelin kendi başına bir sayı koyacağı yer yok.",
    analysePool: "Havuz bul →",
    methodHeading: "Nasıl çalışıyor",
    methodSteps: [
      {
        step: "Doğrulanmış veri",
        detail:
          "Havuz bilgileri Uniswap subgraph'larından çekilir ve zincirden okunur, asla varsayılmaz. Fiyat, havuzun kendisi için bildirdiği tick'e karşı çapraz doğrulanır.",
      },
      {
        step: "Deterministik hesap",
        detail:
          "Volatilite, fiyat bandı ve tick aralığı düz TypeScript ile hesaplanır; aynı havuz her zaman aynı sayıları verir.",
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
            name: "Komisyon ve geçici kayıp",
            summary:
              "Bir pozisyonun ne kazanacağı, ve bir hareketi baştan sona tutmanın neyi feda ettiği. Açıklama ikisini de modellemediğini açıkça söylüyor — bu dürüst, ama çoğu insanın buraya gelirken sorduğu soru da tam bu.",
          },
          {
            name: "Komisyon kademesi seçimi",
            summary:
              "Bir parite için mevcut komisyon kademelerini, o paritenin gerçekte nasıl işlem gördüğüyle karşılaştırmak.",
          },
          {
            name: "Aralık emirleri",
            summary:
              "Fiyat bir bandın içinden geçerken tek taraflı pozisyonla iki token arasında dönüşüm yapmak.",
          },
        ],
      },
      {
        version: "Uniswap v4",
        features: [
          {
            name: "Hook keşfi",
            summary:
              "Bir hedefe uygun yayımlanmış hook'ları bulmak ve sınırlarını açıkça belirtmek.",
          },
          {
            name: "Dinamik komisyon hook'ları",
            summary:
              "Piyasa koşullarına tepki veren bir komisyonun getirdiği karmaşıklığa ne zaman değdiğini anlamak.",
          },
          {
            name: "TWAMM tarzı stratejiler",
            summary:
              "Büyük bir emri tek bir likidite noktasına karşı yürütmek yerine zamana yaymak.",
          },
        ],
      },
    ],
    footer:
      "Yukarıdakilerin hiçbiri henüz yok. Olan şey, bu sayfada daha yukarıda anlatılanların tamamı: adıyla bulunan bir havuz, hesaplanıp çapraz doğrulanmış sayılar, ve gösterilmeden önce doğrulanan bir metin. Cüzdan bağlanabilir ve ondan istenen tek şey adresidir — kod tabanının hiçbir yerinde kalıcı depolama ya da hesap yok, ve buradaki hiçbir şey senin adına bir işlem imzalayamaz veya gönderemez.",
  },

  pool: {
    back: "← Uniswap Strateji Danışmanı",
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
    occupancyHeading: "Bu günler aralığa göre nerede durdu",
    fullyInside: "Tamamen içeride geçen gün",
    fullyOutside: "Tamamen dışarıda geçen gün",
    undetermined: "Bir kenarı geçen gün",
    undeterminedNote:
      "Kaynak günlük en yüksek ve en düşüğü yayımlıyor; bu yüzden bir kısmını içeride geçiren bir gün, çekmediğimiz gün içi veri olmadan bölünemez.",
    feesWhileInside: "Tamamen içeride geçen günlerde alınan komisyon",
    feesWithheld: "Bu havuz için gösterilmiyor",
    feesWithheldNote:
      "Bu havuzun hook'u takastan pay almaya izinli ve kaynak, hook'un payını likidite sağlayıcılarınkinden ayırmıyor. Yukarıdaki komisyonlar havuzun aldığı tutar — bu bir olgu; ama onun bir kısmını bu aralığa bağlamak, kimsenin doğrulayamayacağı bir pozisyon iddiası olurdu.",
    inSample:
      "Bunlar, aralığın kendisinden ölçüldüğü günlerin ta kendisi; yani bu, bandın nasıl oturtulduğunu anlatır, ne kadar tuttuğunu sınamaz. Aralık ayrıca bugünkü fiyata göre ortalanmış — bir ay önce kimse onu açamazdı. Bir geriye dönük test olarak değil, havuzun son dönem hareketinin önerilen aralığa göre nerede durduğu olarak oku.",
    notYourEarnings:
      "Bunların hiçbiri bir pozisyonun kazanacağı miktar değil. O, bu komisyonların, takaslar olurken aralıkta aktif olan likiditedeki payınla çarpımı olurdu — bu uygulamanın okumadığı bir pay, ve büyüklüğünü belirlemeyeceği bir yatırım için. Burada bilerek bir getiri rakamı yok.",
  },

  realizedFee: {
    heading: "Gerçekte ne kadar aldı",
    intro:
      "Yukarıdaki oran, havuzun beyan ettiği oran. Buradaki ise takas yapanların ödediği oran: yukarıdaki sayıların ölçüldüğü aynı günlerden geri bölünerek çıkarıldı — bir günün komisyonu, o günün hacmine. Fazladan hiçbir istek götürmüyor ve hook hakkında hiçbir şey bilmesi gerekmiyor.",
    declared: "Beyan edilen oran",
    noDeclared: "Yok",
    noDeclaredNote: "Bu havuzun anahtarında komisyon yok. Oranı hook'u her takasta belirliyor.",
    median: "Ortanca gün",
    spread: "En ucuz ve en pahalı gün",
    spreadValue: (lowest: string, highest: string) => `${lowest} – ${highest}`,
    aggregate: "Pencerenin tamamında",
    aggregateNote:
      "Pencerenin komisyonu, pencerenin hacmine bölündü; yani yüz kat fazla işlem gören bir günün yüz kat sözü var.",
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
    heading: "Aynı yöntem, hiç görmediği günlerde",
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
    price: "Fiyat",
    loss: "Tutmaya kıyasla",
    entryRow: "Bunun ölçüldüğü fiyat — havuzun güncel fiyatı.",
    impermanentNote:
      "Buna genelde geçici kayıp denir. Yalnızca fiyat geri gelirse geçicidir: açıldığı fiyattan farklı bir fiyatta kapatılan bir pozisyon onu gerçekleştirmiş olur.",
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
  },

  parameters: {
    heading: "Aralığı değiştir",
    apply: "Yeniden hesapla",
    days: (days: string) => `${days} gün`,
    sigma: (value: string) => `${value}σ`,
    note: "Ufuk, ölçülen hareketin ne kadar ileriye taşındığını söyler. Ölçümün kendisini değiştirmez: hangi ufuk seçilirse seçilsin volatilite her zaman tamamlanmış son 30 günden gelir. Daha büyük bir çarpan aralığı genişletir; bir güven düzeyi değildir.",
    fellBack:
      "İstenenlerin bir kısmı okunamadı, o alanda varsayılan kullanıldı. Gerçekten kullanılan ufuk ve çarpan yukarıda yazıyor.",
  },

  holdings: {
    heading: "Bu adres ne tutuyor",
    intro:
      "Bu adreste bulunan tokenlar ve girebilecekleri havuzlar. Burada hiçbir şey saklanmıyor ve adres zaten herkese açık bilgi — aynı liste, bakan herkese görünür.",
    forAddress: "Adres",
    howItLooked: (tokens: string, v3Pools: string, v4Pools: string | null) =>
      `Bir tokenın bakiyesi tokenın kendi sözleşmesinin içinde durur; yani bir adresin nelere sahip olduğunun listesi diye bir şey yoktur, yalnızca tek tek sorulabilecek tokenlar vardır. Burada ${tokens} tanesi soruldu: Ethereum mainnet'te en çok işlem gören ${v3Pools} Uniswap v3 havuzunda geçen tokenların tamamı${v4Pools === null ? "" : ` ve en çok işlem gören ${v4Pools} v4 havuzundaki para birimlerinin tamamı — zincirin kendi ether'i dahil`}. Bu kümenin dışında tutulan bir şey, adres onu tutmadığı için değil, sorulmadığı için bu sayfada yok.`,
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
      "Bu havuzun ne olduğu, kendi anahtarından okundu. Bir v4 havuzu kendine ait bir sözleşme değildir: tek bir PoolManager'ın içinde yaşar ve onu tanımlayan beş şeyin özetiyle adlandırılır — iki para birimi, komisyon, tick adımı ve hook.",
    poolId: "Havuz kimliği",
    pair: "Para birimleri",
    fee: "Komisyon",
    dynamicFee: "Hook belirliyor, her takasta",
    dynamicFeeNote:
      "Bu havuzun anahtarı komisyon yerine dinamik komisyon bayrağını taşıyor; yani bir takasın ne tutacağına, olduğu anda hook karar veriyor. Bu okuma bir tanesini gözlemlemedi ve burada bildirilecek bir komisyon yok.",
    tickSpacing: "Tick adımı",
    tickSpacingNote:
      "v4'te havuzun anahtarının parçası; yani v3'ten farklı olarak ayrı bir sözleşme çağrısı gerektirmiyor.",
    nativeCurrency: "Yerli ether",
    nativeCurrencyNote:
      "Buradaki sıfır adres eksik bir alan değil. v4, bir havuzun sarmalanmış token yerine zincirin kendi ether'ini tutmasına izin veriyor; bu da o.",
    hookHeading: "Hook",
    noHook: "Bu havuz hook'suz çalışıyor.",
    noHookNote:
      "Takaslarının ya da yatırımlarının yanında hiçbir şey çalışmıyor; yani bir v3 havuzu gibi davranıyor.",
    hookMay: "Neye izinli",
    hookAddressIsThePermission:
      "Bunlar hook'un kendi adresinden okundu. v4 bir hook'un izinlerini hiçbir yerde saklamaz: hook, son on dört biti PoolManager'ın hangi geri çağrıları tetikleyeceğini yazan bir adrese kurulur, ve PoolManager sözleşmeye sormak yerine o bitlere bakar. Yani burada yazan, hook'un ne *yapabileceği*; ne yaptığı değil — her takasta komisyonu yeniden yazmaya izinli bir hook hep aynı komisyonu döndürüyor olabilir, ve bu buradan bilinemez.",
    alterSwapWarning:
      "Bu hook, bir takasın ne tutacağını ya da ne ödeyeceğini değiştirmeye izinli. Fiyat geçmişinden türeyen her rakam — önerilen aralık, komisyon kademesi, sadece tutmaya kıyaslama — havuzun söylediği komisyonu aldığını ve eğrinin söylediğini ödediğini varsayar. Burada iki varsayım da güvenli değil, ve bunların hiçbiri bir fiyat serisinde görünmez.",
    analysisScope:
      "Aşağıda aralık analizi var. Bant ve tick'ler, zaten gerçekleşmiş fiyatlardan çıkıyor; bu yüzden burada, hook'u olmayan bir havuzdaki kadar geçerliler — bir hook, fiyatın geçmişte nereye gittiğini geriye dönük değiştiremez. Hook'un değiştirebildiği şey, bir takasın neye mal olduğu; bu yüzden bu havuzun aldığı oran, yukarıdaki komisyondan alınmıyor, topladığı tutardan ölçülüyor.",
    unavailableHeading: "Bu havuz okunamadı",
    invalidId:
      "Bu bir v4 havuz kimliği değil. Bir v4 havuzu 32 baytlık bir özetle adlandırılır — 0x ve ardından 64 onaltılık karakter — bir sözleşme adresiyle değil.",
    noId: "Havuzun ne olduğunu ve hook'unun neye izinli olduğunu görmek için bir v4 havuz kimliği yapıştır.",
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
      "Salt okunur. Bu uygulama cüzdandan adresini ister, imza istemez: burada bir mesajı imzalayabilecek ya da işlem gönderebilecek hiçbir kod yok, ve ziyaretler arasında hiçbir şey saklanmıyor.",
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
    symbolWarning:
      "Sembol, tokenın kendi sözleşmesinden gelir; kendine USDC diyen bir token çıkarmanın hiçbir maliyeti yoktur. İki tokenı birbirinden ayıran şey, her paritenin altındaki sözleşme adresleridir.",

    feeTier: "Komisyon kademesi",
    holds: "Tuttuğu",
    reservesUnread: "Bu havuzun ne tuttuğu zincirden okunamadı.",
    moreNotShown: (count: string) =>
      `${count} tanesi daha gösterilmiyor. Yukarıdakiler bunların en çok işlem görenleri, veri kaynağının bildirdiği sırayla — bu, bir havuzun ne kadar yoğun olduğuna dair bir iddiadır ve başka hiçbir şeye dair değildir.`,
    analyse: "Bu havuzu analiz et",

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
      volatility: "tarihsel volatilite ölçülürken",
      band: "fiyat bandı kurulurken",
      range: "bant havuzun tick ızgarasına hizalanırken",
      divergence: "o aralık iki tokenı tutmakla karşılaştırılırken",
      activity: "havuzun ölçüm penceresinde ne yaptığı okunurken",
    },
    noRangeHeading: "Bu havuz için aralık yok",
    stoppedWhile: (step: string) => `İşlem ${step} durdu.`,
    /*
     * "adım", not "aralık". The suggested range is headed "Önerilen tick
     * aralığı" a few lines below, and one page calling two different things by
     * one name is a page that cannot be read carefully — a model writing about
     * it produced "the pool's fine tick aralığı, a few tick aralığı wide".
     */
    poolSummary: (protocol: string, feeTier: string, tickSpacing: string) =>
      `Ethereum mainnet üzerinde Uniswap ${protocol} · ${feeTier} komisyon kademesi · tick adımı ${tickSpacing}`,
    noDeclaredFee: "sabit olmayan",
    caveatsHeading: (count: number) =>
      count === 1
        ? "Bu sayılar için bir çekince geçerli."
        : `Bu sayılar için ${count} çekince geçerli.`,
    caveatsAriaLabel: "Çekinceler",

    rangeHeading: "Önerilen tick aralığı",
    lowerTick: "Alt tick",
    upperTick: "Üst tick",
    priceAt: (price: string, quote: string, base: string) =>
      `Fiyat: ${base} başına ${price} ${quote}`,
    width: "Genişlik",
    widthValue: (ticks: string) => `${ticks} tick`,
    widthNote: (spacings: string, tickSpacing: string) =>
      `${tickSpacing}'lik ${spacings} adım`,
    inRange: "Şu an aralık içinde",
    yes: "Evet",
    no: "Hayır",
    inRangeNote: "Havuzun güncel tick'i bu sınırların içinde.",
    outOfRangeNote:
      "Burada kurulan bir pozisyon tek token tutar ve fiyat dönene kadar hiçbir şey kazanmaz.",
    lowerEdge: "Alt kenar",
    upperEdge: "Üst kenar",
    truncated: "Kırpıldı",
    asAsked: "İstendiği gibi",
    lowerTruncatedNote: "Bu havuzun kabul ettiği en düşük tick'te durdu.",
    upperTruncatedNote: "Bu havuzun kabul ettiği en yüksek tick'te durdu.",

    currentStateHeading: "Güncel durum",
    tokenPrice: (symbol: string) => `${symbol} fiyatı`,
    quotePerBase: (quote: string, base: string) => `${base} başına ${quote}`,
    currentTick: "Güncel tick",
    sourceReportedTick: (tick: string) => `Kaynak ${tick} bildirdi.`,
    noSourceTick:
      "Kaynak kendi tick'ini bildirmedi, bu yüzden bu dönüşüm doğrulanmadı.",
    tvl: "Kilitli toplam değer",
    sourceBlock: "Kaynak blok",
    noBlockTime: "Blok zamanı bildirilmedi.",
    fetchedAt: "Çekilme zamanı",
    fetchedAtNote: "Yanıtın geldiği an — anlattığı an değil.",

    volatilityHeading: "Tarihsel volatilite",
    annualised: "Yıllıklandırılmış",
    annualisedNote:
      "Günlük log getirilerinin örneklem standart sapması, sqrt(365) ile ölçeklenmiş.",
    daily: "Günlük",
    window: "Pencere",
    windowNote: (returns: string) => `${returns} kullanılabilir günlük getiri.`,
    coverage: "Kapsama",
    coverageNote: "Pencerenin ne kadarının ardışık günlük fiyatlarla desteklendiği.",

    bandHeading: "Bu aralığın türediği fiyat bandı",
    horizon: "Ufuk",
    horizonValue: (days: string) => `${days} gün`,
    horizonNote: "Bandın ne kadar ileriye ölçeklendiği.",
    multiplier: "Çarpan",
    multiplierNote: "Ufuk standart sapması sayısı — güven düzeyi değil.",
    lowerBound: "Alt sınır",
    upperBound: "Üst sınır",
    downside: "Aşağı yön",
    downsideNote: "Güncel fiyattan alt sınıra olan mesafe.",
    upside: "Yukarı yön",
    upsideNote: "Güncel fiyattan üst sınıra olan mesafe.",

    epilogue:
      "Bant log uzayında simetriktir; bu da onu yüzde cinsinden bilerek asimetrik yapar: fiyatın yarıya inmesiyle iki katına çıkması logaritmik olarak aynı mesafedir ve bunlardan yalnızca biri “%50”'dir. Bant beklenen getiriyi sıfır varsayar, fiyatın geçmişte ne kadar hareket ettiğini anlatır ve bir tahmin değildir. Çarpan bir güven düzeyi değildir. Buradaki hiçbir şey pozisyon büyüklüğü belirlemez, hangi tokendan ne kadar yatırılacağını söylemez.",
  },

  explanation: {
    heading: "Açıklama",
    pending: "Açıklama yazılıyor…",
    unavailable: "Bu analiz için açıklama yok.",
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
      "pool-not-found":
        "Ethereum mainnet üzerinde bu adrese ait bir Uniswap v3 havuzu bulunamadı.",
      "pool-contract-not-found":
        "Ethereum mainnet üzerinde bu adreste yanıt veren bir Uniswap v3 havuz sözleşmesi yok.",
      "pool-configuration-inconsistent":
        "Havuzun iki kaynaktan derlenen yapılandırması doğrulanamadı.",
      "pool-history-insufficient":
        "Bu havuzun analiz için yeterli tamamlanmış günlük fiyat geçmişi henüz yok.",
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
        "Bu havuzun güncel fiyatı, Uniswap'ın tick olarak ifade edebildiği aralığın dışında; bu yüzden ondan bir pozisyon aralığı kurulamıyor.",
      "range-tick-disagreement":
        "Kaynağın bu havuz için bildirdiği tick, fiyatının bu token ondalıklarıyla ima ettiği tick ile uyuşmuyor; bu yüzden aralık yayımlanmıyor.",
      "range-too-narrow":
        "Fiyat bandı bu havuzun bir tick adımından dar, bu yüzden iki ayrı pozisyon sınırı tanımlamıyor.",
      "range-unverifiable":
        "Tick aralığı hesabı, bu uygulamanın doğrulayamadığı bir sonuç üretti.",
      "divergence-unverifiable":
        "Tutmaya kıyaslama hesabı, bu uygulamanın doğrulayamadığı bir sonuç üretti.",
      "activity-unverifiable":
        "Havuzun son dönem hareketliliği, bu uygulamanın doğrulayamadığı bir sonuç üretti.",
      "fee-rate-unmeasurable":
        "Bu havuz, pencerenin indekslenmiş hiçbir gününde işlem görmemiş; bu yüzden aldığı komisyon oranı, topladığı tutardan bölünerek çıkarılamıyor.",
      "out-of-sample-insufficient-history":
        "Bu havuzun, geçmişte bir bant kurup onu tam bir ufuk boyunca sınamaya yetecek kadar indekslenmiş geçmişi yok.",
      "out-of-sample-unverifiable":
        "Örneklem dışı kontrol, bu uygulamanın doğrulayamadığı bir sonuç üretti.",
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
        "Alt kenar bu havuzun kabul ettiği en düşük tick'te duruyor, bu yüzden aralık aşağıda bandın indiği kadar inmiyor.",
      "range-upper-edge-truncated":
        "Üst kenar bu havuzun kabul ettiği en yüksek tick'te duruyor, bu yüzden aralık yukarıda bandın çıktığı kadar çıkmıyor.",
      "range-tick-unverified":
        "Fiyat kaynağı havuzun kendi tick'ini bildirmedi, bu yüzden dönüştürülen tick ona karşı kontrol edilemedi.",
      "range-excludes-current-price":
        "Havuzun güncel tick'i bu aralığın dışında; burada kurulacak bir pozisyon tek token tutar ve fiyat dönene kadar hiçbir şey kazanmaz.",
    } satisfies Record<DataWarningNotice, string>,
  },

  rateLimited: {
    title: "Çok fazla istek",
    body: (limit: number) =>
      `Bu sayfa her ziyarette canlı Uniswap verisi okuduğu için dakikada ${limit} analizle sınırlı.`,
    retry: (seconds: number) => `${seconds} saniye sonra tekrar dene.`,
    back: "Danışmana dön",
  },
};

const dictionaries: Record<Locale, Dictionary> = { en, tr };

export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale];

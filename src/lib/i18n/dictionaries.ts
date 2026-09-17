import type { HookPermission, HookTopic } from "../../schemas/hookPermissions";
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
      "A price range for one Ethereum mainnet Uniswap v3 pool, drawn from how far its price has actually moved.",
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
      "Search for a pool by its pair, or paste a v3 pool address or a v4 pool id. You get the pool's verified configuration and current state, the last month of daily prices drawn against a suggested range, how far the pair has actually moved, and the range that follows from it — with the horizon and the width yours to change. Beside it: what the pool charged and what it actually collected, how its recent days sat against the range, what the same method did on days it never saw, what a position gives up against simply holding, and what each of the other widths would have done instead. A v4 pool also says what its hook is permitted to do, in plain words, read out of the hook's own address. An address can be looked up for the pools its tokens can go into. Then a plain-language explanation of all of it, in English or Turkish. No model touches any of those figures, none of them is estimated to fill a gap, and the prose has nowhere to put a number of its own.",
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
            name: "What a deposit would earn",
            summary:
              "The fees the pool charged are measured and shown; what a particular deposit would take of them is not. That needs a position size and its share of the liquidity active at each price, and this application reads neither.",
          },
          {
            name: "Gas, and the cost of following the price",
            summary:
              "A range the price has left has to be closed and reopened to follow it, which costs gas and turns a divergence on paper into one that has been realised. None of that is counted anywhere here.",
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
            name: "What a hook actually does",
            summary:
              "A v4 page says what a hook is permitted to do, because the protocol enforces that much and it is read out of the hook's own address. Reading the contract to say what it does with those permissions is a different problem, and this application does not attempt it.",
          },
          {
            name: "Hook discovery",
            summary:
              "Finding published hooks relevant to a goal, with their limitations stated plainly.",
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
      "None of this is what a position would earn. That would be these fees multiplied by your share of the liquidity active in the range while the swaps happened — a share this application does not read, for a deposit it will not size. There is no yield figure here on purpose.",
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
    days: (days: string) => `${days} days`,
    sigma: (value: string) => `${value}σ`,
    /** A word for the offered widths; a width typed into the URL gets none. */
    widthChoice: (sigma: string, word: string | null) =>
      word === null ? sigma : `${word} (${sigma})`,
    widthWords: { tight: "Tight", medium: "Medium", wide: "Wide", veryWide: "Very wide" },
    note: "The horizon says how far the measured movement is laid forward. It does not change the measurement: volatility always comes from the last 30 completed days, whichever horizon is chosen. The width multiplies that movement; a wider range is left less often, and it is not a confidence level.",
    fellBack:
      "Part of what was asked for could not be read, so the default was used where that happened. The horizon and width actually used are shown above.",
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
    poolSummary: (protocol: string, fee: string) =>
      `Uniswap ${protocol} · Ethereum mainnet · ${fee}`,
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
      "Bir Ethereum mainnet Uniswap v3 havuzu için, fiyatının gerçekte ne kadar hareket ettiğinden çizilmiş bir fiyat aralığı.",
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
      "Havuzu paritesinden ara, ya da bir v3 havuz adresi veya v4 havuz kimliği yapıştır. Havuzun doğrulanmış yapılandırmasını ve güncel durumunu, son bir ayın günlük fiyatlarını önerilen aralığa çizilmiş hâlde, paritenin gerçekte ne kadar hareket ettiğini ve bundan çıkan aralığı görürsün — ufuk da genişlik de senin elinde. Yanında: havuzun ne komisyon aldığı ve gerçekte ne topladığı, son günlerinin aralığa göre nerede durduğu, aynı yöntemin hiç görmediği günlerde ne yaptığı, bir pozisyonun sadece tutmaya kıyasla neyden vazgeçtiği, ve diğer genişliklerin her birinin ne yapacağı. Bir v4 havuzu ayrıca hook'unun neye izinli olduğunu, hook'un kendi adresinden okunmuş hâliyle sade cümlelerle söyler. Bir adres, tuttuğu tokenların girebileceği havuzlar için sorgulanabilir. Sonra hepsinin gündelik dille açıklaması, Türkçe ya da İngilizce. Bu sayıların hiçbirine model dokunmuyor, hiçbiri bir boşluğu doldurmak için tahmin edilmiyor, ve metnin kendi başına bir sayı koyacağı yer yok.",
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
            name: "Bir yatırımın ne kazanacağı",
            summary:
              "Havuzun aldığı komisyonlar ölçülüp gösteriliyor; belli bir yatırımın bunlardan ne kadarını alacağı gösterilmiyor. Bunun için bir pozisyon büyüklüğü ve o pozisyonun her fiyatta aktif olan likidite içindeki payı gerekir; bu uygulama ikisini de okumaz.",
          },
          {
            name: "Gas, ve fiyatı takip etmenin maliyeti",
            summary:
              "Fiyatın terk ettiği bir aralık, fiyatı takip etmek için kapatılıp yeniden açılmalıdır; bu hem gas harcar hem de kâğıt üstündeki bir sapmayı gerçekleşmiş bir sapmaya çevirir. Bunların hiçbiri burada hesaba katılmıyor.",
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
            name: "Bir hook'un gerçekte ne yaptığı",
            summary:
              "Bir v4 sayfası, hook'un neye izinli olduğunu söyler; çünkü protokolün zorladığı kısım budur ve hook'un kendi adresinden okunur. O izinlerle ne yaptığını söylemek için sözleşmeyi okumak gerekir, bu ayrı bir problemdir ve bu uygulama ona girişmez.",
          },
          {
            name: "Hook keşfi",
            summary:
              "Bir hedefe uygun yayımlanmış hook'ları bulmak ve sınırlarını açıkça belirtmek.",
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
      "Bunların hiçbiri bir pozisyonun kazanacağı miktar değil. O, bu komisyonların, takaslar olurken aralıkta aktif olan likiditedeki payınla çarpımı olurdu — bu uygulamanın okumadığı bir pay, ve büyüklüğünü belirlemeyeceği bir yatırım için. Burada bilerek bir getiri rakamı yok.",
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
    days: (days: string) => `${days} gün`,
    sigma: (value: string) => `${value}σ`,
    widthChoice: (sigma: string, word: string | null) =>
      word === null ? sigma : `${word} (${sigma})`,
    widthWords: { tight: "Dar", medium: "Orta", wide: "Geniş", veryWide: "Çok geniş" },
    note: "Ufuk, ölçülen hareketin ne kadar ileriye taşındığını söyler. Ölçümün kendisini değiştirmez: hangi ufuk seçilirse seçilsin volatilite her zaman tamamlanmış son 30 günden gelir. Genişlik o hareketi çarpar; daha geniş bir aralık daha seyrek terk edilir ve bir güven düzeyi değildir.",
    fellBack:
      "İstenenlerin bir kısmı okunamadı, o alanda varsayılan kullanıldı. Gerçekten kullanılan ufuk ve genişlik yukarıda yazıyor.",
  },

  holdings: {
    heading: "Bu adres ne tutuyor",
    intro:
      "Bu adreste bulunan tokenlar ve girebilecekleri havuzlar. Burada hiçbir şey saklanmıyor ve adres zaten herkese açık bilgi — aynı liste, bakan herkese görünür.",
    forAddress: "Adres",
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
    poolSummary: (protocol: string, fee: string) =>
      `Uniswap ${protocol} · Ethereum mainnet · ${fee}`,
    feePerSwap: (fee: string) => `her takasta ${fee} komisyon`,
    feePlusProtocol: (fee: string, protocol: string) =>
      `her takasta ${fee} komisyon, artı protokole ${protocol}`,
    noDeclaredFee: "komisyonu her takasta hook'u belirliyor",
    caveatsHeading: (count: number) =>
      count === 1
        ? "Bu sayılar için bir çekince geçerli."
        : `Bu sayılar için ${count} çekince geçerli.`,
    caveatsAriaLabel: "Çekinceler",

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
};

const dictionaries: Record<Locale, Dictionary> = { en, tr };

export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale];

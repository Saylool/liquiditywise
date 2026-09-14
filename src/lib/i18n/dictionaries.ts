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
      "None of the above exists yet. What does is everything higher up this page: a pool found by name, figures computed and cross-checked, and prose that is verified before it is shown. There is no persistence, no account and no wallet connection anywhere in the codebase — this advisor explains and suggests, and can never sign or send a transaction on your behalf.",
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
    inSample:
      "These are the same days the range was measured from, so this describes how the band was fitted rather than testing how it holds up. The range is also centred on today's price, which nobody could have opened a month ago. Read it as how the pool's recent movement sits against the range being suggested, not as a backtest.",
    notYourEarnings:
      "None of this is what a position would earn. That would be these fees multiplied by your share of the liquidity active in the range while the swaps happened — a share this application does not read, for a deposit it will not size. There is no yield figure here on purpose.",
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

  parameters: {
    heading: "Change the range",
    apply: "Recalculate",
    days: (days: string) => `${days} days`,
    sigma: (value: string) => `${value}σ`,
    note: "The horizon says how far the measured movement is laid forward. It does not change the measurement: volatility always comes from the last 30 completed days, whichever horizon is chosen. A larger multiplier makes the range wider, and is not a confidence level.",
    fellBack:
      "Part of what was asked for could not be read, so the default was used where that happened. The horizon and multiplier actually used are shown above.",
  },

  search: {
    label: "A pair, or a pool address",
    placeholder: "WETH/USDC",
    help: "Type a pair like WETH/USDC, or paste the address of the pool contract itself. Read-only: this application never connects a wallet and never sends a transaction.",
    submit: "Find pools",

    heading: "Matching pools",
    resultsFor: (terms: string) => `Pools whose tokens match ${terms}.`,
    empty: (terms: string) =>
      `No Ethereum mainnet Uniswap v3 pool has a token matching ${terms}.`,
    emptyHint: "Check the spelling, or paste the pool's address if you have it.",

    /*
     * The ordering is the one claim a list makes, so it is stated rather than
     * left to be inferred from the order itself.
     */
    ordering:
      "Pools named exactly what you searched for come first. After that the order follows the value the data source reports as locked in each pool — the source's own dollar figure, not one this application computed or checked.",
    /*
     * The sentence that does the real work on this page. Search is what lets
     * someone reach a pool they did not go looking for.
     */
    symbolWarning:
      "A symbol comes from the token's own contract, and deploying a token that calls itself USDC costs nothing. The contract addresses under each pair are what tell two tokens apart.",

    feeTier: "Fee tier",
    reportedLiquidity: "Reported liquidity",
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
    poolSummary: (feeTier: string, tickSpacing: string) =>
      `Uniswap v3 on Ethereum mainnet · ${feeTier} fee tier · tick spacing ${tickSpacing}`,
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
      "Yukarıdakilerin hiçbiri henüz yok. Olan şey, bu sayfada daha yukarıda anlatılanların tamamı: adıyla bulunan bir havuz, hesaplanıp çapraz doğrulanmış sayılar, ve gösterilmeden önce doğrulanan bir metin. Kod tabanının hiçbir yerinde kalıcı depolama, hesap ya da cüzdan bağlantısı yok — bu danışman açıklar ve önerir; senin adına asla bir işlem imzalayamaz veya gönderemez.",
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
    inSample:
      "Bunlar, aralığın kendisinden ölçüldüğü günlerin ta kendisi; yani bu, bandın nasıl oturtulduğunu anlatır, ne kadar tuttuğunu sınamaz. Aralık ayrıca bugünkü fiyata göre ortalanmış — bir ay önce kimse onu açamazdı. Bir geriye dönük test olarak değil, havuzun son dönem hareketinin önerilen aralığa göre nerede durduğu olarak oku.",
    notYourEarnings:
      "Bunların hiçbiri bir pozisyonun kazanacağı miktar değil. O, bu komisyonların, takaslar olurken aralıkta aktif olan likiditedeki payınla çarpımı olurdu — bu uygulamanın okumadığı bir pay, ve büyüklüğünü belirlemeyeceği bir yatırım için. Burada bilerek bir getiri rakamı yok.",
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

  parameters: {
    heading: "Aralığı değiştir",
    apply: "Yeniden hesapla",
    days: (days: string) => `${days} gün`,
    sigma: (value: string) => `${value}σ`,
    note: "Ufuk, ölçülen hareketin ne kadar ileriye taşındığını söyler. Ölçümün kendisini değiştirmez: hangi ufuk seçilirse seçilsin volatilite her zaman tamamlanmış son 30 günden gelir. Daha büyük bir çarpan aralığı genişletir; bir güven düzeyi değildir.",
    fellBack:
      "İstenenlerin bir kısmı okunamadı, o alanda varsayılan kullanıldı. Gerçekten kullanılan ufuk ve çarpan yukarıda yazıyor.",
  },

  search: {
    label: "Bir parite ya da havuz adresi",
    placeholder: "WETH/USDC",
    help: "WETH/USDC gibi bir parite yaz, ya da havuz sözleşmesinin kendi adresini yapıştır. Salt okunur: bu uygulama asla cüzdan bağlamaz ve işlem göndermez.",
    submit: "Havuz bul",

    heading: "Eşleşen havuzlar",
    resultsFor: (terms: string) => `Tokenları ${terms} ile eşleşen havuzlar.`,
    empty: (terms: string) =>
      `Ethereum mainnet üzerinde ${terms} ile eşleşen tokenı olan bir Uniswap v3 havuzu bulunamadı.`,
    emptyHint: "Yazımı kontrol et, ya da havuzun adresi elindeyse onu yapıştır.",

    ordering:
      "Tam olarak arattığın adı taşıyan havuzlar önce gelir. Sonrası, veri kaynağının her havuzda kilitli olduğunu bildirdiği değere göre sıralanır — kaynağın kendi dolar rakamı, bu uygulamanın hesapladığı ya da doğruladığı bir şey değil.",
    symbolWarning:
      "Sembol, tokenın kendi sözleşmesinden gelir; kendine USDC diyen bir token çıkarmanın hiçbir maliyeti yoktur. İki tokenı birbirinden ayıran şey, her paritenin altındaki sözleşme adresleridir.",

    feeTier: "Komisyon kademesi",
    reportedLiquidity: "Bildirilen likidite",
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
    poolSummary: (feeTier: string, tickSpacing: string) =>
      `Ethereum mainnet üzerinde Uniswap v3 · ${feeTier} komisyon kademesi · tick adımı ${tickSpacing}`,
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

import type { Locale } from "./locales";

/*
 * The methodology page's own words: how every figure on the site is made, from
 * what, and what each one leaves out.
 *
 * Written from the code, not from what the code was meant to do. Every
 * sentence below summarises an implementation and the block comment above it
 * — the volatility in analytics/historicalVolatility.ts, the band in
 * logSymmetricBand.ts, the deposit's share in depositFeeShare.ts, the hook
 * rule in advisor/feeDisclosure.ts, what is checked about a hook in
 * advisor/hookCheck.ts and getHookChecks.ts, the re-centring strategy in
 * recentringReplay.ts, the smart fifth in smartLiquidity.ts, an
 * open position's record in advisor/positionRecord.ts, the explanation's
 * contract in schemas/interpretation.ts — and where one of those
 * changes, the sentence here is wrong until it is changed too.
 *
 * The figures a sentence names that the code holds as constants — the
 * thirty-one closes, the size and window floors, the share counted as smart,
 * the pair page's floor, the chains — are not written into the prose. They
 * arrive as `MethodFigures`, formatted from those constants for the reader's
 * language, so a floor moved in the code moves on this page with it. What is
 * spelled out in words here is spelled out in words in the code's own
 * comments too.
 *
 * Nothing on it is advice, and the page says so.
 */

/** The sections, in reading order; each is also the anchor it is linked to. */
export const METHOD_SECTION_IDS = [
  "suggested-range",
  "out-of-sample",
  "recentring",
  "fees",
  "hooks",
  "smart-liquidity",
  "position-record",
  "pair",
  "language-model",
  "data-sources",
] as const;

export type MethodSectionId = (typeof METHOD_SECTION_IDS)[number];

/** The code's own constants, already formatted for the reader's language. */
export type MethodFigures = {
  /** Daily closes a volatility is measured from. */
  readonly closes: string;
  /** The daily returns those closes give. */
  readonly returns: string;
  /** Days of closes the history reader asks for. */
  readonly historyDays: string;
  /** Days a year is counted as when a volatility is annualised. */
  readonly yearDays: string;
  /** The horizons the form offers, as a list ending in "or". */
  readonly horizons: string;
  readonly defaultHorizon: string;
  /** The widths the form offers, in standard deviations, as a list ending in "or". */
  readonly multipliers: string;
  readonly defaultMultiplier: string;
  /** How far behind the chain a pool's current state may be, in minutes. */
  readonly freshMinutes: string;
  /** How many of the week's most traded v3 pools the smart-liquidity page reads. */
  readonly smartPools: string;
  /** The most positions per pool whose earnings are read from the chain. */
  readonly positionsPerPool: string;
  readonly minPositionUsd: string;
  readonly minWindowDays: string;
  /** The share, by yield, counted as smart. */
  readonly smartShare: string;
  /** Measurements needed before anyone is said to keep showing up. */
  readonly ownerSets: string;
  readonly pairFloorUsd: string;
  /** Every network the site reads, as a list. */
  readonly chains: string;
  /** The networks whose positions can be listed. */
  readonly smartChains: string;
  /** The networks read for v4 only. */
  readonly v4OnlyChains: string;
  /** How many of a hook's pools are counted before the count is said to be at least that. */
  readonly hookPoolCap: string;
  /** Hours an answer about a hook is kept. */
  readonly hookCheckHours: string;
  /** Minutes before a question about a hook that went unanswered is asked again. */
  readonly hookCheckRetryMinutes: string;
};

export type MethodSection = {
  readonly title: string;
  readonly paragraphs: (figures: MethodFigures) => readonly string[];
};

export type MethodCopy = {
  /** Where the page is linked from: the footer and the about page. */
  readonly link: string;
  /** Beside the short method notes on the smart-liquidity and pair pages, leading here. */
  readonly pointer: string;
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly lead: string;
  readonly contentsHeading: string;
  readonly sections: { readonly [Id in MethodSectionId]: MethodSection };
  readonly notAdvice: string;
};

const en: MethodCopy = {
  link: "How it works",
  pointer: "How this is measured, in full",
  title: "How it works",
  description:
    "How every figure on LiquidityWise is made — the suggested range, the backtests, fees, impermanent loss, v4 hooks, smart liquidity and the written explanation — from what data, and what each one leaves out.",
  heading: "How every figure is made",
  lead: "Every figure on this site is computed by plain code from a pool's indexed data and from the chain itself, and checked before it is shown; a language model only describes the figures afterwards. This page says, section by section, how each one is made and what it leaves out. It summarises the code; it makes no promise about any pool.",
  contentsHeading: "On this page",
  sections: {
    "suggested-range": {
      title: "The suggested range",
      paragraphs: (f) => [
        `It starts from the pool's own daily closing prices, as its subgraph publishes them: the last ${f.closes} completed UTC days, leaving out today because it has not closed yet. Those give ${f.returns} daily returns, each the difference between the logarithms of two consecutive closes. A day missing from the source is skipped — never filled in, carried forward or interpolated — and the page says when the window had gaps.`,
        `The volatility is the sample standard deviation of those returns, scaled to a year by the square root of ${f.yearDays}. It is then scaled to the horizon you choose (${f.horizons} days; ${f.defaultHorizon} unless you choose) by the square root of the horizon's share of a year, and multiplied by the width you choose (in standard deviations: ${f.multipliers}; ${f.defaultMultiplier} unless you choose). The horizon only says how far the measured movement is laid forward: the movement is always measured over the same last ${f.returns} days.`,
        `The band is laid around today's price symmetrically in logarithms, with no drift: halving and doubling are the same distance, which is why the two percentages either side differ. Its edges are then moved outward onto the pool's tick grid, never inward, so the range always covers at least the band. Two checks guard it: the pool's current price must convert to the tick the pool itself reports, and it must come from a block at most ${f.freshMinutes} minutes behind the chain.`,
        `It is not a forecast: it says how far the price has moved, not where it will go. And the width is not a confidence level — turning "two standard deviations" into "95% of the time" needs an assumption about how prices are distributed that has not been established. It does not size a position or say how much of either token to deposit.`,
      ],
    },
    "out-of-sample": {
      title: "Checked on days it never saw",
      paragraphs: (f) => [
        `The site reads ${f.historyDays} days of closes — more than the volatility needs — so the method can be tested on days it was not fitted to. It is stepped back one horizon, fitted again on the ${f.closes} closes before that point and nothing after, centred on the close at that point, and laid over the days that followed; then the same again further back, for as long as the history has room. Each day counts as entirely inside, entirely outside or across an edge: a day's high and low cannot say where in the day the price was, so a crossing day is never split by a guess.`,
        "That is a few stretches of one pool, not a measure of how often the method works. Consecutive fits overlap, so the stretches are not independent of each other, and nobody held these bands.",
        `"Opened thirty days ago" replays the range the method would have drawn at the start of the last thirty days — from the ${f.closes} closes before it and nothing after — over each of those days. It gives two figures. Worth against holding, at each day's close, comes from the exact concentrated-liquidity amounts and needs no dollar price. Fees come from the pool's own daily fees on the days the price stayed wholly inside, shared out as the deposit figure shares them, with the deposit sized at today's dollar rate because the history has no daily one.`,
        `"Try your own range" replays two prices you type over the same thirty days, from the same opening close, with the same fee sharing and the same dollar rate, so the only difference between the two columns is the range. A range that does not hold the opening price starts with only one of the two tokens and takes no fees until the price reaches it. A range that did well over these days says nothing about the next ones.`,
      ],
    },
    recentring: {
      title: "Re-centring when the price leaves",
      paragraphs: () => [
        "\"Re-centre when the price leaves\" replays one simple active strategy over the same thirty days as \"Opened thirty days ago\", from the same opening close and in the same range. At each later day's close, if the close is outside the range, the position is re-centred there: what it holds — by then only one of the two tokens — is swapped into the mix a range of the same width centred on that close needs, and what is left after the swap's fee is the new position. The width is the opening range's, as multiples of its centre, so a re-centre moves the range and never redraws it. Fees are counted exactly as in the static replay, day by day, for the range held that day, and kept aside rather than reinvested.",
        "The swap pays the fee the pool's own terms say a swap pays — a v3 tier, or a v4 key's fee with the protocol's cut, in the swap's direction. Where nothing fixed says, because a hook sets the fee per swap, it pays the rate the month's swaps actually paid, fees over volume, and the page says so; where a hook may change what a swap pays, the page says the cost may differ. Price impact is not modelled: each swap is priced at the close, as if the pool could take it whole. Gas is counted only if you set a cost per re-centre, in dollars like the deposit, and it is paid from outside the position; opening costs both the same and is counted in neither.",
        "It sees daily closes and nothing else. A price that left the range and came back within a day is not a re-centre, and a re-centre happens at the close rather than at the edge — usually past it. Every dollar figure is at today's rate, as the deposit's are. The page sets the end value, everything counted, beside holding the deposit's opening tokens and beside the same range never re-centred; a month with no re-centre is that range exactly. It is one strategy over one month that already happened, and it is not advice.",
      ],
    },
    fees: {
      title: "Fees and impermanent loss",
      paragraphs: () => [
        "What the pool charged comes from the fees and volume its subgraph publishes for each of the last thirty days. Dividing a day's fees by its volume measures the rate swappers actually paid — the typical day, the lowest and highest, and the whole window as total fees over total volume — and it is set against the fee the pool states. A day with no volume is left out rather than counted as zero.",
        `What a deposit would have taken: on each day the price stayed wholly inside the range, a share L / (A + L) of that day's fees, where L is the liquidity the deposit buys in the range and A is the liquidity the source reports active that day. The "+ L" is the deposit diluting itself, which is why a larger deposit does not collect proportionally more. Days that crossed an edge are not counted, and an inside day the source published no fees or no active liquidity for is reported as such, not as zero.`,
        "Turning dollars into the pool's liquidity needs a dollar price, and the site uses the subgraph's own, derived from what the pool holds in each token and in dollars — the rate its fee figures are in. It is today's rate applied to past days, and the page says so. The result is fees only, over days that have already happened: not a yearly rate, and not what the next month will pay.",
        "Impermanent loss — the position against simply holding the two tokens — is the exact arithmetic of the protocol's curve between the range's edges, from today's price to each price shown. It needs no market data and no deposit size, because liquidity cancels out of the ratio. It is only impermanent if the price comes back. It counts price movement and nothing else, and fees are what a provider is paid for bearing it, so the two have to be read together.",
      ],
    },
    hooks: {
      title: "v4 hooks",
      paragraphs: (f) => [
        "A v4 pool may name a hook, a contract the protocol calls at fixed moments. Its permissions are read from its address: a hook is deployed to an address whose lowest fourteen bits say which callbacks the PoolManager will call, and the PoolManager checks those bits rather than asking the contract. So the site reads the rule the protocol enforces, not a registry, a label or the contract's own description — and it says what a hook may do, never what it does.",
        "A hook allowed to act before a swap can rewrite its fee; one allowed to return a delta from a swap can take part of the swap itself. When a pool's hook holds either, every fee figure tied to a range or a deposit is withheld — the fees while inside, a deposit's share, the fees in the thirty-day replay, the yield on the pair page — because nothing in the source separates the hook's share from the providers'. What the pool charged is still shown, as a fact about the pool, and the panels showing what a swap costs carry a note. A pool whose key fixes no fee is shown as having none, and the rate it actually charged is measured from its days.",
        `Beside the permissions, the hooks page and a v4 pool's page show two things anyone can check from outside. Whether a hook's source code is verified is asked, from the server and with no key, of Sourcify and of the network's own Blockscout: verified on either is shown as verified, with the contract's name from Blockscout where it gives one and from Sourcify otherwise; verified on neither is shown as not found; a source that did not answer within a few seconds, or answered in a way not understood, leaves it shown as not checked. Verified means the source published for the address compiles to the code deployed there, so it can be read; it is not an audit, and it says nothing about whether the hook is safe. How many v4 pools on the network name the hook, and when the first of them was created, comes from the network's v4 subgraph, counted up to ${f.hookPoolCap}. Answers are kept for ${f.hookCheckHours} hours and a question that went unanswered is asked again after ${f.hookCheckRetryMinutes} minutes; a page never waits on one for long, and says the check could not be made instead.`,
      ],
    },
    "smart-liquidity": {
      title: "Smart liquidity",
      paragraphs: (f) => [
        `On each network where positions can be listed (${f.smartChains}), the page looks into the week's ${f.smartPools} most traded v3 pools, takes the positions in range right now, and asks the chain about up to ${f.positionsPerPool} per pool, largest first, each worth at least ${f.minPositionUsd}. It is measured again every six hours.`,
        `A position's fees are what it has earned since it was last changed: its liquidity times the fee growth inside its range since the position manager last wrote its snapshot, read from the chain. Each position's pair, fee and ticks must lead back to the pool it was listed in. Those fees, over what the position is worth now, over the days since that change, scaled to a year, are its yield. Positions under ${f.minPositionUsd}, or changed less than ${f.minWindowDays} days ago, are left out as too small or too new to say anything; the ${f.smartShare} with the highest yield are the smart ones.`,
        "The subgraph lists the positions and dates each one's last change, and nothing more. Its fee fields are not used: checked on 2026-09-30, they reported two billion dollars collected by a position that had deposited thirty-two million. The position manager's owed amounts are not counted either, because after a withdrawal they hold the withdrawn principal until it is collected.",
        "What the yield leaves out: it is fees only, and what a position gave up against holding the two tokens is not in it. It covers one window per position, it reads only positions in range now, and it says nothing about what any of them will earn next or about who holds them.",
        `Each measurement is kept, so the page can say how things moved over the last week once a day of measurements exists. A pair's range is compared as prices, never as distances from the current price, because those move whenever the price does even if nobody touches a position. "Holders that keep showing up" are addresses in the top ${f.smartShare} in at least half of the measurements, once there are ${f.ownerSets} or more. Each is marked a wallet or a contract from whether the chain holds code at its address: a contract is a vault, a bot or another program, and its yield is that program's.`,
      ],
    },
    "position-record": {
      title: "How an open position has done",
      paragraphs: () => [
        "Where an address is looked up, each open v3 position it holds carries a record of how it has done since it was opened. What was deposited, and what was withdrawn as principal, are the running totals the network's positions subgraph keeps at each change to the position. What is in it now is worked out from its liquidity, its two ticks and the pool's square-root price, all read from the chain. Its fees are not taken from the subgraph's fee fields, which are unusable: between one change and the next a position's liquidity does not move, so what it earned in that stretch is its liquidity times the fee growth inside its range between the snapshots the position manager wrote at either end. The stretch since the last change is read from the chain, as the fees not yet collected are.",
        "A record is shown only when the history provably reaches the present: the newest change the subgraph holds must carry exactly the liquidity and the fee-growth snapshot the position manager holds now, the history must include a deposit, and every row of it must have been read. Otherwise the position says its history could not be checked, and shows no figures rather than a partial sum. The v4 indexers keep no history for each position, so a v4 position has no record.",
        "Everything in a record is valued at today's price, in the token the page quotes the pair in. Against what the deposits would be worth had they simply been held, it sets what the position holds now, plus what was withdrawn, plus its fees; the difference is split into the fees and the range effect, which is the position against holding before fees — what is usually called impermanent loss. Deposits and withdrawals are valued at today's price, not at the price on their day, and gas is not counted. A record covers the position's whole life, under every owner it has had, and it is a measurement, not advice.",
      ],
    },
    pair: {
      title: "One pair, every pool",
      paragraphs: (f) => [
        "The pair page lists every v3 and v4 pool whose two symbols are exactly the pair typed, on every network the site reads. Each is ranked by the fees it charged over the last week, over what is in it now, scaled to a year — simple, not compounded. That is past fees over present liquidity: not a forecast, and not what a position would earn, since a position earns only while the price is inside its range, shares the fees with everyone else there, and gives up something against holding.",
        `What is in a pool is measured differently on each protocol, so the two are ranked apart: on v3, what the pool's token contracts hold for it; on v4, whose tokens all sit in one PoolManager, its depth at the current price. Only pools worth at least ${f.pairFloorUsd} are ranked — below that, one afternoon's trading moves the figure too much and a lookalike token is likelier — and the rest are listed below by size, without a yield. A v4 pool whose hook may change what swaps pay shows its fees with a note and no yield. A network that cannot be read is listed as such.`,
      ],
    },
    "language-model": {
      title: "The written explanation",
      paragraphs: () => [
        "On a pool's page, after every figure has been computed and checked, a language model writes four short paragraphs: what the range covers, what happens when the price leaves it, what the volatility measures and what it does not, and what the analysis leaves out. It is given the figures as the page shows them, in the reader's language, with the directions already written out as sentences. Nothing a visitor writes reaches it except a pool address that has passed a strict format check — no token description, no free text — and no tick reaches it at all.",
        "It is told never to state a number, never to advise and never to predict. That is enforced, not only asked: every paragraph is checked before it is shown. One containing a digit in any script — Arabic, Devanagari and full-width digits, fractions and superscripts included — other than in the names v3 and v4, or a number from eleven upwards written as a word in any of the ten languages, is refused, as is one too short or too long. If any paragraph fails, the whole explanation is dropped and the figures stand on their own.",
        "What a check cannot enforce is tone; that is left to the instruction, and the page does not pretend otherwise. The page names the model that wrote the text, as the provider reports it, and the same explanation is reused for at most an hour for the same pool, settings and language.",
      ],
    },
    "data-sources": {
      title: "Data sources and limits",
      paragraphs: (f) => [
        `Pools are read from Uniswap's v3 and v4 subgraphs on The Graph, on ${f.chains}; ${f.v4OnlyChains} is read for v4 only. Where a subgraph is wrong or silent, the chain is asked directly, read-only: a v3 pool's tick spacing and what its token contracts hold, a v4 pool's liquidity and price from the PoolManager, a position's earnings and holder from the position manager, and whether an address holds code. Every subgraph is checked hourly.`,
        `A pool's current state must come from a block at most ${f.freshMinutes} minutes behind the chain, or it is refused. Daily histories are kept for the UTC day, the week's most traded pools for half an hour, searches and pair reads for ten minutes, and an explanation for an hour; the smart-liquidity measurement is refreshed every six hours.`,
        "When a source fails, the page says which part could not be made and shows the rest; a missing figure is shown as missing, never as zero, and never replaced by a guess. On the smart-liquidity page a pool that cannot be read costs that pool alone, and a failed refresh leaves the last measurement standing until it expires; on the pair page a network that cannot be read is listed as such. The explanation is the one part allowed to be missing.",
        "Nothing is kept about who reads the site. A visit is counted as a line naming the page, the pool if there is one (a public contract), the language and whether it looked like a bot — no IP address, no browser string, no search text, and never an address typed in to look up its positions. The one thing kept about a reader is a Telegram alert they set up themselves: the address they typed, their language, the chat's numeric id and whether each position was in range last time. /stop deletes it at once, and the backups lose it within seven days.",
      ],
    },
  },
  notAdvice:
    "Nothing on this page, or anywhere on the site, is financial advice. Every figure describes days that have already happened or the protocol's own arithmetic; none of them says what to do or what will happen next.",
};

const tr: MethodCopy = {
  link: "Nasıl çalışır",
  pointer: "Bunun nasıl ölçüldüğü, ayrıntısıyla",
  title: "Nasıl çalışır",
  description:
    "LiquidityWise'daki her rakamın nasıl üretildiği — önerilen aralık, geriye dönük testler, komisyonlar, geçici kayıp, v4 hook'ları, akıllı likidite ve yazılı açıklama — hangi veriden geldiği ve neyi dışarıda bıraktığı.",
  heading: "Her rakam nasıl üretilir",
  lead: "Bu sitedeki her rakam, havuzun indekslenmiş verisinden ve doğrudan zincirden düz kodla hesaplanır ve gösterilmeden önce kontrol edilir; bir dil modeli rakamları ancak ondan sonra anlatır. Bu sayfa, bölüm bölüm, her birinin nasıl üretildiğini ve neyi dışarıda bıraktığını söyler. Kodun bir özetidir; hiçbir havuz hakkında bir vaat değildir.",
  contentsHeading: "Bu sayfada",
  sections: {
    "suggested-range": {
      title: "Önerilen aralık",
      paragraphs: (f) => [
        `Başlangıç noktası havuzun kendi günlük kapanış fiyatlarıdır, subgraph'ının yayımladığı haliyle: tamamlanmış son ${f.closes} UTC günü; bugün henüz kapanmadığı için dışarıda kalır. Bunlardan ${f.returns} günlük getiri çıkar; her biri ardışık iki kapanışın logaritmaları arasındaki farktır. Kaynakta eksik olan bir gün atlanır — asla doldurulmaz, önceki günden taşınmaz ya da enterpolasyonla tahmin edilmez — ve pencerede boşluk varsa sayfa bunu söyler.`,
        `Volatilite, bu getirilerin örneklem standart sapmasıdır ve ${f.yearDays} sayısının karekökü ile yıllıklandırılır. Ardından seçtiğin ufka (${f.horizons} gün; seçmezsen ${f.defaultHorizon}) ufkun yıl içindeki payının karekökü ile ölçeklenir ve seçtiğin genişlikle (standart sapma cinsinden: ${f.multipliers}; seçmezsen ${f.defaultMultiplier}) çarpılır. Ufuk yalnızca ölçülen hareketin ne kadar ileriye taşındığını söyler: hareket her zaman aynı son ${f.returns} gün üzerinden ölçülür.`,
        `Bant bugünkü fiyatın etrafına logaritmada simetrik olarak, hiçbir eğilim eklenmeden yerleştirilir: yarıya inmek ile iki katına çıkmak aynı uzaklıktır; iki yandaki yüzdelerin farklı olmasının nedeni budur. Sonra kenarları havuzun tick ızgarasına dışarı doğru — asla içeri doğru değil — taşınır; böylece aralık her zaman en az bandı kapsar. İki kontrol onu korur: havuzun güncel fiyatı, havuzun kendi bildirdiği tick'e dönüşmelidir ve zincirin en fazla ${f.freshMinutes} dakika gerisindeki bir bloktan gelmelidir.`,
        `Bir tahmin değildir: fiyatın ne kadar hareket ettiğini söyler, nereye gideceğini değil. Genişlik de bir güven düzeyi değildir — "iki standart sapma"yı "zamanın %95'i"ne çevirmek, fiyatların nasıl dağıldığına dair henüz kanıtlanmamış bir varsayım gerektirir. Bir pozisyonu boyutlandırmaz ve iki tokendan ne kadar yatırılacağını söylemez.`,
      ],
    },
    "out-of-sample": {
      title: "Hiç görmediği günlerde sınandı",
      paragraphs: (f) => [
        `Site ${f.historyDays} günlük kapanış okur — volatilitenin ihtiyacından fazlasını — böylece yöntem, kurulmadığı günlerde sınanabilir. Yöntem bir ufuk geriye alınır, yalnızca o noktadan önceki ${f.closes} kapanışla yeniden kurulur, o noktadaki kapanışa ortalanır ve ardından gelen günlerin üzerine yerleştirilir; sonra geçmiş el verdikçe aynısı daha geriden tekrarlanır. Her gün tamamen içeride, tamamen dışarıda ya da bir kenarı aşmış sayılır: bir günün en yükseği ve en düşüğü, fiyatın gün içinde nerede olduğunu söyleyemez, bu yüzden kenarı aşan bir gün asla tahminle bölüştürülmez.`,
        "Bu, tek bir havuzun birkaç dönemidir; yöntemin ne sıklıkla tuttuğunun bir ölçüsü değildir. Ardışık kurulumlar birbiriyle örtüşür, bu yüzden dönemler birbirinden bağımsız değildir ve bu bantları kimse gerçekten tutmadı.",
        `"Otuz gün önce açılsaydı", yöntemin son otuz günün başında çizeceği aralığı — o günden önceki ${f.closes} kapanıştan, sonrasından hiçbir şey katmadan — o günlerin her biri üzerinde yeniden oynatır. İki rakam verir. Sadece tutmaya göre değer, her günün kapanışında, yoğunlaştırılmış likiditenin tam miktarlarından gelir ve dolar fiyatına ihtiyaç duymaz. Komisyonlar, fiyatın tamamen içeride kaldığı günlerde havuzun kendi günlük komisyonlarından gelir ve yatırım rakamının paylaştırdığı gibi paylaştırılır; geçmişte günlük dolar kuru olmadığı için yatırım bugünkü dolar kuruyla boyutlandırılır.`,
        `"Kendi aralığını dene", yazdığın iki fiyatı aynı otuz gün üzerinde, aynı açılış kapanışından, aynı komisyon paylaşımı ve aynı dolar kuruyla yeniden oynatır; böylece iki sütun arasındaki tek fark aralıktır. Açılış fiyatını içermeyen bir aralık iki tokendan yalnızca biriyle başlar ve fiyat ona ulaşana kadar komisyon almaz. Bu günlerde iyi giden bir aralık, sonraki günler hakkında hiçbir şey söylemez.`,
      ],
    },
    recentring: {
      title: "Fiyat çıkınca yeniden ortalamak",
      paragraphs: () => [
        "\"Fiyat çıkınca yeniden ortala\", basit bir aktif stratejiyi \"Otuz gün önce açılsaydı\" ile aynı otuz günde, aynı açılış kapanışından ve aynı aralıkta yeniden oynatır. Sonraki her günün kapanışında, kapanış aralığın dışındaysa pozisyon orada yeniden ortalanır: elindekiler — o noktada iki tokendan yalnızca biri — o kapanışı ortalayan aynı genişlikteki aralığın gerektirdiği karışıma takasla çevrilir ve takasın komisyonundan sonra kalan, yeni pozisyondur. Genişlik, açılış aralığınınkidir, merkezinin katları olarak; yani yeniden ortalama aralığı taşır, asla yeniden çizmez. Komisyon, sabit tekrardaki gibi gün gün, o gün tutulan aralık için sayılır ve yeniden yatırılmaz, kenara konur.",
        "Takas, havuzun kendi koşullarının bir takas için söylediği komisyonu öder — v3'te kademe, v4'te anahtarın komisyonu artı protokolün payı, takasın yönünde. Sabit hiçbir şey söylemiyorsa, çünkü komisyonu bir hook takas başına belirliyorsa, ayın takaslarının gerçekte ödediği oranı — hacme bölünmüş komisyonu — öder ve sayfa bunu söyler; bir hook bir takasın ödediğini değiştirebiliyorsa sayfa maliyetin farklı olabileceğini söyler. Fiyat etkisi modellenmez: her takas, havuz onu bütünüyle karşılayabilirmiş gibi kapanıştan fiyatlanır. Gas yalnızca yeniden ortalama başına bir maliyet girersen sayılır, yatırım gibi dolar cinsinden, ve pozisyonun dışından ödenir; açılış ikisine de aynı maliyettedir ve hiçbirinde sayılmaz.",
        "Günlük kapanışlardan başka hiçbir şey görmez. Aralıktan çıkıp aynı gün içinde geri dönen bir fiyat yeniden ortalama değildir ve yeniden ortalama kenarda değil kapanışta olur — çoğu zaman kenarın ötesinde. Dolar cinsinden her rakam, yatırımınkiler gibi bugünkü kurdandır. Sayfa, her şey sayılınca son değeri, yatırımın açılıştaki tokenlarını elde tutmanın ve aynı aralığın hiç yeniden ortalanmamasının yanına koyar; hiç yeniden ortalanmayan bir ay tam olarak o aralıktır. Zaten yaşanmış tek bir aydaki tek bir stratejidir ve yatırım tavsiyesi değildir.",
      ],
    },
    fees: {
      title: "Komisyonlar ve geçici kayıp",
      paragraphs: () => [
        "Havuzun ne aldığı, subgraph'ının son otuz günün her biri için yayımladığı komisyon ve hacimden gelir. Bir günün komisyonunu o günün hacmine bölmek, takas yapanların gerçekte ödediği oranı ölçer — tipik gün, en düşük ve en yüksek gün, ve toplam komisyonun toplam hacme bölümü olarak bütün pencere — ve bu, havuzun beyan ettiği komisyonla karşılaştırılır. Hacmi olmayan bir gün sıfır sayılmaz, dışarıda bırakılır.",
        `Bir yatırımın ne alacağı: fiyatın tamamen aralık içinde kaldığı her gün, o günün komisyonlarının L / (A + L) kadarı; burada L yatırımın aralıkta satın aldığı likidite, A ise kaynağın o gün aktif olarak bildirdiği likiditedir. "+ L", yatırımın kendini seyreltmesidir; daha büyük bir yatırımın orantılı olarak daha fazla toplamamasının nedeni budur. Bir kenarı aşan günler sayılmaz; kaynağın komisyon ya da aktif likidite yayımlamadığı bir iç gün de sıfır olarak değil, öyle olduğu belirtilerek bildirilir.`,
        "Doları havuzun likiditesine çevirmek bir dolar fiyatı gerektirir ve site, subgraph'ın kendi fiyatını kullanır: havuzun her tokendan ve dolar olarak ne tuttuğundan türetilen, komisyon rakamlarının da cinsinden olduğu kur. Geçmiş günlere uygulanan bugünkü kurdur ve sayfa bunu söyler. Sonuç yalnızca komisyondur, zaten yaşanmış günler üzerinden: yıllık bir oran değildir ve gelecek ayın ne ödeyeceği değildir.",
        "Geçici kayıp — pozisyonun iki tokenı sadece tutmaya kıyasla durumu — protokolün eğrisinin aralığın kenarları arasındaki tam aritmetiğidir; bugünkü fiyattan gösterilen her fiyata kadar. Piyasa verisine ve yatırım büyüklüğüne ihtiyaç duymaz, çünkü likidite orandan sadeleşir. Yalnızca fiyat geri gelirse geçicidir. Fiyat hareketinden başka bir şey saymaz ve komisyonlar, likidite sağlayıcısına tam da bunu üstlendiği için ödenen şeydir; bu yüzden ikisi birlikte okunmalıdır.",
      ],
    },
    hooks: {
      title: "v4 hook'ları",
      paragraphs: (f) => [
        "Bir v4 havuzu bir hook belirleyebilir: protokolün belirli anlarda çağırdığı bir sözleşme. İzinleri adresinden okunur: bir hook, en alttaki on dört biti PoolManager'ın hangi geri çağrıları yapacağını söyleyen bir adrese kurulur ve PoolManager sözleşmeye sormak yerine bu bitleri kontrol eder. Yani site protokolün zorunlu kıldığı kuralı okur; bir kayıt listesini, bir etiketi ya da sözleşmenin kendi tanımını değil — ve bir hook'un ne yapabileceğini söyler, ne yaptığını asla.",
        "Takastan önce devreye girmesine izin verilen bir hook komisyonu yeniden yazabilir; bir takastan delta döndürmesine izin verilen bir hook takasın bir kısmını kendisi alabilir. Bir havuzun hook'u bunlardan birine sahipse, bir aralığa ya da bir yatırıma bağlanan her komisyon rakamı gösterilmez — içerideyken alınan komisyonlar, bir yatırımın payı, otuz günlük yeniden oynatmadaki komisyonlar, parite sayfasındaki verim — çünkü kaynakta hiçbir şey hook'un payını likidite sağlayıcılarınınkinden ayırmaz. Havuzun aldığı komisyon, havuz hakkında bir olgu olarak yine gösterilir ve bir takasın maliyetini gösteren paneller bir not taşır. Anahtarı sabit bir komisyon taşımayan havuz böyle gösterilir ve gerçekte aldığı oran günlerinden ölçülür.",
        `İzinlerin yanında, v4 hook'ları sayfası ve bir v4 havuzunun sayfası herkesin dışarıdan bakabileceği iki şey daha gösterir. Bir hook'un kaynak kodunun doğrulanmış olup olmadığı, sunucudan ve anahtarsız olarak Sourcify'a ve ağın kendi Blockscout'una sorulur: ikisinden birinde doğrulanmışsa doğrulanmış gösterilir, sözleşmenin adı Blockscout veriyorsa ondan, vermiyorsa Sourcify'dan alınır; ikisinde de doğrulanmamışsa bulunamadı olarak gösterilir; birkaç saniye içinde cevap vermeyen ya da anlaşılmayan bir biçimde cevap veren bir kaynak, durumu kontrol edilemedi olarak bırakır. Doğrulanmış, adres için yayımlanan kaynağın orada dağıtılmış koda derlendiği, yani okunabileceği anlamına gelir; bir denetim değildir ve hook'un güvenli olup olmadığı hakkında hiçbir şey söylemez. Ağda kaç v4 havuzunun hook'un adını verdiği ve ilkinin ne zaman oluşturulduğu ağın v4 subgraph'ından gelir; en fazla ${f.hookPoolCap} tanesi sayılır. Cevaplar ${f.hookCheckHours} saat saklanır, cevapsız kalan bir soru ${f.hookCheckRetryMinutes} dakika sonra yeniden sorulur; bir sayfa hiçbirini uzun süre beklemez, onun yerine kontrolün yapılamadığını söyler.`,
      ],
    },
    "smart-liquidity": {
      title: "Akıllı likidite",
      paragraphs: (f) => [
        `Pozisyonların listelenebildiği her ağda (${f.smartChains}) sayfa, haftanın en çok işlem gören ${f.smartPools} v3 havuzuna bakar, şu an aralık içinde olan pozisyonları alır ve havuz başına en büyüklerden başlayarak, her biri en az ${f.minPositionUsd} değerinde olan ${f.positionsPerPool} pozisyona kadarını zincire sorar. Ölçüm altı saatte bir yenilenir.`,
        `Bir pozisyonun komisyonu, son değiştirildiğinden beri kazandığıdır: likiditesi çarpı, pozisyon yöneticisinin anlık kaydını son yazdığı andan beri aralığı içindeki komisyon büyümesi; zincirden okunur. Her pozisyonun çifti, komisyon kademesi ve tick'leri listelendiği havuza çıkmalıdır. Bu komisyon, pozisyonun bugünkü değerine ve o değişiklikten bu yana geçen günlere bölünüp yıllığa çevrildiğinde verimidir. ${f.minPositionUsd} altındaki ya da ${f.minWindowDays} günden kısa süre önce değiştirilmiş pozisyonlar, bir şey söylemek için fazla küçük ya da fazla yeni oldukları için dışarıda kalır; verimi en yüksek ${f.smartShare} akıllı sayılır.`,
        "Subgraph pozisyonları listeler ve her birinin son değişikliğini tarihler, başka bir şey değil. Komisyon alanları kullanılmaz: 2026-09-30'da kontrol edildiğinde, otuz iki milyon dolar yatırmış bir pozisyonun iki milyar dolar topladığını bildiriyorlardı. Pozisyon yöneticisinin borçlu olduğu tutarlar da sayılmaz, çünkü bir çekimden sonra toplanana kadar çekilen anaparayı tutarlar.",
        "Verimin dışarıda bıraktıkları: yalnızca komisyondur ve bir pozisyonun iki tokenı tutmaya göre kaybettiği bunun içinde değildir. Pozisyon başına tek bir pencereyi kapsar, yalnızca şu an aralık içindeki pozisyonları okur ve hiçbirinin bundan sonra ne kazanacağı ya da kimin elinde olduğu hakkında hiçbir şey söylemez.",
        `Her ölçüm saklanır; böylece bir günlük ölçüm biriktiğinde sayfa son haftada işlerin nasıl kaydığını söyleyebilir. Bir paritenin aralığı fiyat olarak karşılaştırılır, asla güncel fiyata uzaklık olarak değil; çünkü o uzaklıklar kimse bir pozisyona dokunmasa da fiyat her hareket ettiğinde değişir. "Listede sürekli görünen sahipler", ölçümlerin en az yarısında en yüksek ${f.smartShare} içinde olan adreslerdir; ölçüm sayısı ${f.ownerSets} veya daha fazla olduğunda. Her biri, zincirin o adreste kod tutup tutmadığına göre cüzdan ya da sözleşme olarak işaretlenir: sözleşme bir kasa, bir bot ya da başka bir programdır ve verimi o programın verimidir.`,
      ],
    },
    "position-record": {
      title: "Açık bir pozisyon nasıl gitti",
      paragraphs: () => [
        "Bir adres sorgulandığında, tuttuğu her açık v3 pozisyonu açıldığından beri nasıl gittiğinin hesabını taşır. Yatırılan ve anapara olarak çekilen, ağın pozisyon subgraph'ının pozisyondaki her değişiklikte tuttuğu birikimli toplamlardır. Şu an içinde olan; likiditesinden, iki tick'inden ve havuzun karekök fiyatından hesaplanır, hepsi zincirden okunur. Komisyonu subgraph'ın komisyon alanlarından alınmaz, çünkü onlar kullanılamaz: bir değişiklikten bir sonrakine kadar pozisyonun likiditesi kıpırdamaz, dolayısıyla o süre içinde kazandığı, likiditesi çarpı pozisyon yöneticisinin iki uçta yazdığı anlık kayıtlar arasındaki, aralığı içindeki komisyon büyümesidir. Son değişiklikten bu yana olan kısım, henüz çekilmemiş komisyon gibi zincirden okunur.",
        "Hesap yalnızca geçmişin bugüne kadar uzandığı kanıtlanabildiğinde gösterilir: subgraph'taki en yeni değişiklik, pozisyon yöneticisinin şu an tuttuğu likiditeyi ve komisyon büyümesi kaydını birebir taşımalı, geçmişte bir yatırma bulunmalı ve her satırı okunmuş olmalıdır. Aksi halde pozisyon, geçmişinin doğrulanamadığını söyler ve yarım bir toplam yerine hiç rakam göstermez. v4 indeksleyicileri pozisyon başına geçmiş tutmaz, bu yüzden v4 pozisyonlarının böyle bir hesabı yoktur.",
        "Hesaptaki her şey bugünkü fiyatla, sayfanın pariteyi fiyatladığı token cinsinden değerlenir. Yatırılanlar sadece tutulsaydı edeceği değerin karşısına pozisyonun şu an tuttuğunu, artı çekileni, artı komisyonunu koyar; fark, komisyon ve aralık etkisi olarak ikiye ayrılır. Aralık etkisi, komisyondan önce pozisyonun tutmaya kıyasla durumudur: genelde geçici kayıp denen şey. Yatırmalar ve çekmeler kendi günlerindeki fiyatla değil bugünkü fiyatla değerlenir ve gas sayılmaz. Hesap, pozisyon hangi adreste durmuş olursa olsun bütün ömrünü kapsar ve bir ölçümdür, yatırım tavsiyesi değildir.",
      ],
    },
    pair: {
      title: "Tek parite, tüm havuzlar",
      paragraphs: (f) => [
        "Parite sayfası, sitenin okuduğu her ağda, iki sembolü tam olarak yazılan parite olan her v3 ve v4 havuzunu listeler. Her biri son haftada aldığı komisyonun bugün içinde olana bölünüp yıllığa çevrilmesiyle sıralanır — basit, bileşik değil. Bu, geçmiş komisyonun bugünkü likiditeye oranıdır: bir tahmin değildir ve bir pozisyonun kazanacağı da değildir; çünkü bir pozisyon yalnızca fiyat aralığı içindeyken kazanır, komisyonu orada bulunan herkesle paylaşır ve sadece tutmaya göre bir şey kaybeder.",
        `Bir havuzda ne olduğu her protokolde farklı ölçülür, bu yüzden ikisi ayrı sıralanır: v3'te havuzun token sözleşmelerinin onun için tuttuğu; tüm tokenları tek bir PoolManager'da duran v4'te ise güncel fiyattaki derinliği. Yalnızca en az ${f.pairFloorUsd} değerindeki havuzlar sıralanır — bunun altında tek bir öğleden sonranın işlemleri rakamı fazla oynatır ve taklit bir token olma ihtimali daha yüksektir — geri kalanlar altta, büyüklüğe göre ve verimsiz listelenir. Hook'u takasların ödediğini değiştirebilen bir v4 havuzu komisyonlarını bir notla ve verimsiz gösterir. Okunamayan bir ağ, okunamadığı belirtilerek listelenir.`,
      ],
    },
    "language-model": {
      title: "Yazılı açıklama",
      paragraphs: () => [
        "Bir havuzun sayfasında, her rakam hesaplanıp kontrol edildikten sonra bir dil modeli dört kısa paragraf yazar: aralığın neyi kapsadığı, fiyat ondan çıkınca ne olduğu, volatilitenin neyi ölçtüğü ve neyi ölçmediği, ve analizin neyi dışarıda bıraktığı. Rakamlar ona sayfanın gösterdiği haliyle, okurun dilinde verilir; yönler önceden cümle olarak yazılmıştır. Bir ziyaretçinin yazdığı hiçbir şey ona ulaşmaz — sıkı bir biçim kontrolünden geçmiş bir havuz adresi dışında; ne bir token açıklaması ne serbest metin — ve hiçbir tick ona hiç ulaşmaz.",
        "Ona asla bir sayı söylememesi, asla tavsiye vermemesi ve asla tahmin yapmaması söylenir. Bu yalnızca istenmez, zorunlu kılınır: her paragraf gösterilmeden önce kontrol edilir. v3 ve v4 adları dışında herhangi bir yazı sisteminde bir rakam — Arapça, Devanagari ve tam genişlikli rakamlar, kesirler ve üst simgeler dahil — ya da on dil hangisinde olursa olsun kelimeyle yazılmış on birden büyük bir sayı içeren paragraf reddedilir; fazla kısa ya da fazla uzun olan da. Bir paragraf bile geçemezse açıklamanın tamamı atılır ve rakamlar kendi başlarına kalır.",
        "Bir kontrolün zorlayamayacağı şey üsluptur; o, talimata bırakılmıştır ve sayfa aksini iddia etmez. Sayfa, metni yazan modelin adını sağlayıcının bildirdiği haliyle verir ve aynı açıklama aynı havuz, ayarlar ve dil için en fazla bir saat yeniden kullanılır.",
      ],
    },
    "data-sources": {
      title: "Veri kaynakları ve sınırlar",
      paragraphs: (f) => [
        `Havuzlar, The Graph üzerindeki Uniswap v3 ve v4 subgraph'larından okunur; ağlar: ${f.chains}. ${f.v4OnlyChains} yalnızca v4 için okunur. Bir subgraph yanlış olduğunda ya da sessiz kaldığında zincire doğrudan, yalnızca okuma amaçlı sorulur: bir v3 havuzunun fiyat adımı ve token sözleşmelerinin ne tuttuğu, bir v4 havuzunun PoolManager'dan likiditesi ve fiyatı, bir pozisyonun pozisyon yöneticisinden kazancı ve sahibi, ve bir adresin kod tutup tutmadığı. Her subgraph saatte bir kontrol edilir.`,
        `Bir havuzun güncel durumu zincirin en fazla ${f.freshMinutes} dakika gerisindeki bir bloktan gelmelidir, yoksa reddedilir. Günlük geçmişler UTC günü boyunca, haftanın en çok işlem gören havuzları yarım saat, aramalar ve parite okumaları on dakika, bir açıklama bir saat saklanır; akıllı likidite ölçümü altı saatte bir yenilenir.`,
        "Bir kaynak başarısız olduğunda sayfa hangi kısmın üretilemediğini söyler ve geri kalanını gösterir; eksik bir rakam eksik olarak gösterilir, asla sıfır olarak değil ve asla bir tahminle değiştirilmez. Akıllı likidite sayfasında okunamayan bir havuz yalnızca o havuza mal olur ve başarısız bir yenileme, süresi dolana kadar son ölçümü yerinde bırakır; parite sayfasında okunamayan bir ağ öyle olduğu belirtilerek listelenir. Eksik kalmasına izin verilen tek kısım açıklamadır.",
        "Siteyi kimin okuduğu hakkında hiçbir şey saklanmaz. Bir ziyaret; sayfayı, varsa havuzu (herkese açık bir sözleşme), dili ve bot gibi görünüp görünmediğini adlandıran bir satır olarak sayılır — IP adresi yok, tarayıcı bilgisi yok, arama metni yok ve pozisyonlarına bakmak için yazılan bir adres asla yok. Bir okur hakkında saklanan tek şey, kendi kurduğu bir Telegram uyarısıdır: yazdığı adres, dili, sohbetin sayısal kimliği ve her pozisyonun son seferde aralık içinde olup olmadığı. /stop onu hemen siler; yedeklerden de yedi gün içinde silinir.",
      ],
    },
  },
  notAdvice:
    "Bu sayfadaki ya da sitenin herhangi bir yerindeki hiçbir şey yatırım tavsiyesi değildir. Her rakam ya zaten yaşanmış günleri ya da protokolün kendi aritmetiğini anlatır; hiçbiri ne yapılacağını ya da bundan sonra ne olacağını söylemez.",
};

const de: MethodCopy = {
  link: "So funktioniert es",
  pointer: "Wie das gemessen wird, ausführlich",
  title: "So funktioniert es",
  description:
    "Wie jede Zahl auf LiquidityWise entsteht — der vorgeschlagene Bereich, die Rückblicke, Gebühren, Impermanent Loss, v4-Hooks, kluge Liquidität und die schriftliche Erklärung —, aus welchen Daten, und was jede davon auslässt.",
  heading: "Wie jede Zahl entsteht",
  lead: "Jede Zahl auf dieser Seite wird von gewöhnlichem Code aus den indexierten Daten eines Pools und aus der Chain selbst berechnet und vor der Anzeige geprüft; ein Sprachmodell beschreibt die Zahlen erst danach. Diese Seite sagt Abschnitt für Abschnitt, wie jede entsteht und was sie auslässt. Sie fasst den Code zusammen; über keinen Pool verspricht sie etwas.",
  contentsHeading: "Auf dieser Seite",
  sections: {
    "suggested-range": {
      title: "Der vorgeschlagene Bereich",
      paragraphs: (f) => [
        `Ausgangspunkt sind die täglichen Schlusskurse des Pools, wie sein Subgraph sie veröffentlicht: die letzten ${f.closes} abgeschlossenen UTC-Tage, ohne den heutigen, der noch nicht geschlossen hat. Daraus ergeben sich ${f.returns} Tagesrenditen, jede die Differenz der Logarithmen zweier aufeinanderfolgender Schlusskurse. Ein Tag, der in der Quelle fehlt, wird übersprungen — nie aufgefüllt, fortgeschrieben oder interpoliert —, und die Seite sagt, wenn das Fenster Lücken hatte.`,
        `Die Volatilität ist die Stichproben-Standardabweichung dieser Renditen, mit der Quadratwurzel aus ${f.yearDays} aufs Jahr gerechnet. Dann wird sie mit der Quadratwurzel des Jahresanteils auf den gewählten Zeithorizont skaliert (${f.horizons} Tage; ohne Wahl ${f.defaultHorizon}) und mit der gewählten Breite multipliziert (in Standardabweichungen: ${f.multipliers}; ohne Wahl ${f.defaultMultiplier}). Der Horizont sagt nur, wie weit die gemessene Bewegung nach vorn gelegt wird: gemessen wird die Bewegung immer über dieselben letzten ${f.returns} Tage.`,
        `Das Band wird logarithmisch symmetrisch um den heutigen Preis gelegt, ohne Drift: Halbierung und Verdopplung sind derselbe Abstand, deshalb unterscheiden sich die beiden Prozentzahlen links und rechts. Dann werden seine Ränder auf das Tick-Raster des Pools nach außen verschoben, nie nach innen, sodass der Bereich das Band immer mindestens abdeckt. Zwei Prüfungen sichern ihn: der aktuelle Preis des Pools muss den Tick ergeben, den der Pool selbst meldet, und er muss aus einem Block stammen, der höchstens ${f.freshMinutes} Minuten hinter der Chain liegt.`,
        `Er ist keine Prognose: er sagt, wie weit sich der Preis bewegt hat, nicht wohin er geht. Und die Breite ist kein Konfidenzniveau — aus „zwei Standardabweichungen" „95 % der Zeit" zu machen, verlangt eine Annahme über die Verteilung der Preise, die nicht belegt ist. Er bemisst keine Position und sagt nicht, wie viel von welchem Token einzulegen wäre.`,
      ],
    },
    "out-of-sample": {
      title: "An Tagen geprüft, die sie nie gesehen hat",
      paragraphs: (f) => [
        `Die Seite liest ${f.historyDays} Tage an Schlusskursen — mehr, als die Volatilität braucht —, damit die Methode an Tagen geprüft werden kann, an die sie nicht angepasst wurde. Sie wird um einen Horizont zurückversetzt, nur auf den ${f.closes} Schlusskursen vor diesem Punkt neu angepasst, auf den Schlusskurs an diesem Punkt zentriert und über die folgenden Tage gelegt; dann dasselbe weiter zurück, solange die Historie Platz hat. Jeder Tag zählt als ganz innerhalb, ganz außerhalb oder über einen Rand: Tageshoch und -tief können nicht sagen, wo im Tag der Preis war, deshalb wird ein Tag über einen Rand nie nach Gutdünken aufgeteilt.`,
        "Das sind einige Abschnitte eines einzigen Pools, kein Maß dafür, wie oft die Methode hält. Aufeinanderfolgende Anpassungen überlappen sich, die Abschnitte sind also nicht unabhängig voneinander, und niemand hat diese Bänder gehalten.",
        `„Vor dreißig Tagen eröffnet" spielt den Bereich, den die Methode zu Beginn der letzten dreißig Tage gezogen hätte — aus den ${f.closes} Schlusskursen davor und nichts danach —, über jeden dieser Tage nach. Es liefert zwei Zahlen. Der Wert gegenüber dem Halten, zu jedem Tagesschluss, folgt aus den exakten Beträgen konzentrierter Liquidität und braucht keinen Dollarpreis. Die Gebühren stammen aus den eigenen Tagesgebühren des Pools an den Tagen, an denen der Preis ganz innerhalb blieb, verteilt wie bei der Einlage, und die Einlage wird zum heutigen Dollarkurs bemessen, weil die Historie keinen täglichen hat.`,
        `„Eigenen Bereich ausprobieren" spielt zwei eingegebene Preise über dieselben dreißig Tage nach, ab demselben Eröffnungskurs, mit derselben Gebührenverteilung und demselben Dollarkurs, sodass sich die beiden Spalten nur im Bereich unterscheiden. Ein Bereich, der den Eröffnungspreis nicht einschließt, beginnt mit nur einem der beiden Token und nimmt keine Gebühren ein, bis der Preis ihn erreicht. Ein Bereich, der an diesen Tagen gut lief, sagt nichts über die nächsten.`,
      ],
    },
    recentring: {
      title: "Neu zentrieren, wenn der Preis den Bereich verlässt",
      paragraphs: () => [
        "„Neu zentrieren, sobald der Preis den Bereich verlässt\" spielt eine einfache aktive Strategie über dieselben dreißig Tage nach wie „Vor dreißig Tagen eröffnet\", ab demselben Eröffnungskurs und im selben Bereich. Schließt ein späterer Tag außerhalb des Bereichs, wird die Position dort neu zentriert: Was sie hält — dann nur noch einer der beiden Token —, wird in die Mischung getauscht, die ein gleich breiter Bereich um diesen Schlusskurs braucht, und was nach der Gebühr des Tauschs bleibt, ist die neue Position. Die Breite ist die des Eröffnungsbereichs, als Vielfache seiner Mitte; eine Neuzentrierung verschiebt den Bereich also und zieht ihn nie neu. Gebühren werden genau wie beim statischen Nachspielen gezählt, Tag für Tag, für den an diesem Tag gehaltenen Bereich, und beiseitegelegt statt reinvestiert.",
        "Der Tausch zahlt die Gebühr, die nach den eigenen Bedingungen des Pools ein Tausch zahlt — eine v3-Gebührenstufe oder die Gebühr eines v4-Schlüssels samt Anteil des Protokolls, in Richtung des Tauschs. Wo nichts Festes sie nennt, weil ein Hook die Gebühr je Tausch festlegt, zahlt er den Satz, den die Tausche des Monats tatsächlich zahlten — Gebühren durch Volumen —, und die Seite sagt das; wo ein Hook ändern darf, was ein Tausch zahlt, sagt die Seite, dass die Kosten abweichen können. Der Preiseinfluss ist nicht modelliert: Jeder Tausch wird zum Schlusskurs bewertet, als könnte der Pool ihn ganz aufnehmen. Gas wird nur gezählt, wenn du Kosten je Neuzentrierung angibst, in Dollar wie die Einlage, und es wird von außerhalb der Position bezahlt; die Eröffnung kostet beide gleich und wird bei keiner gezählt.",
        "Sie sieht Tagesschlusskurse und sonst nichts. Ein Preis, der den Bereich verließ und innerhalb eines Tages zurückkam, ist keine Neuzentrierung, und eine Neuzentrierung geschieht zum Schlusskurs statt an der Grenze — meist jenseits davon. Jede Dollarzahl steht zum heutigen Kurs, wie die der Einlage. Die Seite stellt den Endwert, alles gezählt, neben das Halten der Token der Einlage bei der Eröffnung und neben denselben Bereich ohne Neuzentrierung; ein Monat ohne Neuzentrierung ist genau dieser Bereich. Es ist eine Strategie über einen Monat, der schon vergangen ist, und keine Finanzberatung.",
      ],
    },
    fees: {
      title: "Gebühren und Impermanent Loss",
      paragraphs: () => [
        "Was der Pool berechnet hat, stammt aus den Gebühren und dem Volumen, die sein Subgraph für jeden der letzten dreißig Tage veröffentlicht. Die Gebühren eines Tages geteilt durch sein Volumen messen den Satz, den Tauschende tatsächlich gezahlt haben — der typische Tag, der niedrigste und der höchste, und das ganze Fenster als Summe der Gebühren über Summe des Volumens —, und er wird der angegebenen Gebühr des Pools gegenübergestellt. Ein Tag ohne Volumen wird weggelassen, nicht als null gezählt.",
        `Was eine Einlage eingenommen hätte: an jedem Tag, an dem der Preis ganz innerhalb des Bereichs blieb, einen Anteil L / (A + L) der Tagesgebühren, wobei L die Liquidität ist, die die Einlage im Bereich kauft, und A die Liquidität, die die Quelle an diesem Tag als aktiv meldet. Das „+ L" ist die Einlage, die sich selbst verwässert — deshalb nimmt eine größere Einlage nicht proportional mehr ein. Tage über einen Rand werden nicht gezählt, und ein Tag innerhalb, für den die Quelle keine Gebühren oder keine aktive Liquidität veröffentlicht hat, wird als solcher ausgewiesen, nicht als null.`,
        "Dollar in die Liquidität des Pools umzurechnen braucht einen Dollarpreis, und die Seite nimmt den des Subgraphen selbst, abgeleitet aus dem, was der Pool in jedem Token und in Dollar hält — der Kurs, in dem auch seine Gebührenzahlen stehen. Es ist der heutige Kurs, auf vergangene Tage angewandt, und die Seite sagt das. Das Ergebnis sind nur Gebühren, über Tage, die schon vorbei sind: kein Jahressatz und nicht das, was der nächste Monat zahlt.",
        "Impermanent Loss — die Position gegenüber dem bloßen Halten der beiden Token — ist die exakte Arithmetik der Kurve des Protokolls zwischen den Rändern des Bereichs, vom heutigen Preis bis zu jedem gezeigten Preis. Sie braucht keine Marktdaten und keine Einlagehöhe, weil sich die Liquidität aus dem Verhältnis herauskürzt. Unbeständig ist er nur, wenn der Preis zurückkommt. Er zählt Preisbewegung und sonst nichts, und Gebühren sind genau das, wofür ein Anbieter dafür bezahlt wird — beides muss zusammen gelesen werden.",
      ],
    },
    hooks: {
      title: "v4-Hooks",
      paragraphs: (f) => [
        "Ein v4-Pool kann einen Hook nennen, einen Vertrag, den das Protokoll zu festen Zeitpunkten aufruft. Seine Berechtigungen werden aus seiner Adresse gelesen: ein Hook wird an eine Adresse deployt, deren unterste vierzehn Bits sagen, welche Callbacks der PoolManager aufruft, und der PoolManager prüft diese Bits, statt den Vertrag zu fragen. Die Seite liest also die Regel, die das Protokoll durchsetzt — kein Verzeichnis, kein Etikett und nicht die Selbstbeschreibung des Vertrags —, und sie sagt, was ein Hook darf, nie, was er tut.",
        "Ein Hook, der vor einem Tausch eingreifen darf, kann dessen Gebühr umschreiben; einer, der aus einem Tausch ein Delta zurückgeben darf, kann einen Teil des Tauschs selbst nehmen. Hat der Hook eines Pools eine dieser Berechtigungen, wird jede Gebührenzahl, die an einen Bereich oder eine Einlage gebunden ist, zurückgehalten — die Gebühren innerhalb, der Anteil einer Einlage, die Gebühren im Dreißig-Tage-Rückblick, die Rendite auf der Paar-Seite —, weil nichts in der Quelle den Anteil des Hooks von dem der Anbieter trennt. Was der Pool berechnet hat, wird weiter gezeigt, als Tatsache über den Pool, und die Felder, die zeigen, was ein Tausch kostet, tragen einen Hinweis. Ein Pool, dessen Schlüssel keine Gebühr festlegt, wird so angezeigt, und der tatsächlich berechnete Satz wird aus seinen Tagen gemessen.",
        `Neben den Rechten zeigen die Hook-Seite und die Seite eines v4-Pools zwei Dinge, die jeder von außen prüfen kann. Ob der Quellcode eines Hooks verifiziert ist, wird vom Server aus und ohne Schlüssel bei Sourcify und beim Blockscout des Netzwerks erfragt: bei einem von beiden verifiziert wird als verifiziert gezeigt, mit dem Namen des Vertrags von Blockscout, wo es einen nennt, sonst von Sourcify; bei keinem verifiziert wird als nicht gefunden gezeigt; eine Quelle, die nicht binnen weniger Sekunden oder nur unverständlich antwortet, lässt es als nicht geprüft stehen. Verifiziert heißt, dass der für die Adresse veröffentlichte Quellcode zu dem dort deployten Code kompiliert, man ihn also lesen kann; es ist kein Audit und sagt nichts darüber, ob der Hook sicher ist. Wie viele v4-Pools im Netzwerk den Hook nennen und wann der erste davon angelegt wurde, kommt aus dem v4-Subgraph des Netzwerks, gezählt bis ${f.hookPoolCap}. Antworten werden ${f.hookCheckHours} Stunden behalten, und eine unbeantwortete Frage wird nach ${f.hookCheckRetryMinutes} Minuten erneut gestellt; eine Seite wartet auf keine lange und sagt stattdessen, dass die Prüfung nicht möglich war.`,
      ],
    },
    "smart-liquidity": {
      title: "Kluge Liquidität",
      paragraphs: (f) => [
        `In jedem Netzwerk, in dem sich Positionen auflisten lassen (${f.smartChains}), schaut die Seite in die ${f.smartPools} meistgehandelten v3-Pools der Woche, nimmt die Positionen, deren Bereich den Preis gerade einschließt, und fragt die Chain nach bis zu ${f.positionsPerPool} pro Pool, die größten zuerst, jede mindestens ${f.minPositionUsd} wert. Gemessen wird alle sechs Stunden neu.`,
        `Die Gebühren einer Position sind, was sie seit ihrer letzten Änderung verdient hat: ihre Liquidität mal das Gebührenwachstum innerhalb ihres Bereichs, seit der Positionsmanager zuletzt seinen Schnappschuss geschrieben hat, von der Chain gelesen. Paar, Gebühr und Ticks jeder Position müssen auf den Pool zurückführen, in dem sie gelistet war. Diese Gebühren, geteilt durch den heutigen Wert der Position und die Tage seit dieser Änderung, aufs Jahr gerechnet, sind ihre Rendite. Positionen unter ${f.minPositionUsd} oder vor weniger als ${f.minWindowDays} Tagen geändert bleiben außen vor, weil sie zu klein oder zu neu sind, um etwas zu sagen; die ${f.smartShare} mit der höchsten Rendite sind die klugen.`,
        "Der Subgraph listet die Positionen und datiert die letzte Änderung jeder einzelnen, mehr nicht. Seine Gebührenfelder werden nicht verwendet: am 2026-09-30 geprüft, meldeten sie zwei Milliarden Dollar eingesammelt von einer Position, die zweiunddreißig Millionen eingelegt hatte. Die geschuldeten Beträge des Positionsmanagers werden ebenfalls nicht gezählt, weil sie nach einer Abhebung das abgezogene Kapital enthalten, bis es eingesammelt ist.",
        "Was die Rendite auslässt: es sind nur Gebühren, und was eine Position gegenüber dem Halten der beiden Token aufgegeben hat, steckt nicht darin. Sie umfasst ein Fenster pro Position, liest nur Positionen, die jetzt im Bereich sind, und sagt nichts darüber, was eine von ihnen künftig verdient, oder darüber, wer sie hält.",
        `Jede Messung wird gespeichert, damit die Seite sagen kann, wie sich die Dinge in der letzten Woche bewegt haben, sobald ein Tag an Messungen vorliegt. Der Bereich eines Paars wird als Preise verglichen, nie als Abstand vom aktuellen Preis, denn dieser Abstand ändert sich bei jeder Preisbewegung, auch wenn niemand eine Position anfasst. „Halter, die immer wieder auftauchen" sind Adressen, die in mindestens der Hälfte der Messungen unter den obersten ${f.smartShare} waren, sobald es ${f.ownerSets} oder mehr gibt. Jede wird als Wallet oder Vertrag markiert, je nachdem, ob die Chain an ihrer Adresse Code hält: ein Vertrag ist ein Tresor, ein Bot oder ein anderes Programm, und seine Rendite ist die dieses Programms.`,
      ],
    },
    "position-record": {
      title: "Wie sich eine offene Position geschlagen hat",
      paragraphs: () => [
        "Wo eine Adresse nachgeschlagen wird, trägt jede offene v3-Position, die sie hält, eine Rechnung darüber, wie sie sich seit ihrer Eröffnung geschlagen hat. Einlagen und als Kapital Entnommenes sind die laufenden Summen, die der Positions-Subgraph des Netzwerks bei jeder Änderung der Position führt. Was jetzt in ihr steckt, wird aus ihrer Liquidität, ihren beiden Ticks und dem Quadratwurzelpreis des Pools berechnet, alles von der Chain gelesen. Ihre Gebühren stammen nicht aus den Gebührenfeldern des Subgraphs, die unbrauchbar sind: zwischen einer Änderung und der nächsten bewegt sich die Liquidität einer Position nicht, also ist, was sie in diesem Abschnitt verdient hat, ihre Liquidität mal das Gebührenwachstum innerhalb ihres Bereichs zwischen den Schnappschüssen, die der Positionsmanager an beiden Enden geschrieben hat. Der Abschnitt seit der letzten Änderung wird von der Chain gelesen, wie die noch nicht eingesammelten Gebühren.",
        "Eine Rechnung wird nur gezeigt, wenn der Verlauf nachweislich bis in die Gegenwart reicht: die neueste Änderung, die der Subgraph kennt, muss genau die Liquidität und den Schnappschuss des Gebührenwachstums tragen, die der Positionsmanager jetzt hält, der Verlauf muss eine Einlage enthalten, und jede seiner Zeilen muss gelesen worden sein. Andernfalls sagt die Position, dass ihr Verlauf nicht geprüft werden konnte, und zeigt lieber keine Zahlen als eine Teilsumme. Die v4-Indexer führen keinen Verlauf je Position, deshalb hat eine v4-Position keine Rechnung.",
        "Alles in einer Rechnung wird zum heutigen Preis bewertet, in dem Token, in dem die Seite das Paar notiert. Dem, was die Einlagen wert wären, hätte man sie einfach gehalten, stellt sie gegenüber, was die Position jetzt hält, plus das Entnommene, plus ihre Gebühren; die Differenz wird in die Gebühren und den Bereichseffekt aufgeteilt, also die Position gegenüber dem Halten vor Gebühren — das, was man gewöhnlich Impermanent Loss nennt. Einlagen und Entnahmen werden zum heutigen Preis bewertet, nicht zum Preis an ihrem Tag, und Gas ist nicht mitgezählt. Eine Rechnung umfasst die ganze Laufzeit der Position, unter jedem Eigentümer, den sie hatte, und sie ist eine Messung, keine Finanzberatung.",
      ],
    },
    pair: {
      title: "Ein Paar, jeder Pool",
      paragraphs: (f) => [
        "Die Paar-Seite listet jeden v3- und v4-Pool, dessen zwei Symbole genau das eingegebene Paar sind, in jedem Netzwerk, das die Seite liest. Jeder wird nach den Gebühren der letzten Woche geteilt durch das, was jetzt in ihm liegt, aufs Jahr gerechnet, gereiht — einfach, nicht verzinst. Das sind vergangene Gebühren gegenüber heutiger Liquidität: keine Prognose und nicht das, was eine Position verdienen würde, denn eine Position verdient nur, solange der Preis in ihrem Bereich liegt, teilt die Gebühren mit allen anderen dort und gibt gegenüber dem Halten etwas auf.",
        `Was in einem Pool liegt, wird in jedem Protokoll anders gemessen, deshalb werden beide getrennt gereiht: in v3, was die Token-Verträge des Pools für ihn halten; in v4, wo alle Token in einem PoolManager liegen, seine Tiefe beim aktuellen Preis. Gereiht werden nur Pools im Wert von mindestens ${f.pairFloorUsd} — darunter bewegt der Handel eines Nachmittags die Zahl zu stark, und ein nachgemachter Token ist wahrscheinlicher —, die übrigen stehen darunter nach Größe, ohne Rendite. Ein v4-Pool, dessen Hook ändern darf, was Tausche zahlen, zeigt seine Gebühren mit einem Hinweis und ohne Rendite. Ein Netzwerk, das sich nicht lesen lässt, wird als solches aufgeführt.`,
      ],
    },
    "language-model": {
      title: "Die schriftliche Erklärung",
      paragraphs: () => [
        "Auf der Seite eines Pools schreibt ein Sprachmodell, nachdem jede Zahl berechnet und geprüft ist, vier kurze Absätze: was der Bereich abdeckt, was passiert, wenn der Preis ihn verlässt, was die Volatilität misst und was nicht, und was die Analyse auslässt. Es bekommt die Zahlen so, wie die Seite sie zeigt, in der Sprache der Lesenden, mit den Richtungen bereits als Sätze ausgeschrieben. Nichts, was Besucher schreiben, erreicht es — außer einer Pool-Adresse, die eine strenge Formatprüfung bestanden hat; keine Token-Beschreibung, kein freier Text —, und kein Tick erreicht es überhaupt.",
        "Ihm wird gesagt, nie eine Zahl zu nennen, nie zu beraten und nie vorherzusagen. Das wird erzwungen, nicht nur verlangt: jeder Absatz wird vor der Anzeige geprüft. Einer mit einer Ziffer in irgendeiner Schrift — arabische, Devanagari- und Vollbreiten-Ziffern, Brüche und Hochzahlen eingeschlossen —, außer in den Namen v3 und v4, oder mit einer als Wort geschriebenen Zahl ab elf in irgendeiner der zehn Sprachen, wird abgelehnt, ebenso einer, der zu kurz oder zu lang ist. Scheitert ein Absatz, wird die ganze Erklärung verworfen, und die Zahlen stehen für sich.",
        "Was eine Prüfung nicht erzwingen kann, ist der Ton; der bleibt der Anweisung überlassen, und die Seite gibt nichts anderes vor. Die Seite nennt das Modell, das den Text geschrieben hat, so wie der Anbieter es meldet, und dieselbe Erklärung wird höchstens eine Stunde lang für denselben Pool, dieselben Einstellungen und dieselbe Sprache wiederverwendet.",
      ],
    },
    "data-sources": {
      title: "Datenquellen und Grenzen",
      paragraphs: (f) => [
        `Pools werden aus den v3- und v4-Subgraphen von Uniswap auf The Graph gelesen, auf ${f.chains}; ${f.v4OnlyChains} wird nur für v4 gelesen. Wo ein Subgraph falsch liegt oder schweigt, wird die Chain direkt gefragt, nur lesend: der Tick-Abstand eines v3-Pools und was seine Token-Verträge halten, Liquidität und Preis eines v4-Pools vom PoolManager, Ertrag und Halter einer Position vom Positionsmanager, und ob an einer Adresse Code liegt. Jeder Subgraph wird stündlich geprüft.`,
        `Der aktuelle Zustand eines Pools muss aus einem Block stammen, der höchstens ${f.freshMinutes} Minuten hinter der Chain liegt, sonst wird er abgelehnt. Tagesverläufe werden für den UTC-Tag gespeichert, die meistgehandelten Pools der Woche eine halbe Stunde, Suchen und Paar-Abfragen zehn Minuten und eine Erklärung eine Stunde; die Messung der klugen Liquidität wird alle sechs Stunden erneuert.`,
        "Fällt eine Quelle aus, sagt die Seite, welcher Teil nicht entstehen konnte, und zeigt den Rest; eine fehlende Zahl wird als fehlend gezeigt, nie als null, und nie durch eine Schätzung ersetzt. Auf der Seite zur klugen Liquidität kostet ein nicht lesbarer Pool nur diesen Pool, und eine gescheiterte Erneuerung lässt die letzte Messung stehen, bis sie abläuft; auf der Paar-Seite wird ein nicht lesbares Netzwerk als solches aufgeführt. Die Erklärung ist der einzige Teil, der fehlen darf.",
        "Über die Leser der Seite wird nichts gespeichert. Ein Besuch wird als eine Zeile gezählt, die die Seite nennt, den Pool, falls es einen gibt (ein öffentlicher Vertrag), die Sprache und ob es nach einem Bot aussah — keine IP-Adresse, keine Browserkennung, kein Suchtext und nie eine Adresse, die eingegeben wurde, um ihre Positionen anzusehen. Das Einzige, was über einen Leser gespeichert wird, ist ein Telegram-Hinweis, den er selbst einrichtet: die eingegebene Adresse, seine Sprache, die numerische Chat-ID und ob jede Position zuletzt im Bereich war. /stop löscht ihn sofort, und aus den Sicherungen verschwindet er innerhalb von sieben Tagen.",
      ],
    },
  },
  notAdvice:
    "Nichts auf dieser Seite und nirgends sonst auf der Website ist Finanzberatung. Jede Zahl beschreibt Tage, die schon vorbei sind, oder die eigene Arithmetik des Protokolls; keine sagt, was zu tun ist oder was als Nächstes geschieht.",
};

const es: MethodCopy = {
  link: "Cómo funciona",
  pointer: "Cómo se mide esto, en detalle",
  title: "Cómo funciona",
  description:
    "Cómo se obtiene cada cifra de LiquidityWise — el rango sugerido, las pruebas hacia atrás, las comisiones, la pérdida impermanente, los hooks de v4, la liquidez inteligente y la explicación escrita —, de qué datos sale y qué deja fuera cada una.",
  heading: "Cómo se obtiene cada cifra",
  lead: "Cada cifra de este sitio la calcula código sencillo a partir de los datos indexados de un pool y de la propia cadena, y se comprueba antes de mostrarse; un modelo de lenguaje solo describe las cifras después. Esta página explica, sección por sección, cómo se obtiene cada una y qué deja fuera. Resume el código; no promete nada sobre ningún pool.",
  contentsHeading: "En esta página",
  sections: {
    "suggested-range": {
      title: "El rango sugerido",
      paragraphs: (f) => [
        `Parte de los precios de cierre diarios del propio pool, tal como los publica su subgraph: los últimos ${f.closes} días UTC completos, sin el de hoy, que aún no ha cerrado. De ellos salen ${f.returns} rendimientos diarios, cada uno la diferencia entre los logaritmos de dos cierres consecutivos. Un día que falta en la fuente se omite — nunca se rellena, se arrastra ni se interpola — y la página avisa cuando la ventana tenía huecos.`,
        `La volatilidad es la desviación estándar muestral de esos rendimientos, llevada a un año con la raíz cuadrada de ${f.yearDays}. Luego se escala al horizonte que elijas (${f.horizons} días; ${f.defaultHorizon} si no eliges) con la raíz cuadrada de la fracción del año que es ese horizonte, y se multiplica por la amplitud que elijas (en desviaciones estándar: ${f.multipliers}; ${f.defaultMultiplier} si no eliges). El horizonte solo dice hasta dónde se proyecta el movimiento medido: el movimiento se mide siempre sobre los mismos últimos ${f.returns} días.`,
        `La banda se coloca alrededor del precio de hoy de forma simétrica en logaritmos, sin deriva: reducirse a la mitad y duplicarse son la misma distancia, y por eso los dos porcentajes a cada lado son distintos. Después sus bordes se desplazan hacia fuera sobre la cuadrícula de ticks del pool, nunca hacia dentro, de modo que el rango siempre cubre al menos la banda. Dos comprobaciones lo protegen: el precio actual del pool debe convertirse en el tick que el propio pool informa, y debe venir de un bloque como mucho ${f.freshMinutes} minutos por detrás de la cadena.`,
        `No es un pronóstico: dice cuánto se ha movido el precio, no adónde irá. Y la amplitud no es un nivel de confianza — convertir "dos desviaciones estándar" en "el 95 % del tiempo" exige un supuesto sobre cómo se distribuyen los precios que no está establecido. No dimensiona una posición ni dice cuánto depositar de cada token.`,
      ],
    },
    "out-of-sample": {
      title: "Probado en días que nunca vio",
      paragraphs: (f) => [
        `El sitio lee ${f.historyDays} días de cierres — más de los que necesita la volatilidad — para poder probar el método en días a los que no se ajustó. Se retrocede un horizonte, se ajusta de nuevo solo con los ${f.closes} cierres anteriores a ese punto y nada posterior, se centra en el cierre de ese punto y se coloca sobre los días que siguieron; y lo mismo más atrás, mientras el historial tenga espacio. Cada día cuenta como totalmente dentro, totalmente fuera o cruzando un borde: el máximo y el mínimo de un día no dicen dónde estuvo el precio dentro del día, así que un día que cruzó un borde nunca se reparte a ojo.`,
        "Son unos pocos tramos de un solo pool, no una medida de con qué frecuencia funciona el método. Los ajustes consecutivos se solapan, así que los tramos no son independientes entre sí, y nadie mantuvo estas bandas.",
        `"Abierta hace treinta días" reproduce el rango que el método habría trazado al comienzo de los últimos treinta días — con los ${f.closes} cierres anteriores y nada posterior — sobre cada uno de esos días. Da dos cifras. El valor frente a mantener, en cada cierre diario, sale de las cantidades exactas de la liquidez concentrada y no necesita precio en dólares. Las comisiones salen de las comisiones diarias del propio pool en los días en que el precio quedó totalmente dentro, repartidas como las reparte la cifra del depósito, con el depósito dimensionado al tipo de cambio en dólares de hoy porque el historial no tiene uno diario.`,
        `"Prueba tu propio rango" reproduce dos precios que escribas sobre los mismos treinta días, desde el mismo cierre de apertura, con el mismo reparto de comisiones y el mismo tipo en dólares, de modo que lo único que distingue las dos columnas es el rango. Un rango que no contiene el precio de apertura empieza con solo uno de los dos tokens y no cobra comisiones hasta que el precio lo alcanza. Un rango que fue bien en estos días no dice nada de los siguientes.`,
      ],
    },
    recentring: {
      title: "Recentrar cuando el precio sale",
      paragraphs: () => [
        "\"Recentrar cuando el precio sale\" reproduce una estrategia activa sencilla sobre los mismos treinta días que \"Abierta hace treinta días\", desde el mismo cierre de apertura y en el mismo rango. En el cierre de cada día posterior, si el cierre queda fuera del rango, la posición se recentra allí: lo que tiene — para entonces solo uno de los dos tokens — se intercambia por la mezcla que necesita un rango del mismo ancho centrado en ese cierre, y lo que queda tras la comisión del intercambio es la nueva posición. El ancho es el del rango de apertura, como múltiplos de su centro, así que un recentrado mueve el rango y nunca lo vuelve a trazar. Las comisiones se cuentan exactamente como en la repetición estática, día a día, para el rango que se tiene ese día, y se apartan en vez de reinvertirse.",
        "El intercambio paga la comisión que, según las propias condiciones del pool, paga un intercambio: un nivel de v3, o la comisión de la clave de v4 con la parte del protocolo, en la dirección del intercambio. Donde nada fijo la dice, porque un hook fija la comisión en cada intercambio, paga la tasa que de verdad pagaron los intercambios del mes — comisiones sobre volumen — y la página lo dice; donde un hook puede cambiar lo que paga un intercambio, la página dice que el coste puede ser otro. No se modela el impacto en el precio: cada intercambio se valora al cierre, como si el pool pudiera absorberlo entero. El gas solo se cuenta si fijas un coste por recentrado, en dólares como el depósito, y se paga desde fuera de la posición; la apertura cuesta lo mismo a las dos y no se cuenta en ninguna.",
        "Ve cierres diarios y nada más. Un precio que salió del rango y volvió en el mismo día no es un recentrado, y un recentrado ocurre en el cierre y no en el borde — normalmente más allá. Toda cifra en dólares está a la tasa de hoy, como las del depósito. La página pone el valor final, todo contado, junto a mantener los tokens con que se abrió el depósito y junto al mismo rango nunca recentrado; un mes sin recentrados es exactamente ese rango. Es una estrategia sobre un mes que ya ocurrió, y no es asesoramiento.",
      ],
    },
    fees: {
      title: "Comisiones y pérdida impermanente",
      paragraphs: () => [
        "Lo que cobró el pool sale de las comisiones y el volumen que su subgraph publica para cada uno de los últimos treinta días. Dividir las comisiones de un día por su volumen mide la tasa que pagaron de verdad quienes intercambiaron — el día típico, el más bajo y el más alto, y la ventana entera como comisiones totales sobre volumen total — y se compara con la comisión que declara el pool. Un día sin volumen se deja fuera en lugar de contarse como cero.",
        `Lo que habría cobrado un depósito: cada día en que el precio quedó totalmente dentro del rango, una parte L / (A + L) de las comisiones de ese día, donde L es la liquidez que el depósito compra en el rango y A la liquidez que la fuente informa como activa ese día. El "+ L" es el depósito diluyéndose a sí mismo, por eso un depósito mayor no cobra proporcionalmente más. Los días que cruzaron un borde no se cuentan, y un día dentro para el que la fuente no publicó comisiones o liquidez activa se indica como tal, no como cero.`,
        "Convertir dólares en la liquidez del pool necesita un precio en dólares, y el sitio usa el del propio subgraph, derivado de lo que el pool tiene en cada token y en dólares — el tipo en que están sus cifras de comisiones. Es el tipo de hoy aplicado a días pasados, y la página lo dice. El resultado son solo comisiones, sobre días que ya pasaron: no es una tasa anual ni lo que pagará el próximo mes.",
        "La pérdida impermanente — la posición frente a simplemente mantener los dos tokens — es la aritmética exacta de la curva del protocolo entre los bordes del rango, desde el precio de hoy hasta cada precio mostrado. No necesita datos de mercado ni tamaño de depósito, porque la liquidez se cancela en el cociente. Solo es impermanente si el precio vuelve. Cuenta el movimiento del precio y nada más, y las comisiones son lo que se le paga a un proveedor por asumirlo, así que hay que leer las dos cosas juntas.",
      ],
    },
    hooks: {
      title: "Hooks de v4",
      paragraphs: (f) => [
        "Un pool de v4 puede nombrar un hook, un contrato al que el protocolo llama en momentos fijos. Sus permisos se leen de su dirección: un hook se despliega en una dirección cuyos catorce bits más bajos dicen qué callbacks llamará el PoolManager, y el PoolManager comprueba esos bits en lugar de preguntar al contrato. Así que el sitio lee la regla que el protocolo hace cumplir — no un registro, una etiqueta ni la descripción que el contrato da de sí mismo — y dice lo que un hook puede hacer, nunca lo que hace.",
        "Un hook autorizado a actuar antes de un intercambio puede reescribir su comisión; uno autorizado a devolver un delta de un intercambio puede quedarse con parte del intercambio. Cuando el hook de un pool tiene alguno de estos permisos, se retiene toda cifra de comisiones ligada a un rango o a un depósito — las comisiones mientras está dentro, la parte de un depósito, las comisiones de la reproducción de treinta días, el rendimiento en la página del par — porque nada en la fuente separa la parte del hook de la de los proveedores. Lo que cobró el pool se sigue mostrando, como un hecho sobre el pool, y los paneles que muestran lo que cuesta un intercambio llevan una nota. Un pool cuya clave no fija comisión se muestra sin ella, y la tasa que realmente cobró se mide a partir de sus días.",
        `Junto a los permisos, la página de hooks y la de un pool v4 muestran dos cosas que cualquiera puede comprobar desde fuera. Si el código fuente de un hook está verificado se pregunta, desde el servidor y sin clave, a Sourcify y al Blockscout de la propia red: verificado en cualquiera de los dos se muestra como verificado, con el nombre del contrato según Blockscout cuando lo da y según Sourcify si no; no verificado en ninguno se muestra como no encontrado; una fuente que no responde en unos segundos, o que responde de un modo que no se entiende, lo deja como no comprobado. Verificado significa que el código publicado para la dirección compila al código desplegado allí, así que se puede leer; no es una auditoría y no dice nada sobre si el hook es seguro. Cuántos pools v4 de la red nombran el hook, y cuándo se creó el primero de ellos, sale del subgraph v4 de la red, contados hasta ${f.hookPoolCap}. Las respuestas se guardan ${f.hookCheckHours} horas y una pregunta sin respuesta se repite a los ${f.hookCheckRetryMinutes} minutos; ninguna página espera mucho por una, y en su lugar dice que la comprobación no pudo hacerse.`,
      ],
    },
    "smart-liquidity": {
      title: "Liquidez inteligente",
      paragraphs: (f) => [
        `En cada red donde se pueden listar posiciones (${f.smartChains}), la página mira los ${f.smartPools} pools de v3 más negociados de la semana, toma las posiciones que están dentro de rango ahora mismo y pregunta a la cadena por hasta ${f.positionsPerPool} por pool, las mayores primero, cada una de al menos ${f.minPositionUsd}. Se vuelve a medir cada seis horas.`,
        `Las comisiones de una posición son lo que ha ganado desde su último cambio: su liquidez por el crecimiento de comisiones dentro de su rango desde que el gestor de posiciones escribió su última instantánea, leído de la cadena. El par, la comisión y los ticks de cada posición deben llevar al pool en que figuraba. Esas comisiones, sobre lo que vale la posición ahora, sobre los días desde ese cambio, llevadas a un año, son su rendimiento. Las posiciones de menos de ${f.minPositionUsd}, o cambiadas hace menos de ${f.minWindowDays} días, se dejan fuera por ser demasiado pequeñas o demasiado nuevas para decir algo; el ${f.smartShare} con mayor rendimiento son las inteligentes.`,
        "El subgraph lista las posiciones y fecha el último cambio de cada una, y nada más. Sus campos de comisiones no se usan: comprobados el 2026-09-30, informaban de dos mil millones de dólares cobrados por una posición que había depositado treinta y dos millones. Tampoco se cuentan los importes adeudados del gestor de posiciones, porque tras una retirada contienen el capital retirado hasta que se cobra.",
        "Lo que el rendimiento deja fuera: son solo comisiones, y lo que una posición cedió frente a mantener los dos tokens no está incluido. Cubre una ventana por posición, solo lee posiciones dentro de rango ahora, y no dice nada de lo que ninguna ganará después ni de quién las tiene.",
        `Cada medición se guarda, para que la página pueda decir cómo se movieron las cosas en la última semana en cuanto haya un día de mediciones. El rango de un par se compara como precios, nunca como distancias al precio actual, porque esas distancias cambian cada vez que el precio se mueve aunque nadie toque una posición. Los "Titulares que siguen apareciendo" son las direcciones que estuvieron en el ${f.smartShare} superior en al menos la mitad de las mediciones, una vez que hay ${f.ownerSets} o más. Cada una se marca como billetera o contrato según si la cadena guarda código en su dirección: un contrato es una bóveda, un bot u otro programa, y su rendimiento es el de ese programa.`,
      ],
    },
    "position-record": {
      title: "Cómo le ha ido a una posición abierta",
      paragraphs: () => [
        "Cuando se consulta una dirección, cada posición v3 abierta que tiene lleva un cálculo de cómo le ha ido desde que se abrió. Lo depositado y lo retirado como principal son los totales acumulados que el subgraph de posiciones de la red guarda en cada cambio de la posición. Lo que hay en ella ahora se calcula a partir de su liquidez, sus dos ticks y el precio en raíz cuadrada del pool, todo leído de la cadena. Sus comisiones no se toman de los campos de comisiones del subgraph, que no sirven: entre un cambio y el siguiente la liquidez de una posición no se mueve, así que lo que ganó en ese tramo es su liquidez por el crecimiento de comisiones dentro de su rango entre las instantáneas que el gestor de posiciones escribió en cada extremo. El tramo desde el último cambio se lee de la cadena, igual que las comisiones aún sin cobrar.",
        "El cálculo solo se muestra cuando el historial llega de forma demostrable al presente: el cambio más reciente que tiene el subgraph debe llevar exactamente la liquidez y la instantánea de crecimiento de comisiones que el gestor de posiciones tiene ahora, el historial debe incluir un depósito y cada una de sus filas debe haberse leído. Si no, la posición dice que su historial no pudo comprobarse, y no muestra cifras en lugar de mostrar una suma parcial. Los indexadores de v4 no guardan un historial por posición, así que una posición v4 no tiene cálculo.",
        "Todo en el cálculo se valora al precio de hoy, en el token en que la página cotiza el par. Frente a lo que valdrían los depósitos si simplemente se hubieran mantenido, pone lo que la posición tiene ahora, más lo retirado, más sus comisiones; la diferencia se divide en las comisiones y el efecto del rango, que es la posición frente a mantener antes de comisiones: lo que se suele llamar pérdida impermanente. Los depósitos y retiros se valoran al precio de hoy, no al de su día, y el gas no se cuenta. El cálculo abarca toda la vida de la posición, con cada dueño que haya tenido, y es una medición, no asesoramiento financiero.",
      ],
    },
    pair: {
      title: "Un par, todos sus pools",
      paragraphs: (f) => [
        "La página del par lista cada pool de v3 y v4 cuyos dos símbolos son exactamente el par escrito, en cada red que lee el sitio. Cada uno se ordena por las comisiones que cobró la última semana, sobre lo que hay en él ahora, llevadas a un año — simple, sin capitalizar. Son comisiones pasadas sobre liquidez presente: no es un pronóstico ni lo que ganaría una posición, ya que una posición solo gana mientras el precio está dentro de su rango, comparte las comisiones con todos los demás allí y cede algo frente a mantener.",
        `Lo que hay en un pool se mide distinto en cada protocolo, así que los dos se ordenan por separado: en v3, lo que los contratos de sus tokens guardan para él; en v4, donde todos los tokens están en un mismo PoolManager, su profundidad al precio actual. Solo se ordenan los pools que valen al menos ${f.pairFloorUsd} — por debajo, el trading de una tarde mueve demasiado la cifra y es más probable un token imitador — y el resto se lista debajo por tamaño, sin rendimiento. Un pool de v4 cuyo hook puede cambiar lo que pagan los intercambios muestra sus comisiones con una nota y sin rendimiento. Una red que no se puede leer aparece como tal.`,
      ],
    },
    "language-model": {
      title: "La explicación escrita",
      paragraphs: () => [
        "En la página de un pool, cuando cada cifra ya se ha calculado y comprobado, un modelo de lenguaje escribe cuatro párrafos cortos: qué cubre el rango, qué pasa cuando el precio sale de él, qué mide la volatilidad y qué no, y qué deja fuera el análisis. Recibe las cifras tal como las muestra la página, en el idioma de quien lee, con las direcciones ya escritas como frases. Nada de lo que escribe un visitante le llega — salvo una dirección de pool que ha pasado una comprobación estricta de formato; ninguna descripción de token, ningún texto libre — y ningún tick le llega en absoluto.",
        "Se le indica que nunca dé un número, nunca aconseje y nunca prediga. Eso se hace cumplir, no solo se pide: cada párrafo se comprueba antes de mostrarse. Se rechaza uno que contenga un dígito en cualquier escritura — dígitos árabes, devanagari y de ancho completo, fracciones y superíndices incluidos —, salvo en los nombres v3 y v4, o un número de once en adelante escrito con palabras en cualquiera de los diez idiomas, y también uno demasiado corto o demasiado largo. Si falla un solo párrafo, se descarta la explicación entera y las cifras quedan por sí solas.",
        "Lo que una comprobación no puede imponer es el tono; eso queda en manos de la instrucción, y la página no finge lo contrario. La página nombra el modelo que escribió el texto, tal como lo informa el proveedor, y la misma explicación se reutiliza como mucho una hora para el mismo pool, los mismos ajustes y el mismo idioma.",
      ],
    },
    "data-sources": {
      title: "Fuentes de datos y límites",
      paragraphs: (f) => [
        `Los pools se leen de los subgraphs de v3 y v4 de Uniswap en The Graph, en ${f.chains}; ${f.v4OnlyChains} se lee solo para v4. Donde un subgraph se equivoca o calla, se pregunta directamente a la cadena, solo en lectura: el espaciado de ticks de un pool de v3 y lo que guardan los contratos de sus tokens, la liquidez y el precio de un pool de v4 desde el PoolManager, las ganancias y el titular de una posición desde el gestor de posiciones, y si una dirección guarda código. Cada subgraph se comprueba cada hora.`,
        `El estado actual de un pool debe venir de un bloque como mucho ${f.freshMinutes} minutos por detrás de la cadena, o se rechaza. Los historiales diarios se guardan durante el día UTC, los pools más negociados de la semana media hora, las búsquedas y las lecturas de pares diez minutos, y una explicación una hora; la medición de la liquidez inteligente se renueva cada seis horas.`,
        "Cuando falla una fuente, la página dice qué parte no pudo obtenerse y muestra el resto; una cifra que falta se muestra como ausente, nunca como cero, y nunca se sustituye por una suposición. En la página de liquidez inteligente un pool que no se puede leer cuesta solo ese pool, y una renovación fallida deja en pie la última medición hasta que caduca; en la página del par, una red que no se puede leer aparece como tal. La explicación es la única parte que puede faltar.",
        "No se guarda nada sobre quién lee el sitio. Una visita se cuenta como una línea que nombra la página, el pool si lo hay (un contrato público), el idioma y si parecía un bot — sin dirección IP, sin datos del navegador, sin texto de búsqueda, y nunca una dirección escrita para consultar sus posiciones. Lo único que se guarda sobre un lector es una alerta de Telegram que configura él mismo: la dirección que escribió, su idioma, el identificador numérico del chat y si cada posición estaba dentro de rango la última vez. /stop la borra al instante, y de las copias de seguridad desaparece en siete días.",
      ],
    },
  },
  notAdvice:
    "Nada de esta página, ni de ninguna otra parte del sitio, es asesoramiento financiero. Cada cifra describe días que ya pasaron o la propia aritmética del protocolo; ninguna dice qué hacer ni qué pasará después.",
};

const ar: MethodCopy = {
  link: "كيف يعمل",
  pointer: "كيف يُقاس هذا، بالتفصيل",
  title: "كيف يعمل",
  description:
    "كيف يُحسب كل رقم في LiquidityWise — النطاق المقترح، والاختبارات الرجعية، والرسوم، والخسارة غير الدائمة، وخطّافات v4، والسيولة الذكية، والشرح المكتوب — ومن أي بيانات، وما الذي يتركه كل منها خارجه.",
  heading: "كيف يُحسب كل رقم",
  lead: "كل رقم في هذا الموقع تحسبه شيفرة عادية من بيانات التجمّع المفهرسة ومن السلسلة نفسها، ويُفحص قبل عرضه؛ ولا يصف نموذج لغوي الأرقام إلا بعد ذلك. تقول هذه الصفحة، قسمًا بعد قسم، كيف يُحسب كل منها وما الذي يتركه خارجه. إنها تلخّص الشيفرة؛ ولا تَعِد بشيء عن أي تجمّع.",
  contentsHeading: "في هذه الصفحة",
  sections: {
    "suggested-range": {
      title: "النطاق المقترح",
      paragraphs: (f) => [
        `يبدأ من أسعار الإغلاق اليومية للتجمّع نفسه كما ينشرها الـ subgraph الخاص به: آخر ${f.closes} يومًا مكتملًا بتوقيت UTC، من دون اليوم الحالي لأنه لم يُغلق بعد. وتعطي هذه الإغلاقات ${f.returns} عائدًا يوميًا، كلٌّ منها الفرق بين لوغاريتمَي إغلاقين متتاليين. واليوم الغائب عن المصدر يُتخطّى — لا يُملأ ولا يُنقل إليه ما قبله ولا يُستكمل بالاستيفاء — والصفحة تقول متى كانت في النافذة فجوات.`,
        `التقلّب هو الانحراف المعياري للعيّنة لتلك العوائد، محوّلًا إلى أساس سنوي بالجذر التربيعي لـ ${f.yearDays}. ثم يُحوَّل إلى الأفق الذي تختاره (${f.horizons} يومًا؛ ${f.defaultHorizon} إن لم تختر) بالجذر التربيعي لحصة الأفق من السنة، ويُضرب في الاتساع الذي تختاره (بالانحرافات المعيارية: ${f.multipliers}؛ ${f.defaultMultiplier} إن لم تختر). ولا يحدّد الأفق إلا المدى الذي تُمدّ إليه الحركة المقيسة نحو الأمام: أما الحركة نفسها فتُقاس دائمًا على الأيام نفسها، آخر ${f.returns} يومًا.`,
        `توضع الحزمة حول سعر اليوم متناظرةً في اللوغاريتمات، من دون أي انجراف: فالانخفاض إلى النصف والتضاعف على المسافة نفسها، ولهذا تختلف النسبتان على الجانبين. ثم تُزاح حافتاها إلى الخارج على شبكة الـ tick الخاصة بالتجمّع، لا إلى الداخل أبدًا، فيغطي النطاق دائمًا الحزمةَ كلّها على الأقل. ويحرسه فحصان: يجب أن يتحوّل السعر الحالي للتجمّع إلى الـ tick الذي يبلّغ عنه التجمّع نفسه، وأن يأتي من كتلة لا تتأخر عن السلسلة أكثر من ${f.freshMinutes} دقيقة.`,
        `ليس تنبؤًا: يقول كم تحرّك السعر، لا إلى أين سيذهب. والاتساع ليس مستوى ثقة — فتحويل «انحرافين معياريين» إلى «95% من الوقت» يحتاج إلى افتراض عن كيفية توزّع الأسعار لم يثبت. ولا يحدّد حجم مركز ولا يقول كم يُودَع من كل رمز.`,
      ],
    },
    "out-of-sample": {
      title: "مُختبَر في أيام لم يرها قط",
      paragraphs: (f) => [
        `يقرأ الموقع ${f.historyDays} يومًا من أسعار الإغلاق — أكثر مما يحتاجه التقلّب — حتى يمكن اختبار الطريقة على أيام لم تُواءَم عليها. تُرجَع الطريقة أفقًا واحدًا إلى الوراء، وتُواءَم من جديد على الإغلاقات الـ ${f.closes} السابقة لتلك النقطة وحدها ولا شيء بعدها، ومركزها إغلاق تلك النقطة، وتوضع فوق الأيام التي تلتها؛ ثم الأمر نفسه أبعد إلى الوراء ما دام في التاريخ متّسع. ويُعدّ كل يوم داخل النطاق بالكامل أو خارجه بالكامل أو عابرًا لحافة: فأعلى اليوم وأدناه لا يقولان أين كان السعر خلال اليوم، لذلك لا يُقسَم اليوم العابر لحافة بالتخمين أبدًا.`,
        "هذه بضعة مقاطع من تجمّع واحد، وليست مقياسًا لعدد المرات التي تصمد فيها الطريقة. والمواءمات المتتالية تتداخل، فالمقاطع ليست مستقلة بعضها عن بعض، ولم يحتفظ أحد بهذه الحزم فعلًا.",
        `«لو فُتح قبل ثلاثين يومًا» يعيد تطبيق النطاق الذي كانت الطريقة سترسمه في بداية الأيام الثلاثين الأخيرة — من الإغلاقات الـ ${f.closes} التي سبقتها ولا شيء بعدها — على كل يوم من تلك الأيام. ويعطي رقمين. القيمة مقارنةً بالاحتفاظ، عند كل إغلاق يومي، تأتي من المقادير الدقيقة للسيولة المركّزة ولا تحتاج إلى سعر بالدولار. والرسوم تأتي من الرسوم اليومية للتجمّع نفسه في الأيام التي بقي فيها السعر داخل النطاق بالكامل، موزّعةً كما يوزّعها رقم الإيداع، مع تحديد حجم الإيداع بسعر الدولار اليوم لأن السجل التاريخي لا يحوي سعر دولار يوميًا.`,
        `«جرّب نطاقك الخاص» يعيد تطبيق النطاق بين سعرين تكتبهما على الأيام الثلاثين نفسها، من إغلاق الافتتاح نفسه، بتوزيع الرسوم نفسه وسعر الدولار نفسه، فلا يبقى بين العمودين فرق سوى النطاق. والنطاق الذي لا يحوي سعر الافتتاح يبدأ برمز واحد فقط من الرمزين ولا يأخذ رسومًا حتى يبلغه السعر. والنطاق الذي أبلى حسنًا في هذه الأيام لا يقول شيئًا عن الأيام التالية.`,
      ],
    },
    recentring: {
      title: "إعادة التوسيط حين يخرج السعر",
      paragraphs: () => [
        "«إعادة التوسيط حين يخرج السعر» تعيد تطبيق استراتيجية نشطة بسيطة واحدة على الأيام الثلاثين نفسها التي يعيدها «لو فُتح قبل ثلاثين يومًا»، من إغلاق الافتتاح نفسه وفي النطاق نفسه. عند إغلاق كل يوم لاحق، إذا كان الإغلاق خارج النطاق، يُعاد توسيط المركز هناك: ما يحمله — وهو حينها أحد الرمزين فقط — يُحوَّل بتبادلٍ إلى المزيج الذي يحتاجه نطاق بالاتساع نفسه يتوسّطه ذلك الإغلاق، وما يتبقى بعد رسوم التبادل هو المركز الجديد. والاتساع هو اتساع نطاق الافتتاح، كمضاعفات لمنتصفه، فإعادة التوسيط تنقل النطاق ولا تعيد رسمه أبدًا. وتُحتسب الرسوم تمامًا كما في الإعادة الثابتة، يومًا بيوم، للنطاق المحتفَظ به في ذلك اليوم، وتوضع جانبًا بدل إعادة استثمارها.",
        "ويدفع التبادل الرسوم التي تقول شروط التجمّع نفسه إن التبادل يدفعها — شريحة رسوم في v3، أو رسوم مفتاح v4 مع حصة البروتوكول، في اتجاه التبادل. وحيث لا يذكرها شيء ثابت، لأن خطّافًا يحدّد الرسوم لكل تبادل، يدفع المعدل الذي دفعته تبادلات الشهر فعلًا — الرسوم مقسومة على الحجم — وتقول الصفحة ذلك؛ وحيث يمكن لخطّاف أن يغيّر ما يدفعه التبادل، تقول الصفحة إن التكلفة قد تختلف. أثر السعر غير منمذج: يُسعَّر كل تبادل عند الإغلاق، كأن التجمّع يستطيع استيعابه كاملًا. ولا يُحتسب الغاز إلا إذا حدّدت تكلفة لكل إعادة توسيط، بالدولار كالإيداع، ويُدفع من خارج المركز؛ والافتتاح يكلّف الاثنين القدر نفسه ولا يُحتسب في أيّ منهما.",
        "لا ترى إلا الإغلاقات اليومية. السعر الذي خرج من النطاق وعاد خلال يوم ليس إعادة توسيط، وإعادة التوسيط تحدث عند الإغلاق لا عند الحافة — وغالبًا بعدها. وكل رقم بالدولار محسوب بسعر اليوم، كأرقام الإيداع. وتضع الصفحة القيمة النهائية، مع احتساب كل شيء، بجانب الاحتفاظ بالرموز التي فُتح بها الإيداع وبجانب النطاق نفسه بلا إعادة توسيط؛ والشهر الذي لا إعادة توسيط فيه هو ذلك النطاق تمامًا. إنها استراتيجية واحدة على شهر واحد مضى، وليست نصيحة.",
      ],
    },
    fees: {
      title: "الرسوم والخسارة غير الدائمة",
      paragraphs: () => [
        "ما تقاضاه التجمّع يأتي من الرسوم والحجم اللذين ينشرهما الـ subgraph الخاص به لكل يوم من الأيام الثلاثين الأخيرة. وقسمة رسوم اليوم على حجمه تقيس المعدّل الذي دفعه المبادلون فعلًا — اليوم المعتاد، والأدنى والأعلى، والنافذة كلها بوصفها مجموع الرسوم على مجموع الحجم — ويُقارن بالرسم الذي يعلنه التجمّع. واليوم الذي لا حجم فيه يُستبعد بدل أن يُعدّ صفرًا.",
        `ما كان الإيداع سيأخذه: في كل يوم بقي فيه السعر داخل النطاق بالكامل، حصة L / (A + L) من رسوم ذلك اليوم، حيث L هي السيولة التي يشتريها الإيداع في النطاق وA هي السيولة التي يبلّغ المصدر أنها كانت نشطة ذلك اليوم. والـ "+ L" هو الإيداع يخفّف نفسه بنفسه، ولهذا لا يحصّل الإيداع الأكبر أكثر بالنسبة نفسها. والأيام التي عبرت حافة لا تُحسب، واليوم الداخلي الذي لم ينشر له المصدر رسومًا أو سيولة نشطة يُذكر أنه بلا بيانات، لا بوصفه صفرًا.`,
        "تحويل الدولارات إلى سيولة التجمّع يحتاج إلى سعر بالدولار، والموقع يستخدم سعر الـ subgraph نفسه، المشتق مما يحتفظ به التجمّع من كل رمز وبالدولار — وهو السعر الذي تُقوَّم به أرقام رسومه. إنه سعر اليوم مطبّقًا على أيام مضت، والصفحة تقول ذلك. والنتيجة رسوم فقط، على أيام مضت بالفعل: ليست معدّلًا سنويًا، وليست ما سيدفعه الشهر المقبل.",
        "الخسارة غير الدائمة — المركز مقارنةً بالاحتفاظ البسيط بالرمزين — هي الحساب الدقيق لمنحنى البروتوكول بين حافتي النطاق، من سعر اليوم إلى كل سعر معروض. لا تحتاج إلى بيانات سوق ولا إلى حجم إيداع، لأن السيولة تُختزَل من النسبة. وهي غير دائمة فقط إن عاد السعر. إنها تحسب حركة السعر ولا شيء غيرها، والرسوم هي ما يُدفع لمزوّد السيولة مقابل تحمّلها، لذلك يجب أن يُقرأ الاثنان معًا.",
      ],
    },
    hooks: {
      title: "خطّافات v4",
      paragraphs: (f) => [
        "قد يسمّي تجمّع v4 خطّافًا (hook)، أي عقدًا يستدعيه البروتوكول في لحظات محددة. وتُقرأ صلاحياته من عنوانه: يُنشر الخطّاف على عنوان تقول بِتّاته الأربع عشرة الدنيا أيّ الاستدعاءات سيجريها الـ PoolManager، والـ PoolManager يفحص تلك البِتّات بدل أن يسأل العقد. فالموقع إذن يقرأ القاعدة التي يفرضها البروتوكول — لا سجلًّا ولا وسمًا ولا وصف العقد لنفسه — ويقول ما يُسمح للخطّاف بفعله، ولا يقول أبدًا ما يفعله.",
        "الخطّاف المسموح له بالتدخل قبل التبادل يستطيع إعادة كتابة رسمه؛ والمسموح له بإرجاع فرق (delta) من التبادل يستطيع أن يأخذ جزءًا من التبادل نفسه. وحين يملك خطّاف التجمّع أيًّا من هذين، يُحجب كل رقم رسوم مرتبط بنطاق أو بإيداع — الرسوم أثناء البقاء داخله، وحصة الإيداع، والرسوم في الشهر المُعاد، والعائد في صفحة الزوج — إذ لا شيء في المصدر يفصل حصة الخطّاف عن حصة المزوّدين. أما ما تقاضاه التجمّع فيبقى معروضًا، بوصفه حقيقة عن التجمّع، واللوحات التي تعرض تكلفة التبادل تحمل ملاحظة. والتجمّع الذي لا يثبّت مفتاحه رسمًا يُعرض بلا رسم، ويُقاس المعدّل الذي تقاضاه فعلًا من أيامه.",
        `إلى جانب الصلاحيات، تعرض صفحة الخطّافات وصفحة تجمّع v4 أمرين يستطيع أي أحد التحقق منهما من الخارج. أما هل الشيفرة المصدرية للخطّاف موثّقة، فيُسأل عنه من الخادم وبلا مفتاح كلٌّ من Sourcify ومستكشف Blockscout الخاص بالشبكة: الموثّق على أيٍّ منهما يُعرض موثّقًا، مع اسم العقد من Blockscout حين يذكره ومن Sourcify إن لم يذكره؛ وغير الموثّق على كليهما يُعرض على أنه لم يُعثر عليه؛ والمصدر الذي لا يجيب في غضون ثوانٍ، أو يجيب بما لا يُفهم، يتركه معروضًا على أنه لم يُتحقق منه. والموثّق يعني أن المصدر المنشور للعنوان يُترجَم إلى الشيفرة المنشورة عنده، فتمكن قراءتها؛ وهو ليس تدقيقًا، ولا يقول شيئًا عن كون الخطّاف آمنًا. أما عدد تجمّعات v4 على الشبكة التي تسمّي الخطّاف، ومتى أُنشئ أولها، فيأتي من subgraph الـ v4 الخاص بالشبكة، ويتوقف العدّ عند ${f.hookPoolCap}. وتُحفظ الإجابات ${f.hookCheckHours} ساعة، ويُعاد السؤال الذي لم يُجب عنه بعد ${f.hookCheckRetryMinutes} دقائق؛ ولا تنتظر أي صفحة إجابةً طويلًا، بل تقول بدلًا من ذلك إن التحقق تعذّر.`,
      ],
    },
    "smart-liquidity": {
      title: "السيولة الذكية",
      paragraphs: (f) => [
        `في كل شبكة يمكن فيها سرد المراكز (${f.smartChains})، تنظر الصفحة في تجمّعات v3 الـ ${f.smartPools} الأكثر تداولًا في الأسبوع، وتأخذ المراكز التي يقع السعر داخل نطاقها الآن، وتسأل السلسلة عمّا يصل إلى ${f.positionsPerPool} منها في كل تجمّع، الأكبر أولًا، وقيمة كل منها ${f.minPositionUsd} على الأقل. ويُعاد القياس كل ست ساعات.`,
        `رسوم المركز هي ما كسبه منذ آخر تغيير له: سيولته مضروبةً في نمو الرسوم داخل نطاقه منذ أن كتب مدير المراكز لقطته الأخيرة، مقروءةً من السلسلة. ويجب أن يقود زوج كل مركز ورسمه وحافتاه إلى التجمّع الذي أُدرج فيه. وتلك الرسوم، مقسومةً على قيمة المركز الآن وعلى الأيام منذ ذلك التغيير، ومحوّلةً إلى أساس سنوي، هي عائده. والمراكز التي تقل عن ${f.minPositionUsd}، أو التي تغيّرت قبل أقل من ${f.minWindowDays} أيام، تُستبعد لأنها أصغر أو أحدث من أن تدل على شيء؛ و${f.smartShare} الأعلى عائدًا منها هي المراكز الذكية.`,
        "الـ subgraph يسرد المراكز ويؤرّخ آخر تغيير لكل منها، لا أكثر. وحقول الرسوم فيه لا تُستخدم: عند فحصها في 2026-09-30 كانت تُبلّغ عن ملياري دولار حصّلها مركز كان قد أودع اثنين وثلاثين مليونًا. ولا تُحسب كذلك المبالغ المستحقة لدى مدير المراكز، لأنها بعد السحب تحوي رأس المال المسحوب إلى أن يُحصَّل.",
        "ما يتركه العائد خارجه: إنه رسوم فقط، وما تخلّى عنه المركز مقارنةً بالاحتفاظ بالرمزين ليس فيه. يغطي نافذة واحدة لكل مركز، ولا يقرأ إلا المراكز الواقعة في نطاقها الآن، ولا يقول شيئًا عمّا سيكسبه أيّ منها بعد ذلك ولا عمّن يملكها.",
        `يُحتفظ بكل قياس، حتى تستطيع الصفحة أن تقول كيف تحرّكت الأمور في الأسبوع الأخير متى توفّر يوم من القياسات. ويُقارن نطاق الزوج بوصفه أسعارًا، لا بوصفه مسافات عن السعر الحالي أبدًا، لأن تلك المسافات تتغيّر كلما تحرّك السعر حتى لو لم يلمس أحد أي مركز. و«حائزون يظهرون باستمرار» هم العناوين التي كانت ضمن أعلى ${f.smartShare} في نصف القياسات على الأقل، متى بلغ عدد القياسات ${f.ownerSets} أو أكثر. ويُوسم كل منها محفظةً أو عقدًا بحسب ما إذا كانت السلسلة تحفظ شيفرة عند عنوانه: العقد خزنة أو بوت أو برنامج آخر، وعائده عائد ذلك البرنامج.`,
      ],
    },
    "position-record": {
      title: "كيف كان أداء مركز مفتوح",
      paragraphs: () => [
        "حين يُبحث عن عنوان، يحمل كل مركز v3 مفتوح يملكه حسابًا لأدائه منذ فُتح. فالمودَع والمسحوب من رأس المال هما المجموعان التراكميان اللذان يحفظهما الـ subgraph الخاص بمراكز الشبكة عند كل تغيير في المركز. وما فيه الآن يُحسب من سيولته وحافتيه والسعر الجذري للتجمّع، وكلها مقروءة من السلسلة. ولا تؤخذ رسومه من حقول الرسوم في الـ subgraph، فهي غير صالحة للاستعمال: بين تغيير والذي يليه لا تتحرك سيولة المركز، فما كسبه في تلك الفترة هو سيولته مضروبةً في نمو الرسوم داخل نطاقه بين اللقطتين اللتين كتبهما مدير المراكز عند طرفيها. أما الفترة منذ آخر تغيير فتُقرأ من السلسلة، كما تُقرأ الرسوم التي لم تُحصَّل بعد.",
        "لا يُعرض الحساب إلا حين يثبت أن السجل يصل إلى الحاضر: يجب أن يحمل أحدث تغيير لدى الـ subgraph السيولة ولقطة نمو الرسوم اللتين يحفظهما مدير المراكز الآن بالضبط، وأن يتضمن السجل إيداعًا، وأن يكون كل صف منه قد قُرئ. وإلا قال المركز إن سجله تعذّر التحقق منه، ولم يعرض أي رقم بدل مجموع ناقص. ومفهرسات v4 لا تحتفظ بسجل لكل مركز، فلا حساب لمركز في v4.",
        "كل ما في الحساب يُقوَّم بسعر اليوم، بالرمز الذي تسعّر به الصفحة الزوج. ففي مقابل ما كانت ستساويه الإيداعات لو احتُفظ بها ببساطة، يضع ما يحمله المركز الآن، مضافًا إليه المسحوب، ومضافًا إليه رسومه؛ ويُقسم الفرق إلى الرسوم وأثر النطاق، وهو المركز مقابل الاحتفاظ قبل الرسوم — ما يُسمّى عادةً الخسارة غير الدائمة. وتُقوَّم الإيداعات والسحوبات بسعر اليوم لا بسعر يومها، ولا يُحتسب الغاز. ويشمل الحساب عمر المركز كله، مع كل مالك كان له، وهو قياس لا نصيحة مالية.",
      ],
    },
    pair: {
      title: "زوج واحد، كل تجمّعاته",
      paragraphs: (f) => [
        "تسرد صفحة الزوج كل تجمّع v3 وv4 يطابق رمزاه الزوجَ المكتوب تمامًا، على كل شبكة يقرؤها الموقع. ويُرتَّب كل منها بالرسوم التي تقاضاها في الأسبوع الأخير مقسومةً على ما فيه الآن، ومحوّلةً إلى أساس سنوي — بسيط، لا مركّب. إنها رسوم ماضية على سيولة حاضرة: ليست تنبؤًا، وليست ما سيكسبه مركز، فالمركز لا يكسب إلا ما دام السعر داخل نطاقه، ويتقاسم الرسوم مع كل من هناك، ويتخلّى عن شيء مقارنةً بالاحتفاظ.",
        `ما في التجمّع يُقاس بطريقة مختلفة في كل بروتوكول، لذلك يُرتَّب الاثنان كلٌّ على حدة: في v3، ما تحتفظ به له عقود رموزه؛ وفي v4، حيث تقبع كل الرموز في PoolManager واحد، عمقه عند السعر الحالي. ولا تُرتَّب إلا التجمّعات التي تساوي ${f.pairFloorUsd} على الأقل — فما دون ذلك يحرّك تداولُ بضع ساعات الرقمَ أكثر من اللازم ويزيد احتمال أن يكون الرمز مقلَّدًا — وتُسرد البقية تحتها بحسب الحجم، بلا عائد. والتجمّع v4 الذي قد يغيّر خطّافه ما تدفعه التبادلات يعرض رسومه مع ملاحظة وبلا عائد. والشبكة التي تتعذّر قراءتها تُدرج مع الإشارة إلى ذلك.`,
      ],
    },
    "language-model": {
      title: "الشرح المكتوب",
      paragraphs: () => [
        "في صفحة التجمّع، بعد أن يُحسب كل رقم ويُفحص، يكتب نموذج لغوي أربع فقرات قصيرة: ما الذي يغطيه النطاق، وماذا يحدث حين يغادره السعر، وما الذي يقيسه التقلّب وما الذي لا يقيسه، وما الذي يتركه التحليل خارجه. وتُعطى له الأرقام كما تعرضها الصفحة، بلغة القارئ، مع الاتجاهات مكتوبةً سلفًا في جمل. ولا يصل إليه شيء مما يكتبه الزائر — سوى عنوان تجمّع اجتاز فحصًا صارمًا لصيغته؛ لا وصف رمز ولا نص حر — ولا يصل إليه أي tick على الإطلاق.",
        "يُطلب منه ألّا يذكر رقمًا أبدًا، وألّا ينصح، وألّا يتنبأ. وهذا يُفرض ولا يُطلب فحسب: كل فقرة تُفحص قبل عرضها. فالفقرة التي تحوي رقمًا بأي خط — بما في ذلك الأرقام العربية المشرقية والديفاناغرية وكاملة العرض، والكسور والأسس — خارج الاسمين v3 وv4، أو عددًا من أحد عشر فما فوق مكتوبًا بالكلمات بأي من اللغات العشر، تُرفض، وكذلك الفقرة القصيرة جدًا أو الطويلة جدًا. وإن فشلت فقرة واحدة، يُسقط الشرح كله وتبقى الأرقام وحدها.",
        "ما لا يستطيع الفحص فرضه هو النبرة؛ وهذا متروك للتعليمات، والصفحة لا تدّعي غير ذلك. وتسمّي الصفحة النموذج الذي كتب النص كما يبلّغ عنه مزوّد الخدمة، ويُعاد استخدام الشرح نفسه ساعة على الأكثر للتجمّع نفسه والإعدادات نفسها واللغة نفسها.",
      ],
    },
    "data-sources": {
      title: "مصادر البيانات وحدودها",
      paragraphs: (f) => [
        `تُقرأ التجمّعات من الـ subgraphs الخاصة بـ Uniswap v3 وv4 على The Graph، في شبكات ${f.chains}؛ وتُقرأ ${f.v4OnlyChains} لـ v4 فقط. وحيث يخطئ الـ subgraph أو يصمت، تُسأل السلسلة مباشرة، للقراءة فقط: تباعد الـ tick لتجمّع v3 وما تحتفظ به عقود رموزه، وسيولة تجمّع v4 وسعره من الـ PoolManager، وأرباح المركز وحائزه من مدير المراكز، وما إذا كان عنوانٌ ما يحوي شيفرة. ويُفحص كل subgraph كل ساعة.`,
        `يجب أن تأتي الحالة الحالية للتجمّع من كتلة لا تتأخر عن السلسلة أكثر من ${f.freshMinutes} دقيقة، وإلا رُفضت. ويُحتفظ بالسجلات اليومية طوال يوم UTC، وبأكثر تجمّعات الأسبوع تداولًا نصف ساعة، وبعمليات البحث وقراءات الأزواج عشر دقائق، وبالشرح ساعة؛ ويُجدَّد قياس السيولة الذكية كل ست ساعات.`,
        "حين يتعطّل مصدر، تقول الصفحة أيّ جزء تعذّر حسابه وتعرض الباقي؛ والرقم الغائب يُعرض غائبًا، لا صفرًا أبدًا، ولا يُستبدل بتخمين أبدًا. وفي صفحة السيولة الذكية لا يكلّف التجمّعُ الذي تتعذّر قراءته إلا نفسه، والتجديد الفاشل يُبقي القياس الأخير قائمًا حتى تنتهي صلاحيته؛ وفي صفحة الزوج تُدرج الشبكة التي تتعذّر قراءتها مع الإشارة إلى ذلك. والشرح هو الجزء الوحيد المسموح له بالغياب.",
        "لا يُحتفظ بشيء عمّن يقرأ الموقع. تُسجَّل الزيارة في سطر يذكر الصفحة، والتجمّع إن وُجد (وهو عقد علني)، واللغة، وما إذا بدت آلية — بلا عنوان IP، وبلا بيانات المتصفح، وبلا نص بحث، ولا عنوانٍ كُتب للاطلاع على مراكزه أبدًا. والشيء الوحيد المحفوظ عن قارئ هو تنبيه تيليغرام يُعدّه بنفسه: العنوان الذي كتبه، ولغته، والمعرّف الرقمي للمحادثة، وما إذا كان كل مركز داخل نطاقه في المرة الأخيرة. والأمر /stop يحذفه فورًا، ويختفي من النسخ الاحتياطية خلال سبعة أيام.",
      ],
    },
  },
  notAdvice:
    "لا شيء في هذه الصفحة، ولا في أي مكان آخر من الموقع، نصيحة مالية. كل رقم يصف أيامًا مضت بالفعل أو حساب البروتوكول نفسه؛ ولا يقول أيّ منها ما الذي يجب فعله أو ما الذي سيحدث بعد ذلك.",
};

const hi: MethodCopy = {
  link: "यह कैसे काम करता है",
  pointer: "यह कैसे मापा जाता है, पूरे विस्तार से",
  title: "यह कैसे काम करता है",
  description:
    "LiquidityWise का हर आँकड़ा कैसे बनता है — सुझाया गया दायरा, पिछले दिनों पर जाँच, शुल्क, अस्थायी हानि, v4 के hooks, स्मार्ट तरलता और लिखित स्पष्टीकरण — किस डेटा से, और हर एक क्या छोड़ देता है।",
  heading: "हर आँकड़ा कैसे बनता है",
  lead: "इस साइट का हर आँकड़ा सादे कोड से, पूल के इंडेक्स किए गए डेटा और ख़ुद चेन से गिना जाता है, और दिखाए जाने से पहले जाँचा जाता है; भाषा मॉडल आँकड़ों का वर्णन उसके बाद ही करता है। यह पृष्ठ, हिस्सा-दर-हिस्सा, बताता है कि हर आँकड़ा कैसे बनता है और क्या छोड़ देता है। यह कोड का सार है; किसी पूल के बारे में कोई वादा नहीं।",
  contentsHeading: "इस पृष्ठ पर",
  sections: {
    "suggested-range": {
      title: "सुझाया गया दायरा",
      paragraphs: (f) => [
        `शुरुआत पूल के अपने रोज़ाना बंद भावों से होती है, जैसे उसका subgraph उन्हें प्रकाशित करता है: पिछले ${f.closes} पूरे UTC दिन, आज को छोड़कर क्योंकि वह अभी बंद नहीं हुआ। इनसे ${f.returns} दैनिक प्रतिफल निकलते हैं, हर एक दो लगातार बंद भावों के लघुगणकों का अंतर। स्रोत में न मिलने वाला दिन छोड़ दिया जाता है — कभी भरा नहीं जाता, पिछले दिन से आगे नहीं खींचा जाता, न अनुमान से बीच में बैठाया जाता है — और खिड़की में खाली जगह हो तो पृष्ठ यह बताता है।`,
        `अस्थिरता उन प्रतिफलों का प्रतिदर्श मानक विचलन है, जिसे ${f.yearDays} के वर्गमूल से गुणा करके सालाना किया जाता है। फिर उसे आपकी चुनी अवधि (${f.horizons} दिन; न चुनें तो ${f.defaultHorizon}) के लिए ढाला जाता है — अवधि साल का जितना हिस्सा है, उसके वर्गमूल से — और आपकी चुनी चौड़ाई (मानक विचलनों में: ${f.multipliers}; न चुनें तो ${f.defaultMultiplier}) से गुणा किया जाता है। अवधि केवल यह बताती है कि मापी गई हलचल कितनी आगे तक बिछाई जाए: हलचल हमेशा उन्हीं पिछले ${f.returns} दिनों पर मापी जाती है।`,
        `बैंड आज की कीमत के चारों ओर लघुगणक में सममित रूप से रखा जाता है, बिना किसी झुकाव के: आधा होना और दोगुना होना एक ही दूरी है, इसीलिए दोनों तरफ़ के प्रतिशत अलग होते हैं। फिर उसके किनारे पूल की tick ग्रिड पर बाहर की ओर खिसकाए जाते हैं, अंदर की ओर कभी नहीं, ताकि दायरा हमेशा कम से कम बैंड को ढके। दो जाँचें उसकी रक्षा करती हैं: पूल की मौजूदा कीमत को उसी tick में बदलना चाहिए जो पूल ख़ुद बताता है, और वह ऐसे ब्लॉक से आनी चाहिए जो चेन से ज़्यादा से ज़्यादा ${f.freshMinutes} मिनट पीछे हो।`,
        `यह पूर्वानुमान नहीं है: यह बताता है कि कीमत कितनी हिली है, यह नहीं कि कहाँ जाएगी। और चौड़ाई कोई विश्वास-स्तर नहीं है — "दो मानक विचलन" को "95% समय" में बदलने के लिए कीमतों के वितरण के बारे में एक ऐसी धारणा चाहिए जो स्थापित नहीं हुई है। यह किसी पोज़िशन का आकार तय नहीं करता, न बताता है कि किस टोकन का कितना जमा करें।`,
      ],
    },
    "out-of-sample": {
      title: "उन दिनों पर परखा गया जो इसने कभी देखे नहीं",
      paragraphs: (f) => [
        `साइट ${f.historyDays} दिनों के बंद भाव पढ़ती है — अस्थिरता की ज़रूरत से ज़्यादा — ताकि तरीके को उन दिनों पर परखा जा सके जिन पर वह बिठाया नहीं गया। तरीके को एक अवधि पीछे ले जाया जाता है, उस बिंदु से पहले के ${f.closes} बंद भावों पर, बाद के किसी दिन के बिना, दोबारा बिठाया जाता है, उस बिंदु के बंद भाव पर केंद्रित किया जाता है, और उसके बाद आए दिनों पर रखा जाता है; फिर वही और पीछे, जब तक इतिहास में जगह हो। हर दिन पूरी तरह भीतर, पूरी तरह बाहर या किनारे के आर-पार गिना जाता है: दिन का उच्चतम और न्यूनतम यह नहीं बता सकते कि दिन में कीमत कहाँ थी, इसलिए किनारा पार करने वाला दिन अंदाज़े से कभी नहीं बाँटा जाता।`,
        "ये एक ही पूल के कुछ हिस्से हैं, यह माप नहीं कि तरीका कितनी बार टिकता है। लगातार बिठाए गए बैंड एक-दूसरे पर चढ़ते हैं, इसलिए हिस्से एक-दूसरे से स्वतंत्र नहीं हैं, और ये बैंड किसी ने असल में रखे नहीं थे।",
        `"तीस दिन पहले खोली गई होती" उस दायरे को, जो तरीका पिछले तीस दिनों की शुरुआत में खींचता — उससे पहले के ${f.closes} बंद भावों से, बाद के किसी दिन के बिना — उन दिनों में से हर एक पर दोबारा चलाता है। यह दो आँकड़े देता है। रखे रहने की तुलना में मूल्य, हर दिन के बंद भाव पर, केंद्रित तरलता की सटीक मात्राओं से आता है और उसे डॉलर कीमत नहीं चाहिए। शुल्क उन दिनों के पूल के अपने दैनिक शुल्क से आते हैं जब कीमत पूरी तरह भीतर रही, वैसे ही बाँटे जाते हैं जैसे जमा वाला आँकड़ा बाँटता है, और जमा का आकार आज की डॉलर दर पर तय होता है क्योंकि इतिहास में दैनिक दर नहीं है।`,
        `"अपना दायरा आज़माएँ" आपकी लिखी दो कीमतों को उन्हीं तीस दिनों पर, उसी शुरुआती बंद भाव से, उसी शुल्क-बँटवारे और उसी डॉलर दर के साथ दोबारा चलाता है, ताकि दोनों कॉलम में फ़र्क़ केवल दायरे का रहे। जो दायरा शुरुआती कीमत को नहीं समेटता, वह दोनों में से केवल एक टोकन के साथ शुरू होता है, और कीमत के उस तक पहुँचने तक कोई शुल्क नहीं लेता। जो दायरा इन दिनों में अच्छा रहा, वह अगले दिनों के बारे में कुछ नहीं कहता।`,
      ],
    },
    recentring: {
      title: "बाहर जाने पर फिर से केंद्रित करना",
      paragraphs: () => [
        "\"बाहर जाने पर फिर से केंद्रित करें\" एक सरल सक्रिय रणनीति को उन्हीं तीस दिनों पर दोहराता है जिन पर \"तीस दिन पहले खोली गई होती\", उसी शुरुआती बंद भाव से और उसी दायरे में। हर अगले दिन के बंद भाव पर, अगर बंद भाव दायरे के बाहर है, तो पोज़िशन वहीं फिर से केंद्रित की जाती है: उसके पास जो है — तब तक दोनों में से बस एक टोकन — उसे स्वैप करके उस मिश्रण में बदला जाता है जो उस बंद भाव पर केंद्रित, उतनी ही चौड़ाई वाले दायरे को चाहिए, और स्वैप के शुल्क के बाद जो बचता है वही नई पोज़िशन है। चौड़ाई शुरुआती दायरे की ही रहती है, उसके केंद्र के गुणजों के रूप में, इसलिए पुनःकेंद्रण दायरे को खिसकाता है, उसे कभी दोबारा नहीं खींचता। शुल्क ठीक स्थिर दोहराव की तरह गिना जाता है, दिन-ब-दिन, उस दिन रखे गए दायरे के लिए, और दोबारा लगाया नहीं जाता, अलग रखा जाता है।",
        "स्वैप वह शुल्क चुकाता है जो पूल की अपनी शर्तों के अनुसार एक स्वैप चुकाता है — v3 का शुल्क स्तर, या v4 की कुंजी का शुल्क और प्रोटोकॉल का हिस्सा, स्वैप की दिशा में। जहाँ कोई तय चीज़ यह नहीं बताती, क्योंकि hook हर स्वैप पर शुल्क तय करता है, वहाँ वह दर चुकाई जाती है जो महीने के स्वैप ने असल में चुकाई — शुल्क बँटा वॉल्यूम — और पृष्ठ यह बताता है; जहाँ hook बदल सकता है कि स्वैप क्या चुकाता है, वहाँ पृष्ठ कहता है कि लागत अलग हो सकती है। कीमत पर असर का मॉडल नहीं बनाया गया: हर स्वैप बंद भाव पर आँका जाता है, मानो पूल उसे पूरा सँभाल सके। गैस तभी गिनी जाती है जब आप प्रति पुनःकेंद्रण लागत तय करें, जमा की तरह डॉलर में, और वह पोज़िशन के बाहर से चुकाई जाती है; शुरुआत दोनों को बराबर पड़ती है और किसी में नहीं गिनी जाती।",
        "यह दैनिक बंद भाव देखता है, और कुछ नहीं। जो कीमत दायरे से बाहर जाकर एक ही दिन में लौट आई, वह पुनःकेंद्रण नहीं है, और पुनःकेंद्रण किनारे पर नहीं, बंद भाव पर होता है — अक्सर उसके पार। डॉलर का हर आँकड़ा, जमा के आँकड़ों की तरह, आज की दर पर है। पृष्ठ अंतिम मूल्य को, सब कुछ गिनकर, जमा के शुरुआती टोकन रखे रहने के बगल में और उसी दायरे के बिना पुनःकेंद्रण के बगल में रखता है; जिस महीने कोई पुनःकेंद्रण न हो, वह ठीक वही दायरा है। यह बीत चुके एक महीने पर एक रणनीति है, और सलाह नहीं है।",
      ],
    },
    fees: {
      title: "शुल्क और अस्थायी हानि",
      paragraphs: () => [
        "पूल ने क्या लिया, यह उन शुल्कों और कारोबार से आता है जो उसका subgraph पिछले तीस दिनों में से हर एक के लिए प्रकाशित करता है। किसी दिन के शुल्क को उसके कारोबार से भाग देने पर वह दर मापी जाती है जो स्वैप करने वालों ने असल में चुकाई — सामान्य दिन, सबसे कम और सबसे ज़्यादा, और पूरी खिड़की कुल शुल्क बटा कुल कारोबार के रूप में — और उसकी तुलना पूल के घोषित शुल्क से की जाती है। जिस दिन कोई कारोबार नहीं हुआ, उसे शून्य गिनने के बजाय छोड़ दिया जाता है।",
        `एक जमा ने कितना वसूला होता: हर उस दिन जब कीमत पूरी तरह दायरे के भीतर रही, उस दिन के शुल्क का L / (A + L) हिस्सा, जहाँ L वह तरलता है जो जमा दायरे में ख़रीदती है और A वह तरलता है जिसे स्रोत उस दिन सक्रिय बताता है। "+ L" का अर्थ है कि जमा ख़ुद अपना हिस्सा घटाती है, इसीलिए बड़ी जमा अनुपात में ज़्यादा नहीं वसूलती। किनारा पार करने वाले दिन नहीं गिने जाते, और भीतर का ऐसा दिन जिसके लिए स्रोत ने शुल्क या सक्रिय तरलता प्रकाशित नहीं की, वैसा ही बताया जाता है, शून्य के रूप में नहीं।`,
        "डॉलर को पूल की तरलता में बदलने के लिए डॉलर कीमत चाहिए, और साइट subgraph की अपनी कीमत लेती है, जो इससे निकाली जाती है कि पूल हर टोकन में और डॉलर में कितना रखता है — वही दर जिसमें उसके शुल्क के आँकड़े हैं। यह पिछले दिनों पर लगाई गई आज की दर है, और पृष्ठ यह बताता है। नतीजा केवल शुल्क है, बीत चुके दिनों पर: यह सालाना दर नहीं है, और अगला महीना क्या देगा यह भी नहीं।",
        "अस्थायी हानि — दोनों टोकन केवल रखे रहने की तुलना में पोज़िशन — प्रोटोकॉल के वक्र का दायरे के किनारों के बीच सटीक गणित है, आज की कीमत से दिखाई गई हर कीमत तक। इसे न बाज़ार डेटा चाहिए, न जमा का आकार, क्योंकि अनुपात में तरलता कट जाती है। वह अस्थायी तभी है जब कीमत लौट आए। यह कीमत की हलचल गिनती है और कुछ नहीं, और शुल्क वही है जो तरलता देने वाले को इसे उठाने के बदले मिलता है, इसलिए दोनों को साथ पढ़ना होगा।",
      ],
    },
    hooks: {
      title: "v4 के hooks",
      paragraphs: (f) => [
        "कोई v4 पूल एक hook का नाम दे सकता है — एक कॉन्ट्रैक्ट जिसे प्रोटोकॉल तय क्षणों पर बुलाता है। उसकी अनुमतियाँ उसके पते से पढ़ी जाती हैं: hook ऐसे पते पर तैनात होता है जिसके सबसे निचले चौदह बिट बताते हैं कि PoolManager कौन-से कॉलबैक बुलाएगा, और PoolManager कॉन्ट्रैक्ट से पूछने के बजाय इन्हीं बिटों को जाँचता है। इसलिए साइट वह नियम पढ़ती है जिसे प्रोटोकॉल लागू करता है — कोई रजिस्टर, कोई लेबल या कॉन्ट्रैक्ट का अपने बारे में दिया विवरण नहीं — और बताती है कि hook क्या कर सकता है, यह कभी नहीं कि वह क्या करता है।",
        "जिस hook को स्वैप से पहले दख़ल की अनुमति है, वह उसका शुल्क दोबारा लिख सकता है; जिसे स्वैप से delta लौटाने की अनुमति है, वह स्वैप का एक हिस्सा ख़ुद ले सकता है। जब किसी पूल के hook के पास इनमें से कोई अनुमति हो, तो दायरे या जमा से जुड़ा हर शुल्क-आँकड़ा रोक लिया जाता है — भीतर रहने के दौरान के शुल्क, एक जमा का हिस्सा, तीस दिन के दोहराव के शुल्क, जोड़ी वाले पृष्ठ की शुल्क आय — क्योंकि स्रोत में कुछ भी hook के हिस्से को तरलता देने वालों के हिस्से से अलग नहीं करता। पूल ने जो लिया वह फिर भी दिखाया जाता है, पूल के बारे में एक तथ्य के रूप में, और स्वैप की लागत दिखाने वाले पैनलों पर एक टिप्पणी रहती है। जिस पूल की कुंजी कोई शुल्क तय नहीं करती, वह बिना शुल्क के दिखाया जाता है, और उसने असल में जो दर ली वह उसके दिनों से मापी जाती है।",
        `अनुमतियों के साथ, hooks वाला पृष्ठ और किसी v4 पूल का पृष्ठ दो ऐसी बातें दिखाते हैं जिन्हें कोई भी बाहर से जाँच सकता है। किसी hook का सोर्स कोड सत्यापित है या नहीं, यह सर्वर से और बिना किसी कुंजी के Sourcify और नेटवर्क के अपने Blockscout से पूछा जाता है: दोनों में से किसी पर भी सत्यापित हो तो उसे सत्यापित दिखाया जाता है, कॉन्ट्रैक्ट का नाम Blockscout दे तो उससे, नहीं तो Sourcify से; दोनों में से किसी पर सत्यापित न हो तो दिखाया जाता है कि कुछ नहीं मिला; जो स्रोत कुछ सेकंड में जवाब न दे, या ऐसा जवाब दे जो समझ में न आए, उसके रहते दिखाया जाता है कि जाँच नहीं हो सकी। सत्यापित का मतलब है कि पते के लिए प्रकाशित सोर्स कोड कंपाइल होकर वहाँ तैनात कोड बनता है, इसलिए उसे पढ़ा जा सकता है; यह ऑडिट नहीं है, और इससे यह पता नहीं चलता कि hook सुरक्षित है या नहीं। नेटवर्क पर कितने v4 पूल उस hook का नाम लेते हैं, और उनमें से पहला कब बना, यह नेटवर्क के v4 subgraph से आता है, ${f.hookPoolCap} तक गिना जाता है। जवाब ${f.hookCheckHours} घंटे रखे जाते हैं और जिस सवाल का जवाब नहीं मिला वह ${f.hookCheckRetryMinutes} मिनट बाद फिर पूछा जाता है; कोई पृष्ठ किसी जवाब का देर तक इंतज़ार नहीं करता, बल्कि कह देता है कि जाँच नहीं हो सकी।`,
      ],
    },
    "smart-liquidity": {
      title: "स्मार्ट तरलता",
      paragraphs: (f) => [
        `हर उस नेटवर्क पर जहाँ पोज़िशनें सूचीबद्ध की जा सकती हैं (${f.smartChains}), पृष्ठ हफ़्ते के ${f.smartPools} सबसे ज़्यादा कारोबार वाले v3 पूलों को देखता है, इस समय दायरे के भीतर की पोज़िशनें लेता है, और हर पूल में अधिकतम ${f.positionsPerPool} के बारे में चेन से पूछता है, सबसे बड़ी पहले, हर एक कम से कम ${f.minPositionUsd} की। माप हर छह घंटे में दोबारा होता है।`,
        `किसी पोज़िशन के शुल्क वे हैं जो उसने अपने पिछले बदलाव के बाद से कमाए: उसकी तरलता गुणा उसके दायरे के भीतर शुल्क की बढ़त, जब से पोज़िशन मैनेजर ने आख़िरी बार अपना स्नैपशॉट लिखा, चेन से पढ़ी गई। हर पोज़िशन की जोड़ी, शुल्क और ticks उसी पूल से मेल खाने चाहिए जिसमें वह सूचीबद्ध थी। इन शुल्कों को पोज़िशन के आज के मूल्य से और उस बदलाव के बाद बीते दिनों से भाग देकर सालाना करने पर उसकी आय मिलती है। ${f.minPositionUsd} से छोटी, या ${f.minWindowDays} दिन से कम पहले बदली गई पोज़िशनें कुछ कहने के लिए बहुत छोटी या बहुत नई होने के कारण बाहर रहती हैं; सबसे ज़्यादा आय वाली ${f.smartShare} स्मार्ट हैं।`,
        "subgraph पोज़िशनों की सूची देता है और हर एक के पिछले बदलाव की तारीख़, इससे ज़्यादा कुछ नहीं। उसके शुल्क वाले फ़ील्ड इस्तेमाल नहीं होते: 2026-09-30 को जाँचने पर वे एक ऐसी पोज़िशन के लिए दो अरब डॉलर वसूले जाने की बात कह रहे थे जिसने तीन करोड़ बीस लाख डॉलर जमा किए थे। पोज़िशन मैनेजर की बकाया रक़में भी नहीं गिनी जातीं, क्योंकि निकासी के बाद वे वसूली होने तक निकाली गई मूल रक़म रखती हैं।",
        "आय क्या छोड़ देती है: यह केवल शुल्क है, और दोनों टोकन रखे रहने की तुलना में पोज़िशन ने जो गँवाया वह इसमें नहीं है। यह हर पोज़िशन की एक खिड़की को ढकती है, केवल अभी दायरे के भीतर की पोज़िशनें पढ़ती है, और यह कुछ नहीं कहती कि उनमें से कोई आगे क्या कमाएगी या उनका धारक कौन है।",
        `हर माप सहेजा जाता है, ताकि एक दिन के माप जमा होते ही पृष्ठ बता सके कि पिछले हफ़्ते चीज़ें कैसे खिसकीं। किसी जोड़ी के दायरे की तुलना कीमतों के रूप में की जाती है, मौजूदा कीमत से दूरी के रूप में कभी नहीं, क्योंकि वह दूरी कीमत हिलते ही बदल जाती है, भले किसी ने पोज़िशन को छुआ तक न हो। "जो धारक बार-बार दिखते हैं" वे पते हैं जो कम से कम आधे मापों में सबसे ऊपर के ${f.smartShare} में रहे, जब माप ${f.ownerSets} या उससे ज़्यादा हों। हर एक को वॉलेट या कॉन्ट्रैक्ट चिह्नित किया जाता है, इस आधार पर कि चेन उसके पते पर कोड रखती है या नहीं: कॉन्ट्रैक्ट एक वॉल्ट, एक बॉट या कोई और प्रोग्राम है, और उसकी आय उसी प्रोग्राम की है।`,
      ],
    },
    "position-record": {
      title: "खुली पोज़िशन का अब तक का हाल",
      paragraphs: () => [
        "जब किसी पते को देखा जाता है, उसकी हर खुली v3 पोज़िशन के साथ यह हिसाब होता है कि खुलने के बाद से उसका हाल कैसा रहा। जमा की गई राशि और मूलधन के रूप में निकाली गई राशि वे चलते योग हैं जो नेटवर्क का पोज़िशन subgraph पोज़िशन के हर बदलाव पर रखता है। अभी उसमें क्या है, यह उसकी तरलता, उसके दो ticks और पूल की वर्गमूल कीमत से निकाला जाता है, सब चेन से पढ़ा हुआ। उसका शुल्क subgraph के शुल्क वाले फ़ील्ड से नहीं लिया जाता, जो काम के नहीं हैं: एक बदलाव से अगले बदलाव तक पोज़िशन की तरलता नहीं हिलती, इसलिए उस दौर में उसने जो कमाया वह उसकी तरलता गुणा उसके दायरे के भीतर शुल्क की बढ़त है, उन दो स्नैपशॉट के बीच जो पोज़िशन मैनेजर ने दोनों सिरों पर लिखे। पिछले बदलाव के बाद का दौर चेन से पढ़ा जाता है, जैसे अभी तक न निकाला गया शुल्क।",
        "हिसाब तभी दिखाया जाता है जब यह साबित हो कि इतिहास आज तक पहुँचता है: subgraph में सबसे नया बदलाव ठीक वही तरलता और शुल्क की बढ़त का स्नैपशॉट रखे जो पोज़िशन मैनेजर के पास अभी है, इतिहास में कोई जमा हो, और उसकी हर पंक्ति पढ़ी गई हो। वरना पोज़िशन कहती है कि उसका इतिहास जाँचा नहीं जा सका, और अधूरे योग की जगह कोई आँकड़ा नहीं दिखाती। v4 के इंडेक्सर हर पोज़िशन का इतिहास नहीं रखते, इसलिए v4 पोज़िशन का कोई हिसाब नहीं होता।",
        "हिसाब में सब कुछ आज की कीमत पर आँका जाता है, उस टोकन में जिसमें यह पृष्ठ जोड़ी की कीमत बताता है। अगर जमा राशि बस रखी रहती तो जितनी होती, उसके सामने यह रखता है कि पोज़िशन में अभी क्या है, उसमें निकाली गई राशि और उसका शुल्क जोड़कर; अंतर को शुल्क और दायरे के असर में बाँटा जाता है — दायरे का असर शुल्क से पहले पोज़िशन बनाम रखे रहना है, जिसे आमतौर पर अस्थायी हानि कहते हैं। जमा और निकासी को उनके दिन की कीमत पर नहीं, आज की कीमत पर आँका जाता है, और गैस नहीं गिनी जाती। हिसाब पोज़िशन के पूरे जीवनकाल को, उसके हर मालिक के दौर समेत, समेटता है, और यह एक माप है, वित्तीय सलाह नहीं।",
      ],
    },
    pair: {
      title: "एक जोड़ी, सभी पूल",
      paragraphs: (f) => [
        "जोड़ी वाला पृष्ठ हर वह v3 और v4 पूल दिखाता है जिसके दोनों चिह्न ठीक वही हैं जो जोड़ी में लिखे गए, साइट के पढ़े हर नेटवर्क पर। हर पूल का क्रम इससे तय होता है: पिछले हफ़्ते लिया गया शुल्क, उसमें अभी मौजूद रक़म से भाग देकर, सालाना — साधारण, चक्रवृद्धि नहीं। यह बीते शुल्क बटा मौजूदा तरलता है: न पूर्वानुमान, न वह जो कोई पोज़िशन कमाती, क्योंकि पोज़िशन तभी कमाती है जब कीमत उसके दायरे के भीतर हो, शुल्क वहाँ मौजूद बाक़ी सबके साथ बाँटती है, और रखे रहने की तुलना में कुछ गँवाती है।",
        `पूल में क्या है, यह हर प्रोटोकॉल पर अलग मापा जाता है, इसलिए दोनों अलग-अलग क्रम में रखे जाते हैं: v3 पर, पूल के टोकन कॉन्ट्रैक्ट उसके लिए क्या रखते हैं; v4 पर, जहाँ सारे टोकन एक ही PoolManager में रहते हैं, मौजूदा कीमत पर उसकी गहराई। केवल कम से कम ${f.pairFloorUsd} मूल्य वाले पूल क्रम में रखे जाते हैं — उससे नीचे एक दोपहर का कारोबार आँकड़े को बहुत हिला देता है और नक़ली टोकन की संभावना ज़्यादा होती है — और बाक़ी नीचे आकार के क्रम में, बिना आय के दिखाए जाते हैं। जिस v4 पूल का hook बदल सकता है कि स्वैप क्या चुकाते हैं, वह अपने शुल्क एक टिप्पणी के साथ और बिना आय के दिखाता है। जो नेटवर्क पढ़ा न जा सके, उसे वैसा ही बताया जाता है।`,
      ],
    },
    "language-model": {
      title: "लिखित स्पष्टीकरण",
      paragraphs: () => [
        "पूल के पृष्ठ पर, हर आँकड़ा गिने और जाँचे जाने के बाद, एक भाषा मॉडल चार छोटे अनुच्छेद लिखता है: दायरा क्या ढकता है, कीमत उससे बाहर जाए तो क्या होता है, अस्थिरता क्या मापती है और क्या नहीं, और विश्लेषण क्या छोड़ देता है। उसे आँकड़े वैसे ही दिए जाते हैं जैसे पृष्ठ दिखाता है, पाठक की भाषा में, दिशाएँ पहले से वाक्यों में लिखी हुई। आगंतुक का लिखा कुछ भी उस तक नहीं पहुँचता — एक कड़ी प्रारूप-जाँच पास कर चुके पूल पते के सिवा; न टोकन का विवरण, न खुला पाठ — और कोई tick उस तक बिल्कुल नहीं पहुँचता।",
        "उससे कहा जाता है कि कभी कोई संख्या न बताए, कभी सलाह न दे और कभी पूर्वानुमान न लगाए। यह केवल माँगा नहीं जाता, लागू किया जाता है: हर अनुच्छेद दिखाए जाने से पहले जाँचा जाता है। जिस अनुच्छेद में किसी भी लिपि का अंक हो — अरबी, देवनागरी और पूरी चौड़ाई वाले अंक, भिन्न और ऊपर लिखे अंक भी — v3 और v4 नामों को छोड़कर, या दसों भाषाओं में से किसी में शब्दों में लिखी ग्यारह या उससे बड़ी संख्या, वह अस्वीकार होता है, और बहुत छोटा या बहुत लंबा अनुच्छेद भी। एक भी अनुच्छेद विफल हो तो पूरा स्पष्टीकरण हटा दिया जाता है और केवल आँकड़े दिखाए जाते हैं।",
        "जाँच जो लागू नहीं कर सकती, वह लहजा है; वह निर्देश पर छोड़ा गया है, और पृष्ठ इसके उलट कोई दावा नहीं करता। पृष्ठ उस मॉडल का नाम बताता है जिसने पाठ लिखा, जैसा प्रदाता बताता है, और वही स्पष्टीकरण उसी पूल, उन्हीं सेटिंग्स और उसी भाषा के लिए ज़्यादा से ज़्यादा एक घंटे तक दोबारा इस्तेमाल होता है।",
      ],
    },
    "data-sources": {
      title: "डेटा स्रोत और सीमाएँ",
      paragraphs: (f) => [
        `पूल The Graph पर Uniswap के v3 और v4 subgraphs से पढ़े जाते हैं, इन नेटवर्कों पर: ${f.chains}; ${f.v4OnlyChains} केवल v4 के लिए पढ़ा जाता है। जहाँ subgraph ग़लत हो या चुप रहे, चेन से सीधे, केवल पढ़ने के लिए, पूछा जाता है: v3 पूल का tick अंतराल और उसके टोकन कॉन्ट्रैक्ट क्या रखते हैं, PoolManager से v4 पूल की तरलता और कीमत, पोज़िशन मैनेजर से पोज़िशन की कमाई और धारक, और यह कि किसी पते पर कोड है या नहीं। हर subgraph हर घंटे जाँचा जाता है।`,
        `पूल की मौजूदा स्थिति ऐसे ब्लॉक से आनी चाहिए जो चेन से ज़्यादा से ज़्यादा ${f.freshMinutes} मिनट पीछे हो, वरना वह अस्वीकार होती है। दैनिक इतिहास UTC दिन भर, हफ़्ते के सबसे ज़्यादा कारोबार वाले पूल आधे घंटे, खोज और जोड़ी के नतीजे दस मिनट, और एक स्पष्टीकरण एक घंटे तक रखा जाता है; स्मार्ट तरलता का माप हर छह घंटे में नया होता है।`,
        "जब कोई स्रोत विफल हो, पृष्ठ बताता है कि कौन-सा हिस्सा नहीं बन सका और बाक़ी दिखाता है; छूटा हुआ आँकड़ा छूटा हुआ दिखाया जाता है, शून्य कभी नहीं, और अंदाज़े से कभी नहीं बदला जाता। स्मार्ट तरलता वाले पृष्ठ पर जो पूल पढ़ा न जा सके उसकी कीमत केवल वही पूल चुकाता है, और विफल नवीनीकरण पिछले माप को उसकी मियाद ख़त्म होने तक बना रहने देता है; जोड़ी वाले पृष्ठ पर न पढ़ा जा सकने वाला नेटवर्क वैसा ही बताया जाता है। स्पष्टीकरण ही एकमात्र हिस्सा है जिसके न होने की अनुमति है।",
        "साइट कौन पढ़ता है, इसके बारे में कुछ नहीं रखा जाता। एक विज़िट एक पंक्ति के रूप में गिनी जाती है जिसमें पृष्ठ, अगर हो तो पूल (एक सार्वजनिक कॉन्ट्रैक्ट), भाषा और यह दर्ज होता है कि वह बॉट जैसा लगा या नहीं — न IP पता, न ब्राउज़र की जानकारी, न खोज का पाठ, और पोज़िशनें देखने के लिए लिखा गया पता कभी नहीं। किसी पाठक के बारे में रखी जाने वाली एकमात्र चीज़ एक Telegram सूचना है जो वह ख़ुद सेट करता है: उसका लिखा पता, उसकी भाषा, चैट की संख्यात्मक पहचान, और यह कि पिछली बार हर पोज़िशन दायरे के भीतर थी या नहीं। /stop उसे तुरंत मिटा देता है, और बैकअप से वह सात दिनों के भीतर हट जाती है।",
      ],
    },
  },
  notAdvice:
    "इस पृष्ठ पर, या साइट पर कहीं भी, कुछ भी वित्तीय सलाह नहीं है। हर आँकड़ा या तो बीत चुके दिनों का वर्णन करता है या प्रोटोकॉल के अपने गणित का; कोई भी यह नहीं बताता कि क्या करें या आगे क्या होगा।",
};

const zh: MethodCopy = {
  link: "工作原理",
  pointer: "这是怎么测出来的，完整说明",
  title: "工作原理",
  description:
    "LiquidityWise 上每个数字是怎么算出来的——建议区间、回溯检验、手续费、无常损失、v4 钩子、聪明的流动性和文字解释——用的是什么数据，又各自漏掉了什么。",
  heading: "每个数字是怎么来的",
  lead: "本站的每个数字都由普通代码根据资金池的索引数据和链本身算出，并在显示前经过核对；语言模型只在之后描述这些数字。本页逐节说明每个数字是怎么算出来的、漏掉了什么。它是对代码的概括，不对任何资金池作出承诺。",
  contentsHeading: "本页内容",
  sections: {
    "suggested-range": {
      title: "建议区间",
      paragraphs: (f) => [
        `起点是资金池自己的每日收盘价，按其子图公布的数据：最近 ${f.closes} 个完整的 UTC 日，不含今天，因为今天还没收盘。由此得到 ${f.returns} 个日收益，每个都是相邻两个收盘价的对数之差。来源中缺失的日子会被跳过——从不填补、不沿用前一天、也不插值——窗口有缺口时页面会说明。`,
        `波动率是这些收益的样本标准差，再乘以 ${f.yearDays} 的平方根换算成年化。然后按你选择的时间跨度（${f.horizons} 天；不选则为 ${f.defaultHorizon}）乘以该跨度占一年比例的平方根，再乘以你选择的宽度（以标准差计：${f.multipliers}；不选则为 ${f.defaultMultiplier}）。时间跨度只说明把测出来的走势往前摊多远：走势始终是在同样的最近 ${f.returns} 天上测量的。`,
        `价格带以今天的价格为中心、在对数上对称地展开，不加任何漂移：跌一半和涨一倍是同样的距离，所以两侧的百分比不同。然后把它的两端向外——从不向内——对齐到资金池的 tick 网格上，所以区间总是至少覆盖整个价格带。有两项检查守住它：资金池的当前价格必须换算成资金池自己报告的那个 tick，而且必须来自落后链上不超过 ${f.freshMinutes} 分钟的区块。`,
        `它不是预测：它说的是价格已经动了多少，而不是会去哪里。宽度也不是置信水平——要把"两个标准差"变成"95% 的时间"，需要一个关于价格如何分布的假设，而这个假设并未确立。它不决定仓位大小，也不说每种代币该存入多少。`,
      ],
    },
    "out-of-sample": {
      title: "在它从未见过的日子里检验",
      paragraphs: (f) => [
        `本站读取 ${f.historyDays} 天的收盘价——比波动率需要的多——这样就能在方法没有拟合过的日子上检验它。方法被往回挪一个时间跨度，只用那个时点之前的 ${f.closes} 个收盘价重新拟合，之后的一概不用，以那个时点的收盘价为中心，再叠放到随后的日子上；然后再往前重复，直到历史数据不够为止。每一天被计为完全在内、完全在外或越过边界：一天的最高价和最低价说不出当天价格在哪个时刻在哪里，所以越过边界的一天从不靠猜测来拆分。`,
        "这只是一个资金池的几段时间，不能衡量方法有多常成立。相邻的拟合相互重叠，所以这些时段彼此并不独立，而且没有人真的持有过这些价格带。",
        `"如果三十天前开仓"把方法在最近三十天开始时会画出的区间——用那之前的 ${f.closes} 个收盘价，之后的一概不用——在这三十天的每一天上重放。它给出两个数字。与持有相比的价值，在每天收盘时，来自集中流动性的精确数量，不需要美元价格。手续费来自价格完全留在区间内的那些日子里资金池自己的每日手续费，按存入资金那个数字的方式分配；由于历史数据没有每日美元汇率，存入资金按今天的美元汇率折算。`,
        `"试试你自己的区间"把你输入的两个价格在同样的三十天上、从同一个开仓收盘价、用同样的手续费分配和同样的美元汇率重放，所以两列之间唯一的差别就是区间。不包含开仓价格的区间一开始只持有两种代币中的一种，在价格到达它之前不收手续费。在这些日子里表现好的区间，对接下来的日子什么也说明不了。`,
      ],
    },
    recentring: {
      title: "价格离开时重新居中",
      paragraphs: () => [
        "\"价格离开时重新居中\"在与\"如果三十天前开仓\"相同的三十天里，从同一个开仓收盘价、在同一个区间重演一个简单的主动策略。在之后每一天收盘时，如果收盘价在区间之外，就在那里把仓位重新居中：它持有的东西——那时只剩两种代币中的一种——通过兑换调成以该收盘价为中心、同样宽度的区间所需的比例，扣掉兑换手续费后剩下的就是新仓位。宽度沿用开仓区间的宽度，按其中心的倍数计，所以重新居中只是移动区间，从不重新画它。手续费的计法与静态重演完全相同，逐日、按当天所持的区间计算，并单独存放而不再投入。",
        "兑换支付的是资金池自己的条款规定一笔兑换要付的费率——v3 的费率档，或 v4 键里的费率加上协议的抽成，按兑换方向计。如果没有任何固定的东西写明，因为 hook 逐笔设定费率，就按本月兑换实际支付的费率——手续费除以交易量——计，页面会说明；如果 hook 可能改变一笔兑换所付的费用，页面会说明成本可能不同。没有模拟价格冲击：每笔兑换都按收盘价计价，仿佛资金池能整笔吃下。只有你设定每次重新居中的成本时才计 gas，和存入金额一样以美元计，并从仓位之外支付；开仓对两者成本相同，两边都不计。",
        "它只看每日收盘价，别的都看不到。价格离开区间又在一天之内回来，不算重新居中；重新居中发生在收盘价上而不是边界上——通常已经越过边界。所有美元数字都按今天的汇率计算，和存入金额一样。页面把全部计入后的期末价值，与持有存入时的代币相比，也与同一区间从不重新居中相比；没有任何重新居中的一个月，就正好是那个区间。这是一个策略在一个已经过去的月份上的表现，不构成建议。",
      ],
    },
    fees: {
      title: "手续费与无常损失",
      paragraphs: () => [
        "资金池收了多少，来自其子图为最近三十天每一天公布的手续费和交易量。用一天的手续费除以当天交易量，测出兑换者实际支付的费率——典型的一天、最低和最高的一天，以及以总手续费除以总交易量计算的整个窗口——并与资金池声明的费率对照。没有交易量的日子不计为零，而是排除在外。",
        `一笔资金本可以收到多少：在价格完全留在区间内的每一天，取当天手续费的 L / (A + L)，其中 L 是这笔资金在区间内买到的流动性，A 是来源报告的当天活跃流动性。"+ L"是这笔资金对自己的稀释，所以资金越多，收到的并不按比例增加。越过边界的日子不计入；来源没有公布手续费或活跃流动性的区间内日子，会如实注明，而不是记为零。`,
        "把美元换算成资金池的流动性需要一个美元价格，本站用的是子图自己的价格，由资金池持有的每种代币数量和美元价值推出——也就是它的手续费数字所用的汇率。这是用今天的汇率套用到过去的日子，页面会说明。结果只是手续费，而且是已经过去的日子：不是年化费率，也不是下个月会付多少。",
        "无常损失——仓位与单纯持有两种代币相比——是协议曲线在区间两端之间的精确计算，从今天的价格算到页面上显示的每个价格。它不需要市场数据，也不需要资金规模，因为流动性在比值里约掉了。只有价格回来了它才是“无常”的。它只计价格变动，别的都不算，而手续费正是流动性提供者承担它所得到的报酬，所以两者必须一起看。",
      ],
    },
    hooks: {
      title: "v4 钩子",
      paragraphs: (f) => [
        "v4 资金池可以指定一个 hook：一个由协议在固定时刻调用的合约。它的权限从它的地址读取：hook 部署在这样一个地址上，其最低的十四位说明 PoolManager 会调用哪些回调，而 PoolManager 检查的正是这些位，而不是去问合约。所以本站读的是协议强制执行的规则——不是登记表、标签或合约对自己的描述——它说的是 hook 被允许做什么，从不说它实际做了什么。",
        "被允许在兑换前介入的 hook 可以改写兑换的手续费；被允许从兑换中返回 delta 的 hook 可以自己拿走兑换的一部分。当资金池的 hook 拥有其中任何一项权限时，所有与区间或存入资金挂钩的手续费数字都会被隐去——区间内期间的手续费、一笔资金的份额、三十天重放里的手续费、交易对页面上的收益率——因为来源中没有任何东西能把 hook 的份额和流动性提供者的份额分开。资金池收了多少仍会显示，作为关于这个资金池的事实；显示兑换成本的面板会附上说明。PoolKey 中没有固定手续费的资金池会如实显示为没有，它实际收取的费率从它的每日数据中测出。",
        `除了权限，hook 页面和 v4 资金池的页面还显示两项任何人都能从外部核实的信息。一个 hook 的源代码是否经过验证，由服务器在不使用任何密钥的情况下向 Sourcify 和该网络自己的 Blockscout 查询：在其中任何一个上经过验证就显示为已验证，合约名称在 Blockscout 给出时取自 Blockscout，否则取自 Sourcify；在两者上都未经验证就显示为未找到；某个来源如果几秒内没有回应，或者回应的内容无法理解，就显示为未能核实。经过验证的意思是，为该地址公开的源代码编译后就是部署在那里的代码，因此可以阅读；这不是审计，也不说明这个 hook 是否安全。网络上有多少个 v4 资金池指定了这个 hook，以及其中第一个是什么时候创建的，来自该网络的 v4 子图，计数上限为 ${f.hookPoolCap}。回应会保留 ${f.hookCheckHours} 小时，没有得到回应的查询会在 ${f.hookCheckRetryMinutes} 分钟后重新发出；页面从不长时间等待任何一个，而是直接说明这项核实未能完成。`,
      ],
    },
    "smart-liquidity": {
      title: "聪明的流动性",
      paragraphs: (f) => [
        `在每个能列出仓位的网络上（${f.smartChains}），页面查看本周交易最多的 ${f.smartPools} 个 v3 资金池，取出此刻处于区间内的仓位，并在每个资金池里向链查询最多 ${f.positionsPerPool} 个，从最大的开始，每个价值至少 ${f.minPositionUsd}。每六小时重新测量一次。`,
        `一个仓位的手续费是它自上次变动以来赚到的：它的流动性乘以自仓位管理器上次写入快照以来其区间内的手续费增长，从链上读取。每个仓位的交易对、费率和 tick 都必须能推回它被列入的那个资金池。这些手续费除以仓位现在的价值，再除以自那次变动以来的天数，年化之后就是它的收益率。价值低于 ${f.minPositionUsd}、或变动距今不足 ${f.minWindowDays} 天的仓位被排除，因为它们太小或太新，说明不了什么；收益率最高的 ${f.smartShare} 就是聪明的仓位。`,
        "子图只用来列出仓位、标出每个仓位上次变动的日期，别的都不用。它的手续费字段不被采用：在 2026-09-30 核对时，这些字段显示一个只存入了三千二百万美元的仓位收取了二十亿美元。仓位管理器中的应付金额也不计入，因为在提取之后、被领取之前，它们包含的是被提取的本金。",
        "收益率漏掉了什么：它只是手续费，仓位相对于持有两种代币所放弃的部分不在其中。它只覆盖每个仓位的一个窗口，只读取此刻处于区间内的仓位，对任何仓位接下来会赚多少、由谁持有，什么也没说。",
        `每次测量都会被保存，所以一旦积累了一天的测量，页面就能说明过去一周的变化。交易对的区间按价格比较，从不按与当前价格的距离比较，因为只要价格一动，这个距离就会变，哪怕没人碰过任何仓位。"一再出现的持有者"是在至少一半测量中都位于前 ${f.smartShare} 的地址，前提是测量已有 ${f.ownerSets} 次或更多。每个地址按链上该地址是否存有代码被标为钱包或合约：合约是金库、机器人或别的程序，它的收益率属于那个程序。`,
      ],
    },
    "position-record": {
      title: "一个未平仓仓位的表现",
      paragraphs: () => [
        "查询一个地址时，它持有的每一个未平仓 v3 仓位都会附上一份计算，说明它自开仓以来表现如何。存入的和作为本金取出的，是该网络的仓位子图在仓位每次变动时记下的累计总数。它现在里面有什么，由它的流动性、两个 tick 和资金池的平方根价格算出，全部从链上读取。它的手续费不取自子图的手续费字段，那些字段不可用：从一次变动到下一次变动，仓位的流动性不变，所以它在这一段里赚到的，就是它的流动性乘以仓位管理器在两端写入的快照之间其区间内的手续费增长。自上次变动以来的那一段从链上读取，和尚未收取的手续费一样。",
        "只有在能证明历史一直延续到现在时才显示这份计算：子图里最新的一次变动必须与仓位管理器现在持有的流动性和手续费增长快照完全一致，历史里必须有一笔存入，而且每一行都必须读到。否则这个仓位会说明它的历史无法核对，不显示任何数字，而不是一个不完整的总和。v4 的索引器不为每个仓位保留历史，所以 v4 仓位没有这份计算。",
        "计算中的一切都按今天的价格、以本页给这个交易对报价的那种代币计。它把存入的代币若只是持有今天值多少，与仓位现在持有的、加上取出的、再加上手续费放在一起比较；差额分成手续费和区间影响两部分——区间影响是不计手续费时仓位相对持有的差额，也就是通常所说的无常损失。存入和取出都按今天的价格计算，而不是按当天的价格，gas 也不计入。这份计算涵盖仓位的整个存续期间，包括它在每一位持有者手中的时候；它是一项测量，不构成财务建议。",
      ],
    },
    pair: {
      title: "一个交易对，所有资金池",
      paragraphs: (f) => [
        "交易对页面列出本站读取的每个网络上、两个代币符号与输入的交易对完全一致的每个 v3 和 v4 资金池。每个资金池按上一周收取的手续费除以现在池中的资金、再年化来排序——单利，不复利。这是过去的手续费除以现在的流动性：不是预测，也不是一个仓位会赚到的，因为仓位只有在价格处于其区间内时才赚钱，要与那里的所有人分享手续费，而且与持有相比还要放弃一些东西。",
        `池中有多少在两个协议里的测法不同，所以两者分开排名：在 v3，是该资金池的代币合约为它持有的数量；在 v4，所有代币都在同一个 PoolManager 里，所以用的是它在当前价格下的深度。只有价值至少 ${f.pairFloorUsd} 的资金池参与排名——低于这个数，一个下午的交易就会让数字波动太大，而且更可能是仿冒代币——其余的按规模列在下面，不给收益率。hook 可能改变兑换支付金额的 v4 资金池会显示手续费并附说明，不给收益率。读取不了的网络会如实列出。`,
      ],
    },
    "language-model": {
      title: "文字解释",
      paragraphs: () => [
        "在资金池页面上，每个数字都算好并核对之后，一个语言模型会写四段简短的文字：区间覆盖了什么、价格离开区间时会怎样、波动率衡量什么和不衡量什么、以及分析漏掉了什么。它拿到的数字与页面显示的一致，用读者的语言，方向已经事先写成句子。访客写的任何东西都到不了它那里——除了通过严格格式检查的资金池地址；没有代币描述，没有自由文本——tick 更是完全不会给它。",
        "它被要求从不说出数字、从不给建议、从不做预测。这不只是要求，而是强制执行：每一段在显示前都会被检查。凡是包含任何文字体系中的数字——包括阿拉伯数字、天城文数字、全角数字、分数和上标——但 v3 和 v4 这两个名称除外，或者在十种语言中任何一种里用文字写出的十一及以上的数，都会被拒绝；太短或太长的段落也一样。只要有一段不通过，整个解释都会被丢弃，数字独立呈现。",
        "检查无法强制的是语气；那留给指令去管，页面也不假装不是这样。页面会写明撰写这段文字的模型，以服务商报告的为准；同一资金池、同样设置和同一语言的解释最多重复使用一小时。",
      ],
    },
    "data-sources": {
      title: "数据来源与局限",
      paragraphs: (f) => [
        `资金池数据读自 The Graph 上 Uniswap 的 v3 和 v4 子图，覆盖 ${f.chains}；${f.v4OnlyChains} 只读取 v4。子图出错或没有数据时，就直接只读地询问链本身：v3 资金池的 tick 间距及其代币合约持有的数量、从 PoolManager 读取 v4 资金池的流动性和价格、从仓位管理器读取仓位的收益和持有者，以及某个地址上是否有代码。每个子图每小时检查一次。`,
        `资金池的当前状态必须来自落后链上不超过 ${f.freshMinutes} 分钟的区块，否则会被拒绝。每日历史保留到当天 UTC 日结束，本周交易最多的资金池保留半小时，搜索和交易对读取保留十分钟，解释保留一小时；聪明的流动性每六小时重新测量一次。`,
        "某个来源失败时，页面会说明哪一部分没能算出，并显示其余部分；缺失的数字显示为缺失，从不显示为零，也从不用猜测代替。在聪明的流动性页面上，读不了的资金池只影响它自己，刷新失败时上一次测量会保留到过期为止；在交易对页面上，读不了的网络会如实列出。解释是唯一允许缺失的部分。",
        "本站不保存任何关于谁在阅读的信息。一次访问记为一行，写明页面、资金池（如有，是公开合约）、语言以及是否像机器人——没有 IP 地址，没有浏览器信息，没有搜索文本，也从不记录为查看仓位而输入的地址。唯一保存的关于读者的信息，是他们自己设置的 Telegram 提醒：他们输入的地址、他们的语言、聊天的数字 ID，以及每个仓位上一次是否在区间内。/stop 会立即删除它，备份中的副本七天内消失。",
      ],
    },
  },
  notAdvice:
    "本页以及本站任何地方的内容都不是财务建议。每个数字描述的要么是已经过去的日子，要么是协议本身的算术；没有一个数字告诉你该做什么，或接下来会发生什么。",
};

const ru: MethodCopy = {
  link: "Как это работает",
  pointer: "Как это измеряется, подробно",
  title: "Как это работает",
  description:
    "Как получается каждая цифра на LiquidityWise — предложенный диапазон, проверки на прошлом, комиссии, непостоянные потери, hook’и v4, умная ликвидность и письменное пояснение, — из каких данных и что каждая из них оставляет за кадром.",
  heading: "Как получается каждая цифра",
  lead: "Каждую цифру на этом сайте считает обычный код по индексированным данным пула и по самой сети, и перед показом она проверяется; языковая модель лишь описывает цифры после этого. Эта страница по разделам рассказывает, как получается каждая и что она оставляет за кадром. Это пересказ кода, а не обещание о каком-либо пуле.",
  contentsHeading: "На этой странице",
  sections: {
    "suggested-range": {
      title: "Предложенный диапазон",
      paragraphs: (f) => [
        `Исходная точка — собственные дневные цены закрытия пула, как их публикует его subgraph: последние ${f.closes} завершённых дней по UTC, без сегодняшнего, потому что он ещё не закрылся. Из них получается ${f.returns} дневных доходностей, каждая — разность логарифмов двух соседних закрытий. День, которого нет в источнике, пропускается — никогда не заполняется, не переносится с предыдущего и не интерполируется, — и страница говорит, если в окне были пропуски.`,
        `Волатильность — это выборочное стандартное отклонение этих доходностей, приведённое к году умножением на квадратный корень из ${f.yearDays}. Затем она масштабируется на выбранный горизонт (${f.horizons} дней; без выбора — ${f.defaultHorizon}) квадратным корнем из доли горизонта в году и умножается на выбранную ширину (в стандартных отклонениях: ${f.multipliers}; без выбора — ${f.defaultMultiplier}). Горизонт говорит лишь, насколько далеко вперёд раскладывается измеренное движение: само движение всегда измеряется по тем же последним ${f.returns} дням.`,
        `Полоса откладывается вокруг сегодняшней цены симметрично в логарифмах, без дрейфа: падение вдвое и рост вдвое — одно и то же расстояние, поэтому проценты по обе стороны различаются. Затем её края сдвигаются на сетку tick’ов пула наружу, никогда внутрь, так что диапазон всегда покрывает полосу как минимум целиком. Её охраняют две проверки: текущая цена пула должна переводиться в тот tick, который сообщает сам пул, и она должна быть взята из блока, отстающего от сети не более чем на ${f.freshMinutes} минут.`,
        `Это не прогноз: диапазон говорит, насколько цена уже двигалась, а не куда она пойдёт. И ширина — не доверительный уровень: чтобы превратить «два стандартных отклонения» в «95% времени», нужно допущение о распределении цен, которое не установлено. Он не определяет размер позиции и не говорит, сколько какого токена вносить.`,
      ],
    },
    "out-of-sample": {
      title: "Проверено на днях, которых он не видел",
      paragraphs: (f) => [
        `Сайт читает ${f.historyDays} дней закрытий — больше, чем нужно для волатильности, — чтобы метод можно было проверить на днях, по которым он не подгонялся. Метод сдвигается на один горизонт назад, заново подгоняется только по ${f.closes} закрытиям до этой точки и ничему после, центрируется на закрытии в этой точке и накладывается на последующие дни; затем то же самое дальше в прошлое, пока хватает истории. Каждый день считается целиком внутри, целиком снаружи или пересекающим край: дневные максимум и минимум не говорят, где внутри дня была цена, поэтому день, пересёкший край, никогда не делится наугад.`,
        "Это несколько отрезков одного пула, а не мера того, как часто метод срабатывает. Соседние подгонки перекрываются, так что отрезки не независимы друг от друга, и никто на самом деле не держал эти полосы.",
        `«Если бы открыли тридцать дней назад» воспроизводит диапазон, который метод нарисовал бы в начале последних тридцати дней — по ${f.closes} закрытиям до этого и ничему после, — на каждом из этих дней. Получаются две цифры. Стоимость в сравнении с хранением, на каждом дневном закрытии, берётся из точных количеств концентрированной ликвидности и не требует цены в долларах. Комиссии берутся из собственных дневных комиссий пула в те дни, когда цена целиком оставалась внутри, и делятся так же, как в расчёте вклада; вклад пересчитывается по сегодняшнему курсу доллара, потому что дневного курса в истории нет.`,
        `«Попробуйте свой диапазон» воспроизводит две введённые цены на тех же тридцати днях, от того же закрытия открытия, с тем же делением комиссий и тем же курсом доллара, так что две колонки отличаются только диапазоном. Диапазон, не содержащий цену открытия, начинает лишь с одним из двух токенов и не получает комиссий, пока цена до него не дойдёт. Диапазон, который хорошо показал себя в эти дни, ничего не говорит о следующих.`,
      ],
    },
    recentring: {
      title: "Перецентрирование, когда цена выходит",
      paragraphs: () => [
        "«Перецентрировать, когда цена выходит» повторяет одну простую активную стратегию на тех же тридцати днях, что и «Если бы открыли тридцать дней назад», с того же закрытия при открытии и в том же диапазоне. На закрытии каждого следующего дня, если закрытие вне диапазона, позиция перецентрируется там: то, что она держит, — к тому моменту лишь один из двух токенов — обменивается на соотношение, которое нужно диапазону той же ширины с центром на этом закрытии, а то, что остаётся после комиссии свопа, и есть новая позиция. Ширина — та же, что у диапазона при открытии, в долях от его центра, так что перецентрирование сдвигает диапазон и никогда не рисует его заново. Комиссии считаются точно так же, как в статичном повторе, день за днём, для диапазона, который держали в тот день, и откладываются, а не реинвестируются.",
        "Своп платит ту комиссию, которую по собственным условиям пула платит своп: уровень комиссии v3 или комиссию ключа v4 с долей протокола, в направлении свопа. Где ничто фиксированное её не называет, потому что комиссию для каждого свопа задаёт hook, он платит ставку, которую фактически платили свопы за месяц, — комиссии, делённые на объём, — и страница это говорит; где hook может менять то, что платит своп, страница говорит, что стоимость может отличаться. Влияние на цену не моделируется: каждый своп оценивается по закрытию, как будто пул может принять его целиком. Gas учитывается, только если вы зададите стоимость одного перецентрирования, в долларах, как вклад, и он оплачивается не из позиции; открытие стоит обеим одинаково и не учитывается ни в одной.",
        "Она видит дневные закрытия и ничего больше. Цена, которая вышла из диапазона и вернулась в течение дня, — не перецентрирование, а перецентрирование происходит на закрытии, а не на границе, — обычно за ней. Каждая долларовая цифра — по сегодняшнему курсу, как и у вклада. Страница ставит итоговую стоимость, всё учтено, рядом с хранением токенов, с которыми открылся вклад, и рядом с тем же диапазоном без перецентрирования; месяц без перецентрирований — это ровно тот диапазон. Это одна стратегия на одном уже прошедшем месяце, и это не совет.",
      ],
    },
    fees: {
      title: "Комиссии и непостоянные потери",
      paragraphs: () => [
        "Сколько брал пул, берётся из комиссий и объёма, которые его subgraph публикует за каждый из последних тридцати дней. Комиссии дня, делённые на его объём, дают ставку, которую участники свопов действительно заплатили, — типичный день, самый низкий и самый высокий, и всё окно как сумма комиссий на сумму объёма, — и она сопоставляется с заявленной комиссией пула. День без объёма не считается нулём, а исключается.",
        `Сколько взял бы вклад: в каждый день, когда цена целиком оставалась внутри диапазона, долю L / (A + L) комиссий этого дня, где L — ликвидность, которую вклад покупает в диапазоне, а A — ликвидность, которую источник сообщает активной в тот день. «+ L» — это вклад, разбавляющий сам себя, поэтому больший вклад собирает не пропорционально больше. Дни, пересёкшие край, не считаются, а день внутри, для которого источник не опубликовал комиссий или активной ликвидности, так и помечается, а не записывается нулём.`,
        "Чтобы перевести доллары в ликвидность пула, нужна цена в долларах, и сайт берёт собственную цену subgraph’а, выведенную из того, что пул держит в каждом токене и в долларах, — тот самый курс, в котором выражены его комиссии. Это сегодняшний курс, применённый к прошлым дням, и страница так и говорит. Результат — только комиссии за уже прошедшие дни: не годовая ставка и не то, что заплатит следующий месяц.",
        "Непостоянные потери — позиция в сравнении с простым хранением двух токенов — это точная арифметика кривой протокола между краями диапазона, от сегодняшней цены до каждой показанной. Им не нужны ни рыночные данные, ни размер вклада, потому что ликвидность сокращается в отношении. Непостоянны они только если цена вернётся. Они учитывают движение цены и ничего больше, а комиссии — это именно то, что поставщику платят за то, что он их несёт, поэтому читать их нужно вместе.",
      ],
    },
    hooks: {
      title: "Hook’и v4",
      paragraphs: (f) => [
        "Пул v4 может назвать hook — контракт, который протокол вызывает в определённые моменты. Его разрешения читаются из его адреса: hook развёртывается по адресу, младшие четырнадцать бит которого говорят, какие обратные вызовы сделает PoolManager, и PoolManager проверяет эти биты, а не спрашивает контракт. Значит, сайт читает правило, которое обеспечивает протокол, — не реестр, не ярлык и не описание контракта самим собой — и говорит, что hook’у разрешено, но никогда не то, что он делает.",
        "Hook, которому разрешено вмешиваться до свопа, может переписать его комиссию; тот, которому разрешено возвращать delta из свопа, может забрать часть самого свопа. Если у hook’а пула есть любое из этих разрешений, скрывается каждая цифра комиссий, привязанная к диапазону или вкладу, — комиссии, пока цена внутри, доля вклада, комиссии в тридцатидневном воспроизведении, доходность на странице пары, — потому что ничто в источнике не отделяет долю hook’а от доли поставщиков. То, что пул взял, по-прежнему показывается как факт о пуле, а панели, показывающие стоимость свопа, несут пометку. Пул, чей ключ не фиксирует комиссию, так и показывается, а ставка, которую он реально брал, измеряется по его дням.",
        `Помимо разрешений, страница hook’ов и страница пула v4 показывают две вещи, которые любой может проверить снаружи. Верифицирован ли исходный код hook’а, спрашивается с сервера и без ключа у Sourcify и у собственного Blockscout сети: верифицированный хотя бы на одном показывается как верифицированный, с именем контракта от Blockscout, если тот его даёт, а иначе от Sourcify; не верифицированный ни на одном показывается как не найденный; источник, который не ответил за несколько секунд или ответил непонятно, оставляет его непроверенным. Верифицирован значит, что исходный код, опубликованный для адреса, компилируется в код, развёрнутый по нему, и его можно прочитать; это не аудит, и это ничего не говорит о том, безопасен ли hook. Сколько пулов v4 в сети называют hook и когда был создан первый из них, берётся из subgraph’а v4 этой сети, счёт идёт до ${f.hookPoolCap}. Ответы хранятся ${f.hookCheckHours} часов, а вопрос без ответа задаётся снова через ${f.hookCheckRetryMinutes} минут; страница никогда не ждёт ответа долго и вместо этого говорит, что проверить не удалось.`,
      ],
    },
    "smart-liquidity": {
      title: "Умная ликвидность",
      paragraphs: (f) => [
        `В каждой сети, где позиции можно перечислить (${f.smartChains}), страница смотрит в ${f.smartPools} самых торгуемых v3-пулов недели, берёт позиции, находящиеся в диапазоне прямо сейчас, и спрашивает сеть о не более чем ${f.positionsPerPool} на пул, начиная с крупнейших, каждая стоимостью не меньше ${f.minPositionUsd}. Измерение повторяется каждые шесть часов.`,
        `Комиссии позиции — это то, что она заработала с последнего изменения: её ликвидность, умноженная на рост комиссий внутри её диапазона с тех пор, как менеджер позиций последний раз записал свой снимок, прочитанная из сети. Пара, комиссия и tick’и каждой позиции должны вести к тому пулу, в котором она была указана. Эти комиссии, делённые на нынешнюю стоимость позиции и на дни с того изменения и приведённые к году, — её доходность. Позиции меньше ${f.minPositionUsd} или изменённые менее ${f.minWindowDays} дней назад отбрасываются как слишком маленькие или слишком новые, чтобы о чём-то говорить; ${f.smartShare} с наибольшей доходностью и есть умные.`,
        "Subgraph перечисляет позиции и датирует последнее изменение каждой — и только. Его поля комиссий не используются: при проверке 2026-09-30 они сообщали о двух миллиардах долларов, собранных позицией, внёсшей тридцать два миллиона. Суммы к выплате в менеджере позиций тоже не учитываются, потому что после вывода в них лежит выведенный основной капитал, пока его не заберут.",
        "Чего доходность не учитывает: это только комиссии, и то, чем позиция поступилась по сравнению с хранением двух токенов, в неё не входит. Она охватывает одно окно на позицию, читает только позиции, находящиеся в диапазоне сейчас, и ничего не говорит о том, сколько любая из них заработает дальше или кто ею владеет.",
        `Каждое измерение сохраняется, чтобы страница могла сказать, как всё сдвинулось за последнюю неделю, как только накопится день измерений. Диапазон пары сравнивается в ценах, а не в расстояниях от текущей цены, потому что эти расстояния меняются при каждом движении цены, даже если никто не трогал позицию. «Держатели, которые появляются снова и снова» — это адреса, бывшие в верхних ${f.smartShare} как минимум в половине измерений, когда их ${f.ownerSets} или больше. Каждый помечается как кошелёк или контракт по тому, хранит ли сеть код по его адресу: контракт — это хранилище, бот или другая программа, и его доходность — доходность этой программы.`,
      ],
    },
    "position-record": {
      title: "Как показала себя открытая позиция",
      paragraphs: () => [
        "Когда адрес просматривают, у каждой открытой позиции v3, которую он держит, есть расчёт того, как она показала себя с момента открытия. Внесённое и выведенное как основной капитал — это накопленные итоги, которые subgraph позиций этой сети записывает при каждом изменении позиции. То, что в ней сейчас, вычисляется из её ликвидности, двух её tick’ов и квадратного корня цены пула — всё прочитано из сети. Её комиссии не берутся из полей комиссий subgraph, которые непригодны: между одним изменением и следующим ликвидность позиции не меняется, поэтому заработанное за этот отрезок — это её ликвидность, умноженная на рост комиссий внутри её диапазона между снимками, которые менеджер позиций записал на обоих концах. Отрезок с последнего изменения читается из сети, так же как ещё не собранные комиссии.",
        "Расчёт показывается, только если доказано, что история доходит до настоящего: самое новое изменение, известное subgraph, должно нести ровно те ликвидность и снимок роста комиссий, которые менеджер позиций держит сейчас, в истории должен быть взнос, и каждая её строка должна быть прочитана. Иначе позиция сообщает, что её историю не удалось проверить, и не показывает цифр вместо неполной суммы. Индексаторы v4 не хранят историю каждой позиции, поэтому у позиции v4 расчёта нет.",
        "Всё в расчёте оценено по сегодняшней цене, в том токене, в котором страница котирует пару. Тому, сколько стоили бы взносы, если бы их просто держали, он противопоставляет то, что позиция держит сейчас, плюс выведенное, плюс её комиссии; разница делится на комиссии и эффект диапазона — позицию против хранения до комиссий, то, что обычно называют непостоянными потерями. Взносы и выводы оценены по сегодняшней цене, а не по цене своего дня, и gas не учтён. Расчёт охватывает всю жизнь позиции, при каждом её владельце, и это измерение, а не финансовый совет.",
      ],
    },
    pair: {
      title: "Одна пара, все пулы",
      paragraphs: (f) => [
        "Страница пары перечисляет каждый пул v3 и v4, два символа которого в точности совпадают с введённой парой, во всех сетях, которые читает сайт. Каждый ранжируется по комиссиям за последнюю неделю, делённым на то, что в нём сейчас, и приведённым к году, — простой ставкой, без капитализации. Это прошлые комиссии к нынешней ликвидности: не прогноз и не то, что заработала бы позиция, ведь позиция зарабатывает, только пока цена внутри её диапазона, делит комиссии со всеми остальными там и кое-чем поступается в сравнении с хранением.",
        `То, что лежит в пуле, в двух протоколах измеряется по-разному, поэтому они ранжируются отдельно: в v3 — то, что токен-контракты пула держат для него; в v4, где все токены лежат в одном PoolManager, — его глубина при текущей цене. Ранжируются только пулы стоимостью не меньше ${f.pairFloorUsd}: ниже этого торговля одного дня слишком сильно двигает цифру, а токен-подделка вероятнее; остальные перечислены ниже по размеру, без доходности. Пул v4, чей hook может менять то, что платят свопы, показывает свои комиссии с пометкой и без доходности. Сеть, которую не удалось прочитать, так и указывается.`,
      ],
    },
    "language-model": {
      title: "Письменное пояснение",
      paragraphs: () => [
        "На странице пула, после того как каждая цифра посчитана и проверена, языковая модель пишет четыре коротких абзаца: что покрывает диапазон, что происходит, когда цена из него выходит, что измеряет волатильность и чего не измеряет, и что анализ оставляет за кадром. Ей дают цифры так, как их показывает страница, на языке читателя, с направлениями, уже записанными готовыми предложениями. Ничего из написанного посетителем до неё не доходит — кроме адреса пула, прошедшего строгую проверку формата; ни описания токена, ни свободного текста, — а tick’и не доходят до неё вовсе.",
        "Ей велено никогда не называть чисел, никогда не советовать и никогда не предсказывать. Это не только просьба, это обеспечивается: каждый абзац проверяется перед показом. Абзац с цифрой в любой письменности — включая арабские, деванагари и полноширинные цифры, дроби и надстрочные знаки, — кроме как в названиях v3 и v4, или с числом от одиннадцати и выше, записанным словами на любом из десяти языков, отклоняется, как и слишком короткий или слишком длинный. Если не проходит хотя бы один абзац, отбрасывается всё пояснение, и цифры остаются сами по себе.",
        "Чего проверка обеспечить не может, так это тона; это оставлено инструкции, и страница не делает вид, что это не так. Страница называет модель, написавшую текст, так, как её сообщает провайдер, и одно и то же пояснение используется повторно не дольше часа для того же пула, тех же настроек и того же языка.",
      ],
    },
    "data-sources": {
      title: "Источники данных и ограничения",
      paragraphs: (f) => [
        `Пулы читаются из subgraph’ов Uniswap v3 и v4 в The Graph, в сетях ${f.chains}; ${f.v4OnlyChains} читается только для v4. Там, где subgraph ошибается или молчит, сеть спрашивают напрямую, только на чтение: шаг tick’ов пула v3 и то, что держат его токен-контракты, ликвидность и цену пула v4 у PoolManager, доход и держателя позиции у менеджера позиций, и есть ли код по адресу. Каждый subgraph проверяется ежечасно.`,
        `Текущее состояние пула должно быть взято из блока, отстающего от сети не более чем на ${f.freshMinutes} минут, иначе оно отклоняется. Дневные истории хранятся в течение дня по UTC, самые торгуемые пулы недели — полчаса, поиски и чтения пар — десять минут, пояснение — час; измерение умной ликвидности обновляется каждые шесть часов.`,
        "Когда источник отказывает, страница говорит, какую часть не удалось получить, и показывает остальное; отсутствующая цифра показывается как отсутствующая, никогда как ноль, и никогда не подменяется догадкой. На странице умной ликвидности непрочитанный пул стоит только самого себя, а неудачное обновление оставляет последнее измерение в силе до истечения его срока; на странице пары непрочитанная сеть так и указывается. Пояснение — единственная часть, которой разрешено отсутствовать.",
        "О том, кто читает сайт, ничего не хранится. Визит считается строкой, где названы страница, пул, если он есть (публичный контракт), язык и было ли это похоже на бота, — без IP-адреса, без данных браузера, без текста поиска и никогда — адреса, введённого, чтобы посмотреть его позиции. Единственное, что хранится о читателе, — оповещение в Telegram, которое он настраивает сам: введённый им адрес, его язык, числовой id чата и была ли каждая позиция в диапазоне в прошлый раз. /stop удаляет его сразу, а из резервных копий оно исчезает в течение семи дней.",
      ],
    },
  },
  notAdvice:
    "Ничто на этой странице и нигде на сайте не является финансовой рекомендацией. Каждая цифра описывает уже прошедшие дни или собственную арифметику протокола; ни одна не говорит, что делать или что будет дальше.",
};

const pt: MethodCopy = {
  link: "Como funciona",
  pointer: "Como isto é medido, em detalhe",
  title: "Como funciona",
  description:
    "Como cada número do LiquidityWise é obtido — a faixa sugerida, os testes no passado, as taxas, a perda impermanente, os hooks do v4, a liquidez inteligente e a explicação escrita —, de que dados vem e o que cada um deixa de fora.",
  heading: "Como cada número é obtido",
  lead: "Cada número deste site é calculado por código simples a partir dos dados indexados de um pool e da própria rede, e conferido antes de ser mostrado; um modelo de linguagem só descreve os números depois. Esta página diz, seção por seção, como cada um é obtido e o que deixa de fora. Ela resume o código; não promete nada sobre nenhum pool.",
  contentsHeading: "Nesta página",
  sections: {
    "suggested-range": {
      title: "A faixa sugerida",
      paragraphs: (f) => [
        `O ponto de partida são os preços de fechamento diários do próprio pool, como o subgraph dele os publica: os últimos ${f.closes} dias UTC completos, sem o de hoje, que ainda não fechou. Deles saem ${f.returns} retornos diários, cada um a diferença entre os logaritmos de dois fechamentos consecutivos. Um dia ausente da fonte é pulado — nunca preenchido, repetido do anterior nem interpolado — e a página avisa quando a janela teve lacunas.`,
        `A volatilidade é o desvio padrão amostral desses retornos, levado a um ano pela raiz quadrada de ${f.yearDays}. Depois é escalada para o horizonte que você escolher (${f.horizons} dias; ${f.defaultHorizon} se você não escolher) pela raiz quadrada da fração do ano que ele representa, e multiplicada pela largura que você escolher (em desvios padrão: ${f.multipliers}; ${f.defaultMultiplier} se você não escolher). O horizonte só diz até onde à frente o movimento medido é estendido: o movimento é sempre medido sobre os mesmos últimos ${f.returns} dias.`,
        `A banda é colocada em torno do preço de hoje de forma simétrica em logaritmos, sem deriva: cair pela metade e dobrar são a mesma distância, e por isso as duas porcentagens de cada lado diferem. Depois as bordas são deslocadas para fora sobre a grade de ticks do pool, nunca para dentro, de modo que a faixa sempre cobre pelo menos a banda. Duas verificações a protegem: o preço atual do pool tem de se converter no tick que o próprio pool informa, e tem de vir de um bloco no máximo ${f.freshMinutes} minutos atrás da rede.`,
        `Não é uma previsão: diz quanto o preço já se moveu, não para onde vai. E a largura não é um nível de confiança — transformar "dois desvios padrão" em "95% do tempo" exige uma suposição sobre como os preços se distribuem que não está estabelecida. Ela não dimensiona uma posição nem diz quanto depositar de cada token.`,
      ],
    },
    "out-of-sample": {
      title: "Testado em dias que ele nunca viu",
      paragraphs: (f) => [
        `O site lê ${f.historyDays} dias de fechamentos — mais do que a volatilidade precisa — para que o método possa ser testado em dias aos quais não foi ajustado. Ele é recuado um horizonte, ajustado de novo só com os ${f.closes} fechamentos anteriores a esse ponto e nada depois, centrado no fechamento desse ponto e colocado sobre os dias seguintes; depois o mesmo mais para trás, enquanto o histórico tiver espaço. Cada dia conta como inteiramente dentro, inteiramente fora ou cruzando uma borda: a máxima e a mínima de um dia não dizem onde o preço estava ao longo do dia, então um dia que cruzou uma borda nunca é dividido no chute.`,
        "São alguns trechos de um único pool, não uma medida de com que frequência o método funciona. Ajustes consecutivos se sobrepõem, então os trechos não são independentes entre si, e ninguém de fato manteve essas bandas.",
        `"Aberta há trinta dias" reproduz a faixa que o método teria traçado no início dos últimos trinta dias — com os ${f.closes} fechamentos anteriores e nada depois — sobre cada um desses dias. Dá dois números. O valor comparado com segurar, a cada fechamento diário, vem das quantidades exatas da liquidez concentrada e não precisa de preço em dólar. As taxas vêm das taxas diárias do próprio pool nos dias em que o preço ficou inteiramente dentro, repartidas como o número do depósito as reparte, com o depósito dimensionado pela cotação do dólar de hoje porque o histórico não tem uma diária.`,
        `"Teste sua própria faixa" reproduz dois preços que você digitar sobre os mesmos trinta dias, a partir do mesmo fechamento de abertura, com a mesma repartição de taxas e a mesma cotação do dólar, de modo que a única diferença entre as duas colunas é a faixa. Uma faixa que não contém o preço de abertura começa com só um dos dois tokens e não recebe taxas até o preço alcançá-la. Uma faixa que foi bem nesses dias não diz nada sobre os próximos.`,
      ],
    },
    recentring: {
      title: "Recentralizar quando o preço sai",
      paragraphs: () => [
        "\"Recentralizar quando o preço sai\" repete uma estratégia ativa simples sobre os mesmos trinta dias que \"Aberta há trinta dias\", a partir do mesmo fechamento de abertura e na mesma faixa. No fechamento de cada dia seguinte, se o fechamento estiver fora da faixa, a posição é recentralizada ali: o que ela tem — a essa altura só um dos dois tokens — é trocado pela mistura de que precisa uma faixa da mesma largura centrada nesse fechamento, e o que sobra depois da taxa do swap é a nova posição. A largura é a da faixa de abertura, como múltiplos do seu centro, então uma recentralização move a faixa e nunca a traça de novo. As taxas são contadas exatamente como na repetição estática, dia a dia, para a faixa mantida naquele dia, e postas de lado em vez de reinvestidas.",
        "O swap paga a taxa que, pelas próprias condições do pool, um swap paga — um nível da v3, ou a taxa da chave da v4 com a parte do protocolo, na direção do swap. Onde nada fixo a diz, porque um hook define a taxa a cada swap, ele paga a taxa que os swaps do mês de fato pagaram — taxas sobre volume — e a página diz isso; onde um hook pode mudar o que um swap paga, a página diz que o custo pode ser outro. O impacto no preço não é modelado: cada swap é avaliado no fechamento, como se o pool pudesse absorvê-lo inteiro. O gas só é contado se você definir um custo por recentralização, em dólar como o depósito, e é pago de fora da posição; a abertura custa o mesmo às duas e não é contada em nenhuma.",
        "Ela vê fechamentos diários e nada mais. Um preço que saiu da faixa e voltou no mesmo dia não é uma recentralização, e uma recentralização acontece no fechamento, não na borda — em geral além dela. Todo número em dólar está pela cotação de hoje, como os do depósito. A página coloca o valor final, tudo contado, ao lado de manter os tokens com que o depósito abriu e ao lado da mesma faixa nunca recentralizada; um mês sem recentralização é exatamente essa faixa. É uma estratégia sobre um mês que já aconteceu, e não é recomendação.",
      ],
    },
    fees: {
      title: "Taxas e perda impermanente",
      paragraphs: () => [
        "O que o pool cobrou vem das taxas e do volume que o subgraph dele publica para cada um dos últimos trinta dias. Dividir as taxas de um dia pelo seu volume mede a taxa que quem fez swaps realmente pagou — o dia típico, o mais baixo e o mais alto, e a janela inteira como taxas totais sobre volume total — e ela é comparada com a taxa que o pool declara. Um dia sem volume fica de fora em vez de contar como zero.",
        `O que um depósito teria recolhido: em cada dia em que o preço ficou inteiramente dentro da faixa, uma parcela L / (A + L) das taxas daquele dia, onde L é a liquidez que o depósito compra na faixa e A a liquidez que a fonte informa como ativa naquele dia. O "+ L" é o depósito diluindo a si mesmo, e por isso um depósito maior não recolhe proporcionalmente mais. Dias que cruzaram uma borda não contam, e um dia dentro para o qual a fonte não publicou taxas ou liquidez ativa é informado como tal, não como zero.`,
        "Converter dólares na liquidez do pool exige um preço em dólar, e o site usa o do próprio subgraph, derivado do que o pool guarda em cada token e em dólares — a cotação em que estão os números de taxas dele. É a cotação de hoje aplicada a dias passados, e a página diz isso. O resultado são só taxas, sobre dias que já passaram: não é uma taxa anual nem o que o próximo mês vai pagar.",
        "A perda impermanente — a posição comparada com simplesmente segurar os dois tokens — é a aritmética exata da curva do protocolo entre as bordas da faixa, do preço de hoje até cada preço mostrado. Não precisa de dados de mercado nem do tamanho do depósito, porque a liquidez se cancela na razão. Ela só é impermanente se o preço voltar. Conta o movimento do preço e nada mais, e as taxas são o que um provedor recebe por suportá-la, então as duas coisas precisam ser lidas juntas.",
      ],
    },
    hooks: {
      title: "Hooks do v4",
      paragraphs: (f) => [
        "Um pool do v4 pode nomear um hook, um contrato que o protocolo chama em momentos fixos. As permissões dele são lidas do seu endereço: um hook é implantado num endereço cujos catorze bits mais baixos dizem quais callbacks o PoolManager vai chamar, e o PoolManager confere esses bits em vez de perguntar ao contrato. Então o site lê a regra que o protocolo impõe — não um registro, um rótulo ou a descrição que o contrato faz de si mesmo — e diz o que um hook pode fazer, nunca o que ele faz.",
        "Um hook autorizado a agir antes de um swap pode reescrever a taxa dele; um autorizado a devolver um delta de um swap pode ficar com parte do próprio swap. Quando o hook de um pool tem qualquer uma dessas permissões, todo número de taxas ligado a uma faixa ou a um depósito é retido — as taxas enquanto dentro, a parcela de um depósito, as taxas na reprodução de trinta dias, o rendimento na página do par — porque nada na fonte separa a parte do hook da dos provedores. O que o pool cobrou continua aparecendo, como um fato sobre o pool, e os painéis que mostram quanto custa um swap trazem uma nota. Um pool cuja chave não fixa taxa aparece sem taxa, e a taxa que ele de fato cobrou é medida a partir dos seus dias.",
        `Ao lado das permissões, a página de hooks e a página de um pool v4 mostram duas coisas que qualquer um pode conferir de fora. Se o código-fonte de um hook está verificado é perguntado, pelo servidor e sem chave, ao Sourcify e ao Blockscout da própria rede: verificado em qualquer um dos dois aparece como verificado, com o nome do contrato dado pelo Blockscout quando ele dá um e pelo Sourcify caso contrário; não verificado em nenhum aparece como não encontrado; uma fonte que não responde em poucos segundos, ou responde de um jeito que não se entende, deixa como não conferido. Verificado quer dizer que o código publicado para o endereço compila para o código implantado ali, então ele pode ser lido; não é uma auditoria e não diz nada sobre o hook ser seguro. Quantos pools v4 da rede citam o hook, e quando o primeiro deles foi criado, vem do subgraph v4 da rede, contados até ${f.hookPoolCap}. As respostas ficam guardadas por ${f.hookCheckHours} horas e uma pergunta sem resposta é refeita depois de ${f.hookCheckRetryMinutes} minutos; nenhuma página espera muito por uma, e diz em vez disso que a conferência não pôde ser feita.`,
      ],
    },
    "smart-liquidity": {
      title: "Liquidez inteligente",
      paragraphs: (f) => [
        `Em cada rede onde as posições podem ser listadas (${f.smartChains}), a página olha os ${f.smartPools} pools v3 mais negociados da semana, pega as posições que estão dentro da faixa agora e pergunta à rede sobre até ${f.positionsPerPool} por pool, as maiores primeiro, cada uma valendo pelo menos ${f.minPositionUsd}. A medição é refeita a cada seis horas.`,
        `As taxas de uma posição são o que ela ganhou desde a última alteração: sua liquidez vezes o crescimento das taxas dentro da sua faixa desde que o gerenciador de posições gravou seu último instantâneo, lido da rede. O par, a taxa e os ticks de cada posição têm de levar ao pool em que ela foi listada. Essas taxas, sobre o que a posição vale agora, sobre os dias desde essa alteração, levadas a um ano, são o rendimento dela. Posições abaixo de ${f.minPositionUsd}, ou alteradas há menos de ${f.minWindowDays} dias, ficam de fora por serem pequenas ou novas demais para dizer algo; os ${f.smartShare} de maior rendimento são as inteligentes.`,
        "O subgraph lista as posições e data a última alteração de cada uma, e nada mais. Os campos de taxas dele não são usados: conferidos em 2026-09-30, informavam dois bilhões de dólares recolhidos por uma posição que tinha depositado trinta e dois milhões. Os valores devidos do gerenciador de posições também não contam, porque depois de um saque eles guardam o principal sacado até ser recolhido.",
        "O que o rendimento deixa de fora: são só taxas, e o que uma posição abriu mão em comparação com segurar os dois tokens não está nele. Cobre uma janela por posição, lê só posições dentro da faixa agora e não diz nada sobre o que qualquer uma delas vai ganhar depois nem sobre quem a detém.",
        `Cada medição é guardada, para que a página possa dizer como as coisas se moveram na última semana assim que houver um dia de medições. A faixa de um par é comparada como preços, nunca como distâncias do preço atual, porque essas distâncias mudam sempre que o preço se move, mesmo que ninguém toque numa posição. "Titulares que continuam aparecendo" são os endereços que estiveram nos ${f.smartShare} do topo em pelo menos metade das medições, quando elas são ${f.ownerSets} ou mais. Cada um é marcado como carteira ou contrato conforme a rede guarde ou não código no endereço: um contrato é um cofre, um bot ou outro programa, e o rendimento é desse programa.`,
      ],
    },
    "position-record": {
      title: "Como uma posição aberta se saiu",
      paragraphs: () => [
        "Quando um endereço é consultado, cada posição v3 aberta que ele tem traz um cálculo de como ela se saiu desde que foi aberta. O depositado e o retirado como principal são os totais acumulados que o subgraph de posições da rede guarda a cada mudança da posição. O que há nela agora é calculado a partir da liquidez dela, dos seus dois ticks e do preço em raiz quadrada do pool, tudo lido da rede. As taxas dela não vêm dos campos de taxas do subgraph, que não servem: entre uma mudança e a seguinte a liquidez de uma posição não se mexe, então o que ela ganhou nesse trecho é a liquidez dela vezes o crescimento das taxas dentro da sua faixa entre os instantâneos que o gerenciador de posições gravou em cada ponta. O trecho desde a última mudança é lido da rede, como as taxas ainda não coletadas.",
        "O cálculo só aparece quando o histórico comprovadamente chega ao presente: a mudança mais recente que o subgraph tem precisa trazer exatamente a liquidez e o instantâneo de crescimento das taxas que o gerenciador de posições tem agora, o histórico precisa incluir um depósito e cada linha dele precisa ter sido lida. Caso contrário, a posição diz que o histórico dela não pôde ser conferido e não mostra números em vez de uma soma parcial. Os indexadores do v4 não guardam um histórico por posição, então uma posição v4 não tem cálculo.",
        "Tudo no cálculo é avaliado ao preço de hoje, no token em que a página cota o par. Diante do que os depósitos valeriam se tivessem sido só segurados, ele põe o que a posição tem agora, mais o retirado, mais as taxas dela; a diferença é dividida entre as taxas e o efeito da faixa, que é a posição contra segurar antes das taxas — o que costuma ser chamado de perda impermanente. Depósitos e retiradas são avaliados ao preço de hoje, não ao do dia deles, e o gas não é contado. O cálculo cobre a vida inteira da posição, com cada dono que ela teve, e é uma medição, não uma recomendação financeira.",
      ],
    },
    pair: {
      title: "Um par, todos os pools",
      paragraphs: (f) => [
        "A página do par lista todo pool v3 e v4 cujos dois símbolos são exatamente o par digitado, em toda rede que o site lê. Cada um é ordenado pelas taxas que cobrou na última semana, sobre o que há nele agora, levadas a um ano — juros simples, não compostos. São taxas passadas sobre liquidez presente: não é uma previsão nem o que uma posição ganharia, já que uma posição só ganha enquanto o preço está dentro da faixa dela, divide as taxas com todos os outros ali e abre mão de algo em comparação com segurar.",
        `O que há num pool é medido de forma diferente em cada protocolo, então os dois são ordenados separadamente: no v3, o que os contratos dos tokens guardam para o pool; no v4, onde todos os tokens ficam num único PoolManager, sua profundidade no preço atual. Só são ordenados os pools que valem pelo menos ${f.pairFloorUsd} — abaixo disso, o trading de uma tarde mexe demais no número e um token imitador é mais provável — e o resto aparece embaixo por tamanho, sem rendimento. Um pool v4 cujo hook pode mudar o que os swaps pagam mostra suas taxas com uma nota e sem rendimento. Uma rede que não pode ser lida aparece como tal.`,
      ],
    },
    "language-model": {
      title: "A explicação escrita",
      paragraphs: () => [
        "Na página de um pool, depois que cada número foi calculado e conferido, um modelo de linguagem escreve quatro parágrafos curtos: o que a faixa cobre, o que acontece quando o preço sai dela, o que a volatilidade mede e o que não mede, e o que a análise deixa de fora. Ele recebe os números como a página os mostra, no idioma de quem lê, com as direções já escritas como frases. Nada que um visitante escreva chega até ele — exceto um endereço de pool que passou por uma verificação de formato rigorosa; nenhuma descrição de token, nenhum texto livre — e nenhum tick chega até ele.",
        "Ele é instruído a nunca dizer um número, nunca aconselhar e nunca prever. Isso é imposto, não só pedido: cada parágrafo é conferido antes de aparecer. Um parágrafo com um dígito em qualquer escrita — incluindo dígitos árabes, devanágari e de largura total, frações e sobrescritos —, fora dos nomes v3 e v4, ou com um número de onze para cima escrito por extenso em qualquer um dos dez idiomas, é recusado, assim como um curto ou longo demais. Se um único parágrafo falhar, a explicação inteira é descartada e os números ficam por conta própria.",
        "O que uma verificação não consegue impor é o tom; isso fica a cargo da instrução, e a página não finge o contrário. A página nomeia o modelo que escreveu o texto, como o provedor o informa, e a mesma explicação é reutilizada por no máximo uma hora para o mesmo pool, as mesmas configurações e o mesmo idioma.",
      ],
    },
    "data-sources": {
      title: "Fontes de dados e limites",
      paragraphs: (f) => [
        `Os pools são lidos dos subgraphs v3 e v4 da Uniswap no The Graph, em ${f.chains}; ${f.v4OnlyChains} é lida só para o v4. Onde um subgraph erra ou se cala, a rede é consultada diretamente, só para leitura: o espaçamento de ticks de um pool v3 e o que os contratos dos tokens guardam, a liquidez e o preço de um pool v4 no PoolManager, os ganhos e o titular de uma posição no gerenciador de posições, e se um endereço guarda código. Cada subgraph é verificado de hora em hora.`,
        `O estado atual de um pool tem de vir de um bloco no máximo ${f.freshMinutes} minutos atrás da rede, ou é recusado. Os históricos diários são guardados durante o dia UTC, os pools mais negociados da semana por meia hora, as buscas e as leituras de pares por dez minutos, e uma explicação por uma hora; a medição da liquidez inteligente é renovada a cada seis horas.`,
        "Quando uma fonte falha, a página diz que parte não pôde ser obtida e mostra o resto; um número ausente aparece como ausente, nunca como zero, e nunca é trocado por um chute. Na página de liquidez inteligente, um pool que não pode ser lido custa só esse pool, e uma renovação que falha mantém a última medição de pé até ela expirar; na página do par, uma rede que não pode ser lida aparece como tal. A explicação é a única parte que pode faltar.",
        "Nada é guardado sobre quem lê o site. Uma visita é contada como uma linha que nomeia a página, o pool, se houver (um contrato público), o idioma e se parecia um bot — sem endereço IP, sem dados do navegador, sem texto de busca, e nunca um endereço digitado para ver suas posições. A única coisa guardada sobre um leitor é um alerta no Telegram que ele mesmo configura: o endereço que digitou, o idioma dele, o id numérico do chat e se cada posição estava dentro da faixa da última vez. /stop o apaga na hora, e dos backups ele some em até sete dias.",
      ],
    },
  },
  notAdvice:
    "Nada nesta página, nem em qualquer outro lugar do site, é aconselhamento financeiro. Cada número descreve dias que já passaram ou a própria aritmética do protocolo; nenhum diz o que fazer nem o que vai acontecer a seguir.",
};

const zhHant: MethodCopy = {
  link: "運作原理",
  pointer: "這是怎麼測出來的，完整說明",
  title: "運作原理",
  description:
    "LiquidityWise 上每個數字是怎麼算出來的——建議區間、回測、手續費、無常損失、v4 hook、聰明的流動性和文字解釋——用的是什麼資料，又各自遺漏了什麼。",
  heading: "每個數字是怎麼來的",
  lead: "本站的每個數字都由一般程式碼根據資金池的索引資料和鏈本身算出，並在顯示前經過核對；語言模型只在之後描述這些數字。本頁逐節說明每個數字是怎麼算出來的、遺漏了什麼。它是對程式碼的概括，不對任何資金池作出承諾。",
  contentsHeading: "本頁內容",
  sections: {
    "suggested-range": {
      title: "建議區間",
      paragraphs: (f) => [
        `起點是資金池自己的每日收盤價，依其子圖公布的資料：最近 ${f.closes} 個完整的 UTC 日，不含今天，因為今天還沒收盤。由此得到 ${f.returns} 個日報酬，每個都是相鄰兩個收盤價的對數之差。來源中缺少的日子會被跳過——從不填補、不沿用前一天、也不內插——期間有缺口時頁面會說明。`,
        `波動率是這些報酬的樣本標準差，再乘以 ${f.yearDays} 的平方根換算成年化。接著依你選擇的時間跨度（${f.horizons} 天；不選則為 ${f.defaultHorizon}）乘以該跨度佔一年比例的平方根，再乘以你選擇的寬度（以標準差計：${f.multipliers}；不選則為 ${f.defaultMultiplier}）。時間跨度只說明把測出來的走勢往前攤多遠：走勢始終是以同樣的最近 ${f.returns} 天來測量的。`,
        `價格帶以今天的價格為中心、在對數上對稱地展開，不加任何漂移：跌一半和漲一倍是同樣的距離，所以兩側的百分比不同。然後把它的兩端向外——從不向內——對齊到資金池的 tick 網格上，所以區間總是至少涵蓋整個價格帶。有兩項檢查守住它：資金池的當前價格必須換算成資金池自己回報的那個 tick，而且必須來自比鏈上最新狀態落後不超過 ${f.freshMinutes} 分鐘的區塊。`,
        `它不是預測：它說的是價格已經動了多少，而不是會去哪裡。寬度也不是信賴水準——要把「兩個標準差」變成「95% 的時間」，需要一個關於價格如何分布的假設，而這個假設並未確立。它不決定倉位大小，也不說每種代幣該存入多少。`,
      ],
    },
    "out-of-sample": {
      title: "在它從未見過的日子裡檢驗",
      paragraphs: (f) => [
        `本站讀取 ${f.historyDays} 天的收盤價——比波動率需要的多——這樣就能在方法沒有擬合過的日子上檢驗它。方法被往回挪一個時間跨度，只用那個時點之前的 ${f.closes} 個收盤價重新擬合，之後的一概不用，以那個時點的收盤價為中心，再疊放到隨後的日子上；然後再往前重複，直到歷史資料不夠為止。每一天被計為完全在內、完全在外或越過邊界：一天的最高價和最低價無法說明當天價格在什麼時候處於什麼位置，所以越過邊界的一天從不靠猜測來拆分。`,
        "這只是一個資金池的幾段時間，不能衡量方法有多常成立。相鄰的擬合彼此重疊，所以這些時段彼此並不獨立，而且沒有人真的持有過這些價格帶。",
        `「如果三十天前開倉」把方法在最近三十天開始時會畫出的區間——用那之前的 ${f.closes} 個收盤價，之後的一概不用——逐日重演這三十天。它給出兩個數字。「相對持有的價值」按每天的收盤價計算，來自集中流動性的精確數量，不需要美元價格。手續費來自價格完全留在區間內的那些日子裡資金池自己的每日手續費，與「一筆資金本可以收到多少」用同樣的方式分配；由於歷史資料沒有每日美元匯率，存入資金按今天的美元匯率折算。`,
        `「試試你自己的區間」把你輸入的兩個價格構成的區間，在同樣的三十天裡、從同一個開倉收盤價起，以同樣的手續費分配方式和同樣的美元匯率重演，所以兩欄之間唯一的差別就是區間。不包含開倉價格的區間一開始只持有兩種代幣中的一種，在價格到達它之前不收手續費。在這些日子裡表現好的區間，對接下來的日子什麼也說明不了。`,
      ],
    },
    recentring: {
      title: "價格離開時重新置中",
      paragraphs: () => [
        "「價格離開時重新置中」在與「如果三十天前開倉」相同的三十天期間裡，從同一個開倉收盤價、在同一個區間重演一個簡單的主動策略。在之後每一天收盤時，如果收盤價在區間之外，就在那裡把倉位重新置中：它持有的東西——那時只剩兩種代幣中的一種——透過兌換調成以該收盤價為中心、同樣寬度的區間所需的比例，扣掉兌換手續費後剩下的就是新倉位。寬度沿用開倉區間的寬度，按其中心的倍數計，所以重新置中只是移動區間，從不重新畫它。手續費的計法與靜態重演完全相同，逐日、按當天所持的區間計算，並另外存放而不再投入。",
        "兌換支付的是資金池自己的條款規定一筆兌換要付的費率——v3 的費率級距，或 v4 鍵裡的費率加上協議的抽成，按兌換方向計。如果沒有任何固定的東西寫明，因為 hook 逐筆設定費率，就按這段期間兌換實際支付的費率——手續費除以交易量——計，頁面會說明；如果 hook 可能改變一筆兌換所付的費用，頁面會說明成本可能不同。沒有模擬價格衝擊：每筆兌換都按收盤價計價，彷彿資金池能整筆吃下。只有你設定每次重新置中的成本時才計 gas，和存入金額一樣以美元計，並從倉位之外支付；開倉對兩者成本相同，兩邊都不計。",
        "它只看每日收盤價，其他都看不到。價格離開區間又在一天之內回來，不算重新置中；重新置中發生在收盤價上而不是邊界上——通常已經越過邊界。所有美元數字都按今天的匯率計算，和存入金額一樣。頁面把全部計入後的期末價值，與持有存入時的代幣相比，也與同一區間從不重新置中相比；沒有任何重新置中的一個月，就正好是那個區間。這是一個策略在一個已經過去的月份上的表現，不構成建議。",
      ],
    },
    fees: {
      title: "手續費與無常損失",
      paragraphs: () => [
        "資金池收了多少，來自其子圖為最近三十天每一天公布的手續費和交易量。用一天的手續費除以當天交易量，測出兌換者實際支付的費率——典型的一天、最低和最高的一天，以及以總手續費除以總交易量計算的整個期間——並與資金池聲明的費率對照。沒有交易量的日子不計為零，而是排除在外。",
        `一筆資金本可以收到多少：在價格完全留在區間內的每一天，取當天手續費的 L / (A + L)，其中 L 是這筆資金在區間內買到的流動性，A 是來源回報的當天活躍流動性。「+ L」是這筆資金對自己的稀釋，所以資金越多，收到的並不按比例增加。越過邊界的日子不計入；來源沒有公布手續費或活躍流動性的區間內日子，會如實註明，而不是記為零。`,
        "把美元換算成資金池的流動性需要一個美元價格，本站用的是子圖自己的價格，由資金池持有的每種代幣數量和美元價值推出——也就是它的手續費數字所用的匯率。這是用今天的匯率套用到過去的日子，頁面會說明。結果只是手續費，而且只涵蓋已經過去的日子：不是年化費率，也不是下個月會付多少。",
        "無常損失——倉位與單純持有兩種代幣相比——是協議曲線在區間兩端之間的精確計算，從今天的價格算到頁面上顯示的每個價格。它不需要市場資料，也不需要資金規模，因為流動性在比值裡約掉了。只有價格回來了它才是「無常」的。它只計價格變動，別的都不算，而手續費正是流動性提供者承擔它所得到的報酬，所以兩者必須一起看。",
      ],
    },
    hooks: {
      title: "v4 hook",
      paragraphs: (f) => [
        "v4 資金池可以指定一個 hook：一個由協議在固定時刻呼叫的合約。它的權限從它的地址讀取：hook 部署在這樣一個地址上，其最低的十四個位元說明 PoolManager 會呼叫哪些回呼，而 PoolManager 檢查的正是這些位元，而不是去問合約。所以本站讀的是協議強制執行的規則——不是登記表、標籤或合約對自己的描述——它說的是 hook 被允許做什麼，從不說它實際做了什麼。",
        "被允許在兌換前介入的 hook 可以改寫兌換的手續費；被允許從兌換中回傳 delta 的 hook 可以自己拿走兌換的一部分。當資金池的 hook 擁有其中任何一項權限時，所有與區間或存入資金掛鉤的手續費數字都會被隱去——價格在區間內那些日子的手續費、一筆資金的份額、三十天重演裡的手續費、交易對頁面上的收益率——因為來源中沒有任何東西能把 hook 的份額和流動性提供者的份額分開。資金池收了多少仍會顯示，作為關於這個資金池的事實；顯示兌換成本的面板會附上說明。PoolKey 中沒有固定手續費的資金池會如實顯示為沒有，它實際收取的費率從它的每日資料中測出。",
        `除了權限，hook 頁面和 v4 資金池的頁面還顯示兩項任何人都能從外部核實的資訊。一個 hook 的原始碼是否經過驗證，由伺服器在不使用任何金鑰的情況下向 Sourcify 和該網路自己的 Blockscout 查詢：在其中任何一個上經過驗證就顯示為已驗證，合約名稱在 Blockscout 給出時取自 Blockscout，否則取自 Sourcify；在兩者上都未經驗證就顯示為未找到；某個來源如果幾秒內沒有回應，或者回應的內容無法理解，就顯示為未能核實。經過驗證的意思是，為該地址公開的原始碼編譯後就是部署在那裡的程式碼，因此可以閱讀；這不是審計，也不說明這個 hook 是否安全。網路上有多少個 v4 資金池指定了這個 hook，以及其中第一個是什麼時候建立的，來自該網路的 v4 子圖，計數上限為 ${f.hookPoolCap}。回應會保留 ${f.hookCheckHours} 小時，沒有得到回應的查詢會在 ${f.hookCheckRetryMinutes} 分鐘後重新送出；頁面從不長時間等待任何一個，而是直接說明這項核實未能完成。`,
      ],
    },
    "smart-liquidity": {
      title: "聰明的流動性",
      paragraphs: (f) => [
        `在每個能列出倉位的網路上（${f.smartChains}），頁面查看本週交易最多的 ${f.smartPools} 個 v3 資金池，取出此刻處於區間內的倉位，並在每個資金池裡向鏈查詢最多 ${f.positionsPerPool} 個，從最大的開始，每個價值至少 ${f.minPositionUsd}。每六小時重新測量一次。`,
        `一個倉位的手續費是它自上次變動以來賺到的：它的流動性乘以自倉位管理器上次寫入快照以來其區間內的手續費成長，從鏈上讀取。每個倉位的交易對、費率和 tick 都必須能推回它被列入的那個資金池。這些手續費除以倉位現在的價值，再除以自那次變動以來的天數，年化之後就是它的收益率。價值低於 ${f.minPositionUsd}、或變動距今不足 ${f.minWindowDays} 天的倉位被排除，因為它們太小或太新，說明不了什麼；收益率最高的 ${f.smartShare} 就是聰明的倉位。`,
        "子圖只用來列出倉位、標出每個倉位上次變動的日期，別的都不用。它的手續費欄位不被採用：在 2026-09-30 核對時，這些欄位顯示一個只存入了三千二百萬美元的倉位收取了二十億美元。倉位管理器中的應付金額也不計入，因為在提取之後、被領取之前，它們包含的是被提取的本金。",
        "收益率遺漏了什麼：它只是手續費，倉位相對於持有兩種代幣所放棄的部分不在其中。它只涵蓋每個倉位的一段期間，只讀取此刻處於區間內的倉位，對任何倉位接下來會賺多少、由誰持有，什麼也沒說。",
        `每次測量都會被儲存，所以一旦累積了一天的測量，頁面就能說明過去一週的變化。交易對的區間按價格比較，從不按與當前價格的距離比較，因為只要價格一動，這個距離就會變，哪怕沒人碰過任何倉位。「一再出現的持有者」是在至少一半測量中都位於前 ${f.smartShare} 的地址，前提是測量已有 ${f.ownerSets} 次或更多。每個地址按鏈上該地址是否存有程式碼被標為錢包或合約：合約是金庫、機器人或別的程式，它的收益率屬於那個程式。`,
      ],
    },
    "position-record": {
      title: "一個未平倉倉位的表現",
      paragraphs: () => [
        "查詢一個地址時，它持有的每一個未平倉 v3 倉位都會附上一份計算，說明它自開倉以來表現如何。存入的和作為本金取出的，是該網路的倉位子圖在倉位每次變動時記下的累計總數。它現在裡面有什麼，由它的流動性、兩個 tick 和資金池的平方根價格算出，全部從鏈上讀取。它的手續費不取自子圖的手續費欄位，那些欄位不可用：從一次變動到下一次變動，倉位的流動性不變，所以它在這段期間賺到的，就是它的流動性乘以倉位管理器在兩端寫入的快照之間其區間內的手續費成長。自上次變動以來的那段期間從鏈上讀取，和尚未收取的手續費一樣。",
        "只有在能證明歷史一直延續到現在時才顯示這份計算：子圖裡最新的一次變動必須與倉位管理器現在持有的流動性和手續費成長快照完全一致，歷史裡必須有一筆存入，而且每一行都必須讀到。否則這個倉位會說明它的歷史無法核對，不顯示任何數字，而不是一個不完整的總和。v4 的索引器不為每個倉位保留歷史，所以 v4 倉位沒有這份計算。",
        "計算中的一切都按今天的價格、以本頁給這個交易對報價的那種代幣計。它把存入的代幣若只是持有今天值多少，與倉位現在持有的、加上取出的、再加上手續費放在一起比較；差額分成手續費和區間影響兩部分——區間影響是不計手續費時倉位相對持有的差額，也就是通常所說的無常損失。存入和取出都按今天的價格計算，而不是按當天的價格，gas 也不計入。這份計算涵蓋倉位的整個存續期間，包括它在每一位持有者手中的時候；它是一項測量，不構成財務建議。",
      ],
    },
    pair: {
      title: "一個交易對，所有資金池",
      paragraphs: (f) => [
        "交易對頁面列出本站讀取的每個網路上、兩個代幣符號與輸入的交易對完全一致的每個 v3 和 v4 資金池。每個資金池按過去一週收取的手續費除以現在池中的資金、再年化來排序——單利，不複利。這是過去的手續費除以現在的流動性：不是預測，也不是一個倉位會賺到的，因為倉位只有在價格處於其區間內時才賺錢，要與那裡的所有人分享手續費，而且與持有相比還要放棄一些東西。",
        `池中有多少在兩個協議裡的測法不同，所以兩者分開排名：在 v3，是該資金池的代幣合約為它持有的數量；在 v4，所有代幣都在同一個 PoolManager 裡，所以用的是它在當前價格下的深度。只有價值至少 ${f.pairFloorUsd} 的資金池參與排名——低於這個數，一個下午的交易就會讓數字波動太大，而且更可能是仿冒代幣——其餘的按規模列在下面，不給收益率。hook 可能改變兌換支付金額的 v4 資金池會顯示手續費並附說明，不給收益率。讀取不了的網路會如實列出。`,
      ],
    },
    "language-model": {
      title: "文字解釋",
      paragraphs: () => [
        "在資金池頁面上，每個數字都算好並核對之後，一個語言模型會寫四段簡短的文字：區間涵蓋了什麼、價格離開區間時會怎樣、波動率衡量什麼和不衡量什麼、以及分析遺漏了什麼。它拿到的數字與頁面顯示的一致，用讀者的語言，方向已經事先寫成句子。訪客寫的任何東西都到不了它那裡——除了通過嚴格格式檢查的資金池地址；沒有代幣描述，也沒有任何自由輸入的文字——tick 更是完全不會給它。",
        "它被要求從不說出數字、從不給建議、從不做預測。這不只是要求，而是強制執行：每一段在顯示前都會被檢查。凡是包含任何文字體系中的數字——包括阿拉伯數字、天城文數字、全形數字、分數和上標——但 v3 和 v4 這兩個名稱除外，或者在十種語言中任何一種裡用文字寫出的十一及以上的數，都會被拒絕；太短或太長的段落也一樣。只要有一段不通過，整個解釋都會被丟棄，數字獨立呈現。",
        "檢查無法強制的是語氣；那留給指令去管，頁面也不假裝不是這樣。頁面會寫明撰寫這段文字的模型，以服務供應商回報的為準；同一資金池、同樣設定和同一語言的解釋最多重複使用一小時。",
      ],
    },
    "data-sources": {
      title: "資料來源與局限",
      paragraphs: (f) => [
        `資金池資料讀自 The Graph 上 Uniswap 的 v3 和 v4 子圖，涵蓋 ${f.chains}；${f.v4OnlyChains} 只讀取 v4。子圖出錯或沒有資料時，就直接唯讀地詢問鏈本身：v3 資金池的 tick 間距及其代幣合約持有的數量、從 PoolManager 讀取 v4 資金池的流動性和價格、從倉位管理器讀取倉位的收益和持有者，以及某個地址上是否有程式碼。每個子圖每小時檢查一次。`,
        `資金池的當前狀態必須來自比鏈上最新狀態落後不超過 ${f.freshMinutes} 分鐘的區塊，否則會被拒絕。每日歷史保留到當天 UTC 日結束，本週交易最多的資金池保留半小時，搜尋和交易對讀取保留十分鐘，解釋保留一小時；聰明的流動性每六小時重新測量一次。`,
        "某個來源失敗時，頁面會說明哪一部分沒能算出，並顯示其餘部分；缺少的數字顯示為缺少，從不顯示為零，也從不用猜測代替。在聰明的流動性頁面上，讀不了的資金池只影響它自己，重新整理失敗時上一次測量會保留到過期為止；在交易對頁面上，讀不了的網路會如實列出。解釋是唯一允許缺少的部分。",
        "本站不儲存任何關於誰在閱讀的資訊。一次造訪記為一行，寫明頁面、資金池（如有，是公開合約）、語言以及是否像機器人——沒有 IP 位址，沒有瀏覽器資訊，沒有搜尋文字，也從不記錄為查看倉位而輸入的地址。唯一儲存的關於讀者的資訊，是他們自己設定的 Telegram 提醒：他們輸入的地址、他們的語言、對話的數字 id，以及每個倉位上一次是否在區間內。/stop 會立即刪除它，備份中的副本七天內消失。",
      ],
    },
  },
  notAdvice:
    "本頁以及本站任何地方的內容都不是財務建議。每個數字描述的不是已經過去的日子，就是協議本身的算術；沒有一個數字告訴你該做什麼，或接下來會發生什麼。",
};

const COPY: Record<Locale, MethodCopy> = { en, tr, de, es, ar, hi, zh, ru, pt, "zh-Hant": zhHant };

export const getMethodCopy = (locale: Locale): MethodCopy => COPY[locale];

import type { EmbedFieldPath, EmbedParameter, EmbedStatusKind } from "../embed/embedDocs";
import type { Locale } from "./locales";

/*
 * The developers page's own words: what another site can build on — the
 * embeddable pool card and its JSON — written for the person writing the code
 * that will use them.
 *
 * Written from the code, like the method page, and held to it harder, because
 * somebody else's code will be written against what it says. Every sentence
 * summarises what a module does: the address read in embed/embedRequest.ts,
 * the answers and their lifetimes in embedResponses.ts, the server's keep in
 * readPoolEmbed.ts, the card and its policy in embedCard.ts and
 * security/responseHeaders.ts, the limit in proxy.ts and ratelimit/. Where one
 * of those changes, the sentence here is wrong until it is changed too — and
 * the tests in embed/embedDocs.test.ts are there to make that a failure rather
 * than a surprise.
 *
 * The figures the prose states arrive as `DevelopersFigures`, formatted from
 * the code's own constants for the reader's language, so a lifetime or a limit
 * moved in the code moves here with it. Anything between backticks is code —
 * a parameter, a field, a header, a status — and is the same in every
 * language; the page sets it in monospace, left to right even in Arabic. The
 * code samples themselves are not here at all: they are English and identical
 * for everyone (embed/embedDocs.ts).
 *
 * It promises nothing the code does not do: no version, no uptime, no
 * attribution the code does not ask for, and the limit as it is today.
 */

/** The sections, in reading order; each is also the anchor it is linked to. */
export const DEVELOPERS_SECTION_IDS = ["card", "parameters", "json", "errors", "caching", "examples", "share", "terms"] as const;

export type DevelopersSectionId = (typeof DEVELOPERS_SECTION_IDS)[number];

/** The code's own constants, and two of the card's own phrases, ready for the reader's language. */
export type DevelopersFigures = {
  /** Requests a client may make in one window. */
  readonly limit: string;
  readonly windowSeconds: string;
  /** How long the figures may be kept, in front and on the server. */
  readonly keptSeconds: string;
  /** How long a pool that could not be read may be kept. */
  readonly unreadableSeconds: string;
  /** How long an address that names no pool may be kept. */
  readonly notAPoolSeconds: string;
  readonly frameWidth: string;
  readonly frameHeight: string;
  /** The frame's height when the card carries the hook note. */
  readonly frameHeightHook: string;
  readonly defaultHorizon: string;
  readonly defaultMultiplier: string;
  /** The days the range's movement is measured over, as the disclaimer states them. */
  readonly measuredDays: string;
  /** How many languages the card is written in. */
  readonly languages: string;
  /** The networks read for v4 only, where a v3 pool names nothing. */
  readonly v4OnlyChains: string;
  /** The networks read for v3 only, where a v4 pool names nothing. */
  readonly v3OnlyChains: string;
  /** The pool page's own heading for its offer of the card, so a reader can find it. */
  readonly embedSummary: string;
  /** The card's own link back, as it reads in this language. */
  readonly analysedBy: string;
  /** The words the method page is linked by everywhere, so the pointer to it reads like the link. */
  readonly methodLink: string;
  /** The networks whose positions are kept, where a record can be verified and a share card drawn. */
  readonly positionChains: string;
  /** The holdings page's own heading over the share row, so a reader can find it. */
  readonly shareHeading: string;
};

type Paragraphs = (figures: DevelopersFigures) => readonly string[];

export type DevelopersCopy = {
  /** Where the page is linked from: the footer and the about page. */
  readonly link: string;
  /** Beside the pool page's offer of the card, leading here. */
  readonly pointer: string;
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly lead: string;
  readonly contentsHeading: string;
  readonly sections: { readonly [Id in DevelopersSectionId]: string };

  readonly card: Paragraphs;
  readonly snippetLabel: string;
  readonly cardHeadersLabel: string;

  readonly parametersIntro: Paragraphs;
  readonly parameters: (figures: DevelopersFigures) => {
    readonly [Name in EmbedParameter]: { readonly accepts: string; readonly otherwise: string };
  };
  readonly acceptsLabel: string;
  readonly otherwiseLabel: string;
  readonly chainsCaption: string;
  readonly chainColumns: { readonly network: string; readonly v3: string; readonly v4: string };
  readonly read: string;
  readonly notRead: string;
  readonly languagesCaption: string;

  readonly json: Paragraphs;
  readonly dataHeadersLabel: string;
  readonly fieldsCaption: string;
  /** One sentence or two per field of a `200` answer; the compiler holds the keys to the schema. */
  readonly fields: (figures: DevelopersFigures) => { readonly [Path in EmbedFieldPath]: string };
  readonly exampleCaption: string;

  readonly errors: Paragraphs;
  readonly statuses: (figures: DevelopersFigures) => { readonly [Kind in EmbedStatusKind]: string };
  readonly bodyLabel: string;

  readonly caching: Paragraphs;

  readonly examples: { readonly curl: string; readonly fetch: string; readonly iframe: string; readonly selectHint: string };

  /** The share card: what it draws, how it is addressed, and how it fails. */
  readonly share: Paragraphs;
  readonly shareLabel: string;

  readonly terms: Paragraphs;
  readonly links: { readonly code: string; readonly licence: string };
};

const en: DevelopersCopy = {
  link: "Developers",
  pointer: "The card and its JSON, documented in full",
  title: "For developers",
  description:
    "The embeddable pool card and the JSON behind it — their addresses, every parameter and field, the status codes, caching, CORS and the rate limit, with examples — exactly as the code serves them.",
  heading: "The pool card and its JSON",
  lead: "Two things on this site are meant for other sites: a card showing one pool's suggested range, which any page may put in a frame, and the same figures as JSON, which any site's code may read. Neither needs a key or an account. Both are described here as the code serves them, and tests hold this page to that code: every parameter it lists is one the address is read with, and every field one the answer is checked against before it is sent.",
  contentsHeading: "On this page",
  sections: {
    card: "The card",
    parameters: "Parameters",
    json: "The JSON",
    errors: "Status codes and errors",
    caching: "Caching and the rate limit",
    examples: "Examples",
    share: "The share card",
    terms: "Terms, in plain words",
  },

  card: (f) => [
    `\`/embed/pool\` is a small page written by hand rather than by the site's framework. It shows the pair with its protocol, fee and network; the suggested range, with the horizon and width it was drawn for; the current price; a line saying it is not financial advice; and a link back to the pool's page here, which opens in a new tab. The range is always drawn for the site's defaults, ${f.defaultHorizon} days at ${f.defaultMultiplier}, whatever anyone's own settings are. A note is added while the current price is outside the range, and another for a v4 pool whose hook may change what a swap costs.`,
    "It holds no script and no form, and loads nothing: its own `Content-Security-Policy` allows nothing but its inline style. Its colours are the site's, light or dark as the reader's system is set. It cannot see the page around it, and there is no parameter to choose.",
    `Give it a frame ${f.frameWidth} pixels wide and ${f.frameHeight} tall, or ${f.frameHeightHook} tall for a pool whose hook may change what a swap costs, whose card carries that one more line. Every pool's page offers exactly that under "${f.embedSummary}", with the height already right for that pool, and the frame it offers never grows wider than the column it is pasted into.`,
    "It is the only page on this site another site may frame. Every other address, this one included, is sent with `X-Frame-Options: DENY` and `frame-ancestors 'none'`; the card is sent without the first, and with `frame-ancestors *`.",
  ],
  snippetLabel: "The frame for the USDC / WETH 0.3% pool on Ethereum, as that pool's page offers it:",
  cardHeadersLabel: "What a card with figures is sent with, beside the headers every page carries:",

  parametersIntro: (f) => [
    "The card and the JSON take the same parameters, and name a pool the way the site's own pages do: a v3 pool by its `address`, as on `/pool`, and a v4 pool by its `id`, as on `/v4`. Exactly one of the two is needed, and which one arrived says which protocol it is. A pool or a network named twice is refused rather than having one of its names picked, and any parameter not listed here is ignored.",
    `The language comes from the address alone, never from the reader's browser or a cookie: the site that places the card chooses it, and the same address is the same answer for everyone who loads it, which is what lets a cache keep it. The card is written in all ${f.languages} of the site's languages, and in Arabic it reads right to left.`,
  ],
  parameters: (f) => ({
    address: {
      accepts: "A v3 pool's contract address: `0x` and 40 hexadecimal digits, in upper or lower case.",
      otherwise: `Anything else names no pool, and so does a v3 pool on a network where v3 is not read (${f.v4OnlyChains}): \`400\`, and nothing is read.`,
    },
    id: {
      accepts: "A v4 pool's id, the hash of its key: `0x` and 64 hexadecimal digits, in upper or lower case.",
      otherwise: `Anything else names no pool, and so does a v4 pool on a network where v4 is not read (${f.v3OnlyChains}): \`400\`, and nothing is read. So does an \`id\` beside an \`address\`.`,
    },
    chain: {
      accepts: "A network's slug, from the table below. Left out, the network is Ethereum.",
      otherwise: "A slug the site does not read is refused, never read as Ethereum: `400`.",
    },
    lang: {
      accepts:
        "A language code from the list below, for the card's words and the JSON's `disclaimer`; the figures are the same in every language. Left out, English.",
      otherwise: "Any other value, or `lang` given twice, gives English. It is never refused.",
    },
  }),
  acceptsLabel: "Accepts",
  otherwiseLabel: "Otherwise",
  chainsCaption: "The networks, by the slug `chain` takes:",
  chainColumns: { network: "Network", v3: "v3 pools", v4: "v4 pools" },
  read: "read",
  notRead: "not read",
  languagesCaption: "The languages, by the code `lang` takes:",

  json: () => [
    "`GET /api/embed/pool`, with the same parameters, answers with the card's figures as JSON, for a site that would rather draw them itself: the same reading, kept just as long. Every figure is a JSON number, and every price is written the way the pool's page writes it — how many `price.quote` one `price.base` is worth.",
    "Before an answer is sent it is checked against its schema, and one that does not hold is not sent: the pool is answered as unreadable instead. So an answer with status `200` always has exactly the fields below, no more and no fewer.",
    "Any site's script may read it. Every answer, errors and refusals included, is sent with `Access-Control-Allow-Origin: *`. It sets no cookie and needs no credential. A plain `GET` needs no preflight, and none is answered, so send it without custom headers.",
  ],
  dataHeadersLabel: "What an answer with figures is sent with, beside the headers every page carries:",
  fieldsCaption: "Every field of a `200` answer, with its JSON type:",
  fields: (f) => ({
    protocol: "`v3` for a pool named by `address`, `v4` for one named by `id`.",
    "chain.id": "The network's chain id.",
    "chain.slug": "The network's slug, as `chain` takes it.",
    "chain.name": "The network's name.",
    pool: "The pool's address (v3) or id (v4), in lower case.",
    "pair.token0":
      "The symbol of the pool's first token, as its contract states it: text from a contract anyone can deploy, so escape it before putting it in a page.",
    "pair.token1": "The second token's symbol, the same way.",
    lpFeePpm:
      "The fee the pool pays liquidity providers on a swap, in millionths: `3000` is 0.3%. `null` when a v4 pool's hook sets the fee swap by swap.",
    "price.base": "The token each price is for one unit of.",
    "price.quote": "The token each price is counted in.",
    "price.current": "The pool's price when it was read.",
    "range.lower": "The suggested range's lower edge, as a price.",
    "range.upper": "Its upper edge.",
    "range.currentInRange": "Whether the current price is inside the range. When it is not, the card adds a note.",
    "range.lowerTruncated":
      "`true` when the pool's tick grid cannot reach as far as the band's lower edge, so the range stops short of it.",
    "range.upperTruncated": "The same, for the upper edge.",
    "parameters.horizonDays": `The horizon the range was drawn for, in days: always the default, ${f.defaultHorizon}.`,
    "parameters.standardDeviationMultiplier": `The width it was drawn for, in standard deviations: always the default, ${f.defaultMultiplier}.`,
    hookMayAlterSwaps:
      "`true` for a v4 pool whose hook may change what a swap costs, read from the hook's address; `false` for v3, for a v4 pool with no hook, and for a hook whose permissions leave swaps alone. Where it is `true`, the card carries a note.",
    analysedAt: "When the price was read, in UTC to the millisecond — not when this answer was sent, which can be minutes later.",
    poolUrl: "The pool's page on this site, at the same horizon and width.",
    disclaimer: "What the figures are and are not, in the language `lang` names.",
  }),
  exampleCaption:
    "An answer for the pool in the examples. Its figures are an example, worked out by the site's own code from a sample month of prices rather than read from the pool, and a test checks that the code still answers exactly this for that month:",

  errors: () => [
    "The card and the JSON answer with the same status codes. Neither ever answers with the site's own error page or with what went wrong inside: the card shows one sentence and its link back, and the JSON answers with an `error` a script can test, and with `disclaimer` — except a refusal, which carries the wait instead.",
  ],
  statuses: (f) => ({
    figures: "The figures: a card with them, or the JSON above.",
    "not-a-pool": `The address names no pool the site reads: neither \`address\` nor \`id\`, or both, or one malformed or given twice, a network the site does not read, a v3 pool where only v4 is read (${f.v4OnlyChains}), or a v4 pool where only v3 is read (${f.v3OnlyChains}). Nothing was read, and asking again will not change the answer.`,
    unreadable:
      "A well-formed pool that could not be read just now: a source did not answer in time, or there is no such pool on that network. `poolUrl` still leads to its page. Asking again in a minute may find it.",
    "rate-limited":
      "Too many requests from one client: see the rate limit below. `Retry-After` and `retryAfterSeconds` both say how many seconds to wait. The card answers with a short page saying so, in its own language.",
  }),
  bodyLabel: "The JSON's answer, with how long it may be kept:",

  caching: (f) => [
    `Every answer says how long it may be kept, by a browser and by a shared cache alike: ${f.keptSeconds} seconds for the figures; ${f.unreadableSeconds} seconds for a pool that could not be read, so one that comes back is not shown as unreadable for long; ${f.notAPoolSeconds} seconds for an address that names no pool, which no later moment will change. A refusal is never kept. Each answer is the same for everyone who asks with the same address, which is what makes keeping it safe.`,
    `Behind that, the server keeps each pool's figures for ${f.keptSeconds} seconds from the moment it read them, for the card and the JSON alike, in every language: every card of one pool, on every page it is placed on, is one reading until it runs out. A pool that could not be read is not kept, and is asked again on the next request. So the price in an answer can be older than the answer: \`analysedAt\` says when it was read.`,
    `A request that names a well-formed pool reads that pool, so it is counted against the same allowance as the site's own pool pages: ${f.limit} requests per client in a window of ${f.windowSeconds} seconds that starts with the client's first request, a client being the IP address the request reaches the site from. Past it, the answer is \`429\`, with \`Retry-After\`. Every such request that reaches the site counts, one answered from the server's keep included; a request that names no pool counts for nothing.`,
    `From a browser, a card or a \`fetch\` counts against the reader who loads it, not against the site it is placed on — so a page placing more than ${f.limit} cards has the ones past that refused, for each reader. From a server, every request you send shares that server's one allowance: keep each answer for the ${f.keptSeconds} seconds it allows, which costs little, since for most of that time the server would answer with the reading you already have. The limit is there to keep the cost of reading pools down, and nothing here promises it will stay as it is.`,
  ],

  examples: {
    curl: "The figures, from a terminal:",
    fetch: "From a page's own script, or from a server, with each answer handled:",
    iframe: "The card, on a page:",
    selectHint: "One click selects a whole block, ready to copy.",
  },

  share: (f) => [
    `\`/api/share/position\` draws a card for one open v3 position, a PNG 1200 pixels by 630: the pair with its fee and network, the position's range, the fees it has earned over its whole life, and its result against simply holding the deposits with the result's two parts — the figures the holdings page shows in the record under that position, in the token that page quotes the pool in. The position is named by \`id\`, its token id, with \`chain\` and \`lang\` as above; left out, Ethereum and English. Only on the networks whose positions are kept (${f.positionChains}), where a record can be verified against the chain, and only a verified record puts a figure on the card: one that could not be verified gives a plain card that says so. Every holdings page offers the links under "${f.shareHeading}".`,
    `The card itself is \`200\`. An address that names no position is \`400\`, an id the chain holds no open position under is \`404\`, and a position that could not be read just now is \`503\` — each as JSON with an \`error\` of \`not-a-position\`, \`no-such-position\` or \`unreadable\`, never a card with a figure missing from it. A card is kept ${f.keptSeconds} seconds, like the pool card, since its record is valued at today's price; and a request that names a well-formed position reads the chain, so it counts against the same ${f.limit} requests per ${f.windowSeconds} seconds as the pool pages, and is \`429\` past them. The card names the position's public token id and nothing about who asked for it, and nothing is kept.`,
  ],
  shareLabel: "The card for one position on Ethereum, in English — an address that can be opened as it stands:",

  terms: (f) => [
    `The figures are measurements, not advice. The range is worked out from how far the pool's price moved over the last ${f.measuredDays} days: it is not a forecast and not a recommendation, and every answer says so itself, the card on its face and the JSON in \`disclaimer\`. How every figure is made, and what each leaves out, is under "${f.methodLink}".`,
    `The card carries its own link back, "${f.analysedBy}". The JSON has no attribution field, and nothing in the code asks for one; what it carries is \`poolUrl\`, the pool's page here, and \`disclaimer\`. Shown beside the figures, those two tell a reader where they came from and what they are.`,
    "There is no version number and no key, and no promise that the answer's shape will stay as it is or that the site will be up at any given moment. What holds is narrower: an answer is checked against its schema before it is sent, and tests hold this page to that schema and to the code that reads the address, so it describes what is served now. A change to either shows in the code's public history.",
    "The code is open source, under the MIT licence.",
  ],
  links: { code: "The code, on GitHub", licence: "The MIT licence" },
};

const tr: DevelopersCopy = {
  link: "Geliştiriciler",
  pointer: "Kart ve JSON'u, tüm ayrıntısıyla",
  title: "Geliştiriciler için",
  description:
    "Sitelere gömülebilen havuz kartı ve arkasındaki JSON — adresleri, her parametre ve her alan, durum kodları, önbellek, CORS ve istek sınırı, örnekleriyle — tam olarak kodun sunduğu haliyle.",
  heading: "Havuz kartı ve JSON'u",
  lead: "Bu sitede iki şey başka siteler için yapıldı: bir havuzun önerilen aralığını gösteren ve her sayfanın bir çerçeveye koyabileceği bir kart, ve aynı rakamların her sitenin kodunun okuyabileceği JSON hali. İkisi de anahtar ya da hesap gerektirmez. İkisi de burada kodun sunduğu haliyle anlatılır ve testler bu sayfayı o koda bağlar: listelediği her parametre adresin gerçekten okunduğu bir parametredir, her alan da cevabın gönderilmeden önce karşılaştırıldığı alanlardan biridir.",
  contentsHeading: "Bu sayfada",
  sections: {
    card: "Kart",
    parameters: "Parametreler",
    json: "JSON",
    errors: "Durum kodları ve hatalar",
    caching: "Önbellek ve istek sınırı",
    examples: "Örnekler",
    share: "Paylaşım kartı",
    terms: "Koşullar, sade bir dille",
  },

  card: (f) => [
    `\`/embed/pool\`, sitenin çatısıyla değil elle yazılmış küçük bir sayfadır. Çifti protokolü, komisyonu ve ağıyla; önerilen aralığı, çizildiği süre ve genişlikle; güncel fiyatı; yatırım tavsiyesi olmadığını söyleyen bir satırı ve buradaki havuz sayfasına dönen, yeni sekmede açılan bir bağlantıyı gösterir. Aralık, kimin ayarı ne olursa olsun, her zaman sitenin varsayılanlarıyla çizilir: ${f.defaultHorizon} gün, ${f.defaultMultiplier}. Güncel fiyat aralığın dışındayken bir not eklenir; hook'u bir takasın maliyetini değiştirebilen bir v4 havuzu için de bir not daha.`,
    "İçinde ne betik ne form vardır ve hiçbir şey yüklemez: kendi `Content-Security-Policy` başlığı satır içi stilinden başka hiçbir şeye izin vermez. Renkleri sitenin renkleridir; okurun sistemi nasıl ayarlıysa açık ya da koyu. Etrafındaki sayfayı göremez ve bunu seçecek bir parametre yoktur.",
    `Ona ${f.frameWidth} piksel genişliğinde ve ${f.frameHeight} piksel yüksekliğinde bir çerçeve ver; hook'u bir takasın maliyetini değiştirebilen bir havuz için ${f.frameHeightHook} piksel yükseklik, çünkü onun kartı bir satır daha taşır. Her havuz sayfası "${f.embedSummary}" başlığı altında tam olarak bunu, o havuz için doğru yükseklikle sunar ve sunduğu çerçeve yapıştırıldığı sütundan asla daha geniş olmaz.`,
    "Bu sitede başka bir sitenin çerçeveye koyabileceği tek sayfa budur. Bu sayfa dahil diğer her adres `X-Frame-Options: DENY` ve `frame-ancestors 'none'` ile gönderilir; kart ise ilki olmadan ve `frame-ancestors *` ile gönderilir.",
  ],
  snippetLabel: "Ethereum'daki %0,3'lük USDC / WETH havuzu için çerçeve, o havuzun sayfasının sunduğu haliyle:",
  cardHeadersLabel: "Rakamları olan bir kartın, her sayfanın taşıdığı başlıkların yanında gönderildiği başlıklar:",

  parametersIntro: (f) => [
    "Kart ve JSON aynı parametreleri alır ve bir havuzu sitenin kendi sayfaları gibi adlandırır: v3 havuzunu `/pool`'daki gibi `address` ile, v4 havuzunu `/v4`'teki gibi `id` ile. İkisinden tam olarak biri gerekir; hangisinin geldiği, hangi protokol olduğunu söyler. İki kez belirtilen bir havuz ya da ağ, değerlerinden biri seçilmek yerine reddedilir; burada listelenmeyen her parametre yok sayılır.",
    `Dil yalnızca adresten gelir, okurun tarayıcısından ya da bir çerezden asla: kartı yerleştiren site onu seçer ve aynı adres, onu yükleyen herkes için aynı cevaptır; bir önbelleğin onu saklayabilmesini sağlayan da budur. Kart sitenin ${f.languages} dilinin hepsinde yazılır; Arapçada sağdan sola okunur.`,
  ],
  parameters: (f) => ({
    address: {
      accepts: "Bir v3 havuzunun sözleşme adresi: `0x` ve ardından 40 onaltılık rakam, büyük ya da küçük harfle.",
      otherwise: `Başka her şey bir havuz belirtmez; v3'ün okunmadığı bir ağdaki (${f.v4OnlyChains}) v3 havuzu da öyle: \`400\`, ve hiçbir şey okunmaz.`,
    },
    id: {
      accepts: "Bir v4 havuzunun kimliği, anahtarının özeti: `0x` ve ardından 64 onaltılık rakam, büyük ya da küçük harfle.",
      otherwise: `Başka her şey bir havuz belirtmez; v4'ün okunmadığı bir ağdaki (${f.v3OnlyChains}) v4 havuzu da öyle: \`400\`, ve hiçbir şey okunmaz. Bir \`address\`'in yanında gelen \`id\` de öyle.`,
    },
    chain: {
      accepts: "Aşağıdaki tablodan bir ağın kısa adı. Verilmezse ağ Ethereum'dur.",
      otherwise: "Sitenin okumadığı bir kısa ad reddedilir, asla Ethereum olarak okunmaz: `400`.",
    },
    lang: {
      accepts:
        "Aşağıdaki listeden bir dil kodu; kartın sözleri ve JSON'daki `disclaimer` için. Rakamlar her dilde aynıdır. Verilmezse İngilizce.",
      otherwise: "Başka her değer ya da iki kez verilen `lang` İngilizce verir. Asla reddedilmez.",
    },
  }),
  acceptsLabel: "Kabul eder",
  otherwiseLabel: "Aksi halde",
  chainsCaption: "Ağlar, `chain` parametresinin aldığı kısa adla:",
  chainColumns: { network: "Ağ", v3: "v3 havuzları", v4: "v4 havuzları" },
  read: "okunur",
  notRead: "okunmaz",
  languagesCaption: "Diller, `lang` parametresinin aldığı kodla:",

  json: () => [
    "`GET /api/embed/pool`, aynı parametrelerle, kartın rakamlarını JSON olarak verir; rakamları kendisi çizmeyi tercih eden bir site için: aynı okuma, aynı süre saklanır. Her rakam bir JSON sayısıdır ve her fiyat havuz sayfasının yazdığı yönde yazılır: bir `price.base` kaç `price.quote` eder.",
    "Bir cevap gönderilmeden önce şemasıyla karşılaştırılır ve tutmayan bir cevap gönderilmez; havuz onun yerine okunamamış olarak cevaplanır. Yani `200` durumlu bir cevapta her zaman tam olarak aşağıdaki alanlar vardır, ne fazla ne eksik.",
    "Her sitenin betiği onu okuyabilir. Hatalar ve retler dahil her cevap `Access-Control-Allow-Origin: *` ile gönderilir. Çerez bırakmaz ve kimlik bilgisi istemez. Düz bir `GET` ön kontrol (preflight) gerektirmez ve hiçbir ön kontrole cevap verilmez; o yüzden isteği kendi başlıkların olmadan gönder.",
  ],
  dataHeadersLabel: "Rakamları olan bir cevabın, her sayfanın taşıdığı başlıkların yanında gönderildiği başlıklar:",
  fieldsCaption: "`200` durumlu bir cevabın her alanı, JSON türüyle:",
  fields: (f) => ({
    protocol: "`address` ile adlandırılan havuz için `v3`, `id` ile adlandırılan için `v4`.",
    "chain.id": "Ağın zincir kimliği (chain id).",
    "chain.slug": "Ağın kısa adı, `chain` parametresinin aldığı haliyle.",
    "chain.name": "Ağın adı.",
    pool: "Havuzun adresi (v3) ya da kimliği (v4), küçük harfle.",
    "pair.token0":
      "Havuzun ilk tokenının sembolü, sözleşmesinin söylediği haliyle: herkesin kurabileceği bir sözleşmeden gelen bir metindir, bu yüzden bir sayfaya koymadan önce kaçış karakterleriyle (escape) işle.",
    "pair.token1": "İkinci tokenın sembolü, aynı şekilde.",
    lpFeePpm:
      "Havuzun bir takasta likidite sağlayıcılarına ödediği komisyon, milyonda bir cinsinden: `3000`, %0,3'tür. Bir v4 havuzunun hook'u komisyonu takas takas belirliyorsa `null`.",
    "price.base": "Her fiyatın bir birimi için verildiği token.",
    "price.quote": "Her fiyatın cinsinden yazıldığı token.",
    "price.current": "Okunduğu andaki havuz fiyatı.",
    "range.lower": "Önerilen aralığın alt kenarı, fiyat olarak.",
    "range.upper": "Üst kenarı.",
    "range.currentInRange": "Güncel fiyatın aralığın içinde olup olmadığı. Değilse kart bir not ekler.",
    "range.lowerTruncated":
      "Havuzun tick ızgarası bandın alt kenarına kadar uzanamadığında `true`; o zaman aralık ondan önce biter.",
    "range.upperTruncated": "Aynısı, üst kenar için.",
    "parameters.horizonDays": `Aralığın çizildiği süre, gün olarak: her zaman varsayılan, ${f.defaultHorizon}.`,
    "parameters.standardDeviationMultiplier": `Çizildiği genişlik, standart sapma cinsinden: her zaman varsayılan, ${f.defaultMultiplier}.`,
    hookMayAlterSwaps:
      "Hook'u bir takasın maliyetini değiştirebilen bir v4 havuzu için `true`; hook'un adresinden okunur. v3 için, hook'suz bir v4 havuzu için ve izinleri takaslara dokunmayan bir hook için `false`. `true` olduğunda kart bir not taşır.",
    analysedAt: "Fiyatın okunduğu an, UTC olarak, milisaniyesine kadar — bu cevabın gönderildiği an değil; o, dakikalar sonra olabilir.",
    poolUrl: "Havuzun bu sitedeki sayfası, aynı süre ve genişlikle.",
    disclaimer: "Rakamların ne olduğu ve ne olmadığı, `lang` parametresinin belirttiği dilde.",
  }),
  exampleCaption:
    "Örneklerdeki havuz için bir cevap. Rakamları bir örnektir: havuzdan okunmamış, sitenin kendi koduyla örnek bir aylık fiyattan hesaplanmıştır ve bir test, kodun o ay için hâlâ tam olarak bunu cevapladığını kontrol eder:",

  errors: () => [
    "Kart ve JSON aynı durum kodlarıyla cevap verir. İkisi de asla sitenin kendi hata sayfasıyla ya da içeride neyin ters gittiğiyle cevap vermez: kart tek bir cümle ve geri bağlantısını gösterir; JSON ise bir betiğin sınayabileceği bir `error` ve `disclaimer` ile cevap verir — bunun yerine beklenecek süreyi taşıyan ret hariç.",
  ],
  statuses: (f) => ({
    figures: "Rakamlar: onları taşıyan bir kart ya da yukarıdaki JSON.",
    "not-a-pool": `Adres, sitenin okuduğu bir havuz belirtmiyor: ne \`address\` ne \`id\` var ya da ikisi birden var, biri bozuk ya da iki kez verilmiş, ağ sitenin okumadığı bir ağ, yalnızca v4'ün okunduğu yerde (${f.v4OnlyChains}) bir v3 havuzu ya da yalnızca v3'ün okunduğu yerde (${f.v3OnlyChains}) bir v4 havuzu. Hiçbir şey okunmadı ve yeniden sormak cevabı değiştirmez.`,
    unreadable:
      "Biçimi doğru ama şu an okunamayan bir havuz: bir kaynak zamanında cevap vermedi ya da o ağda böyle bir havuz yok. `poolUrl` yine de sayfasına götürür. Bir dakika sonra yeniden sormak onu bulabilir.",
    "rate-limited":
      "Tek bir istemciden fazla istek: aşağıdaki istek sınırına bak. `Retry-After` ve `retryAfterSeconds` ikisi de kaç saniye beklenmesi gerektiğini söyler. Kart bunu söyleyen kısa bir sayfayla, kendi dilinde cevap verir.",
  }),
  bodyLabel: "JSON'un cevabı ve ne kadar saklanabileceği:",

  caching: (f) => [
    `Her cevap, bir tarayıcı için de ortak bir önbellek için de, ne kadar saklanabileceğini söyler: rakamlar için ${f.keptSeconds} saniye; okunamayan bir havuz için ${f.unreadableSeconds} saniye, böylece geri gelen bir havuz uzun süre okunamaz görünmez; havuz belirtmeyen bir adres için ${f.notAPoolSeconds} saniye, çünkü sonraki hiçbir an bunu değiştirmez. Bir ret asla saklanmaz. Her cevap aynı adresle soran herkes için aynıdır; saklamayı güvenli kılan da budur.`,
    `Bunun arkasında sunucu her havuzun rakamlarını, okuduğu andan itibaren ${f.keptSeconds} saniye saklar; kart ve JSON için aynı şekilde, her dilde: bir havuzun her kartı, yerleştirildiği her sayfada, süresi dolana kadar tek bir okumadır. Okunamayan bir havuz saklanmaz ve bir sonraki istekte yeniden sorulur. Yani bir cevaptaki fiyat cevabın kendisinden eski olabilir: \`analysedAt\` ne zaman okunduğunu söyler.`,
    `Biçimi doğru bir havuz belirten istek o havuzu okur; bu yüzden sitenin kendi havuz sayfalarıyla aynı hakka sayılır: istemci başına ${f.windowSeconds} saniyelik bir pencerede ${f.limit} istek. Pencere istemcinin ilk isteğiyle başlar; istemci, isteğin siteye ulaştığı IP adresidir. Sınır aşılınca cevap \`Retry-After\` ile birlikte \`429\` olur. Siteye ulaşan bu türden her istek sayılır, sunucunun sakladığından cevaplanan da; havuz belirtmeyen bir istek hiç sayılmaz.`,
    `Bir tarayıcıdan, bir kart ya da bir \`fetch\` onu yükleyen okurun hakkından düşer, yerleştirildiği siteninkinden değil; bu yüzden ${f.limit} karttan fazlasını yerleştiren bir sayfada fazlası her okur için reddedilir. Bir sunucudan ise gönderdiğin her istek o sunucunun tek hakkını paylaşır: her cevabı izin verdiği ${f.keptSeconds} saniye boyunca sakla; bunun bedeli azdır, çünkü o sürenin çoğunda sunucu zaten elindeki okumayla cevap verirdi. Sınır havuz okumanın maliyetini düşük tutmak için var ve burada hiçbir şey onun böyle kalacağını vaat etmez.`,
  ],

  examples: {
    curl: "Rakamlar, bir terminalden:",
    fetch: "Bir sayfanın kendi betiğinden ya da bir sunucudan, her cevap ele alınarak:",
    iframe: "Kart, bir sayfada:",
    selectHint: "Tek tıklama bütün bloğu seçer, kopyalamaya hazır.",
  },

  share: (f) => [
    `\`/api/share/position\`, açık bir v3 pozisyonu için bir kart çizer: 1200'e 630 piksellik bir PNG. Üzerinde çift, komisyonu ve ağıyla; pozisyonun aralığı; bütün ömrü boyunca kazandığı komisyon; ve yatırılanları sadece tutmaya kıyasla sonucu, sonucun iki parçasıyla — yani pozisyonlar sayfasının o pozisyonun altındaki hesapta gösterdiği rakamlar, o sayfanın havuzu kote ettiği token cinsinden. Pozisyon \`id\` ile, yani token kimliğiyle belirtilir; \`chain\` ve \`lang\` yukarıdaki gibidir, verilmezse Ethereum ve İngilizce. Yalnızca pozisyonları tutulan ağlarda (${f.positionChains}), çünkü bir hesap ancak oralarda zincirle doğrulanabilir; ve karta rakam koyan yalnızca doğrulanmış bir hesaptır: doğrulanamayan bir hesap, bunu söyleyen düz bir kart verir. Her pozisyonlar sayfası bağlantıları "${f.shareHeading}" başlığı altında sunar.`,
    `Kartın kendisi \`200\`'dür. Pozisyon belirtmeyen bir adres \`400\`, zincirin altında açık bir pozisyon tutmadığı bir kimlik \`404\`, şu an okunamayan bir pozisyon \`503\` olur — her biri JSON olarak, \`error\` alanı \`not-a-position\`, \`no-such-position\` ya da \`unreadable\` ile; asla rakamı eksik bir kart değil. Bir kart, havuz kartı gibi ${f.keptSeconds} saniye saklanır, çünkü hesabı bugünkü fiyatla değerlenir; biçimi doğru bir pozisyon belirten istek zinciri okur, bu yüzden havuz sayfalarıyla aynı hakka sayılır: ${f.windowSeconds} saniyede ${f.limit} istek, ötesi \`429\`. Kart, pozisyonun herkese açık token kimliğini söyler, kimin istediğine dair hiçbir şey söylemez ve hiçbir şey saklanmaz.`,
  ],
  shareLabel: "Ethereum'daki bir pozisyonun kartı, İngilizce — olduğu gibi açılabilen bir adres:",

  terms: (f) => [
    `Rakamlar ölçümdür, tavsiye değildir. Aralık, havuzun fiyatının son ${f.measuredDays} günde ne kadar hareket ettiğinden hesaplanır: bir tahmin değildir, bir öneri de değildir; ve her cevap bunu kendisi söyler, kart yüzünde, JSON \`disclaimer\` içinde. Her rakamın nasıl üretildiği ve neyi dışarıda bıraktığı "${f.methodLink}" sayfasındadır.`,
    `Kart kendi geri bağlantısını taşır: "${f.analysedBy}". JSON'da bir atıf alanı yoktur ve kodda atıf isteyen hiçbir şey yoktur; taşıdığı şey, havuzun buradaki sayfası olan \`poolUrl\` ve \`disclaimer\`'dır. Rakamların yanında gösterildiklerinde bu ikisi okura rakamların nereden geldiğini ve ne olduklarını söyler.`,
    "Sürüm numarası da anahtar da yoktur; cevabın biçiminin böyle kalacağına ya da sitenin herhangi bir anda ayakta olacağına dair bir vaat de yoktur. Geçerli olan daha dardır: bir cevap gönderilmeden önce şemasıyla karşılaştırılır ve testler bu sayfayı o şemaya ve adresi okuyan koda bağlar; yani sayfa şu an sunulanı anlatır. İkisinde yapılan bir değişiklik, kodun herkese açık geçmişinde görünür.",
    "Kod açık kaynaklıdır, MIT lisansı altında.",
  ],
  links: { code: "Kod, GitHub'da", licence: "MIT lisansı" },
};

const de: DevelopersCopy = {
  link: "Entwickler",
  pointer: "Karte und JSON, vollständig dokumentiert",
  title: "Für Entwickler",
  description:
    "Die einbettbare Pool-Karte und das JSON dahinter — ihre Adressen, jeder Parameter und jedes Feld, die Statuscodes, Caching, CORS und das Anfragelimit, mit Beispielen — genau so, wie der Code sie ausliefert.",
  heading: "Die Pool-Karte und ihr JSON",
  lead: "Zwei Dinge auf dieser Website sind für andere Websites gedacht: eine Karte mit dem vorgeschlagenen Bereich eines Pools, die jede Seite in einen Frame setzen darf, und dieselben Zahlen als JSON, die der Code jeder Website lesen darf. Keines von beiden braucht einen Schlüssel oder ein Konto. Beide sind hier so beschrieben, wie der Code sie ausliefert, und Tests halten diese Seite an diesen Code: Jeder Parameter, den sie nennt, ist einer, mit dem die Adresse gelesen wird, und jedes Feld eines, gegen das die Antwort vor dem Senden geprüft wird.",
  contentsHeading: "Auf dieser Seite",
  sections: {
    card: "Die Karte",
    parameters: "Parameter",
    json: "Das JSON",
    errors: "Statuscodes und Fehler",
    caching: "Caching und das Anfragelimit",
    examples: "Beispiele",
    share: "Die Teilen-Karte",
    terms: "Bedingungen, in einfachen Worten",
  },

  card: (f) => [
    `\`/embed/pool\` ist eine kleine Seite, von Hand geschrieben statt vom Framework der Website. Sie zeigt das Paar mit Protokoll, Gebühr und Netzwerk; den vorgeschlagenen Bereich mit dem Horizont und der Breite, für die er gezeichnet wurde; den aktuellen Preis; eine Zeile, dass dies keine Finanzberatung ist; und einen Link zurück zur Seite des Pools hier, der sich in einem neuen Tab öffnet. Der Bereich wird immer für die Voreinstellungen der Website gezeichnet, ${f.defaultHorizon} Tage bei ${f.defaultMultiplier}, ganz gleich, wie jemand selbst eingestellt hat. Eine Notiz kommt hinzu, solange der aktuelle Preis außerhalb des Bereichs liegt, und eine weitere bei einem v4-Pool, dessen Hook ändern kann, was ein Tausch kostet.`,
    "Sie enthält kein Skript und kein Formular und lädt nichts: Ihre eigene `Content-Security-Policy` erlaubt nichts außer ihrem Inline-Stil. Ihre Farben sind die der Website, hell oder dunkel, je nachdem, wie das System des Lesers eingestellt ist. Die Seite um sie herum sieht sie nicht, und es gibt keinen Parameter, um das zu wählen.",
    `Geben Sie ihr einen Frame von ${f.frameWidth} Pixeln Breite und ${f.frameHeight} Pixeln Höhe, oder ${f.frameHeightHook} Pixel Höhe bei einem Pool, dessen Hook ändern kann, was ein Tausch kostet — dessen Karte trägt eine Zeile mehr. Genau das bietet die Seite jedes Pools unter „${f.embedSummary}“ an, mit der für diesen Pool schon passenden Höhe, und der angebotene Frame wird nie breiter als die Spalte, in die er eingefügt wird.`,
    "Sie ist die einzige Seite dieser Website, die eine andere Website in einen Frame setzen darf. Jede andere Adresse, diese eingeschlossen, wird mit `X-Frame-Options: DENY` und `frame-ancestors 'none'` ausgeliefert; die Karte ohne das Erste und mit `frame-ancestors *`.",
  ],
  snippetLabel: "Der Frame für den USDC / WETH-Pool mit 0,3 % auf Ethereum, so wie die Seite dieses Pools ihn anbietet:",
  cardHeadersLabel: "Womit eine Karte mit Zahlen ausgeliefert wird, neben den Headern, die jede Seite trägt:",

  parametersIntro: (f) => [
    "Die Karte und das JSON nehmen dieselben Parameter und benennen einen Pool so wie die Seiten der Website selbst: einen v3-Pool mit seiner `address` wie auf `/pool`, einen v4-Pool mit seiner `id` wie auf `/v4`. Genau einer der beiden wird gebraucht, und welcher ankommt, sagt, welches Protokoll es ist. Ein zweimal genannter Pool oder ein zweimal genanntes Netzwerk wird abgelehnt, statt dass einer der Werte gewählt wird, und jeder hier nicht aufgeführte Parameter wird ignoriert.",
    `Die Sprache kommt allein aus der Adresse, nie aus dem Browser des Lesers oder aus einem Cookie: Die Website, die die Karte einbindet, wählt sie, und dieselbe Adresse ist für alle, die sie laden, dieselbe Antwort — erst das erlaubt einem Cache, sie aufzubewahren. Die Karte gibt es in allen ${f.languages} Sprachen der Website, und auf Arabisch läuft sie von rechts nach links.`,
  ],
  parameters: (f) => ({
    address: {
      accepts: "Die Vertragsadresse eines v3-Pools: `0x` und 40 Hexadezimalziffern, in Groß- oder Kleinbuchstaben.",
      otherwise: `Alles andere benennt keinen Pool, ebenso ein v3-Pool auf einem Netzwerk, auf dem v3 nicht gelesen wird (${f.v4OnlyChains}): \`400\`, und nichts wird gelesen.`,
    },
    id: {
      accepts: "Die ID eines v4-Pools, der Hash seines Schlüssels: `0x` und 64 Hexadezimalziffern, in Groß- oder Kleinbuchstaben.",
      otherwise: `Alles andere benennt keinen Pool, ebenso ein v4-Pool auf einem Netzwerk, auf dem v4 nicht gelesen wird (${f.v3OnlyChains}): \`400\`, und nichts wird gelesen. Ebenso eine \`id\` neben einer \`address\`.`,
    },
    chain: {
      accepts: "Das Kürzel eines Netzwerks aus der Tabelle unten. Fehlt es, ist das Netzwerk Ethereum.",
      otherwise: "Ein Kürzel, das die Website nicht liest, wird abgelehnt, nie als Ethereum gelesen: `400`.",
    },
    lang: {
      accepts:
        "Ein Sprachcode aus der Liste unten, für die Worte der Karte und das `disclaimer` des JSON; die Zahlen sind in jeder Sprache dieselben. Fehlt er, Englisch.",
      otherwise: "Jeder andere Wert, oder `lang` zweimal, ergibt Englisch. Abgelehnt wird nie.",
    },
  }),
  acceptsLabel: "Akzeptiert",
  otherwiseLabel: "Sonst",
  chainsCaption: "Die Netzwerke, nach dem Kürzel, das `chain` nimmt:",
  chainColumns: { network: "Netzwerk", v3: "v3-Pools", v4: "v4-Pools" },
  read: "gelesen",
  notRead: "nicht gelesen",
  languagesCaption: "Die Sprachen, nach dem Code, den `lang` nimmt:",

  json: () => [
    "`GET /api/embed/pool` beantwortet mit denselben Parametern die Zahlen der Karte als JSON, für eine Website, die sie lieber selbst zeichnet: dieselbe Lesung, genauso lange aufbewahrt. Jede Zahl ist eine JSON-Zahl, und jeder Preis steht so herum, wie die Seite des Pools ihn schreibt — wie viele `price.quote` ein `price.base` wert ist.",
    "Bevor eine Antwort gesendet wird, wird sie gegen ihr Schema geprüft, und eine, die es nicht erfüllt, wird nicht gesendet: Der Pool wird stattdessen als nicht lesbar beantwortet. Eine Antwort mit Status `200` hat also immer genau die Felder unten, nicht mehr und nicht weniger.",
    "Das Skript jeder Website darf sie lesen. Jede Antwort, Fehler und Ablehnungen eingeschlossen, wird mit `Access-Control-Allow-Origin: *` ausgeliefert. Sie setzt kein Cookie und braucht keine Anmeldedaten. Ein schlichtes `GET` braucht keinen Preflight, und keiner wird beantwortet — senden Sie es also ohne eigene Header.",
  ],
  dataHeadersLabel: "Womit eine Antwort mit Zahlen ausgeliefert wird, neben den Headern, die jede Seite trägt:",
  fieldsCaption: "Jedes Feld einer `200`-Antwort, mit seinem JSON-Typ:",
  fields: (f) => ({
    protocol: "`v3` für einen mit `address` benannten Pool, `v4` für einen mit `id` benannten.",
    "chain.id": "Die Chain-ID des Netzwerks.",
    "chain.slug": "Das Kürzel des Netzwerks, so wie `chain` es nimmt.",
    "chain.name": "Der Name des Netzwerks.",
    pool: "Die Adresse (v3) oder ID (v4) des Pools, in Kleinbuchstaben.",
    "pair.token0":
      "Das Symbol des ersten Tokens des Pools, so wie sein Vertrag es angibt: Text aus einem Vertrag, den jeder deployen kann — escapen Sie ihn also, bevor Sie ihn in eine Seite setzen.",
    "pair.token1": "Das Symbol des zweiten Tokens, ebenso.",
    lpFeePpm:
      "Die Gebühr, die der Pool den Liquiditätsanbietern bei einem Tausch zahlt, in Millionsteln: `3000` sind 0,3 %. `null`, wenn der Hook eines v4-Pools die Gebühr Tausch für Tausch festlegt.",
    "price.base": "Der Token, für dessen eine Einheit jeder Preis gilt.",
    "price.quote": "Der Token, in dem jeder Preis gezählt wird.",
    "price.current": "Der Preis des Pools, als er gelesen wurde.",
    "range.lower": "Die untere Grenze des vorgeschlagenen Bereichs, als Preis.",
    "range.upper": "Seine obere Grenze.",
    "range.currentInRange": "Ob der aktuelle Preis im Bereich liegt. Wenn nicht, setzt die Karte eine Notiz hinzu.",
    "range.lowerTruncated":
      "`true`, wenn das Tick-Raster des Pools nicht bis zur unteren Grenze des Bandes reicht, sodass der Bereich davor endet.",
    "range.upperTruncated": "Dasselbe für die obere Grenze.",
    "parameters.horizonDays": `Der Horizont, für den der Bereich gezeichnet wurde, in Tagen: immer die Voreinstellung, ${f.defaultHorizon}.`,
    "parameters.standardDeviationMultiplier": `Die Breite, für die er gezeichnet wurde, in Standardabweichungen: immer die Voreinstellung, ${f.defaultMultiplier}.`,
    hookMayAlterSwaps:
      "`true` für einen v4-Pool, dessen Hook ändern kann, was ein Tausch kostet, gelesen aus der Adresse des Hooks; `false` für v3, für einen v4-Pool ohne Hook und für einen Hook, dessen Berechtigungen Tausche unberührt lassen. Wo es `true` ist, trägt die Karte eine Notiz.",
    analysedAt: "Wann der Preis gelesen wurde, in UTC und auf die Millisekunde — nicht, wann diese Antwort gesendet wurde; das kann Minuten später sein.",
    poolUrl: "Die Seite des Pools auf dieser Website, mit demselben Horizont und derselben Breite.",
    disclaimer: "Was die Zahlen sind und was nicht, in der Sprache, die `lang` nennt.",
  }),
  exampleCaption:
    "Eine Antwort für den Pool aus den Beispielen. Ihre Zahlen sind ein Beispiel: vom Code der Website aus einem Beispielmonat von Preisen berechnet, nicht aus dem Pool gelesen — und ein Test prüft, dass der Code für diesen Monat noch genau das antwortet:",

  errors: () => [
    "Die Karte und das JSON antworten mit denselben Statuscodes. Keines von beiden antwortet je mit der eigenen Fehlerseite der Website oder damit, was intern schiefging: Die Karte zeigt einen Satz und ihren Link zurück, das JSON antwortet mit einem `error`, den ein Skript prüfen kann, und mit `disclaimer` — außer bei einer Ablehnung, die stattdessen die Wartezeit trägt.",
  ],
  statuses: (f) => ({
    figures: "Die Zahlen: eine Karte mit ihnen oder das JSON oben.",
    "not-a-pool": `Die Adresse benennt keinen Pool, den die Website liest: weder \`address\` noch \`id\`, oder beide, oder einer fehlerhaft oder doppelt, ein Netzwerk, das die Website nicht liest, ein v3-Pool, wo nur v4 gelesen wird (${f.v4OnlyChains}), oder ein v4-Pool, wo nur v3 gelesen wird (${f.v3OnlyChains}). Nichts wurde gelesen, und erneutes Fragen ändert die Antwort nicht.`,
    unreadable:
      "Ein korrekt benannter Pool, der gerade nicht gelesen werden konnte: Eine Quelle hat nicht rechtzeitig geantwortet, oder auf diesem Netzwerk gibt es keinen solchen Pool. `poolUrl` führt trotzdem zu seiner Seite. In einer Minute erneut zu fragen kann ihn finden.",
    "rate-limited":
      "Zu viele Anfragen von einem Client: siehe das Anfragelimit unten. `Retry-After` und `retryAfterSeconds` sagen beide, wie viele Sekunden zu warten ist. Die Karte antwortet mit einer kurzen Seite, die das sagt, in ihrer eigenen Sprache.",
  }),
  bodyLabel: "Die Antwort des JSON, mit der Dauer, die sie aufbewahrt werden darf:",

  caching: (f) => [
    `Jede Antwort sagt, wie lange sie aufbewahrt werden darf, von einem Browser wie von einem gemeinsamen Cache: ${f.keptSeconds} Sekunden für die Zahlen; ${f.unreadableSeconds} Sekunden für einen Pool, der nicht gelesen werden konnte, damit einer, der wieder antwortet, nicht lange als unlesbar erscheint; ${f.notAPoolSeconds} Sekunden für eine Adresse, die keinen Pool benennt, was kein späterer Moment ändert. Eine Ablehnung wird nie aufbewahrt. Jede Antwort ist für alle, die mit derselben Adresse fragen, dieselbe — das macht das Aufbewahren sicher.`,
    `Dahinter bewahrt der Server die Zahlen jedes Pools ${f.keptSeconds} Sekunden ab dem Moment auf, in dem er sie gelesen hat, für die Karte und das JSON gleichermaßen und in jeder Sprache: Jede Karte eines Pools ist, auf jeder Seite, auf der sie steht, eine einzige Lesung, bis diese abläuft. Ein Pool, der nicht gelesen werden konnte, wird nicht aufbewahrt und bei der nächsten Anfrage erneut gefragt. Der Preis in einer Antwort kann also älter sein als die Antwort: \`analysedAt\` sagt, wann er gelesen wurde.`,
    `Eine Anfrage, die einen korrekt benannten Pool nennt, liest diesen Pool und wird deshalb gegen dasselbe Kontingent gezählt wie die Pool-Seiten der Website: ${f.limit} Anfragen pro Client in einem Fenster von ${f.windowSeconds} Sekunden, das mit der ersten Anfrage des Clients beginnt; ein Client ist die IP-Adresse, von der die Anfrage die Website erreicht. Darüber hinaus lautet die Antwort \`429\`, mit \`Retry-After\`. Jede solche Anfrage, die die Website erreicht, zählt, auch eine, die aus dem Speicher des Servers beantwortet wird; eine Anfrage, die keinen Pool nennt, zählt nicht.`,
    `Aus einem Browser zählt eine Karte oder ein \`fetch\` gegen den Leser, der sie lädt, nicht gegen die Website, auf der sie steht — eine Seite mit mehr als ${f.limit} Karten bekommt die darüber hinaus also für jeden Leser abgelehnt. Von einem Server aus teilen sich alle Ihre Anfragen das eine Kontingent dieses Servers: Bewahren Sie jede Antwort die ${f.keptSeconds} Sekunden auf, die sie erlaubt — das kostet wenig, denn den größten Teil dieser Zeit würde der Server ohnehin mit der Lesung antworten, die Sie schon haben. Das Limit hält die Kosten für das Lesen von Pools niedrig, und nichts hier verspricht, dass es so bleibt.`,
  ],

  examples: {
    curl: "Die Zahlen, aus einem Terminal:",
    fetch: "Aus dem eigenen Skript einer Seite oder von einem Server, mit jeder Antwort behandelt:",
    iframe: "Die Karte, auf einer Seite:",
    selectHint: "Ein Klick markiert einen ganzen Block, bereit zum Kopieren.",
  },

  share: (f) => [
    `\`/api/share/position\` zeichnet eine Karte für eine offene v3-Position, ein PNG von 1200 mal 630 Pixeln: das Paar mit Gebühr und Netzwerk, den Bereich der Position, die Gebühren über ihre ganze Laufzeit und ihr Ergebnis gegenüber dem bloßen Halten der Einlagen mit den zwei Teilen des Ergebnisses — die Zahlen, die die Positionsseite in der Rechnung unter dieser Position zeigt, in dem Token, in dem diese Seite den Pool notiert. Die Position wird mit \`id\`, ihrer Token-ID, benannt; \`chain\` und \`lang\` wie oben, weggelassen Ethereum und Englisch. Nur auf den Netzwerken, deren Positionen geführt werden (${f.positionChains}), wo sich eine Rechnung gegen die Chain prüfen lässt — und nur eine geprüfte Rechnung setzt eine Zahl auf die Karte: eine, die sich nicht prüfen ließ, ergibt eine schlichte Karte, die das sagt. Jede Positionsseite bietet die Links unter "${f.shareHeading}" an.`,
    `Die Karte selbst ist \`200\`. Eine Adresse, die keine Position nennt, ist \`400\`, eine ID, unter der die Chain keine offene Position hält, \`404\`, und eine Position, die sich gerade nicht lesen ließ, \`503\` — jeweils als JSON mit einem \`error\` von \`not-a-position\`, \`no-such-position\` oder \`unreadable\`, nie als Karte, auf der eine Zahl fehlt. Eine Karte wird ${f.keptSeconds} Sekunden behalten, wie die Pool-Karte, da ihre Rechnung zum heutigen Preis bewertet ist; und eine Anfrage, die eine wohlgeformte Position nennt, liest die Chain, zählt also gegen dieselben ${f.limit} Anfragen je ${f.windowSeconds} Sekunden wie die Pool-Seiten und ist darüber hinaus \`429\`. Die Karte nennt die öffentliche Token-ID der Position und nichts über den, der sie angefragt hat, und nichts wird gespeichert.`,
  ],
  shareLabel: "Die Karte für eine Position auf Ethereum, auf Englisch — eine Adresse, die sich so öffnen lässt, wie sie dasteht:",

  terms: (f) => [
    `Die Zahlen sind Messungen, keine Beratung. Der Bereich wird daraus berechnet, wie weit sich der Preis des Pools in den letzten ${f.measuredDays} Tagen bewegt hat: Er ist keine Prognose und keine Empfehlung, und jede Antwort sagt das selbst, die Karte auf ihrer Vorderseite, das JSON in \`disclaimer\`. Wie jede Zahl entsteht und was sie auslässt, steht unter „${f.methodLink}“.`,
    `Die Karte trägt ihren eigenen Link zurück, „${f.analysedBy}“. Das JSON hat kein Feld für eine Namensnennung, und nichts im Code verlangt eine; was es trägt, sind \`poolUrl\`, die Seite des Pools hier, und \`disclaimer\`. Neben den Zahlen gezeigt, sagen diese beiden einem Leser, woher die Zahlen kommen und was sie sind.`,
    "Es gibt keine Versionsnummer und keinen Schlüssel, und kein Versprechen, dass die Form der Antwort so bleibt oder dass die Website zu einem bestimmten Zeitpunkt erreichbar ist. Was gilt, ist enger: Eine Antwort wird vor dem Senden gegen ihr Schema geprüft, und Tests halten diese Seite an dieses Schema und an den Code, der die Adresse liest — sie beschreibt also, was jetzt ausgeliefert wird. Eine Änderung an einem von beiden zeigt sich in der öffentlichen Geschichte des Codes.",
    "Der Code ist Open Source, unter der MIT-Lizenz.",
  ],
  links: { code: "Der Code, auf GitHub", licence: "Die MIT-Lizenz" },
};

const es: DevelopersCopy = {
  link: "Desarrolladores",
  pointer: "La tarjeta y su JSON, documentados por completo",
  title: "Para desarrolladores",
  description:
    "La tarjeta de pool que se puede insertar y el JSON que hay detrás — sus direcciones, cada parámetro y cada campo, los códigos de estado, la caché, CORS y el límite de peticiones, con ejemplos — tal como el código los sirve.",
  heading: "La tarjeta de pool y su JSON",
  lead: "Dos cosas de este sitio están pensadas para otros sitios: una tarjeta con el rango sugerido de un pool, que cualquier página puede poner en un marco, y las mismas cifras en JSON, que el código de cualquier sitio puede leer. Ninguna de las dos necesita una clave ni una cuenta. Ambas se describen aquí tal como el código las sirve, y unas pruebas mantienen esta página fiel a ese código: cada parámetro que enumera es uno con el que se lee la dirección, y cada campo, uno contra el que se comprueba la respuesta antes de enviarla.",
  contentsHeading: "En esta página",
  sections: {
    card: "La tarjeta",
    parameters: "Parámetros",
    json: "El JSON",
    errors: "Códigos de estado y errores",
    caching: "Caché y límite de peticiones",
    examples: "Ejemplos",
    share: "La tarjeta para compartir",
    terms: "Condiciones, en palabras sencillas",
  },

  card: (f) => [
    `\`/embed/pool\` es una página pequeña escrita a mano, no por el framework del sitio. Muestra el par con su protocolo, su comisión y su red; el rango sugerido, con el horizonte y la amplitud para los que se trazó; el precio actual; una línea que dice que no es asesoramiento financiero; y un enlace de vuelta a la página del pool aquí, que se abre en una pestaña nueva. El rango se traza siempre con los valores predeterminados del sitio, ${f.defaultHorizon} días a ${f.defaultMultiplier}, sean cuales sean los ajustes de cada cual. Se añade una nota mientras el precio actual está fuera del rango, y otra para un pool v4 cuyo hook puede cambiar lo que cuesta un intercambio.`,
    "No lleva script ni formulario y no carga nada: su propia `Content-Security-Policy` no permite más que su estilo en línea. Sus colores son los del sitio, claros u oscuros según tenga configurado el sistema el lector. No puede ver la página que la rodea, y no hay ningún parámetro para elegirlo.",
    `Dele un marco de ${f.frameWidth} píxeles de ancho y ${f.frameHeight} de alto, o ${f.frameHeightHook} de alto para un pool cuyo hook puede cambiar lo que cuesta un intercambio, cuya tarjeta lleva esa línea más. Es exactamente lo que ofrece la página de cada pool bajo «${f.embedSummary}», con la altura ya adecuada para ese pool, y el marco que ofrece nunca crece más que la columna en la que se pega.`,
    "Es la única página de este sitio que otro sitio puede poner en un marco. Cualquier otra dirección, esta incluida, se sirve con `X-Frame-Options: DENY` y `frame-ancestors 'none'`; la tarjeta se sirve sin lo primero y con `frame-ancestors *`.",
  ],
  snippetLabel: "El marco para el pool USDC / WETH al 0,3 % en Ethereum, tal como lo ofrece la página de ese pool:",
  cardHeadersLabel: "Con qué se sirve una tarjeta con cifras, además de las cabeceras que lleva cada página:",

  parametersIntro: (f) => [
    "La tarjeta y el JSON aceptan los mismos parámetros y nombran un pool como lo hacen las propias páginas del sitio: un pool v3 por su `address`, como en `/pool`, y un pool v4 por su `id`, como en `/v4`. Hace falta exactamente uno de los dos, y el que llega dice de qué protocolo se trata. Un pool o una red nombrados dos veces se rechazan en lugar de elegir uno de sus valores, y cualquier parámetro que no figure aquí se ignora.",
    `El idioma sale solo de la dirección, nunca del navegador del lector ni de una cookie: lo elige el sitio que coloca la tarjeta, y la misma dirección es la misma respuesta para todos los que la cargan, que es lo que permite a una caché guardarla. La tarjeta está escrita en los ${f.languages} idiomas del sitio, y en árabe se lee de derecha a izquierda.`,
  ],
  parameters: (f) => ({
    address: {
      accepts: "La dirección del contrato de un pool v3: `0x` y 40 dígitos hexadecimales, en mayúsculas o minúsculas.",
      otherwise: `Cualquier otra cosa no nombra ningún pool, y tampoco un pool v3 en una red donde no se lee v3 (${f.v4OnlyChains}): \`400\`, y no se lee nada.`,
    },
    id: {
      accepts: "El id de un pool v4, el hash de su clave: `0x` y 64 dígitos hexadecimales, en mayúsculas o minúsculas.",
      otherwise: `Cualquier otra cosa no nombra ningún pool, y tampoco un pool v4 en una red donde no se lee v4 (${f.v3OnlyChains}): \`400\`, y no se lee nada. Tampoco un \`id\` junto a una \`address\`.`,
    },
    chain: {
      accepts: "El identificador corto de una red, de la tabla de abajo. Si falta, la red es Ethereum.",
      otherwise: "Un identificador que el sitio no lee se rechaza, nunca se lee como Ethereum: `400`.",
    },
    lang: {
      accepts:
        "Un código de idioma de la lista de abajo, para las palabras de la tarjeta y el `disclaimer` del JSON; las cifras son las mismas en todos los idiomas. Si falta, inglés.",
      otherwise: "Cualquier otro valor, o `lang` dos veces, da inglés. Nunca se rechaza.",
    },
  }),
  acceptsLabel: "Acepta",
  otherwiseLabel: "Si no",
  chainsCaption: "Las redes, por el identificador que acepta `chain`:",
  chainColumns: { network: "Red", v3: "pools v3", v4: "pools v4" },
  read: "se leen",
  notRead: "no se leen",
  languagesCaption: "Los idiomas, por el código que acepta `lang`:",

  json: () => [
    "`GET /api/embed/pool`, con los mismos parámetros, responde con las cifras de la tarjeta en JSON, para un sitio que prefiere dibujarlas por su cuenta: la misma lectura, guardada el mismo tiempo. Cada cifra es un número JSON, y cada precio va en el sentido en que lo escribe la página del pool: cuántos `price.quote` vale un `price.base`.",
    "Antes de enviarse, una respuesta se comprueba contra su esquema, y la que no lo cumple no se envía: el pool se responde como ilegible. Así que una respuesta con estado `200` tiene siempre exactamente los campos de abajo, ni más ni menos.",
    "El script de cualquier sitio puede leerla. Cada respuesta, errores y rechazos incluidos, se sirve con `Access-Control-Allow-Origin: *`. No deja cookies ni necesita credenciales. Un `GET` sencillo no necesita preflight, y no se responde a ninguno, así que envíelo sin cabeceras propias.",
  ],
  dataHeadersLabel: "Con qué se sirve una respuesta con cifras, además de las cabeceras que lleva cada página:",
  fieldsCaption: "Cada campo de una respuesta `200`, con su tipo JSON:",
  fields: (f) => ({
    protocol: "`v3` para un pool nombrado por `address`, `v4` para uno nombrado por `id`.",
    "chain.id": "El chain id de la red.",
    "chain.slug": "El identificador corto de la red, tal como lo acepta `chain`.",
    "chain.name": "El nombre de la red.",
    pool: "La dirección (v3) o el id (v4) del pool, en minúsculas.",
    "pair.token0":
      "El símbolo del primer token del pool, tal como lo declara su contrato: es texto de un contrato que cualquiera puede desplegar, así que escápelo antes de ponerlo en una página.",
    "pair.token1": "El símbolo del segundo token, igual.",
    lpFeePpm:
      "La comisión que el pool paga a los proveedores de liquidez en un intercambio, en millonésimas: `3000` es un 0,3 %. `null` cuando el hook de un pool v4 fija la comisión intercambio a intercambio.",
    "price.base": "El token por cada unidad del cual se da cada precio.",
    "price.quote": "El token en el que se cuenta cada precio.",
    "price.current": "El precio del pool cuando se leyó.",
    "range.lower": "El borde inferior del rango sugerido, como precio.",
    "range.upper": "Su borde superior.",
    "range.currentInRange": "Si el precio actual está dentro del rango. Si no lo está, la tarjeta añade una nota.",
    "range.lowerTruncated":
      "`true` cuando la cuadrícula de ticks del pool no llega hasta el borde inferior de la banda, así que el rango se queda antes.",
    "range.upperTruncated": "Lo mismo, para el borde superior.",
    "parameters.horizonDays": `El horizonte para el que se trazó el rango, en días: siempre el predeterminado, ${f.defaultHorizon}.`,
    "parameters.standardDeviationMultiplier": `La amplitud para la que se trazó, en desviaciones estándar: siempre la predeterminada, ${f.defaultMultiplier}.`,
    hookMayAlterSwaps:
      "`true` para un pool v4 cuyo hook puede cambiar lo que cuesta un intercambio, leído de la dirección del hook; `false` para v3, para un pool v4 sin hook y para un hook cuyos permisos no tocan los intercambios. Donde es `true`, la tarjeta lleva una nota.",
    analysedAt: "Cuándo se leyó el precio, en UTC y al milisegundo; no cuándo se envió esta respuesta, que puede ser minutos después.",
    poolUrl: "La página del pool en este sitio, con el mismo horizonte y la misma amplitud.",
    disclaimer: "Qué son las cifras y qué no, en el idioma que indica `lang`.",
  }),
  exampleCaption:
    "Una respuesta para el pool de los ejemplos. Sus cifras son un ejemplo: las calcula el propio código del sitio a partir de un mes de precios de muestra, no se leen del pool, y una prueba comprueba que el código sigue respondiendo exactamente esto para ese mes:",

  errors: () => [
    "La tarjeta y el JSON responden con los mismos códigos de estado. Ninguno responde nunca con la página de error del propio sitio ni con lo que falló por dentro: la tarjeta muestra una frase y su enlace de vuelta, y el JSON responde con un `error` que un script puede comprobar y con `disclaimer`, salvo un rechazo, que lleva en su lugar la espera.",
  ],
  statuses: (f) => ({
    figures: "Las cifras: una tarjeta con ellas, o el JSON de arriba.",
    "not-a-pool": `La dirección no nombra ningún pool que el sitio lea: ni \`address\` ni \`id\`, o los dos, o uno mal formado o repetido, una red que el sitio no lee, un pool v3 donde solo se lee v4 (${f.v4OnlyChains}) o un pool v4 donde solo se lee v3 (${f.v3OnlyChains}). No se leyó nada, y volver a preguntar no cambiará la respuesta.`,
    unreadable:
      "Un pool bien nombrado que no se pudo leer ahora mismo: una fuente no respondió a tiempo, o no existe ese pool en esa red. `poolUrl` sigue llevando a su página. Preguntar de nuevo en un minuto puede encontrarlo.",
    "rate-limited":
      "Demasiadas peticiones de un mismo cliente: vea el límite más abajo. `Retry-After` y `retryAfterSeconds` dicen los dos cuántos segundos esperar. La tarjeta responde con una página corta que lo dice, en su propio idioma.",
  }),
  bodyLabel: "La respuesta del JSON, con cuánto tiempo se puede guardar:",

  caching: (f) => [
    `Cada respuesta dice cuánto tiempo se puede guardar, tanto en un navegador como en una caché compartida: ${f.keptSeconds} segundos las cifras; ${f.unreadableSeconds} segundos un pool que no se pudo leer, para que uno que vuelve no se muestre como ilegible durante mucho tiempo; ${f.notAPoolSeconds} segundos una dirección que no nombra ningún pool, cosa que ningún momento posterior cambiará. Un rechazo no se guarda nunca. Cada respuesta es la misma para todos los que preguntan con la misma dirección, y eso es lo que hace seguro guardarla.`,
    `Detrás de eso, el servidor guarda las cifras de cada pool ${f.keptSeconds} segundos desde el momento en que las leyó, igual para la tarjeta que para el JSON y en todos los idiomas: cada tarjeta de un pool, en cada página donde esté, es una sola lectura hasta que caduca. Un pool que no se pudo leer no se guarda, y se vuelve a preguntar en la siguiente petición. Así que el precio de una respuesta puede ser más antiguo que la respuesta: \`analysedAt\` dice cuándo se leyó.`,
    `Una petición que nombra un pool bien formado lee ese pool, así que cuenta contra la misma asignación que las páginas de pools del propio sitio: ${f.limit} peticiones por cliente en una ventana de ${f.windowSeconds} segundos que empieza con la primera petición del cliente, siendo el cliente la dirección IP desde la que la petición llega al sitio. Pasado ese límite, la respuesta es \`429\`, con \`Retry-After\`. Cuenta cada petición así que llega al sitio, incluida la que se responde con lo que guarda el servidor; una petición que no nombra ningún pool no cuenta.`,
    `Desde un navegador, una tarjeta o un \`fetch\` cuenta contra el lector que lo carga, no contra el sitio donde está, así que en una página con más de ${f.limit} tarjetas las que pasan de ese número se rechazan para cada lector. Desde un servidor, todas sus peticiones comparten la única asignación de ese servidor: guarde cada respuesta los ${f.keptSeconds} segundos que permite, lo que cuesta poco, porque durante la mayor parte de ese tiempo el servidor respondería con la lectura que usted ya tiene. El límite existe para que leer pools cueste poco, y nada aquí promete que vaya a seguir igual.`,
  ],

  examples: {
    curl: "Las cifras, desde una terminal:",
    fetch: "Desde el propio script de una página, o desde un servidor, con cada respuesta tratada:",
    iframe: "La tarjeta, en una página:",
    selectHint: "Un clic selecciona todo un bloque, listo para copiar.",
  },

  share: (f) => [
    `\`/api/share/position\` dibuja una tarjeta para una posición v3 abierta, un PNG de 1200 por 630 píxeles: el par con su comisión y su red, el rango de la posición, las comisiones ganadas en toda su vida y su resultado frente a simplemente mantener lo depositado, con las dos partes del resultado: las cifras que la página de posiciones muestra en el cálculo bajo esa posición, en el token en que esa página cotiza el pool. La posición se nombra con \`id\`, el id de su token; \`chain\` y \`lang\` como arriba, y si se omiten, Ethereum e inglés. Solo en las redes cuyas posiciones se conservan (${f.positionChains}), donde un cálculo puede comprobarse contra la cadena, y solo un cálculo comprobado pone una cifra en la tarjeta: uno que no pudo comprobarse da una tarjeta lisa que lo dice. Cada página de posiciones ofrece los enlaces bajo "${f.shareHeading}".`,
    `La tarjeta en sí es \`200\`. Una dirección que no nombra ninguna posición es \`400\`, un id bajo el que la cadena no tiene ninguna posición abierta es \`404\`, y una posición que no pudo leerse ahora mismo es \`503\`: cada uno como JSON con un \`error\` de \`not-a-position\`, \`no-such-position\` o \`unreadable\`, nunca una tarjeta a la que le falte una cifra. Una tarjeta se conserva ${f.keptSeconds} segundos, como la tarjeta del pool, porque su cálculo se valora al precio de hoy; y una petición que nombra una posición bien formada lee la cadena, así que cuenta contra las mismas ${f.limit} peticiones por ${f.windowSeconds} segundos que las páginas de pools, y más allá es \`429\`. La tarjeta nombra el id público del token de la posición y nada sobre quién la pidió, y no se guarda nada.`,
  ],
  shareLabel: "La tarjeta de una posición en Ethereum, en inglés: una dirección que puede abrirse tal cual:",

  terms: (f) => [
    `Las cifras son mediciones, no asesoramiento. El rango se calcula a partir de cuánto se movió el precio del pool en los últimos ${f.measuredDays} días: no es una previsión ni una recomendación, y cada respuesta lo dice por sí misma, la tarjeta a la vista y el JSON en \`disclaimer\`. Cómo se obtiene cada cifra, y qué deja fuera cada una, está en «${f.methodLink}».`,
    `La tarjeta lleva su propio enlace de vuelta, «${f.analysedBy}». El JSON no tiene ningún campo de atribución, y nada en el código la pide; lo que lleva es \`poolUrl\`, la página del pool aquí, y \`disclaimer\`. Mostrados junto a las cifras, esos dos le dicen al lector de dónde salen y qué son.`,
    "No hay número de versión ni clave, ni ninguna promesa de que la forma de la respuesta siga como está o de que el sitio esté disponible en un momento dado. Lo que se cumple es más estrecho: una respuesta se comprueba contra su esquema antes de enviarse, y unas pruebas mantienen esta página fiel a ese esquema y al código que lee la dirección, así que describe lo que se sirve ahora. Un cambio en cualquiera de los dos queda a la vista en el historial público del código.",
    "El código es abierto, bajo la licencia MIT.",
  ],
  links: { code: "El código, en GitHub", licence: "La licencia MIT" },
};

const ar: DevelopersCopy = {
  link: "للمطوّرين",
  pointer: "البطاقة وJSON الخاص بها، موثّقان بالكامل",
  title: "للمطوّرين",
  description:
    "بطاقة التجمّع القابلة للتضمين وJSON الذي يقف خلفها — عناوينهما، وكل مُعامِل وكل حقل، ورموز الحالة، والتخزين المؤقت، وCORS، وحدّ الطلبات، مع أمثلة — كما تقدّمها الشيفرة تمامًا.",
  heading: "بطاقة التجمّع وJSON الخاص بها",
  lead: "في هذا الموقع شيئان معدّان لمواقع أخرى: بطاقة تعرض النطاق المقترح لتجمّع واحد، يجوز لأي صفحة أن تضعها في إطار، والأرقام نفسها بصيغة JSON، يجوز لشيفرة أي موقع أن تقرأها. لا يحتاج أيّ منهما إلى مفتاح أو حساب. كلاهما موصوف هنا كما تقدّمه الشيفرة، وتُلزم الاختباراتُ هذه الصفحةَ بتلك الشيفرة: كل مُعامِل تذكره هو مُعامِل يُقرأ به العنوان فعلًا، وكل حقل هو حقل تُطابَق عليه الإجابة قبل إرسالها.",
  contentsHeading: "في هذه الصفحة",
  sections: {
    card: "البطاقة",
    parameters: "المُعامِلات",
    json: "صيغة JSON",
    errors: "رموز الحالة والأخطاء",
    caching: "التخزين المؤقت وحدّ الطلبات",
    examples: "أمثلة",
    share: "بطاقة المشاركة",
    terms: "الشروط بكلمات بسيطة",
  },

  card: (f) => [
    `\`/embed/pool\` صفحة صغيرة مكتوبة يدويًا، لا بإطار عمل الموقع. تعرض الزوج مع بروتوكوله ورسومه وشبكته؛ والنطاق المقترح مع الأفق والاتساع اللذين رُسم لهما؛ والسعر الحالي؛ وسطرًا يقول إنها ليست نصيحة مالية؛ ورابطًا يعود إلى صفحة التجمّع هنا، يفتح في علامة تبويب جديدة. يُرسم النطاق دائمًا بالقيم الافتراضية للموقع، ${f.defaultHorizon} يومًا عند ${f.defaultMultiplier}، أيًّا كانت إعدادات أي شخص. وتُضاف ملاحظة ما دام السعر الحالي خارج النطاق، وأخرى لتجمّع v4 قد يغيّر خطّافه تكلفة التبادل.`,
    "لا تحتوي على أي برنامج نصي ولا استمارة، ولا تحمّل شيئًا: سياسة `Content-Security-Policy` الخاصة بها لا تسمح بشيء سوى أسلوبها المضمّن. ألوانها ألوان الموقع، فاتحة أو داكنة بحسب إعداد نظام القارئ. لا ترى الصفحة المحيطة بها، ولا يوجد مُعامِل لاختيار ذلك.",
    `أعطها إطارًا بعرض ${f.frameWidth} بكسل وارتفاع ${f.frameHeight}، أو بارتفاع ${f.frameHeightHook} لتجمّع قد يغيّر خطّافه تكلفة التبادل، إذ تحمل بطاقته سطرًا إضافيًا. هذا بالضبط ما تعرضه صفحة كل تجمّع تحت «${f.embedSummary}»، بالارتفاع المناسب لذلك التجمّع مسبقًا، ولا يصبح الإطار المعروض أعرض من العمود الذي يُلصق فيه أبدًا.`,
    "إنها الصفحة الوحيدة في هذا الموقع التي يجوز لموقع آخر أن يضعها في إطار. كل عنوان آخر، ومنه هذا العنوان، يُرسل مع `X-Frame-Options: DENY` و`frame-ancestors 'none'`؛ أما البطاقة فتُرسل من دون الأول ومع `frame-ancestors *`.",
  ],
  snippetLabel: "الإطار الخاص بتجمّع USDC / WETH بنسبة 0.3% على Ethereum، كما تعرضه صفحة ذلك التجمّع:",
  cardHeadersLabel: "ما تُرسل معه البطاقة التي تحمل أرقامًا، إلى جانب الترويسات التي تحملها كل صفحة:",

  parametersIntro: (f) => [
    "تأخذ البطاقة وJSON المُعامِلات نفسها، وتسمّيان التجمّع كما تسمّيه صفحات الموقع نفسه: تجمّع v3 بعنوانه `address` كما في `/pool`، وتجمّع v4 بمعرّفه `id` كما في `/v4`. يلزم واحد منهما بالضبط، وأيّهما وصل يحدّد البروتوكول. التجمّع أو الشبكة المذكوران مرتين يُرفضان بدل أن تُختار إحدى القيمتين، وأي مُعامِل غير مذكور هنا يُتجاهَل.",
    `تأتي اللغة من العنوان وحده، لا من متصفح القارئ ولا من ملف تعريف ارتباط أبدًا: الموقع الذي يضع البطاقة هو من يختارها، والعنوان نفسه هو الإجابة نفسها لكل من يحمّله، وهذا ما يتيح للتخزين المؤقت الاحتفاظ بها. البطاقة مكتوبة بلغات الموقع الـ${f.languages} كلها، وبالعربية تُقرأ من اليمين إلى اليسار.`,
  ],
  parameters: (f) => ({
    address: {
      accepts: "عنوان عقد تجمّع v3: `0x` ثم 40 رقمًا ست عشريًا، بأحرف كبيرة أو صغيرة.",
      otherwise: `أي شيء آخر لا يسمّي تجمّعًا، وكذلك تجمّع v3 على شبكة لا يُقرأ فيها v3 (${f.v4OnlyChains}): \`400\`، ولا يُقرأ شيء.`,
    },
    id: {
      accepts: "معرّف تجمّع v4، أي تجزئة مفتاحه: `0x` ثم 64 رقمًا ست عشريًا، بأحرف كبيرة أو صغيرة.",
      otherwise: `أي شيء آخر لا يسمّي تجمّعًا، وكذلك تجمّع v4 على شبكة لا يُقرأ فيها v4 (${f.v3OnlyChains}): \`400\`، ولا يُقرأ شيء. وكذلك \`id\` إلى جانب \`address\`.`,
    },
    chain: {
      accepts: "الاسم المختصر لشبكة من الجدول أدناه. إن غاب، فالشبكة هي Ethereum.",
      otherwise: "الاسم الذي لا يقرأ الموقع شبكته يُرفض، ولا يُقرأ على أنه Ethereum أبدًا: `400`.",
    },
    lang: {
      accepts:
        "رمز لغة من القائمة أدناه، لكلمات البطاقة ولحقل `disclaimer` في JSON؛ والأرقام واحدة في كل اللغات. إن غاب، فالإنجليزية.",
      otherwise: "أي قيمة أخرى، أو `lang` مذكورًا مرتين، يعطي الإنجليزية. لا يُرفض أبدًا.",
    },
  }),
  acceptsLabel: "يقبل",
  otherwiseLabel: "وإلا",
  chainsCaption: "الشبكات، بالاسم المختصر الذي يأخذه `chain`:",
  chainColumns: { network: "الشبكة", v3: "تجمّعات v3", v4: "تجمّعات v4" },
  read: "تُقرأ",
  notRead: "لا تُقرأ",
  languagesCaption: "اللغات، بالرمز الذي يأخذه `lang`:",

  json: () => [
    "يجيب `GET /api/embed/pool`، بالمُعامِلات نفسها، بأرقام البطاقة بصيغة JSON، لموقع يفضّل أن يرسمها بنفسه: القراءة نفسها، محفوظة المدة نفسها. كل رقم فيها رقم JSON، وكل سعر مكتوب بالاتجاه الذي تكتبه به صفحة التجمّع: كم `price.quote` يساوي `price.base` واحد.",
    "قبل إرسال الإجابة تُطابَق على مخططها، والإجابة التي لا تطابقه لا تُرسل: يُجاب عن التجمّع بدلًا من ذلك بأنه تعذّرت قراءته. لذلك تحمل الإجابة ذات الحالة `200` دائمًا الحقول أدناه بالضبط، لا أكثر ولا أقل.",
    "يجوز لبرنامج أي موقع أن يقرأها. كل إجابة، ومنها الأخطاء والرفض، تُرسل مع `Access-Control-Allow-Origin: *`. لا تضع ملف تعريف ارتباط ولا تحتاج إلى بيانات اعتماد. طلب `GET` بسيط لا يحتاج إلى فحص مسبق (preflight)، ولا يُجاب عن أي فحص مسبق، فأرسله من دون ترويسات خاصة بك.",
  ],
  dataHeadersLabel: "ما تُرسل معه الإجابة التي تحمل أرقامًا، إلى جانب الترويسات التي تحملها كل صفحة:",
  fieldsCaption: "كل حقل في إجابة `200`، مع نوعه في JSON:",
  fields: (f) => ({
    protocol: "`v3` لتجمّع سُمّي بـ`address`، و`v4` لتجمّع سُمّي بـ`id`.",
    "chain.id": "معرّف السلسلة (chain id) للشبكة.",
    "chain.slug": "الاسم المختصر للشبكة، كما يأخذه `chain`.",
    "chain.name": "اسم الشبكة.",
    pool: "عنوان التجمّع (v3) أو معرّفه (v4)، بأحرف صغيرة.",
    "pair.token0":
      "اسم الرمز الأول في التجمّع كما يعلنه عقده: نصٌّ من عقد يستطيع أي أحد نشره، فاحرص على تهريبه (escape) قبل أن تضعه في صفحة.",
    "pair.token1": "اسم الرمز الثاني، بالطريقة نفسها.",
    lpFeePpm:
      "الرسوم التي يدفعها التجمّع لمزوّدي السيولة عن كل تبادل، بأجزاء من المليون: `3000` تعني 0.3%. وتكون `null` حين يحدّد خطّاف تجمّع v4 الرسوم تبادلًا بتبادل.",
    "price.base": "الرمز الذي يُعطى كل سعر لوحدة واحدة منه.",
    "price.quote": "الرمز الذي يُحسب به كل سعر.",
    "price.current": "سعر التجمّع لحظة قراءته.",
    "range.lower": "الحد الأدنى للنطاق المقترح، كسعر.",
    "range.upper": "حدّه الأعلى.",
    "range.currentInRange": "هل السعر الحالي داخل النطاق. إن لم يكن، تضيف البطاقة ملاحظة.",
    "range.lowerTruncated":
      "`true` حين لا تبلغ شبكة الـ tick في التجمّع الحدَّ الأدنى للحزمة، فيتوقف النطاق قبله.",
    "range.upperTruncated": "الشيء نفسه، للحد الأعلى.",
    "parameters.horizonDays": `الأفق الذي رُسم له النطاق، بالأيام: دائمًا القيمة الافتراضية، ${f.defaultHorizon}.`,
    "parameters.standardDeviationMultiplier": `الاتساع الذي رُسم له، بالانحرافات المعيارية: دائمًا القيمة الافتراضية، ${f.defaultMultiplier}.`,
    hookMayAlterSwaps:
      "`true` لتجمّع v4 قد يغيّر خطّافه تكلفة التبادل، مقروءًا من عنوان الخطّاف؛ و`false` لـ v3، ولتجمّع v4 بلا خطّاف، ولخطّاف لا تمسّ أذوناته التبادل. وحيث تكون `true` تحمل البطاقة ملاحظة.",
    analysedAt: "متى قُرئ السعر، بتوقيت UTC وحتى الجزء من الألف من الثانية — لا متى أُرسلت هذه الإجابة، وقد يكون ذلك بعد دقائق.",
    poolUrl: "صفحة التجمّع على هذا الموقع، بالأفق والاتساع نفسيهما.",
    disclaimer: "ما هي الأرقام وما ليست هي، باللغة التي يحدّدها `lang`.",
  }),
  exampleCaption:
    "إجابة للتجمّع الوارد في الأمثلة. أرقامها مثال: حسبتها شيفرة الموقع نفسها من شهر نموذجي من الأسعار، لا من قراءة التجمّع، ويتحقق اختبار من أن الشيفرة ما زالت تجيب بهذا بالضبط لذلك الشهر:",

  errors: () => [
    "تجيب البطاقة وJSON برموز الحالة نفسها. ولا يجيب أيّ منهما أبدًا بصفحة الخطأ الخاصة بالموقع أو بما تعطّل في الداخل: تعرض البطاقة جملة واحدة ورابطها للعودة، ويجيب JSON بحقل `error` يستطيع البرنامج فحصه، ومعه `disclaimer` — عدا الرفض، الذي يحمل مدة الانتظار بدلًا منه.",
  ],
  statuses: (f) => ({
    figures: "الأرقام: بطاقة تحملها، أو JSON الموصوف أعلاه.",
    "not-a-pool": `العنوان لا يسمّي تجمّعًا يقرؤه الموقع: لا \`address\` ولا \`id\`، أو كلاهما، أو أحدهما مشوّه أو مكرّر، أو شبكة لا يقرؤها الموقع، أو تجمّع v3 حيث لا يُقرأ إلا v4 (${f.v4OnlyChains})، أو تجمّع v4 حيث لا يُقرأ إلا v3 (${f.v3OnlyChains}). لم يُقرأ شيء، وإعادة السؤال لن تغيّر الإجابة.`,
    unreadable:
      "تجمّع سُمّي تسمية صحيحة وتعذّرت قراءته الآن: مصدرٌ لم يُجب في الوقت المحدد، أو لا يوجد تجمّع كهذا على تلك الشبكة. يبقى `poolUrl` موصلًا إلى صفحته. وقد تجده إعادة السؤال بعد دقيقة.",
    "rate-limited":
      "طلبات كثيرة جدًا من عميل واحد: انظر حدّ الطلبات أدناه. يقول كلٌّ من `Retry-After` و`retryAfterSeconds` كم ثانية يجب الانتظار. وتجيب البطاقة بصفحة قصيرة تقول ذلك، بلغتها.",
  }),
  bodyLabel: "إجابة JSON، ومدة جواز الاحتفاظ بها:",

  caching: (f) => [
    `تقول كل إجابة كم يجوز الاحتفاظ بها، للمتصفح وللتخزين المؤقت المشترك على السواء: ${f.keptSeconds} ثانية للأرقام؛ و${f.unreadableSeconds} ثانية لتجمّع تعذّرت قراءته، كي لا يظهر تجمّع عاد للعمل متعذّرًا طويلًا؛ و${f.notAPoolSeconds} ثانية لعنوان لا يسمّي تجمّعًا، فلن تغيّر ذلك أي لحظة لاحقة. أما الرفض فلا يُحتفظ به أبدًا. وكل إجابة واحدة لكل من يسأل بالعنوان نفسه، وهذا ما يجعل الاحتفاظ بها آمنًا.`,
    `ووراء ذلك يحتفظ الخادم بأرقام كل تجمّع ${f.keptSeconds} ثانية من لحظة قراءتها، للبطاقة ولـ JSON على السواء وبكل اللغات: كل بطاقة لتجمّع واحد، في كل صفحة توضع فيها، هي قراءة واحدة حتى تنتهي مدتها. والتجمّع الذي تعذّرت قراءته لا يُحتفظ به، ويُسأل عنه من جديد في الطلب التالي. لذلك قد يكون السعر في الإجابة أقدم من الإجابة نفسها: يقول \`analysedAt\` متى قُرئ.`,
    `الطلب الذي يسمّي تجمّعًا صحيح الصيغة يقرأ ذلك التجمّع، ولذلك يُحسب من الحصة نفسها التي تُحسب منها صفحات التجمّعات في الموقع: ${f.limit} طلبات لكل عميل في نافذة مدتها ${f.windowSeconds} ثانية تبدأ مع أول طلب للعميل، والعميل هو عنوان IP الذي يصل منه الطلب إلى الموقع. وبعد تجاوز الحد تكون الإجابة \`429\` مع \`Retry-After\`. ويُحسب كل طلب كهذا يصل إلى الموقع، ومنه ما يُجاب عنه مما يحتفظ به الخادم؛ أما الطلب الذي لا يسمّي تجمّعًا فلا يُحسب.`,
    `من المتصفح، تُحسب البطاقة أو \`fetch\` على القارئ الذي يحمّلها، لا على الموقع الذي توضع فيه — فالصفحة التي تضع أكثر من ${f.limit} بطاقات تُرفض فيها البطاقات الزائدة لكل قارئ. ومن الخادم، تتقاسم كل طلباتك حصة ذلك الخادم الواحدة: احتفظ بكل إجابة طوال الـ${f.keptSeconds} ثانية التي تسمح بها، وهذا لا يكلّف كثيرًا، لأن الخادم كان سيجيب في معظم تلك المدة بالقراءة التي لديك أصلًا. وُضع الحد لإبقاء كلفة قراءة التجمّعات منخفضة، ولا شيء هنا يَعِد بأنه سيبقى كما هو.`,
  ],

  examples: {
    curl: "الأرقام، من الطرفية:",
    fetch: "من برنامج الصفحة نفسها، أو من خادم، مع معالجة كل إجابة:",
    iframe: "البطاقة، في صفحة:",
    selectHint: "نقرة واحدة تحدّد الكتلة كلها، جاهزة للنسخ.",
  },

  share: (f) => [
    `يرسم \`/api/share/position\` بطاقة لمركز v3 مفتوح واحد، صورة PNG بعرض 1200 بكسل وارتفاع 630: الزوج مع رسومه وشبكته، ونطاق المركز، والرسوم التي كسبها طوال عمره، ونتيجته مقابل الاحتفاظ بالمودَع ببساطة مع جزأي النتيجة — وهي الأرقام التي تعرضها صفحة المراكز في الحساب تحت ذلك المركز، بالرمز الذي تسعّر به تلك الصفحة التجمّع. يُسمّى المركز بـ \`id\`، أي معرّف رمزه؛ و\`chain\` و\`lang\` كما في الأعلى، وإن أُغفلا فإيثيريوم والإنجليزية. على الشبكات التي تُحفظ مراكزها فقط (${f.positionChains})، حيث يمكن التحقق من الحساب مقابل السلسلة، ولا يضع رقمًا على البطاقة إلا حساب تم التحقق منه: أما الذي تعذّر التحقق منه فيعطي بطاقة بسيطة تقول ذلك. وتعرض كل صفحة مراكز الروابط تحت "${f.shareHeading}".`,
    `البطاقة نفسها \`200\`. والعنوان الذي لا يسمّي مركزًا \`400\`، والمعرّف الذي لا تحمل السلسلة تحته مركزًا مفتوحًا \`404\`، والمركز الذي تعذّرت قراءته الآن \`503\` — كل منها بصيغة JSON مع \`error\` قيمته \`not-a-position\` أو \`no-such-position\` أو \`unreadable\`، ولا تكون أبدًا بطاقة ينقصها رقم. تُحفظ البطاقة ${f.keptSeconds} ثانية، كبطاقة التجمّع، لأن حسابها مقوّم بسعر اليوم؛ والطلب الذي يسمّي مركزًا صحيح الصيغة يقرأ السلسلة، فيُحتسب من الحصة نفسها التي تُحتسب منها صفحات التجمّعات: ${f.limit} طلبات في كل ${f.windowSeconds} ثانية، وما زاد عليها فـ \`429\`. تذكر البطاقة معرّف رمز المركز العام ولا شيء عمّن طلبها، ولا يُحفظ شيء.`,
  ],
  shareLabel: "بطاقة مركز واحد على إيثيريوم، بالإنجليزية — عنوان يمكن فتحه كما هو:",

  terms: (f) => [
    `الأرقام قياسات، لا نصيحة. يُحسب النطاق من مقدار تحرّك سعر التجمّع خلال آخر ${f.measuredDays} يومًا: ليس تنبؤًا وليس توصية، وكل إجابة تقول ذلك بنفسها، البطاقة على واجهتها وJSON في \`disclaimer\`. وكيف يُحسب كل رقم وما الذي يتركه خارجه، تجده في صفحة «${f.methodLink}».`,
    `تحمل البطاقة رابطها الخاص للعودة، «${f.analysedBy}». أما JSON فليس فيه حقل لنسبة المصدر، ولا شيء في الشيفرة يطلب ذلك؛ ما يحمله هو \`poolUrl\`، صفحة التجمّع هنا، و\`disclaimer\`. وإذا عُرض هذان بجانب الأرقام، أخبرا القارئ من أين جاءت وما هي.`,
    "لا يوجد رقم إصدار ولا مفتاح، ولا وعد بأن يبقى شكل الإجابة كما هو أو بأن يكون الموقع متاحًا في أي لحظة. ما يصحّ أضيق من ذلك: تُطابَق الإجابة على مخططها قبل إرسالها، وتُلزم الاختبارات هذه الصفحة بذلك المخطط وبالشيفرة التي تقرأ العنوان، فهي تصف ما يُقدَّم الآن. وأي تغيير في أيٍّ منهما يظهر في التاريخ العلني للشيفرة.",
    "الشيفرة مفتوحة المصدر، بموجب رخصة MIT.",
  ],
  links: { code: "الشيفرة على GitHub", licence: "رخصة MIT" },
};

const hi: DevelopersCopy = {
  link: "डेवलपर्स",
  pointer: "कार्ड और उसका JSON, पूरे विवरण के साथ",
  title: "डेवलपर्स के लिए",
  description:
    "दूसरी साइटों में लगाया जा सकने वाला पूल कार्ड और उसके पीछे का JSON — उनके पते, हर पैरामीटर और हर फ़ील्ड, स्टेटस कोड, कैशिंग, CORS और अनुरोध सीमा, उदाहरणों के साथ — ठीक वैसे जैसे कोड उन्हें देता है।",
  heading: "पूल कार्ड और उसका JSON",
  lead: "इस साइट की दो चीज़ें दूसरी साइटों के लिए बनी हैं: एक पूल का सुझाया गया दायरा दिखाने वाला कार्ड, जिसे कोई भी पृष्ठ एक फ़्रेम में रख सकता है, और वही आँकड़े JSON में, जिन्हें किसी भी साइट का कोड पढ़ सकता है। दोनों में से किसी के लिए कुंजी या खाते की ज़रूरत नहीं। दोनों का वर्णन यहाँ वैसा ही है जैसा कोड उन्हें देता है, और टेस्ट इस पृष्ठ को उसी कोड से बाँधे रखते हैं: इसमें लिखा हर पैरामीटर वही है जिससे पता पढ़ा जाता है, और हर फ़ील्ड वही है जिससे जवाब भेजे जाने से पहले मिलाया जाता है।",
  contentsHeading: "इस पृष्ठ पर",
  sections: {
    card: "कार्ड",
    parameters: "पैरामीटर",
    json: "JSON",
    errors: "स्टेटस कोड और त्रुटियाँ",
    caching: "कैशिंग और अनुरोध सीमा",
    examples: "उदाहरण",
    share: "साझा करने का कार्ड",
    terms: "शर्तें, सादे शब्दों में",
  },

  card: (f) => [
    `\`/embed/pool\` एक छोटा पृष्ठ है जो साइट के फ़्रेमवर्क से नहीं, हाथ से लिखा गया है। इस पर जोड़ी अपने प्रोटोकॉल, शुल्क और नेटवर्क के साथ दिखती है; सुझाया गया दायरा, उस अवधि और चौड़ाई के साथ जिसके लिए वह बना; मौजूदा कीमत; एक पंक्ति कि यह वित्तीय सलाह नहीं है; और यहाँ पूल के पृष्ठ पर लौटने वाला लिंक, जो नए टैब में खुलता है। दायरा हमेशा साइट की डिफ़ॉल्ट सेटिंग से बनता है, ${f.defaultHorizon} दिन और ${f.defaultMultiplier}, चाहे किसी की अपनी सेटिंग कुछ भी हो। जब तक मौजूदा कीमत दायरे से बाहर है, एक नोट जुड़ता है, और एक और नोट उस v4 पूल के लिए जिसका hook स्वैप की लागत बदल सकता है।`,
    "इसमें न कोई स्क्रिप्ट है, न कोई फ़ॉर्म, और यह कुछ भी लोड नहीं करता: इसकी अपनी `Content-Security-Policy` इसकी इनलाइन स्टाइल के सिवा किसी चीज़ की अनुमति नहीं देती। इसके रंग साइट के हैं, हल्के या गहरे, जैसा पाठक का सिस्टम सेट है। यह अपने आसपास का पृष्ठ नहीं देख सकता, और इसे चुनने का कोई पैरामीटर नहीं है।",
    `इसे ${f.frameWidth} पिक्सेल चौड़ा और ${f.frameHeight} पिक्सेल ऊँचा फ़्रेम दें, या ऐसे पूल के लिए ${f.frameHeightHook} पिक्सेल ऊँचा जिसका hook स्वैप की लागत बदल सकता है, क्योंकि उसके कार्ड में एक पंक्ति ज़्यादा होती है। हर पूल का पृष्ठ "${f.embedSummary}" के नीचे ठीक यही देता है, उस पूल के लिए सही ऊँचाई के साथ, और दिया गया फ़्रेम उस कॉलम से कभी चौड़ा नहीं होता जिसमें उसे चिपकाया जाए।`,
    "यह इस साइट का अकेला पृष्ठ है जिसे कोई दूसरी साइट फ़्रेम में रख सकती है। हर दूसरा पता, यह पृष्ठ भी, `X-Frame-Options: DENY` और `frame-ancestors 'none'` के साथ भेजा जाता है; कार्ड पहले वाले के बिना और `frame-ancestors *` के साथ भेजा जाता है।",
  ],
  snippetLabel: "Ethereum पर 0.3% वाले USDC / WETH पूल का फ़्रेम, जैसा उस पूल का पृष्ठ उसे देता है:",
  cardHeadersLabel: "आँकड़ों वाला कार्ड किन हेडरों के साथ भेजा जाता है, उन हेडरों के अलावा जो हर पृष्ठ पर होते हैं:",

  parametersIntro: (f) => [
    "कार्ड और JSON एक जैसे पैरामीटर लेते हैं, और पूल का नाम वैसे ही लेते हैं जैसे साइट के अपने पृष्ठ: v3 पूल उसके `address` से, जैसे `/pool` पर, और v4 पूल उसके `id` से, जैसे `/v4` पर। दोनों में से ठीक एक चाहिए, और कौन-सा आया, यही बताता है कि प्रोटोकॉल कौन-सा है। दो बार दिया गया पूल या नेटवर्क अस्वीकार होता है, उसके किसी एक मान को चुना नहीं जाता, और यहाँ न लिखा कोई भी पैरामीटर अनदेखा किया जाता है।",
    `भाषा केवल पते से आती है, पाठक के ब्राउज़र या किसी कुकी से कभी नहीं: कार्ड लगाने वाली साइट उसे चुनती है, और एक ही पता उसे लोड करने वाले हर व्यक्ति के लिए एक ही जवाब है, इसी से कैश उसे रख पाता है। कार्ड साइट की सभी ${f.languages} भाषाओं में लिखा है, और अरबी में दाएँ से बाएँ पढ़ा जाता है।`,
  ],
  parameters: (f) => ({
    address: {
      accepts: "v3 पूल के कॉन्ट्रैक्ट का पता: `0x` और 40 हेक्साडेसिमल अंक, बड़े या छोटे अक्षरों में।",
      otherwise: `इसके अलावा कुछ भी किसी पूल का नाम नहीं लेता, और न ही ऐसे नेटवर्क पर v3 पूल जहाँ v3 नहीं पढ़ा जाता (${f.v4OnlyChains}): \`400\`, और कुछ नहीं पढ़ा जाता।`,
    },
    id: {
      accepts: "v4 पूल का id, उसकी कुंजी का हैश: `0x` और 64 हेक्साडेसिमल अंक, बड़े या छोटे अक्षरों में।",
      otherwise: `इसके अलावा कुछ भी किसी पूल का नाम नहीं लेता, और न ही ऐसे नेटवर्क पर v4 पूल जहाँ v4 नहीं पढ़ा जाता (${f.v3OnlyChains}): \`400\`, और कुछ नहीं पढ़ा जाता। \`address\` के साथ दिया गया \`id\` भी नहीं।`,
    },
    chain: {
      accepts: "नीचे की तालिका से किसी नेटवर्क का छोटा नाम। न दिया जाए, तो नेटवर्क Ethereum है।",
      otherwise: "ऐसा नाम जिसे साइट नहीं पढ़ती, अस्वीकार होता है, कभी Ethereum नहीं माना जाता: `400`।",
    },
    lang: {
      accepts:
        "नीचे की सूची से एक भाषा कोड, कार्ड के शब्दों और JSON के `disclaimer` के लिए; आँकड़े हर भाषा में एक ही हैं। न दिया जाए, तो अंग्रेज़ी।",
      otherwise: "कोई और मान, या दो बार दिया गया `lang`, अंग्रेज़ी देता है। यह कभी अस्वीकार नहीं होता।",
    },
  }),
  acceptsLabel: "स्वीकार करता है",
  otherwiseLabel: "वरना",
  chainsCaption: "नेटवर्क, उस छोटे नाम से जो `chain` लेता है:",
  chainColumns: { network: "नेटवर्क", v3: "v3 पूल", v4: "v4 पूल" },
  read: "पढ़े जाते हैं",
  notRead: "नहीं पढ़े जाते",
  languagesCaption: "भाषाएँ, उस कोड से जो `lang` लेता है:",

  json: () => [
    "`GET /api/embed/pool`, उन्हीं पैरामीटरों के साथ, कार्ड के आँकड़े JSON में देता है, उस साइट के लिए जो उन्हें ख़ुद बनाना पसंद करे: वही रीडिंग, उतनी ही देर रखी हुई। हर आँकड़ा एक JSON संख्या है, और हर कीमत उसी दिशा में लिखी है जिसमें पूल का पृष्ठ उसे लिखता है: एक `price.base` कितने `price.quote` के बराबर है।",
    "भेजे जाने से पहले जवाब को उसके स्कीमा से मिलाया जाता है, और जो जवाब उस पर खरा नहीं उतरता, वह भेजा नहीं जाता: उसके बदले पूल को न पढ़ा जा सकने वाला बताया जाता है। इसलिए `200` स्टेटस वाले जवाब में हमेशा ठीक नीचे वाले फ़ील्ड होते हैं, न ज़्यादा न कम।",
    "किसी भी साइट की स्क्रिप्ट इसे पढ़ सकती है। हर जवाब, त्रुटियाँ और अस्वीकृतियाँ भी, `Access-Control-Allow-Origin: *` के साथ भेजा जाता है। यह कोई कुकी नहीं रखता और किसी क्रेडेंशियल की ज़रूरत नहीं। सादे `GET` को preflight की ज़रूरत नहीं होती, और किसी preflight का जवाब नहीं दिया जाता, इसलिए अनुरोध अपने हेडर जोड़े बिना भेजें।",
  ],
  dataHeadersLabel: "आँकड़ों वाला जवाब किन हेडरों के साथ भेजा जाता है, उन हेडरों के अलावा जो हर पृष्ठ पर होते हैं:",
  fieldsCaption: "`200` जवाब का हर फ़ील्ड, उसके JSON प्रकार के साथ:",
  fields: (f) => ({
    protocol: "`address` से नामित पूल के लिए `v3`, `id` से नामित पूल के लिए `v4`।",
    "chain.id": "नेटवर्क का chain id।",
    "chain.slug": "नेटवर्क का छोटा नाम, जैसा `chain` उसे लेता है।",
    "chain.name": "नेटवर्क का नाम।",
    pool: "पूल का पता (v3) या id (v4), छोटे अक्षरों में।",
    "pair.token0":
      "पूल के पहले टोकन का प्रतीक, जैसा उसका कॉन्ट्रैक्ट बताता है: यह ऐसे कॉन्ट्रैक्ट का पाठ है जिसे कोई भी तैनात कर सकता है, इसलिए पृष्ठ में रखने से पहले उसे escape करें।",
    "pair.token1": "दूसरे टोकन का प्रतीक, उसी तरह।",
    lpFeePpm:
      "स्वैप पर पूल तरलता देने वालों को जो शुल्क देता है, दस लाखवें हिस्सों में: `3000` यानी 0.3%। जब v4 पूल का hook शुल्क हर स्वैप पर अलग तय करता है, तब `null`।",
    "price.base": "वह टोकन जिसकी एक इकाई के लिए हर कीमत दी गई है।",
    "price.quote": "वह टोकन जिसमें हर कीमत गिनी गई है।",
    "price.current": "पढ़े जाने के समय पूल की कीमत।",
    "range.lower": "सुझाए गए दायरे का निचला किनारा, कीमत के रूप में।",
    "range.upper": "उसका ऊपरी किनारा।",
    "range.currentInRange": "मौजूदा कीमत दायरे के भीतर है या नहीं। न हो, तो कार्ड एक नोट जोड़ता है।",
    "range.lowerTruncated":
      "`true` जब पूल की tick ग्रिड बैंड के निचले किनारे तक नहीं पहुँच पाती, इसलिए दायरा उससे पहले रुक जाता है।",
    "range.upperTruncated": "वही, ऊपरी किनारे के लिए।",
    "parameters.horizonDays": `वह अवधि जिसके लिए दायरा बना, दिनों में: हमेशा डिफ़ॉल्ट, ${f.defaultHorizon}।`,
    "parameters.standardDeviationMultiplier": `वह चौड़ाई जिसके लिए वह बना, मानक विचलनों में: हमेशा डिफ़ॉल्ट, ${f.defaultMultiplier}।`,
    hookMayAlterSwaps:
      "उस v4 पूल के लिए `true` जिसका hook स्वैप की लागत बदल सकता है, hook के पते से पढ़ा गया; v3 के लिए, बिना hook वाले v4 पूल के लिए, और ऐसे hook के लिए जिसकी अनुमतियाँ स्वैप को नहीं छूतीं, `false`। जहाँ `true` है, कार्ड पर एक नोट होता है।",
    analysedAt: "कीमत कब पढ़ी गई, UTC में, मिलीसेकंड तक — यह नहीं कि यह जवाब कब भेजा गया, जो कुछ मिनट बाद हो सकता है।",
    poolUrl: "इस साइट पर पूल का पृष्ठ, उसी अवधि और चौड़ाई के साथ।",
    disclaimer: "आँकड़े क्या हैं और क्या नहीं, उस भाषा में जो `lang` बताता है।",
  }),
  exampleCaption:
    "उदाहरणों वाले पूल के लिए एक जवाब। इसके आँकड़े एक उदाहरण हैं: पूल से पढ़े नहीं गए, बल्कि साइट के अपने कोड ने कीमतों के एक नमूना महीने से निकाले हैं, और एक टेस्ट जाँचता है कि उस महीने के लिए कोड अब भी ठीक यही जवाब देता है:",

  errors: () => [
    "कार्ड और JSON एक जैसे स्टेटस कोड से जवाब देते हैं। दोनों में से कोई कभी साइट के अपने त्रुटि पृष्ठ से या भीतर क्या बिगड़ा, उससे जवाब नहीं देता: कार्ड एक वाक्य और लौटने का अपना लिंक दिखाता है, और JSON एक `error` के साथ जवाब देता है जिसे स्क्रिप्ट जाँच सके, और `disclaimer` के साथ — सिवाय अस्वीकृति के, जिसमें उसकी जगह इंतज़ार का समय होता है।",
  ],
  statuses: (f) => ({
    figures: "आँकड़े: उनके साथ कार्ड, या ऊपर वाला JSON।",
    "not-a-pool": `पता ऐसे किसी पूल का नाम नहीं लेता जिसे साइट पढ़ती है: न \`address\` न \`id\`, या दोनों, या कोई एक बिगड़ा हुआ या दो बार दिया गया, ऐसा नेटवर्क जिसे साइट नहीं पढ़ती, ऐसी जगह v3 पूल जहाँ केवल v4 पढ़ा जाता है (${f.v4OnlyChains}), या ऐसी जगह v4 पूल जहाँ केवल v3 पढ़ा जाता है (${f.v3OnlyChains})। कुछ नहीं पढ़ा गया, और दोबारा पूछने से जवाब नहीं बदलेगा।`,
    unreadable:
      "सही ढंग से नामित पूल जो अभी पढ़ा नहीं जा सका: कोई स्रोत समय पर जवाब नहीं दे सका, या उस नेटवर्क पर ऐसा कोई पूल नहीं है। `poolUrl` फिर भी उसके पृष्ठ तक ले जाता है। एक मिनट बाद दोबारा पूछने पर वह मिल सकता है।",
    "rate-limited":
      "एक ही क्लाइंट से बहुत अधिक अनुरोध: नीचे अनुरोध सीमा देखें। `Retry-After` और `retryAfterSeconds` दोनों बताते हैं कि कितने सेकंड रुकना है। कार्ड अपनी भाषा में यही कहने वाले एक छोटे पृष्ठ से जवाब देता है।",
  }),
  bodyLabel: "JSON का जवाब, और उसे कितनी देर रखा जा सकता है:",

  caching: (f) => [
    `हर जवाब बताता है कि उसे कितनी देर रखा जा सकता है, ब्राउज़र में भी और साझा कैश में भी: आँकड़े ${f.keptSeconds} सेकंड; न पढ़ा जा सका पूल ${f.unreadableSeconds} सेकंड, ताकि लौट आया पूल ज़्यादा देर तक न पढ़ा जा सकने वाला न दिखे; किसी पूल का नाम न लेने वाला पता ${f.notAPoolSeconds} सेकंड, क्योंकि बाद का कोई पल इसे नहीं बदलेगा। अस्वीकृति कभी नहीं रखी जाती। हर जवाब उसी पते से पूछने वाले हर व्यक्ति के लिए एक जैसा है, और यही उसे रखना सुरक्षित बनाता है।`,
    `इसके पीछे सर्वर हर पूल के आँकड़े उन्हें पढ़ने के पल से ${f.keptSeconds} सेकंड तक रखता है, कार्ड और JSON दोनों के लिए, हर भाषा में: किसी एक पूल का हर कार्ड, जिस भी पृष्ठ पर लगा हो, अवधि ख़त्म होने तक एक ही रीडिंग है। जो पूल पढ़ा न जा सका, वह रखा नहीं जाता, और अगले अनुरोध पर फिर पूछा जाता है। इसलिए जवाब में कीमत जवाब से पुरानी हो सकती है: \`analysedAt\` बताता है कि वह कब पढ़ी गई।`,
    `जो अनुरोध सही ढंग से लिखे पूल का नाम लेता है, वह उस पूल को पढ़ता है, इसलिए वह उसी कोटे में गिना जाता है जिसमें साइट के अपने पूल पृष्ठ: हर क्लाइंट के लिए ${f.windowSeconds} सेकंड की खिड़की में ${f.limit} अनुरोध, और यह खिड़की क्लाइंट के पहले अनुरोध से शुरू होती है; क्लाइंट वह IP पता है जिससे अनुरोध साइट तक पहुँचता है। सीमा पार होने पर जवाब \`Retry-After\` के साथ \`429\` है। साइट तक पहुँचने वाला ऐसा हर अनुरोध गिना जाता है, सर्वर के रखे आँकड़ों से जवाब पाने वाला भी; किसी पूल का नाम न लेने वाला अनुरोध नहीं गिना जाता।`,
    `ब्राउज़र से, कार्ड या \`fetch\` उस पाठक के खाते में गिना जाता है जो उसे लोड करता है, उस साइट के नहीं जिस पर वह लगा है — इसलिए ${f.limit} से ज़्यादा कार्ड लगाने वाले पृष्ठ पर, उससे ऊपर के कार्ड हर पाठक के लिए अस्वीकार होंगे। सर्वर से, आपके सारे अनुरोध उस सर्वर का एक ही कोटा बाँटते हैं: हर जवाब को उतने ${f.keptSeconds} सेकंड रखें जितने वह अनुमति देता है; इसकी कीमत कम है, क्योंकि उस समय के ज़्यादातर हिस्से में सर्वर वैसे भी वही रीडिंग देता जो आपके पास है। सीमा पूल पढ़ने की लागत कम रखने के लिए है, और यहाँ कुछ भी वादा नहीं करता कि वह ऐसी ही रहेगी।`,
  ],

  examples: {
    curl: "आँकड़े, टर्मिनल से:",
    fetch: "किसी पृष्ठ की अपनी स्क्रिप्ट से, या सर्वर से, हर जवाब को सँभालते हुए:",
    iframe: "कार्ड, किसी पृष्ठ पर:",
    selectHint: "एक क्लिक पूरा ब्लॉक चुन लेता है, कॉपी करने के लिए तैयार।",
  },

  share: (f) => [
    `\`/api/share/position\` एक खुली v3 पोज़िशन के लिए कार्ड बनाता है, 1200 गुणा 630 पिक्सेल का एक PNG: जोड़ी अपने शुल्क और नेटवर्क के साथ, पोज़िशन का दायरा, पूरे जीवनकाल में कमाया गया शुल्क, और जमा की गई राशि को बस रखे रहने की तुलना में उसका नतीजा, नतीजे के दो हिस्सों के साथ — यानी वही आँकड़े जो पोज़िशन वाला पृष्ठ उस पोज़िशन के नीचे के हिसाब में दिखाता है, उसी टोकन में जिसमें वह पृष्ठ पूल की कीमत बताता है। पोज़िशन को \`id\` से, यानी उसकी टोकन आईडी से, नाम दिया जाता है; \`chain\` और \`lang\` ऊपर की तरह, और न देने पर Ethereum और अंग्रेज़ी। सिर्फ़ उन नेटवर्क पर जिनकी पोज़िशनें रखी जाती हैं (${f.positionChains}), जहाँ हिसाब चेन से जाँचा जा सकता है; और कार्ड पर आँकड़ा सिर्फ़ जाँचा हुआ हिसाब ही रखता है: जो जाँचा न जा सका, वह एक सादा कार्ड देता है जो यही कहता है। हर पोज़िशन वाला पृष्ठ ये लिंक "${f.shareHeading}" के नीचे देता है।`,
    `कार्ड खुद \`200\` है। जो पता किसी पोज़िशन का नाम नहीं लेता वह \`400\`, जिस आईडी के नीचे चेन कोई खुली पोज़िशन नहीं रखती वह \`404\`, और जो पोज़िशन अभी पढ़ी न जा सकी वह \`503\` — हर एक JSON के रूप में, \`error\` में \`not-a-position\`, \`no-such-position\` या \`unreadable\` के साथ; कभी ऐसा कार्ड नहीं जिसमें कोई आँकड़ा छूटा हो। कार्ड ${f.keptSeconds} सेकंड रखा जाता है, पूल कार्ड की तरह, क्योंकि उसका हिसाब आज की कीमत पर आँका जाता है; और जो अनुरोध सही रूप की पोज़िशन का नाम लेता है वह चेन पढ़ता है, इसलिए वह पूल पृष्ठों के ही ${f.windowSeconds} सेकंड में ${f.limit} अनुरोधों की गिनती में आता है, और उससे आगे \`429\` है। कार्ड पोज़िशन की सार्वजनिक टोकन आईडी बताता है और माँगने वाले के बारे में कुछ नहीं, और कुछ भी सहेजा नहीं जाता।`,
  ],
  shareLabel: "Ethereum पर एक पोज़िशन का कार्ड, अंग्रेज़ी में — एक पता जो जैसा है वैसा खोला जा सकता है:",

  terms: (f) => [
    `आँकड़े माप हैं, सलाह नहीं। दायरा इस बात से निकाला जाता है कि पिछले ${f.measuredDays} दिनों में पूल की कीमत कितनी हिली: यह कोई पूर्वानुमान नहीं है और कोई सिफ़ारिश भी नहीं, और हर जवाब यह ख़ुद कहता है, कार्ड अपने सामने और JSON \`disclaimer\` में। हर आँकड़ा कैसे बनता है और क्या छोड़ देता है, यह "${f.methodLink}" पृष्ठ पर है।`,
    `कार्ड पर लौटने का उसका अपना लिंक है, "${f.analysedBy}"। JSON में श्रेय देने का कोई फ़ील्ड नहीं है, और कोड में कुछ भी इसे नहीं माँगता; उसमें जो है वह है \`poolUrl\`, यहाँ पूल का पृष्ठ, और \`disclaimer\`। आँकड़ों के पास दिखाए जाएँ, तो ये दोनों पाठक को बताते हैं कि आँकड़े कहाँ से आए और क्या हैं।`,
    "न कोई वर्ज़न नंबर है, न कुंजी, और न यह वादा कि जवाब का आकार ऐसा ही रहेगा या साइट किसी भी पल उपलब्ध होगी। जो पक्का है, वह इससे सीमित है: भेजने से पहले जवाब को उसके स्कीमा से मिलाया जाता है, और टेस्ट इस पृष्ठ को उस स्कीमा और पता पढ़ने वाले कोड से बाँधे रखते हैं, इसलिए यह वही बताता है जो अभी दिया जाता है। दोनों में कोई भी बदलाव कोड के सार्वजनिक इतिहास में दिखता है।",
    "कोड ओपन सोर्स है, MIT लाइसेंस के तहत।",
  ],
  links: { code: "कोड, GitHub पर", licence: "MIT लाइसेंस" },
};

const zh: DevelopersCopy = {
  link: "开发者",
  pointer: "卡片和 JSON 的完整说明",
  title: "面向开发者",
  description:
    "可嵌入的池子卡片及其背后的 JSON——它们的地址、每个参数和字段、状态码、缓存、CORS 和请求频率限制，附示例——完全按代码实际提供的样子。",
  heading: "池子卡片及其 JSON",
  lead: "本站有两样东西是为其他网站准备的：一张显示某个池子建议区间的卡片，任何页面都可以把它放进框架里；以及同样数字的 JSON 版本，任何网站的代码都可以读取。两者都不需要密钥或账号。这里按代码实际提供的样子描述它们，并由测试把本页和那份代码绑在一起：本页列出的每个参数，都是读取地址时真正用到的参数；每个字段，都是响应发出前要核对的字段。",
  contentsHeading: "本页内容",
  sections: {
    card: "卡片",
    parameters: "参数",
    json: "JSON",
    errors: "状态码与错误",
    caching: "缓存与请求限制",
    examples: "示例",
    share: "分享卡片",
    terms: "条款，用大白话说",
  },

  card: (f) => [
    `\`/embed/pool\` 是一个手写的小页面，不是由网站的框架生成的。它显示交易对及其协议、手续费和网络；建议区间，以及绘制它所用的时间跨度和宽度；当前价格；一行说明这不构成财务建议；以及一个返回本站该池子页面的链接，会在新标签页中打开。区间总是按本站的默认值绘制——${f.defaultHorizon} 天、${f.defaultMultiplier}——不管谁自己的设置如何。当前价格在区间外时会加一条提示；对于 hook 可能改变兑换代价的 v4 池子，还会再加一条。`,
    "它不含任何脚本和表单，也不加载任何东西：它自己的 `Content-Security-Policy` 只允许它的内联样式。它的配色就是本站的配色，浅色或深色取决于读者系统的设置。它看不到周围的页面，也没有参数可以选择。",
    `给它一个宽 ${f.frameWidth} 像素、高 ${f.frameHeight} 像素的框架；如果池子的 hook 可能改变兑换代价，高度用 ${f.frameHeightHook} 像素，因为那张卡片多一行。每个池子的页面在“${f.embedSummary}”下提供的正是这个，高度已经按该池子调好；提供的框架也永远不会比粘贴进去的那一栏更宽。`,
    "这是本站唯一允许其他网站放进框架的页面。其他每个地址（包括本页）发送时都带有 `X-Frame-Options: DENY` 和 `frame-ancestors 'none'`；卡片发送时不带前者，并带有 `frame-ancestors *`。",
  ],
  snippetLabel: "Ethereum 上 0.3% 的 USDC / WETH 池子的框架，与该池子页面提供的一致：",
  cardHeadersLabel: "带数字的卡片发送时附带的标头（每个页面都有的标头除外）：",

  parametersIntro: (f) => [
    "卡片和 JSON 接受相同的参数，并像本站自己的页面那样指定池子：v3 池子用它的 `address`，与 `/pool` 相同；v4 池子用它的 `id`，与 `/v4` 相同。两者必须恰好给出一个，给出的是哪一个，就说明是哪种协议。同一个池子或网络给出两次会被拒绝，而不是从中挑一个值；这里没有列出的参数都会被忽略。",
    `语言只取自地址，从不取自读者的浏览器或 cookie：由放置卡片的网站来选择；同一个地址对每个加载它的人都是同一个响应，这样缓存才能保存它。卡片有本站全部 ${f.languages} 种语言的版本，阿拉伯语版从右往左排。`,
  ],
  parameters: (f) => ({
    address: {
      accepts: "v3 池子的合约地址：`0x` 加 40 个十六进制数字，大小写均可。",
      otherwise: `其他任何内容都不指向池子；不读取 v3 的网络（${f.v4OnlyChains}）上的 v3 池子也一样：\`400\`，什么也不读取。`,
    },
    id: {
      accepts: "v4 池子的 id，即其 PoolKey 的哈希：`0x` 加 64 个十六进制数字，大小写均可。",
      otherwise: `其他任何内容都不指向池子；不读取 v4 的网络（${f.v3OnlyChains}）上的 v4 池子也一样：\`400\`，什么也不读取。与 \`address\` 一起给出的 \`id\` 也一样。`,
    },
    chain: {
      accepts: "下表中某个网络的简称。不给出时，网络为 Ethereum。",
      otherwise: "本站不读取的简称会被拒绝，绝不会当成 Ethereum 读取：`400`。",
    },
    lang: {
      accepts: "下面列表中的语言代码，用于卡片上的文字和 JSON 的 `disclaimer`；各语言中的数字完全相同。不给出时为英语。",
      otherwise: "其他任何值，或给出两次的 `lang`，都会得到英语。它永远不会被拒绝。",
    },
  }),
  acceptsLabel: "接受",
  otherwiseLabel: "否则",
  chainsCaption: "网络，按 `chain` 接受的简称：",
  chainColumns: { network: "网络", v3: "v3 池子", v4: "v4 池子" },
  read: "读取",
  notRead: "不读取",
  languagesCaption: "语言，按 `lang` 接受的代码：",

  json: () => [
    "`GET /api/embed/pool` 用相同的参数，以 JSON 返回卡片上的数字，供宁愿自己绘制的网站使用：同一次读取，保存同样久。每个数字都是 JSON 数值，每个价格都按池子页面的方向书写：一个 `price.base` 值多少个 `price.quote`。",
    "响应发出前会与其 schema 核对，不符合的不会发出：这时池子会被回答为无法读取。所以状态为 `200` 的响应总是恰好包含下面这些字段，不多也不少。",
    "任何网站的脚本都可以读取它。每个响应（包括错误和拒绝）发送时都带有 `Access-Control-Allow-Origin: *`。它不设置 cookie，也不需要凭证。普通的 `GET` 不需要预检（preflight），而且不会回应任何预检，所以请不要附加自定义标头。",
  ],
  dataHeadersLabel: "带数字的响应发送时附带的标头（每个页面都有的标头除外）：",
  fieldsCaption: "`200` 响应的每个字段及其 JSON 类型：",
  fields: (f) => ({
    protocol: "用 `address` 指定的池子为 `v3`，用 `id` 指定的为 `v4`。",
    "chain.id": "网络的 chain id。",
    "chain.slug": "网络的简称，即 `chain` 接受的写法。",
    "chain.name": "网络的名称。",
    pool: "池子的地址（v3）或 id（v4），小写。",
    "pair.token0": "池子第一个代币的符号，按其合约所写：这是来自任何人都能部署的合约的文本，放进页面前请先转义。",
    "pair.token1": "第二个代币的符号，同上。",
    lpFeePpm:
      "池子在每笔兑换中付给流动性提供者的手续费，以百万分之一计：`3000` 即 0.3%。当 v4 池子的 hook 逐笔设定手续费时为 `null`。",
    "price.base": "每个价格以其一个单位为准的代币。",
    "price.quote": "每个价格所用的计价代币。",
    "price.current": "读取时池子的价格。",
    "range.lower": "建议区间的下沿，以价格表示。",
    "range.upper": "建议区间的上沿。",
    "range.currentInRange": "当前价格是否在区间内。不在时，卡片会加一条提示。",
    "range.lowerTruncated": "当池子的 tick 网格够不到价格带下沿、区间因此在它之前就截止时为 `true`。",
    "range.upperTruncated": "同上，针对上沿。",
    "parameters.horizonDays": `绘制区间所用的时间跨度，以天计：始终是默认值 ${f.defaultHorizon}。`,
    "parameters.standardDeviationMultiplier": `绘制区间所用的宽度，以标准差计：始终是默认值 ${f.defaultMultiplier}。`,
    hookMayAlterSwaps:
      "对于 hook 可能改变兑换代价的 v4 池子为 `true`，从 hook 的地址读出；对于 v3、没有 hook 的 v4 池子，以及权限不涉及兑换的 hook，为 `false`。为 `true` 时卡片会带一条提示。",
    analysedAt: "价格被读取的时间，UTC，精确到毫秒——不是这次响应发出的时间，后者可能晚几分钟。",
    poolUrl: "该池子在本站的页面，使用相同的时间跨度和宽度。",
    disclaimer: "这些数字是什么、不是什么，使用 `lang` 指定的语言。",
  }),
  exampleCaption:
    "示例中那个池子的一个响应。其中的数字只是示例：由本站自己的代码根据一个样本月份的价格算出，而不是从池子读取的；有一项测试检查代码对那个月份仍然恰好返回这些内容：",

  errors: () => [
    "卡片和 JSON 使用相同的状态码。两者都从不以本站自己的错误页面或内部出错的细节作答：卡片显示一句话和返回链接，JSON 则返回一个脚本可以检测的 `error`，以及 `disclaimer`——拒绝除外，它带的是等待时间。",
  ],
  statuses: (f) => ({
    figures: "数字：带数字的卡片，或上面的 JSON。",
    "not-a-pool": `地址没有指向本站读取的池子：既没有 \`address\` 也没有 \`id\`，或两者都有，或其中一个格式错误或出现两次，或是本站不读取的网络，或是只读取 v4 的网络（${f.v4OnlyChains}）上的 v3 池子，或是只读取 v3 的网络（${f.v3OnlyChains}）上的 v4 池子。什么也没有读取，再问一次也不会改变答案。`,
    unreadable:
      "格式正确、但此刻无法读取的池子：某个数据源没有及时回应，或该网络上没有这个池子。`poolUrl` 仍然指向它的页面。一分钟后再问，也许就能读到。",
    "rate-limited":
      "同一客户端的请求过多：见下文的请求限制。`Retry-After` 和 `retryAfterSeconds` 都说明要等待多少秒。卡片会用一个简短页面以自己的语言说明这一点。",
  }),
  bodyLabel: "JSON 的响应，以及可以保存多久：",

  caching: (f) => [
    `每个响应都说明自己可以被保存多久，对浏览器和共享缓存都一样：数字为 ${f.keptSeconds} 秒；无法读取的池子为 ${f.unreadableSeconds} 秒，以免恢复的池子长时间显示为无法读取；不指向池子的地址为 ${f.notAPoolSeconds} 秒，因为以后任何时候都不会改变。拒绝从不保存。用同一个地址询问的每个人得到的响应都相同，这正是保存它是安全的原因。`,
    `在此之后，服务器会把每个池子的数字从读取那一刻起保存 ${f.keptSeconds} 秒，卡片和 JSON 共用，所有语言共用：同一个池子的每张卡片，无论放在哪个页面上，在过期之前都是同一次读取。无法读取的池子不保存，下一次请求时会重新读取。所以响应中的价格可能比响应本身更早：\`analysedAt\` 说明它是何时读取的。`,
    `指向格式正确的池子的请求会读取该池子，因此会计入与本站自己的池子页面相同的额度：每个客户端在 ${f.windowSeconds} 秒的窗口内最多 ${f.limit} 次请求，窗口从该客户端的第一次请求开始；客户端以请求到达本站时的 IP 地址区分。超出后，响应为 \`429\`，并附 \`Retry-After\`。每个到达本站的此类请求都会计数，包括由服务器保存的数据作答的请求；不指向池子的请求不计数。`,
    `在浏览器中，卡片或 \`fetch\` 计入加载它的读者，而不是放置它的网站——所以一个放了超过 ${f.limit} 张卡片的页面，超出的部分会对每位读者被拒绝。在服务器上，你发出的所有请求共用该服务器的同一个额度：请按响应允许的 ${f.keptSeconds} 秒保存每个响应，这几乎没有代价，因为在这段时间的大部分里，服务器本来也会用你手上那次读取作答。这个限制是为了压低读取池子的成本，本页没有任何内容承诺它会保持不变。`,
  ],

  examples: {
    curl: "在终端里读取数字：",
    fetch: "在页面自己的脚本里，或在服务器上，并处理每种响应：",
    iframe: "把卡片放到页面上：",
    selectHint: "单击即可选中整个代码块，方便复制。",
  },

  share: (f) => [
    `\`/api/share/position\` 为一个未平仓的 v3 仓位绘制一张卡片，一张 1200 乘 630 像素的 PNG：交易对及其手续费和网络、仓位的区间、整个存续期间赚到的手续费，以及相对单纯持有存入代币的结果和结果的两个部分——也就是仓位页面在该仓位下方的记录里显示的数字，以该页面为资金池报价所用的代币计。仓位由 \`id\` 指定，即它的代币 id；\`chain\` 和 \`lang\` 同上，省略时为以太坊和英文。只在保留仓位的网络上（${f.positionChains}），因为只有在那里记录才能与链上核对；而且只有核对过的记录才会把数字放到卡片上：无法核对的记录会得到一张写明这一点的素卡片。每个仓位页面都在“${f.shareHeading}”下提供这些链接。`,
    `卡片本身是 \`200\`。没有指定任何仓位的地址是 \`400\`，链上在该 id 下没有未平仓仓位的是 \`404\`，此刻读不到的仓位是 \`503\`——每一种都以 JSON 返回，\`error\` 为 \`not-a-position\`、\`no-such-position\` 或 \`unreadable\`，绝不会是缺了数字的卡片。卡片保留 ${f.keptSeconds} 秒，和资金池卡片一样，因为它的记录按今天的价格计算；指定了格式正确的仓位的请求会读取链上数据，所以它和资金池页面计入同一份额度：每 ${f.windowSeconds} 秒 ${f.limit} 次请求，超出即为 \`429\`。卡片只写出仓位公开的代币 id，不涉及是谁请求的，也不保存任何东西。`,
  ],
  shareLabel: "以太坊上一个仓位的卡片，英文——一个可以照原样打开的地址：",

  terms: (f) => [
    `这些数字是测量，不是建议。区间是根据池子价格在过去 ${f.measuredDays} 天里的波动幅度算出的：它不是预测，也不是推荐，每个响应都会自己说明这一点——卡片写在正面，JSON 写在 \`disclaimer\` 里。每个数字是怎么算出来的、各自漏掉了什么，见“${f.methodLink}”页面。`,
    `卡片带有自己的返回链接“${f.analysedBy}”。JSON 没有署名字段，代码中也没有任何要求署名的内容；它带的是 \`poolUrl\`（该池子在本站的页面）和 \`disclaimer\`。把这两项放在数字旁边，读者就能知道数字从哪里来、是什么。`,
    "没有版本号，没有密钥，也不承诺响应的结构会保持不变，或网站在任何时刻都能访问。能保证的要窄得多：响应在发出前会与其 schema 核对，而测试把本页与该 schema 以及读取地址的代码绑在一起，所以本页描述的是当前实际提供的内容。两者的任何改动都会出现在代码的公开历史里。",
    "代码是开源的，采用 MIT 许可证。",
  ],
  links: { code: "代码（GitHub）", licence: "MIT 许可证" },
};

const ru: DevelopersCopy = {
  link: "Разработчикам",
  pointer: "Карточка и её JSON — полное описание",
  title: "Для разработчиков",
  description:
    "Встраиваемая карточка пула и JSON за ней — их адреса, каждый параметр и каждое поле, коды ответа, кэширование, CORS и лимит запросов, с примерами — ровно так, как их отдаёт код.",
  heading: "Карточка пула и её JSON",
  lead: "Две вещи на этом сайте сделаны для других сайтов: карточка с предложенным диапазоном одного пула, которую любая страница может поместить во фрейм, и те же цифры в JSON, которые может читать код любого сайта. Ни для одной не нужны ни ключ, ни учётная запись. Обе описаны здесь так, как их отдаёт код, и тесты привязывают эту страницу к этому коду: каждый параметр в ней — тот, по которому действительно читается адрес, а каждое поле — то, с чем ответ сверяется перед отправкой.",
  contentsHeading: "На этой странице",
  sections: {
    card: "Карточка",
    parameters: "Параметры",
    json: "JSON",
    errors: "Коды ответа и ошибки",
    caching: "Кэширование и лимит запросов",
    examples: "Примеры",
    share: "Карточка для публикации",
    terms: "Условия, простыми словами",
  },

  card: (f) => [
    `\`/embed/pool\` — небольшая страница, написанная вручную, а не фреймворком сайта. На ней пара с протоколом, комиссией и сетью; предложенный диапазон с горизонтом и шириной, для которых он построен; текущая цена; строка о том, что это не финансовый совет; и ссылка обратно на страницу пула здесь, которая открывается в новой вкладке. Диапазон всегда строится по умолчаниям сайта — ${f.defaultHorizon} дн. при ${f.defaultMultiplier}, — какими бы ни были чьи-то собственные настройки. Пока текущая цена вне диапазона, добавляется примечание, и ещё одно — для пула v4, чей hook может изменить цену свопа.`,
    "В ней нет ни скрипта, ни формы, и она ничего не загружает: её собственная `Content-Security-Policy` разрешает только её встроенный стиль. Цвета у неё — цвета сайта, светлые или тёмные, как настроена система читателя. Страницу вокруг себя она не видит, и параметра, чтобы это выбрать, нет.",
    `Дайте ей фрейм шириной ${f.frameWidth} пикселей и высотой ${f.frameHeight}, или высотой ${f.frameHeightHook} для пула, чей hook может изменить цену свопа: такая карточка несёт на одну строку больше. Ровно это предлагает страница каждого пула в разделе «${f.embedSummary}», уже с нужной для этого пула высотой, и предложенный фрейм никогда не становится шире колонки, в которую его вставили.`,
    "Это единственная страница сайта, которую другой сайт может поместить во фрейм. Любой другой адрес, включая этот, отдаётся с `X-Frame-Options: DENY` и `frame-ancestors 'none'`; карточка — без первого и с `frame-ancestors *`.",
  ],
  snippetLabel: "Фрейм для пула USDC / WETH 0,3% в Ethereum — таким его предлагает страница этого пула:",
  cardHeadersLabel: "С чем отдаётся карточка с цифрами, помимо заголовков, которые есть у каждой страницы:",

  parametersIntro: (f) => [
    "Карточка и JSON принимают одни и те же параметры и называют пул так же, как собственные страницы сайта: пул v3 — по его `address`, как на `/pool`, пул v4 — по его `id`, как на `/v4`. Нужен ровно один из двух, и то, какой пришёл, говорит, какой это протокол. Пул или сеть, названные дважды, отклоняются, а не выбирается одно из значений, и любой параметр, которого здесь нет, игнорируется.",
    `Язык берётся только из адреса, никогда из браузера читателя или cookie: его выбирает сайт, который размещает карточку, и один и тот же адрес — один и тот же ответ для всех, кто его загружает; именно это позволяет кэшу его хранить. Карточка написана на всех ${f.languages} языках сайта, а на арабском читается справа налево.`,
  ],
  parameters: (f) => ({
    address: {
      accepts: "Адрес контракта пула v3: `0x` и 40 шестнадцатеричных цифр, в верхнем или нижнем регистре.",
      otherwise: `Всё остальное не называет пул, как и пул v3 в сети, где v3 не читается (${f.v4OnlyChains}): \`400\`, и ничего не читается.`,
    },
    id: {
      accepts: "Id пула v4, хеш его ключа: `0x` и 64 шестнадцатеричные цифры, в верхнем или нижнем регистре.",
      otherwise: `Всё остальное не называет пул, как и пул v4 в сети, где v4 не читается (${f.v3OnlyChains}): \`400\`, и ничего не читается. Как и \`id\` рядом с \`address\`.`,
    },
    chain: {
      accepts: "Короткое имя сети из таблицы ниже. Если его нет, сеть — Ethereum.",
      otherwise: "Имя, которое сайт не читает, отклоняется и никогда не читается как Ethereum: `400`.",
    },
    lang: {
      accepts:
        "Код языка из списка ниже — для слов карточки и `disclaimer` в JSON; цифры на всех языках одни и те же. Если его нет — английский.",
      otherwise: "Любое другое значение или `lang`, указанный дважды, дают английский. Он никогда не отклоняется.",
    },
  }),
  acceptsLabel: "Принимает",
  otherwiseLabel: "Иначе",
  chainsCaption: "Сети — по короткому имени, которое принимает `chain`:",
  chainColumns: { network: "Сеть", v3: "пулы v3", v4: "пулы v4" },
  read: "читаются",
  notRead: "не читаются",
  languagesCaption: "Языки — по коду, который принимает `lang`:",

  json: () => [
    "`GET /api/embed/pool` с теми же параметрами отвечает цифрами карточки в JSON — для сайта, который предпочитает рисовать их сам: то же чтение, хранимое столько же. Каждая цифра — число JSON, и каждая цена записана так, как её пишет страница пула: сколько `price.quote` стоит один `price.base`.",
    "Перед отправкой ответ сверяется со своей схемой, и ответ, который ей не соответствует, не отправляется: вместо этого пул отвечается как непрочитанный. Поэтому в ответе со статусом `200` всегда ровно поля ниже — не больше и не меньше.",
    "Его может читать скрипт любого сайта. Каждый ответ, включая ошибки и отказы, отдаётся с `Access-Control-Allow-Origin: *`. Он не ставит cookie и не требует учётных данных. Простому `GET` не нужен preflight, и на preflight никто не отвечает, так что отправляйте запрос без собственных заголовков.",
  ],
  dataHeadersLabel: "С чем отдаётся ответ с цифрами, помимо заголовков, которые есть у каждой страницы:",
  fieldsCaption: "Каждое поле ответа `200`, с его типом в JSON:",
  fields: (f) => ({
    protocol: "`v3` для пула, названного по `address`, `v4` — для названного по `id`.",
    "chain.id": "Chain id сети.",
    "chain.slug": "Короткое имя сети — в том виде, в каком его принимает `chain`.",
    "chain.name": "Название сети.",
    pool: "Адрес (v3) или id (v4) пула, в нижнем регистре.",
    "pair.token0":
      "Символ первого токена пула — так, как его указывает контракт: это текст из контракта, который может развернуть кто угодно, поэтому экранируйте его, прежде чем вставлять в страницу.",
    "pair.token1": "Символ второго токена, так же.",
    lpFeePpm:
      "Комиссия, которую пул платит поставщикам ликвидности за своп, в миллионных долях: `3000` — это 0,3%. `null`, когда hook пула v4 задаёт комиссию для каждого свопа отдельно.",
    "price.base": "Токен, за одну единицу которого дана каждая цена.",
    "price.quote": "Токен, в котором считается каждая цена.",
    "price.current": "Цена пула в момент чтения.",
    "range.lower": "Нижняя граница предложенного диапазона, как цена.",
    "range.upper": "Его верхняя граница.",
    "range.currentInRange": "Находится ли текущая цена внутри диапазона. Если нет, карточка добавляет примечание.",
    "range.lowerTruncated":
      "`true`, когда сетка tick’ов пула не дотягивается до нижней границы полосы, и диапазон кончается раньше неё.",
    "range.upperTruncated": "То же — для верхней границы.",
    "parameters.horizonDays": `Горизонт, для которого построен диапазон, в днях: всегда значение по умолчанию, ${f.defaultHorizon}.`,
    "parameters.standardDeviationMultiplier": `Ширина, для которой он построен, в стандартных отклонениях: всегда значение по умолчанию, ${f.defaultMultiplier}.`,
    hookMayAlterSwaps:
      "`true` для пула v4, чей hook может изменить цену свопа, — это читается из адреса hook’а; `false` для v3, для пула v4 без hook’а и для hook’а, чьи разрешения не затрагивают свопы. Где `true`, карточка несёт примечание.",
    analysedAt: "Когда была прочитана цена, по UTC, с точностью до миллисекунды, — а не когда отправлен этот ответ: это может быть на несколько минут позже.",
    poolUrl: "Страница пула на этом сайте, с тем же горизонтом и той же шириной.",
    disclaimer: "Что такое эти цифры и чем они не являются, на языке, указанном в `lang`.",
  }),
  exampleCaption:
    "Ответ для пула из примеров. Цифры в нём — пример: их посчитал собственный код сайта по образцовому месяцу цен, а не прочитал из пула, и тест проверяет, что код по-прежнему отвечает ровно этим для этого месяца:",

  errors: () => [
    "Карточка и JSON отвечают одними и теми же кодами. Ни та, ни другой никогда не отвечают собственной страницей ошибки сайта или тем, что сломалось внутри: карточка показывает одно предложение и свою ссылку обратно, а JSON отвечает полем `error`, которое скрипт может проверить, и `disclaimer` — кроме отказа, в котором вместо него время ожидания.",
  ],
  statuses: (f) => ({
    figures: "Цифры: карточка с ними или JSON выше.",
    "not-a-pool": `Адрес не называет пул, который читает сайт: нет ни \`address\`, ни \`id\`, или есть оба, или один из них искажён либо повторён, или это сеть, которую сайт не читает, или пул v3 там, где читается только v4 (${f.v4OnlyChains}), или пул v4 там, где читается только v3 (${f.v3OnlyChains}). Ничего не прочитано, и повторный запрос ответа не изменит.`,
    unreadable:
      "Правильно названный пул, который сейчас не удалось прочитать: источник не ответил вовремя, или такого пула в этой сети нет. `poolUrl` всё равно ведёт на его страницу. Повторный запрос через минуту может его найти.",
    "rate-limited":
      "Слишком много запросов от одного клиента: см. лимит ниже. `Retry-After` и `retryAfterSeconds` оба говорят, сколько секунд ждать. Карточка отвечает короткой страницей, где это сказано, на своём языке.",
  }),
  bodyLabel: "Ответ JSON и то, сколько его можно хранить:",

  caching: (f) => [
    `Каждый ответ говорит, сколько его можно хранить — и браузеру, и общему кэшу: цифры — ${f.keptSeconds} с; пул, который не удалось прочитать, — ${f.unreadableSeconds} с, чтобы вернувшийся пул недолго показывался непрочитанным; адрес, не называющий пул, — ${f.notAPoolSeconds} с: этого не изменит никакой следующий момент. Отказ не хранится никогда. Каждый ответ одинаков для всех, кто спрашивает по тому же адресу, — это и делает хранение безопасным.`,
    `За этим сервер хранит цифры каждого пула ${f.keptSeconds} с с момента, когда их прочитал, — одинаково для карточки и JSON и на всех языках: каждая карточка одного пула, на какой бы странице она ни стояла, — одно чтение, пока срок не истечёт. Пул, который не удалось прочитать, не хранится и запрашивается снова при следующем запросе. Поэтому цена в ответе может быть старше самого ответа: \`analysedAt\` говорит, когда она прочитана.`,
    `Запрос, называющий правильно записанный пул, читает этот пул и поэтому считается в тот же лимит, что и собственные страницы пулов на сайте: ${f.limit} запросов на клиента в окне ${f.windowSeconds} с, которое начинается с первого запроса клиента; клиент — это IP-адрес, с которого запрос приходит на сайт. Сверх лимита ответ — \`429\` с \`Retry-After\`. Считается каждый такой запрос, дошедший до сайта, включая отвеченный из хранилища сервера; запрос, не называющий пул, не считается.`,
    `Из браузера карточка или \`fetch\` считаются против читателя, который их загружает, а не против сайта, где они стоят, — поэтому на странице с более чем ${f.limit} карточками лишние будут отклонены для каждого читателя. С сервера все ваши запросы делят один лимит этого сервера: храните каждый ответ те ${f.keptSeconds} с, что он разрешает, — это почти ничего не стоит, ведь большую часть этого времени сервер и так ответил бы тем чтением, что у вас уже есть. Лимит нужен, чтобы чтение пулов оставалось дешёвым, и ничто здесь не обещает, что он останется прежним.`,
  ],

  examples: {
    curl: "Цифры из терминала:",
    fetch: "Из скрипта страницы или с сервера, с обработкой каждого ответа:",
    iframe: "Карточка на странице:",
    selectHint: "Один щелчок выделяет весь блок, готовый к копированию.",
  },

  share: (f) => [
    `\`/api/share/position\` рисует карточку для одной открытой позиции v3, PNG размером 1200 на 630 пикселей: пара с её комиссией и сетью, диапазон позиции, комиссии за всё время её жизни и её итог против простого хранения внесённого с двумя частями итога — те цифры, что страница позиций показывает в расчёте под этой позицией, в том токене, в котором эта страница котирует пул. Позиция называется через \`id\`, id её токена; \`chain\` и \`lang\` как выше, а без них — Ethereum и английский. Только в сетях, чьи позиции хранятся (${f.positionChains}), где расчёт можно сверить с сетью, и только сверенный расчёт ставит цифру на карточку: тот, что сверить не удалось, даёт простую карточку, которая так и говорит. Каждая страница позиций предлагает ссылки под заголовком «${f.shareHeading}».`,
    `Сама карточка — \`200\`. Адрес, не называющий позицию, — \`400\`, id, под которым сеть не держит открытой позиции, — \`404\`, а позиция, которую не удалось прочитать прямо сейчас, — \`503\`; каждый ответ — JSON с \`error\`, равным \`not-a-position\`, \`no-such-position\` или \`unreadable\`, и никогда не карточка с пропущенной цифрой. Карточка хранится ${f.keptSeconds} секунд, как карточка пула, потому что её расчёт оценён по сегодняшней цене; а запрос, называющий корректную позицию, читает сеть, поэтому считается в ту же квоту, что и страницы пулов: ${f.limit} запросов за ${f.windowSeconds} секунд, сверх неё — \`429\`. Карточка называет публичный id токена позиции и ничего о том, кто её запросил, и ничего не сохраняется.`,
  ],
  shareLabel: "Карточка одной позиции в Ethereum, на английском — адрес, который можно открыть как есть:",

  terms: (f) => [
    `Цифры — это измерения, а не совет. Диапазон рассчитан по тому, насколько цена пула двигалась за последние ${f.measuredDays} дн.: это не прогноз и не рекомендация, и каждый ответ говорит это сам — карточка на своей лицевой стороне, JSON в \`disclaimer\`. Как получается каждая цифра и что она оставляет за кадром, рассказано на странице «${f.methodLink}».`,
    `Карточка несёт собственную ссылку обратно — «${f.analysedBy}». В JSON нет поля для указания авторства, и ничто в коде его не требует; в нём есть \`poolUrl\`, страница пула здесь, и \`disclaimer\`. Показанные рядом с цифрами, эти два поля говорят читателю, откуда цифры и что они такое.`,
    "Нет ни номера версии, ни ключа, ни обещания, что форма ответа останется прежней или что сайт будет доступен в любой момент. Действует более узкое: ответ сверяется со своей схемой перед отправкой, а тесты привязывают эту страницу к этой схеме и к коду, который читает адрес, так что она описывает то, что отдаётся сейчас. Изменение любого из них видно в публичной истории кода.",
    "Код открыт, под лицензией MIT.",
  ],
  links: { code: "Код на GitHub", licence: "Лицензия MIT" },
};

const pt: DevelopersCopy = {
  link: "Desenvolvedores",
  pointer: "O cartão e o seu JSON, documentados por completo",
  title: "Para desenvolvedores",
  description:
    "O cartão de pool incorporável e o JSON por trás dele — seus endereços, cada parâmetro e cada campo, os códigos de status, cache, CORS e o limite de requisições, com exemplos — exatamente como o código os serve.",
  heading: "O cartão de pool e o seu JSON",
  lead: "Duas coisas neste site foram feitas para outros sites: um cartão com a faixa sugerida de um pool, que qualquer página pode colocar num frame, e os mesmos números em JSON, que o código de qualquer site pode ler. Nenhuma das duas exige chave ou conta. As duas são descritas aqui como o código as serve, e testes prendem esta página a esse código: cada parâmetro listado é um com que o endereço é lido, e cada campo, um contra o qual a resposta é conferida antes de ser enviada.",
  contentsHeading: "Nesta página",
  sections: {
    card: "O cartão",
    parameters: "Parâmetros",
    json: "O JSON",
    errors: "Códigos de status e erros",
    caching: "Cache e limite de requisições",
    examples: "Exemplos",
    share: "O cartão para compartilhar",
    terms: "Condições, em palavras simples",
  },

  card: (f) => [
    `\`/embed/pool\` é uma página pequena escrita à mão, não pelo framework do site. Ela mostra o par com seu protocolo, taxa e rede; a faixa sugerida, com o horizonte e a largura para os quais foi traçada; o preço atual; uma linha dizendo que não é recomendação financeira; e um link de volta para a página do pool aqui, que abre numa nova aba. A faixa é sempre traçada com os padrões do site, ${f.defaultHorizon} dias a ${f.defaultMultiplier}, quaisquer que sejam os ajustes de cada um. Uma nota é acrescentada enquanto o preço atual está fora da faixa, e outra para um pool v4 cujo hook pode mudar quanto custa um swap.`,
    "Ela não tem script nem formulário e não carrega nada: sua própria `Content-Security-Policy` não permite nada além do seu estilo inline. As cores são as do site, claras ou escuras conforme o sistema do leitor está configurado. Ela não enxerga a página ao redor, e não há parâmetro para escolher.",
    `Dê a ela um frame de ${f.frameWidth} pixels de largura e ${f.frameHeight} de altura, ou ${f.frameHeightHook} de altura para um pool cujo hook pode mudar quanto custa um swap, cujo cartão traz essa linha a mais. É exatamente o que a página de cada pool oferece em "${f.embedSummary}", já com a altura certa para aquele pool, e o frame oferecido nunca fica mais largo que a coluna onde é colado.`,
    "É a única página deste site que outro site pode colocar num frame. Todo outro endereço, este incluído, é servido com `X-Frame-Options: DENY` e `frame-ancestors 'none'`; o cartão é servido sem o primeiro e com `frame-ancestors *`.",
  ],
  snippetLabel: "O frame para o pool USDC / WETH de 0,3% na Ethereum, como a página desse pool o oferece:",
  cardHeadersLabel: "Com o que um cartão com números é servido, além dos cabeçalhos que toda página leva:",

  parametersIntro: (f) => [
    "O cartão e o JSON recebem os mesmos parâmetros e nomeiam um pool como as próprias páginas do site: um pool v3 pelo seu `address`, como em `/pool`, e um pool v4 pelo seu `id`, como em `/v4`. É preciso exatamente um dos dois, e qual deles chegou diz qual é o protocolo. Um pool ou uma rede nomeados duas vezes são recusados, em vez de um dos valores ser escolhido, e qualquer parâmetro que não esteja listado aqui é ignorado.",
    `O idioma vem só do endereço, nunca do navegador do leitor nem de um cookie: quem escolhe é o site que coloca o cartão, e o mesmo endereço é a mesma resposta para todos que o carregam, o que permite a um cache guardá-la. O cartão é escrito nos ${f.languages} idiomas do site, e em árabe ele corre da direita para a esquerda.`,
  ],
  parameters: (f) => ({
    address: {
      accepts: "O endereço do contrato de um pool v3: `0x` e 40 dígitos hexadecimais, em maiúsculas ou minúsculas.",
      otherwise: `Qualquer outra coisa não nomeia nenhum pool, nem um pool v3 numa rede em que o v3 não é lido (${f.v4OnlyChains}): \`400\`, e nada é lido.`,
    },
    id: {
      accepts: "O id de um pool v4, o hash da sua chave: `0x` e 64 dígitos hexadecimais, em maiúsculas ou minúsculas.",
      otherwise: `Qualquer outra coisa não nomeia nenhum pool, nem um pool v4 numa rede em que o v4 não é lido (${f.v3OnlyChains}): \`400\`, e nada é lido. Nem um \`id\` ao lado de um \`address\`.`,
    },
    chain: {
      accepts: "O identificador curto de uma rede, da tabela abaixo. Sem ele, a rede é a Ethereum.",
      otherwise: "Um identificador que o site não lê é recusado, nunca lido como Ethereum: `400`.",
    },
    lang: {
      accepts:
        "Um código de idioma da lista abaixo, para as palavras do cartão e o `disclaimer` do JSON; os números são os mesmos em todos os idiomas. Sem ele, inglês.",
      otherwise: "Qualquer outro valor, ou `lang` duas vezes, dá inglês. Nunca é recusado.",
    },
  }),
  acceptsLabel: "Aceita",
  otherwiseLabel: "Senão",
  chainsCaption: "As redes, pelo identificador que `chain` aceita:",
  chainColumns: { network: "Rede", v3: "pools v3", v4: "pools v4" },
  read: "lidos",
  notRead: "não lidos",
  languagesCaption: "Os idiomas, pelo código que `lang` aceita:",

  json: () => [
    "`GET /api/embed/pool`, com os mesmos parâmetros, responde com os números do cartão em JSON, para um site que prefere desenhá-los ele mesmo: a mesma leitura, guardada pelo mesmo tempo. Cada número é um número JSON, e cada preço vem no sentido em que a página do pool o escreve: quantos `price.quote` vale um `price.base`.",
    "Antes de ser enviada, uma resposta é conferida contra o seu esquema, e uma que não o cumpre não é enviada: o pool é respondido como ilegível. Por isso uma resposta com status `200` sempre tem exatamente os campos abaixo, nem mais nem menos.",
    "O script de qualquer site pode lê-la. Toda resposta, erros e recusas incluídos, é servida com `Access-Control-Allow-Origin: *`. Ela não grava cookie nem exige credencial. Um `GET` simples não precisa de preflight, e nenhum é respondido, então envie-o sem cabeçalhos próprios.",
  ],
  dataHeadersLabel: "Com o que uma resposta com números é servida, além dos cabeçalhos que toda página leva:",
  fieldsCaption: "Cada campo de uma resposta `200`, com seu tipo JSON:",
  fields: (f) => ({
    protocol: "`v3` para um pool nomeado por `address`, `v4` para um nomeado por `id`.",
    "chain.id": "O chain id da rede.",
    "chain.slug": "O identificador curto da rede, como `chain` o aceita.",
    "chain.name": "O nome da rede.",
    pool: "O endereço (v3) ou o id (v4) do pool, em minúsculas.",
    "pair.token0":
      "O símbolo do primeiro token do pool, como o contrato dele o declara: é texto de um contrato que qualquer um pode implantar, então escape-o antes de colocá-lo numa página.",
    "pair.token1": "O símbolo do segundo token, do mesmo jeito.",
    lpFeePpm:
      "A taxa que o pool paga aos provedores de liquidez num swap, em milionésimos: `3000` é 0,3%. `null` quando o hook de um pool v4 define a taxa swap a swap.",
    "price.base": "O token para uma unidade do qual cada preço é dado.",
    "price.quote": "O token em que cada preço é contado.",
    "price.current": "O preço do pool quando foi lido.",
    "range.lower": "A borda inferior da faixa sugerida, como preço.",
    "range.upper": "A borda superior.",
    "range.currentInRange": "Se o preço atual está dentro da faixa. Quando não está, o cartão acrescenta uma nota.",
    "range.lowerTruncated":
      "`true` quando a grade de ticks do pool não alcança a borda inferior da banda, de modo que a faixa para antes dela.",
    "range.upperTruncated": "O mesmo, para a borda superior.",
    "parameters.horizonDays": `O horizonte para o qual a faixa foi traçada, em dias: sempre o padrão, ${f.defaultHorizon}.`,
    "parameters.standardDeviationMultiplier": `A largura para a qual foi traçada, em desvios-padrão: sempre o padrão, ${f.defaultMultiplier}.`,
    hookMayAlterSwaps:
      "`true` para um pool v4 cujo hook pode mudar quanto custa um swap, lido do endereço do hook; `false` para o v3, para um pool v4 sem hook e para um hook cujas permissões não tocam nos swaps. Onde é `true`, o cartão traz uma nota.",
    analysedAt: "Quando o preço foi lido, em UTC, ao milissegundo — não quando esta resposta foi enviada, o que pode ser minutos depois.",
    poolUrl: "A página do pool neste site, com o mesmo horizonte e a mesma largura.",
    disclaimer: "O que os números são e o que não são, no idioma que `lang` indica.",
  }),
  exampleCaption:
    "Uma resposta para o pool dos exemplos. Os números são um exemplo: calculados pelo próprio código do site a partir de um mês de preços de amostra, não lidos do pool, e um teste confere que o código ainda responde exatamente isto para esse mês:",

  errors: () => [
    "O cartão e o JSON respondem com os mesmos códigos de status. Nenhum dos dois responde nunca com a página de erro do próprio site nem com o que deu errado por dentro: o cartão mostra uma frase e seu link de volta, e o JSON responde com um `error` que um script pode testar e com `disclaimer` — exceto uma recusa, que traz a espera no lugar dele.",
  ],
  statuses: (f) => ({
    figures: "Os números: um cartão com eles, ou o JSON acima.",
    "not-a-pool": `O endereço não nomeia nenhum pool que o site lê: nem \`address\` nem \`id\`, ou os dois, ou um malformado ou repetido, uma rede que o site não lê, um pool v3 onde só o v4 é lido (${f.v4OnlyChains}) ou um pool v4 onde só o v3 é lido (${f.v3OnlyChains}). Nada foi lido, e perguntar de novo não muda a resposta.`,
    unreadable:
      "Um pool bem nomeado que não pôde ser lido agora: uma fonte não respondeu a tempo, ou não existe esse pool nessa rede. `poolUrl` continua levando à página dele. Perguntar de novo em um minuto pode encontrá-lo.",
    "rate-limited":
      "Requisições demais de um mesmo cliente: veja o limite abaixo. `Retry-After` e `retryAfterSeconds` dizem os dois quantos segundos esperar. O cartão responde com uma página curta que diz isso, no próprio idioma.",
  }),
  bodyLabel: "A resposta do JSON, com por quanto tempo pode ser guardada:",

  caching: (f) => [
    `Toda resposta diz por quanto tempo pode ser guardada, por um navegador e por um cache compartilhado: ${f.keptSeconds} segundos para os números; ${f.unreadableSeconds} segundos para um pool que não pôde ser lido, para que um que volta não apareça como ilegível por muito tempo; ${f.notAPoolSeconds} segundos para um endereço que não nomeia nenhum pool, o que nenhum momento posterior vai mudar. Uma recusa nunca é guardada. Cada resposta é a mesma para todos que perguntam com o mesmo endereço, e é isso que torna seguro guardá-la.`,
    `Por trás disso, o servidor guarda os números de cada pool por ${f.keptSeconds} segundos a partir do momento em que os leu, para o cartão e para o JSON, em todos os idiomas: cada cartão de um pool, em cada página onde estiver, é uma única leitura até ela expirar. Um pool que não pôde ser lido não é guardado, e é consultado de novo na próxima requisição. Por isso o preço numa resposta pode ser mais antigo que a resposta: \`analysedAt\` diz quando ele foi lido.`,
    `Uma requisição que nomeia um pool bem formado lê esse pool, então conta contra a mesma cota das páginas de pool do próprio site: ${f.limit} requisições por cliente numa janela de ${f.windowSeconds} segundos que começa na primeira requisição do cliente, sendo o cliente o endereço IP de onde a requisição chega ao site. Passado o limite, a resposta é \`429\`, com \`Retry-After\`. Conta toda requisição assim que chega ao site, inclusive a respondida com o que o servidor guardou; uma requisição que não nomeia nenhum pool não conta.`,
    `Num navegador, um cartão ou um \`fetch\` conta contra o leitor que o carrega, não contra o site onde está — então, numa página com mais de ${f.limit} cartões, os que passam disso são recusados para cada leitor. Num servidor, todas as suas requisições dividem a única cota desse servidor: guarde cada resposta pelos ${f.keptSeconds} segundos que ela permite, o que custa pouco, pois na maior parte desse tempo o servidor responderia com a leitura que você já tem. O limite existe para manter baixo o custo de ler pools, e nada aqui promete que ele vá ficar como está.`,
  ],

  examples: {
    curl: "Os números, de um terminal:",
    fetch: "Do script de uma página, ou de um servidor, com cada resposta tratada:",
    iframe: "O cartão, numa página:",
    selectHint: "Um clique seleciona um bloco inteiro, pronto para copiar.",
  },

  share: (f) => [
    `\`/api/share/position\` desenha um cartão para uma posição v3 aberta, um PNG de 1200 por 630 pixels: o par com a taxa e a rede, a faixa da posição, as taxas ganhas em toda a vida dela e o resultado contra simplesmente segurar o que foi depositado, com as duas partes do resultado — os números que a página de posições mostra no cálculo sob aquela posição, no token em que aquela página cota o pool. A posição é nomeada por \`id\`, o id do token dela; \`chain\` e \`lang\` como acima, e, se omitidos, Ethereum e inglês. Só nas redes cujas posições são guardadas (${f.positionChains}), onde um cálculo pode ser conferido com a rede, e só um cálculo conferido põe um número no cartão: um que não pôde ser conferido dá um cartão simples que diz isso. Cada página de posições oferece os links sob "${f.shareHeading}".`,
    `O cartão em si é \`200\`. Um endereço que não nomeia posição nenhuma é \`400\`, um id sob o qual a rede não tem posição aberta é \`404\`, e uma posição que não pôde ser lida agora é \`503\` — cada um como JSON com um \`error\` de \`not-a-position\`, \`no-such-position\` ou \`unreadable\`, nunca um cartão com um número faltando. Um cartão é guardado por ${f.keptSeconds} segundos, como o cartão do pool, porque o cálculo dele é avaliado ao preço de hoje; e um pedido que nomeia uma posição bem formada lê a rede, então conta contra os mesmos ${f.limit} pedidos por ${f.windowSeconds} segundos das páginas de pools, e além deles é \`429\`. O cartão nomeia o id público do token da posição e nada sobre quem o pediu, e nada é guardado.`,
  ],
  shareLabel: "O cartão de uma posição no Ethereum, em inglês — um endereço que pode ser aberto como está:",

  terms: (f) => [
    `Os números são medições, não recomendações. A faixa é calculada a partir de quanto o preço do pool se moveu nos últimos ${f.measuredDays} dias: não é uma previsão nem uma recomendação de investimento, e toda resposta diz isso por si mesma, o cartão na própria face e o JSON em \`disclaimer\`. Como cada número é obtido, e o que cada um deixa de fora, está em "${f.methodLink}".`,
    `O cartão traz seu próprio link de volta, "${f.analysedBy}". O JSON não tem campo de atribuição, e nada no código pede uma; o que ele traz é \`poolUrl\`, a página do pool aqui, e \`disclaimer\`. Mostrados ao lado dos números, esses dois dizem ao leitor de onde eles vieram e o que são.`,
    "Não há número de versão nem chave, nem promessa de que a forma da resposta vá ficar como está ou de que o site esteja no ar num dado momento. O que vale é mais estreito: uma resposta é conferida contra o seu esquema antes de ser enviada, e testes prendem esta página a esse esquema e ao código que lê o endereço, então ela descreve o que é servido agora. Uma mudança em qualquer um dos dois aparece no histórico público do código.",
    "O código é aberto, sob a licença MIT.",
  ],
  links: { code: "O código, no GitHub", licence: "A licença MIT" },
};

const zhHant: DevelopersCopy = {
  link: "開發者",
  pointer: "卡片和 JSON 的完整說明",
  title: "給開發者",
  description:
    "可嵌入的池子卡片及其背後的 JSON——它們的網址、每個參數和欄位、狀態碼、快取、CORS 和請求次數限制，附範例——完全依程式碼實際提供的樣子。",
  heading: "池子卡片及其 JSON",
  lead: "本站有兩樣東西是為其他網站準備的：一張顯示某個池子建議區間的卡片，任何頁面都可以把它放進框架裡；以及同樣數字的 JSON 版本，任何網站的程式碼都可以讀取。兩者都不需要金鑰或帳號。這裡依程式碼實際提供的樣子說明它們，並由測試把本頁和那份程式碼綁在一起：本頁列出的每個參數，都是讀取網址時真正用到的參數；每個欄位，都是回應送出前要核對的欄位。",
  contentsHeading: "本頁內容",
  sections: {
    card: "卡片",
    parameters: "參數",
    json: "JSON",
    errors: "狀態碼與錯誤",
    caching: "快取與請求限制",
    examples: "範例",
    share: "分享卡片",
    terms: "條款，用白話說",
  },

  card: (f) => [
    `\`/embed/pool\` 是一個手寫的小頁面，不是由網站的框架產生的。它顯示交易對及其協議、手續費和網路；建議區間，以及繪製它所用的時間跨度和寬度；當前價格；一行說明這不構成財務建議；以及一個返回本站該池子頁面的連結，會在新分頁中開啟。區間總是依本站的預設值繪製——${f.defaultHorizon} 天、${f.defaultMultiplier}——不管誰自己的設定如何。當前價格在區間外時會加一則提示；對於 hook 可能改變兌換代價的 v4 池子，還會再加一則。`,
    "它不含任何腳本和表單，也不載入任何東西：它自己的 `Content-Security-Policy` 只允許它的內嵌樣式。它的配色就是本站的配色，淺色或深色取決於讀者系統的設定。它看不到周圍的頁面，也沒有參數可以選擇。",
    `給它一個寬 ${f.frameWidth} 像素、高 ${f.frameHeight} 像素的框架；如果池子的 hook 可能改變兌換代價，高度用 ${f.frameHeightHook} 像素，因為那張卡片多一行。每個池子的頁面在「${f.embedSummary}」下提供的正是這個，高度已經依該池子調好；提供的框架也永遠不會比貼進去的那一欄更寬。`,
    "這是本站唯一允許其他網站放進框架的頁面。其他每個網址（包括本頁）送出時都帶有 `X-Frame-Options: DENY` 和 `frame-ancestors 'none'`；卡片送出時不帶前者，並帶有 `frame-ancestors *`。",
  ],
  snippetLabel: "Ethereum 上 0.3% 的 USDC / WETH 池子的框架，與該池子頁面提供的一致：",
  cardHeadersLabel: "帶數字的卡片送出時附帶的標頭（每個頁面都有的標頭除外）：",

  parametersIntro: (f) => [
    "卡片和 JSON 接受相同的參數，並像本站自己的頁面那樣指定池子：v3 池子用它的 `address`，與 `/pool` 相同；v4 池子用它的 `id`，與 `/v4` 相同。兩者必須恰好給出一個，給出的是哪一個，就說明是哪種協議。同一個池子或網路給出兩次會被拒絕，而不是從中挑一個值；這裡沒有列出的參數都會被忽略。",
    `語言只取自網址，從不取自讀者的瀏覽器或 cookie：由放置卡片的網站來選擇；同一個網址對每個載入它的人都是同一個回應，這樣快取才能保存它。卡片有本站全部 ${f.languages} 種語言的版本，阿拉伯語版由右往左排。`,
  ],
  parameters: (f) => ({
    address: {
      accepts: "v3 池子的合約地址：`0x` 加 40 個十六進位數字，大小寫皆可。",
      otherwise: `其他任何內容都不指向池子；不讀取 v3 的網路（${f.v4OnlyChains}）上的 v3 池子也一樣：\`400\`，什麼也不讀取。`,
    },
    id: {
      accepts: "v4 池子的 id，即其 PoolKey 的雜湊值：`0x` 加 64 個十六進位數字，大小寫皆可。",
      otherwise: `其他任何內容都不指向池子；不讀取 v4 的網路（${f.v3OnlyChains}）上的 v4 池子也一樣：\`400\`，什麼也不讀取。與 \`address\` 一起給出的 \`id\` 也一樣。`,
    },
    chain: {
      accepts: "下表中某個網路的簡稱。不給出時，網路為 Ethereum。",
      otherwise: "本站不讀取的簡稱會被拒絕，絕不會當成 Ethereum 讀取：`400`。",
    },
    lang: {
      accepts: "下方清單中的語言代碼，用於卡片上的文字和 JSON 的 `disclaimer`；各語言中的數字完全相同。不給出時為英語。",
      otherwise: "其他任何值，或給出兩次的 `lang`，都會得到英語。它永遠不會被拒絕。",
    },
  }),
  acceptsLabel: "接受",
  otherwiseLabel: "否則",
  chainsCaption: "網路，依 `chain` 接受的簡稱：",
  chainColumns: { network: "網路", v3: "v3 池子", v4: "v4 池子" },
  read: "讀取",
  notRead: "不讀取",
  languagesCaption: "語言，依 `lang` 接受的代碼：",

  json: () => [
    "`GET /api/embed/pool` 用相同的參數，以 JSON 回傳卡片上的數字，供寧願自己繪製的網站使用：同一次讀取，保存同樣久。每個數字都是 JSON 數值，每個價格都依池子頁面的方向書寫：一個 `price.base` 值多少個 `price.quote`。",
    "回應送出前會與其 schema 核對，不符合的不會送出：這時池子會被回覆為無法讀取。所以狀態為 `200` 的回應總是恰好包含下面這些欄位，不多也不少。",
    "任何網站的腳本都可以讀取它。每個回應（包括錯誤和拒絕）送出時都帶有 `Access-Control-Allow-Origin: *`。它不設定 cookie，也不需要憑證。一般的 `GET` 不需要預檢（preflight），而且不會回應任何預檢，所以請不要附加自訂標頭。",
  ],
  dataHeadersLabel: "帶數字的回應送出時附帶的標頭（每個頁面都有的標頭除外）：",
  fieldsCaption: "`200` 回應的每個欄位及其 JSON 型別：",
  fields: (f) => ({
    protocol: "用 `address` 指定的池子為 `v3`，用 `id` 指定的為 `v4`。",
    "chain.id": "網路的 chain id。",
    "chain.slug": "網路的簡稱，即 `chain` 接受的寫法。",
    "chain.name": "網路的名稱。",
    pool: "池子的地址（v3）或 id（v4），小寫。",
    "pair.token0": "池子第一個代幣的符號，照其合約上寫的：這是來自任何人都能部署的合約的文字，放進頁面前請先跳脫（escape）。",
    "pair.token1": "第二個代幣的符號，同上。",
    lpFeePpm:
      "池子在每筆兌換中付給流動性提供者的手續費，以百萬分之一計：`3000` 即 0.3%。當 v4 池子的 hook 逐筆設定手續費時為 `null`。",
    "price.base": "每個價格以其一個單位為準的代幣。",
    "price.quote": "每個價格所用的計價代幣。",
    "price.current": "讀取時池子的價格。",
    "range.lower": "建議區間的下緣，以價格表示。",
    "range.upper": "建議區間的上緣。",
    "range.currentInRange": "當前價格是否在區間內。不在時，卡片會加一則提示。",
    "range.lowerTruncated": "當池子的 tick 網格搆不到價格帶下緣、區間因此在它之前就截止時為 `true`。",
    "range.upperTruncated": "同上，針對上緣。",
    "parameters.horizonDays": `繪製區間所用的時間跨度，以天計：始終是預設值 ${f.defaultHorizon}。`,
    "parameters.standardDeviationMultiplier": `繪製區間所用的寬度，以標準差計：始終是預設值 ${f.defaultMultiplier}。`,
    hookMayAlterSwaps:
      "對於 hook 可能改變兌換代價的 v4 池子為 `true`，從 hook 的地址讀出；對於 v3、沒有 hook 的 v4 池子，以及權限不涉及兌換的 hook，為 `false`。為 `true` 時卡片會帶一則提示。",
    analysedAt: "價格被讀取的時間，UTC，精確到毫秒——不是這次回應送出的時間，後者可能晚幾分鐘。",
    poolUrl: "該池子在本站的頁面，使用相同的時間跨度和寬度。",
    disclaimer: "這些數字是什麼、不是什麼，使用 `lang` 指定的語言。",
  }),
  exampleCaption:
    "範例中那個池子的一個回應。其中的數字只是範例：由本站自己的程式碼根據一個樣本月份的價格算出，而不是從池子讀取的；有一項測試檢查程式碼對那個月份仍然恰好回傳這些內容：",

  errors: () => [
    "卡片和 JSON 使用相同的狀態碼。兩者都從不以本站自己的錯誤頁面或內部出錯的細節回覆：卡片顯示一句話和返回連結，JSON 則回傳一個腳本可以檢查的 `error`，以及 `disclaimer`——拒絕除外，它帶的是等待時間。",
  ],
  statuses: (f) => ({
    figures: "數字：帶數字的卡片，或上面的 JSON。",
    "not-a-pool": `網址沒有指向本站讀取的池子：既沒有 \`address\` 也沒有 \`id\`，或兩者都有，或其中一個格式錯誤或出現兩次，或是本站不讀取的網路，或是只讀取 v4 的網路（${f.v4OnlyChains}）上的 v3 池子，或是只讀取 v3 的網路（${f.v3OnlyChains}）上的 v4 池子。什麼也沒有讀取，再問一次也不會改變答案。`,
    unreadable:
      "格式正確、但此刻無法讀取的池子：某個資料來源沒有及時回應，或該網路上沒有這個池子。`poolUrl` 仍然指向它的頁面。一分鐘後再問，也許就能讀到。",
    "rate-limited":
      "同一用戶端的請求過多：見下文的請求限制。`Retry-After` 和 `retryAfterSeconds` 都說明要等待多少秒。卡片會用一個簡短頁面以自己的語言說明這一點。",
  }),
  bodyLabel: "JSON 的回應，以及可以保存多久：",

  caching: (f) => [
    `每個回應都說明自己可以被保存多久，對瀏覽器和共用快取都一樣：數字為 ${f.keptSeconds} 秒；無法讀取的池子為 ${f.unreadableSeconds} 秒，以免恢復的池子長時間顯示為無法讀取；不指向池子的網址為 ${f.notAPoolSeconds} 秒，因為以後任何時候都不會改變。拒絕從不保存。用同一個網址詢問的每個人得到的回應都相同，這正是保存它是安全的原因。`,
    `在此之後，伺服器會把每個池子的數字從讀取那一刻起保存 ${f.keptSeconds} 秒，卡片和 JSON 共用，所有語言共用：同一個池子的每張卡片，無論放在哪個頁面上，在過期之前都是同一次讀取。無法讀取的池子不保存，下一次請求時會重新讀取。所以回應中的價格可能比回應本身更早：\`analysedAt\` 說明它是何時讀取的。`,
    `指向格式正確的池子的請求會讀取該池子，因此會計入與本站自己的池子頁面相同的額度：每個用戶端在 ${f.windowSeconds} 秒的時段內最多 ${f.limit} 次請求，時段從該用戶端的第一次請求開始；用戶端以請求到達本站時的 IP 位址區分。超出後，回應為 \`429\`，並附 \`Retry-After\`。每個到達本站的此類請求都會計數，包括由伺服器保存的資料回覆的請求；不指向池子的請求不計數。`,
    `在瀏覽器中，卡片或 \`fetch\` 計入載入它的讀者，而不是放置它的網站——所以一個放了超過 ${f.limit} 張卡片的頁面，超出的部分會對每位讀者被拒絕。在伺服器上，你送出的所有請求共用該伺服器的同一個額度：請依回應允許的 ${f.keptSeconds} 秒保存每個回應，這幾乎沒有代價，因為在這段時間的大部分裡，伺服器本來也會用你手上那次讀取回覆。這個限制是為了壓低讀取池子的成本，本頁沒有任何內容承諾它會保持不變。`,
  ],

  examples: {
    curl: "在終端機裡讀取數字：",
    fetch: "在頁面自己的腳本裡，或在伺服器上，並處理每種回應：",
    iframe: "把卡片放到頁面上：",
    selectHint: "點一下即可選取整個程式碼區塊，方便複製。",
  },

  share: (f) => [
    `\`/api/share/position\` 為一個未平倉的 v3 倉位繪製一張卡片，一張 1200 乘 630 像素的 PNG：交易對及其手續費和網路、倉位的區間、整個存續期間賺到的手續費，以及相對單純持有存入代幣的結果和結果的兩個部分——也就是倉位頁面在該倉位下方的記錄裡顯示的數字，以該頁面為資金池報價所用的代幣計。倉位由 \`id\` 指定，即它的代幣 id；\`chain\` 和 \`lang\` 同上，省略時為以太坊和英文。只在保留倉位的網路上（${f.positionChains}），因為只有在那裡記錄才能與鏈上核對；而且只有核對過的記錄才會把數字放到卡片上：無法核對的記錄會得到一張寫明這一點的素卡片。每個倉位頁面都在「${f.shareHeading}」下提供這些連結。`,
    `卡片本身是 \`200\`。沒有指定任何倉位的地址是 \`400\`，鏈上在該 id 下沒有未平倉倉位的是 \`404\`，此刻讀不到的倉位是 \`503\`——每一種都以 JSON 回傳，\`error\` 為 \`not-a-position\`、\`no-such-position\` 或 \`unreadable\`，絕不會是缺了數字的卡片。卡片保留 ${f.keptSeconds} 秒，和資金池卡片一樣，因為它的記錄按今天的價格計算；指定了格式正確的倉位的請求會讀取鏈上資料，所以它和資金池頁面計入同一份額度：每 ${f.windowSeconds} 秒 ${f.limit} 次請求，超出即為 \`429\`。卡片只寫出倉位公開的代幣 id，不涉及是誰請求的，也不保存任何東西。`,
  ],
  shareLabel: "以太坊上一個倉位的卡片，英文——一個可以照原樣開啟的地址：",

  terms: (f) => [
    `這些數字是測量，不是建議。區間是根據池子價格在過去 ${f.measuredDays} 天裡的波動幅度算出的：它不是預測，也不是推薦，每個回應都會自己說明這一點——卡片寫在正面，JSON 寫在 \`disclaimer\` 裡。每個數字是怎麼算出來的、各自遺漏了什麼，見「${f.methodLink}」頁面。`,
    `卡片帶有自己的返回連結「${f.analysedBy}」。JSON 沒有署名欄位，程式碼中也沒有任何要求署名的內容；它帶的是 \`poolUrl\`（該池子在本站的頁面）和 \`disclaimer\`。把這兩項放在數字旁邊，讀者就能知道數字從哪裡來、是什麼。`,
    "沒有版本號，沒有金鑰，也不承諾回應的結構會保持不變，或網站在任何時刻都能使用。能保證的要窄得多：回應在送出前會與其 schema 核對，而測試把本頁與該 schema 以及讀取網址的程式碼綁在一起，所以本頁描述的是目前實際提供的內容。兩者的任何改動都會出現在程式碼的公開歷史裡。",
    "程式碼是開源的，採用 MIT 授權條款。",
  ],
  links: { code: "程式碼（GitHub）", licence: "MIT 授權條款" },
};

const COPY: Record<Locale, DevelopersCopy> = { en, tr, de, es, ar, hi, zh, ru, pt, "zh-Hant": zhHant };

export const getDevelopersCopy = (locale: Locale): DevelopersCopy => COPY[locale];

// The explainer, as one function of time: `frame(t, lang)` returns the SVG of
// the frame at second `t`. render.mjs rasterises it into an MP4 through sharp
// and ffmpeg; build-player.mjs inlines it into an HTML page that plays it in a
// browser. One drawing, two outputs, so the two cannot drift apart.
//
// Six scenes, about a minute: the name; what a position is; where the range
// comes from; the month replayed; what else the site does; the close. The
// price lines are drawn, not real — the figures in scene three are, measured
// on 2026-10-04 on USDC/WETH 0.05% on Ethereum, and the scene says so.
//
// Plain SVG only: shapes, text, opacity and transforms worked out here per
// frame. No CSS animation, no filters, no foreignObject — librsvg (what sharp
// draws with) and the browser must draw the same picture.

export const W = 1920;
export const H = 1080;
export const FPS = 30;

export const SCENES = [
  { key: "title", start: 0, end: 6 },
  { key: "range", start: 6, end: 19 },
  { key: "measure", start: 19, end: 33 },
  { key: "replay", start: 33, end: 45 },
  { key: "more", start: 45, end: 61 },
  { key: "close", start: 61, end: 69 },
];
export const DURATION = SCENES[SCENES.length - 1].end;

/* The site's dark theme, from globals.css. */
const C = {
  bg: "#120f14",
  surface: "#1c171e",
  border: "#352b35",
  fg: "#f5edf3",
  muted: "#b5a6b3",
  subtle: "#a0929e",
  accent: "#ee9cbe",
  accentSoft: "#37202e",
  accentStrong: "#f9b7d2",
  markBg: "#20151f",
  markStroke: "#f6a4c6",
};

const SERIF = "'Instrument Serif', Georgia, serif";
const SANS = "Geist, 'Geist Variable', sans-serif";
const MONO = "'Geist Mono', 'GeistMono Variable', monospace";

export const STRINGS = {
  en: {
    name: "LiquidityWise",
    headline: ["Liquidity,", "understood."],
    site: "liquiditywise.com",
    tagline: "An independent, educational advisor for Uniswap v3 and v4",
    s1Title: "A position is a price range",
    s1Caption: ["Inside the range, a position earns fees.", "Outside it, nothing — until the price comes back."],
    inRange: "in range · earning fees",
    outRange: "out of range · earning nothing",
    upperLabel: "upper",
    lowerLabel: "lower",
    s2Title: "Where should the range be?",
    s2Caption: ["LiquidityWise reads the last 30 days of real prices", "and draws a range from how far the pair actually moved."],
    closes: "30 daily closes",
    band: "mean ± 1σ",
    noForecast: "No forecast. A measurement.",
    s3Title: "Then it replays the month",
    s3Rows: [
      ["Days inside the range", "26 of 30"],
      ["Fees on a $10,000 deposit", "$369"],
      ["Against simply holding", "+$247"],
    ],
    s3Caption: ["Fees earned, days inside, the result against holding —", "all from a month that already happened."],
    s3Note: ["Example: USDC/WETH 0.05% on Ethereum,", "1σ over 7 days, measured 4 Oct 2026"],
    s4Title: "And beyond one pool",
    cards: [
      ["Smart money", "Where the best-earning liquidity", "sits, read from the chain."],
      ["Your positions", "Every fee a position earned,", "and its result against holding."],
      ["Telegram alerts", "Told when a position nears,", "leaves or re-enters its range."],
      ["9 networks · 10 languages", "Ethereum, Base, Arbitrum, Unichain,", "OP Mainnet, Polygon, BNB, Avalanche, Celo."],
    ],
    s4Caption: ["All of it from public on-chain data,", "and all of it explained in plain words."],
    close: ["Measurements, not advice.", "Open source · MIT"],
  },
  tr: {
    name: "LiquidityWise",
    headline: ["Likidite,", "artık daha net."],
    site: "liquiditywise.com",
    tagline: "Uniswap v3 ve v4 için bağımsız, eğitici bir danışman",
    s1Title: "Pozisyon, bir fiyat aralığıdır",
    s1Caption: ["Fiyat aralığın içindeyken pozisyon komisyon kazanır.", "Dışındayken hiçbir şey — fiyat geri gelene kadar."],
    inRange: "aralıkta · komisyon kazanıyor",
    outRange: "aralık dışında · hiçbir şey kazanmıyor",
    upperLabel: "üst",
    lowerLabel: "alt",
    s2Title: "Aralık nerede olmalı?",
    s2Caption: ["LiquidityWise son 30 günün gerçek fiyatlarını okur,", "paritenin gerçekte ne kadar hareket ettiğinden bir aralık çizer."],
    closes: "30 günlük kapanış",
    band: "ortalama ± 1σ",
    noForecast: "Tahmin değil. Ölçüm.",
    s3Title: "Sonra o ayı yeniden oynatır",
    s3Rows: [
      ["Aralık içindeki günler", "30 günün 26'sı"],
      ["10.000 $ yatırımın komisyonu", "369 $"],
      ["Sadece tutmaya göre", "+247 $"],
    ],
    s3Caption: ["Kazanılan komisyon, içeride geçen günler, tutmaya göre sonuç —", "hepsi zaten yaşanmış bir aydan."],
    s3Note: ["Örnek: Ethereum'da USDC/WETH %0,05,", "7 gün üzerinden 1σ, 4 Ekim 2026'da ölçüldü"],
    s4Title: "Ve tek bir havuzun ötesi",
    cards: [
      ["Akıllı para", "En çok kazanan likidite nerede,", "zincirden okunmuş."],
      ["Pozisyonların", "Bir pozisyonun kazandığı her komisyon", "ve tutmaya göre sonucu."],
      ["Telegram uyarıları", "Pozisyon aralığın sınırına yaklaşınca,", "çıkınca ya da geri girince haber."],
      ["9 ağ · 10 dil", "Ethereum, Base, Arbitrum, Unichain,", "OP Mainnet, Polygon, BNB, Avalanche, Celo."],
    ],
    s4Caption: ["Hepsi herkese açık zincir verisinden,", "hepsi sade bir dille açıklanmış."],
    close: ["Ölçüm, tavsiye değil.", "Açık kaynak · MIT"],
  },
};

/* ---------- small helpers ---------- */

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x) => 1 - (1 - clamp01(x)) ** 3;
const easeInOut = (x) => {
  const u = clamp01(x);
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
};
/** 0 → 1 over `dur` seconds from `start`, eased out. */
const prog = (local, start, dur) => easeOut((local - start) / dur);
const lerp = (a, b, x) => a + (b - a) * x;
const fmt = (n) => Math.round(n * 1000) / 1000;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const text = (x, y, s, { size = 32, family = SANS, fill = C.fg, anchor = "start", weight = 400, opacity = 1, spacing = 0 } = {}) =>
  `<text x="${fmt(x)}" y="${fmt(y)}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${fmt(opacity)}"${spacing ? ` letter-spacing="${spacing}"` : ""}>${esc(s)}</text>`;

/** A group that fades in from below: the one motion the whole piece uses for text. */
const rise = (local, start, inner, { dur = 0.7, dist = 24 } = {}) => {
  const p = prog(local, start, dur);
  if (p <= 0) return "";
  return `<g opacity="${fmt(p)}" transform="translate(0 ${fmt(lerp(dist, 0, p))})">${inner}</g>`;
};

/** Two centred caption lines at the bottom, the site's way of saying one thing under a figure. */
const caption = (local, start, lines, { y = 940, size = 40 } = {}) =>
  rise(
    local,
    start,
    lines.map((line, i) => text(W / 2, y + i * 58, line, { size, fill: i === 0 ? C.fg : C.muted, anchor: "middle" })).join(""),
  );

const title = (local, start, s) => rise(local, start, text(W / 2, 170, s, { size: 76, family: SERIF, anchor: "middle" }), { dist: 18 });

/* The brand mark from icon.svg, at a size: the rounded square and the two U strokes. */
const MARK_OUTER = "M8 9v10a9 9 0 0 0 18 0V9";
const MARK_INNER = "M13 6v13a4 4 0 0 0 8 0V6";
const OUTER_LEN = 10 + Math.PI * 9 + 10;
const INNER_LEN = 13 + Math.PI * 4 + 13;

const mark = (x, y, size, { draw = 1, opacity = 1 } = {}) => {
  const k = size / 48;
  const dash = (len, p) => `stroke-dasharray="${fmt(len)} ${fmt(len)}" stroke-dashoffset="${fmt(len * (1 - clamp01(p)))}"`;
  return `<g opacity="${fmt(opacity)}" transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(k)})">
<rect width="48" height="48" rx="13" fill="${C.markBg}"/>
<g transform="translate(7 7)" stroke="${C.markStroke}" fill="none" stroke-width="2.5" stroke-linecap="round">
<path d="${MARK_OUTER}" ${dash(OUTER_LEN, draw * 1.25)}/>
<path d="${MARK_INNER}" ${dash(INNER_LEN, draw * 1.25 - 0.25)}/>
<circle cx="26" cy="6" r="1" opacity="${fmt(clamp01(draw * 1.6 - 0.6))}"/>
</g></g>`;
};

/** The small header the inner scenes share: the mark, the name, the scene's number. */
const header = (lang, n) =>
  `${mark(72, 56, 44)}${text(132, 92, STRINGS[lang].name, { size: 30, family: SERIF, fill: C.fg })}` +
  text(W - 72, 90, `0${n} / 04`, { size: 22, family: MONO, fill: C.subtle, anchor: "end", spacing: 2 });

/* ---------- the price chart ---------- */

const CHART = { x0: 300, x1: 1620, y0: 330, y1: 800, pMin: 2150, pMax: 3250 };
const yOf = (price) => CHART.y1 - ((price - CHART.pMin) / (CHART.pMax - CHART.pMin)) * (CHART.y1 - CHART.y0);
const xOf = (u) => CHART.x0 + u * (CHART.x1 - CHART.x0);

const lcg = (seed) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};

/* Scene one's path: inside the band, out above it for a stretch, back in. Drawn to make the point, not measured. */
const BAND1 = { lower: 2480, upper: 2900 };
const PATH1 = (() => {
  const r = lcg(7);
  const n = 260;
  const out = [];
  let noise = 0;
  for (let i = 0; i < n; i += 1) {
    const u = i / (n - 1);
    const hump = Math.exp(-(((u - 0.56) / 0.11) ** 2));
    noise = noise * 0.86 + (r() - 0.5) * 40;
    out.push(2690 + 120 * Math.sin(u * 9.5) + hump * 400 + noise);
  }
  return out;
})();

/* Scenes two and three: thirty closes with exactly 26 inside the band the site drew, the seed searched for. */
const BAND2 = { lower: 2402, upper: 3024 };
const CLOSES = (() => {
  for (let seed = 1; seed < 100000; seed += 1) {
    const r = lcg(seed);
    let v = 2713;
    const closes = [];
    for (let i = 0; i < 30; i += 1) {
      v = 2713 + (v - 2713) * 0.82 + (r() - 0.5) * 300;
      closes.push(v);
    }
    const inside = closes.filter((p) => p >= BAND2.lower && p <= BAND2.upper).length;
    const outsideSpread = closes.every((p) => p > 2250 && p < 3200);
    if (inside === 26 && outsideSpread) return closes;
  }
  throw new Error("no series with 26 of 30 inside");
})();

const bandRect = (band, { grow = 1, opacity = 1 } = {}) => {
  const mid = (yOf(band.lower) + yOf(band.upper)) / 2;
  const half = ((yOf(band.lower) - yOf(band.upper)) / 2) * grow;
  return `<g opacity="${fmt(opacity)}">
<rect x="${CHART.x0}" y="${fmt(mid - half)}" width="${CHART.x1 - CHART.x0}" height="${fmt(half * 2)}" fill="${C.accentSoft}" opacity="0.85"/>
<line x1="${CHART.x0}" x2="${CHART.x1}" y1="${fmt(mid - half)}" y2="${fmt(mid - half)}" stroke="${C.accent}" stroke-width="2"/>
<line x1="${CHART.x0}" x2="${CHART.x1}" y1="${fmt(mid + half)}" y2="${fmt(mid + half)}" stroke="${C.accent}" stroke-width="2"/>
</g>`;
};

const gridLines = () =>
  [2300, 2600, 2900, 3200]
    .map(
      (p) =>
        `<line x1="${CHART.x0}" x2="${CHART.x1}" y1="${fmt(yOf(p))}" y2="${fmt(yOf(p))}" stroke="${C.border}" stroke-width="1"/>` +
        text(CHART.x0 - 18, yOf(p) + 8, String(p).replace(/(\d)(\d{3})$/, "$1,$2"), { size: 20, family: MONO, fill: C.subtle, anchor: "end" }),
    )
    .join("");

/* ---------- scenes ---------- */

const sceneTitle = (local, lang) => {
  const s = STRINGS[lang];
  const draw = prog(local, 0.2, 1.6);
  const show = prog(local, 0.3, 1.0);
  return (
    mark(W / 2 - 80, 250, 160, { draw, opacity: show }) +
    rise(local, 1.4, text(W / 2, 540, s.name, { size: 112, family: SERIF, anchor: "middle" }), { dist: 20 }) +
    rise(local, 2.2, text(W / 2, 650, `${s.headline[0]} ${s.headline[1]}`, { size: 56, family: SERIF, fill: C.accent, anchor: "middle" })) +
    rise(local, 3.0, text(W / 2, 760, s.tagline, { size: 32, fill: C.muted, anchor: "middle" })) +
    rise(local, 3.6, text(W / 2, 880, s.site, { size: 28, family: MONO, fill: C.subtle, anchor: "middle", spacing: 1 }))
  );
};

const sceneRange = (local, lang) => {
  const s = STRINGS[lang];
  const reveal = easeInOut((local - 1.2) / 9.5);
  const n = PATH1.length;
  const shown = Math.max(2, Math.floor(reveal * n));
  const points = [];
  const ticks = [];
  for (let i = 0; i < shown; i += 1) {
    const u = i / (n - 1);
    const x = xOf(u);
    const y = yOf(PATH1[i]);
    points.push(`${fmt(x)},${fmt(y)}`);
    const inside = PATH1[i] >= BAND1.lower && PATH1[i] <= BAND1.upper;
    if (inside && i % 5 === 0 && i > 0) ticks.push(`<circle cx="${fmt(x)}" cy="${fmt(y - 22)}" r="4" fill="${C.accent}"/>`);
  }
  const head = PATH1[shown - 1];
  const headInside = head >= BAND1.lower && head <= BAND1.upper;
  const hx = xOf((shown - 1) / (n - 1));
  const hy = yOf(head);
  const headFill = headInside ? C.accent : C.muted;
  /* The state is said in one fixed place under the chart, never beside the moving point, where it would cross the line. */
  const status =
    `<circle cx="${CHART.x0 + 8}" cy="${CHART.y1 + 40}" r="7" fill="${headFill}"/>` +
    text(CHART.x0 + 30, CHART.y1 + 49, headInside ? s.inRange : s.outRange, { size: 26, fill: headFill, family: MONO });
  return (
    header(lang, 1) +
    title(local, 0.1, s.s1Title) +
    `<g opacity="${fmt(prog(local, 0.5, 0.8))}">${gridLines()}${bandRect(BAND1)}</g>` +
    (reveal > 0
      ? `<polyline points="${points.join(" ")}" fill="none" stroke="${C.fg}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>` +
        ticks.join("") +
        `<circle cx="${fmt(hx)}" cy="${fmt(hy)}" r="9" fill="${headFill}"/>` +
        `<circle cx="${fmt(hx)}" cy="${fmt(hy)}" r="16" fill="none" stroke="${headFill}" stroke-width="2" opacity="0.5"/>` +
        status
      : "") +
    `<g opacity="${fmt(prog(local, 0.8, 0.8))}">${text(CHART.x1 + 16, yOf(BAND1.upper) + 8, s.upperLabel, { size: 20, family: MONO, fill: C.accent })}${text(CHART.x1 + 16, yOf(BAND1.lower) + 8, s.lowerLabel, { size: 20, family: MONO, fill: C.accent })}</g>` +
    caption(local, 1.6, s.s1Caption)
  );
};

const closesDots = (count, { sweep = -1, highlight = false } = {}) => {
  const out = [];
  for (let i = 0; i < Math.min(count, CLOSES.length); i += 1) {
    const u = (i + 0.5) / CLOSES.length;
    const x = xOf(u);
    const y = yOf(CLOSES[i]);
    const inside = CLOSES[i] >= BAND2.lower && CLOSES[i] <= BAND2.upper;
    const swept = highlight && u <= sweep;
    const fill = swept ? (inside ? C.accent : C.border) : C.fg;
    const r = swept && inside ? 9 : 7;
    out.push(`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${r}" fill="${fill}"/>`);
    if (swept && !inside) out.push(`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="12" fill="none" stroke="${C.subtle}" stroke-width="1.5" stroke-dasharray="3 3"/>`);
  }
  return out.join("");
};

const bandLabels = (opacity) =>
  `<g opacity="${fmt(opacity)}">` +
  text(CHART.x1 + 16, yOf(BAND2.upper) + 9, "3,024", { size: 26, family: MONO, fill: C.accent }) +
  text(CHART.x1 + 16, yOf(BAND2.lower) + 9, "2,402", { size: 26, family: MONO, fill: C.accent }) +
  `</g>`;

const sceneMeasure = (local, lang) => {
  const s = STRINGS[lang];
  const dots = Math.floor(clamp01((local - 1.0) / 4.2) * 31);
  const grow = prog(local, 6.0, 1.4);
  return (
    header(lang, 2) +
    title(local, 0.1, s.s2Title) +
    `<g opacity="${fmt(prog(local, 0.4, 0.8))}">${gridLines()}</g>` +
    (grow > 0 ? bandRect(BAND2, { grow, opacity: grow }) : "") +
    closesDots(dots) +
    rise(local, 1.4, text(CHART.x0, CHART.y1 + 46, s.closes, { size: 24, family: MONO, fill: C.subtle })) +
    rise(local, 6.6, text(CHART.x1, CHART.y1 + 46, s.band, { size: 24, family: MONO, fill: C.accent, anchor: "end" })) +
    bandLabels(prog(local, 6.8, 0.8)) +
    rise(local, 8.6, text(W / 2, 258, s.noForecast, { size: 30, fill: C.accent, anchor: "middle" })) +
    caption(local, 2.2, s.s2Caption)
  );
};

const sceneReplay = (local, lang) => {
  const s = STRINGS[lang];
  const sweep = easeInOut((local - 1.0) / 5.5);
  /* Each figure under its own label, one row per 120 px: the Turkish values are too wide to sit beside their labels. */
  const rows = s.s3Rows
    .map(([label, value], i) =>
      rise(
        local,
        2.4 + i * 1.6,
        text(1120, 436 + i * 120, label, { size: 26, fill: C.muted }) + text(1120, 486 + i * 120, value, { size: 44, family: MONO, fill: i === 0 ? C.fg : C.accent }),
      ),
    )
    .join("");
  const sweepX = xOf(sweep);
  /* The chart, drawn at its usual coordinates and scaled into the left half: 0.62 of its size, its left edge at x = 180. */
  const k = 0.62;
  return (
    header(lang, 3) +
    title(local, 0.1, s.s3Title) +
    `<g transform="translate(${fmt(180 - CHART.x0 * k)} ${fmt(360 - CHART.y0 * k)}) scale(${k})">` +
    `<g opacity="0.9">${gridLines()}</g>${bandRect(BAND2)}${closesDots(30, { sweep, highlight: true })}` +
    (sweep > 0 && sweep < 1 ? `<line x1="${fmt(sweepX)}" x2="${fmt(sweepX)}" y1="${CHART.y0 - 10}" y2="${CHART.y1 + 10}" stroke="${C.accent}" stroke-width="2" stroke-dasharray="6 6"/>` : "") +
    `</g>` +
    `<line x1="1120" x2="1640" y1="392" y2="392" stroke="${C.border}" stroke-width="1" opacity="${fmt(prog(local, 2.2, 0.6))}"/>` +
    rows +
    `<line x1="1120" x2="1640" y1="760" y2="760" stroke="${C.border}" stroke-width="1" opacity="${fmt(prog(local, 7.2, 0.6))}"/>` +
    rise(local, 8.0, s.s3Note.map((line, i) => text(1120, 804 + i * 30, line, { size: 19, family: MONO, fill: C.subtle })).join("")) +
    caption(local, 1.8, s.s3Caption)
  );
};

/* Four small line icons, all strokes in the accent colour, each 64×64 at its origin. */
const ICONS = [
  // bars rising, the tallest in pink
  `<rect x="6" y="36" width="12" height="22" rx="2" fill="${C.border}"/><rect x="26" y="24" width="12" height="34" rx="2" fill="${C.border}"/><rect x="46" y="8" width="12" height="50" rx="2" fill="${C.accent}"/>`,
  // a range with a dot inside
  `<line x1="6" x2="58" y1="20" y2="20" stroke="${C.accent}" stroke-width="3"/><line x1="6" x2="58" y1="46" y2="46" stroke="${C.accent}" stroke-width="3"/><rect x="6" y="20" width="52" height="26" fill="${C.accentSoft}"/><circle cx="36" cy="33" r="6" fill="${C.fg}"/>`,
  // a paper plane
  `<path d="M6 30 L58 8 L40 58 L30 36 Z" fill="none" stroke="${C.accent}" stroke-width="3" stroke-linejoin="round"/><path d="M30 36 L58 8" stroke="${C.accent}" stroke-width="3"/>`,
  // a grid of nodes
  [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => `<circle cx="${12 + c * 20}" cy="${12 + r * 20}" r="5" fill="${(r + c) % 2 === 0 ? C.accent : C.border}"/>`)).join(""),
];

const sceneMore = (local, lang) => {
  const s = STRINGS[lang];
  const cards = s.cards
    .map(([head, l1, l2], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 220 + col * 760;
      const y = 300 + row * 270;
      const p = prog(local, 0.9 + i * 1.1, 0.8);
      if (p <= 0) return "";
      return `<g opacity="${fmt(p)}" transform="translate(0 ${fmt(lerp(30, 0, p))})">
<rect x="${x}" y="${y}" width="720" height="222" rx="20" fill="${C.surface}" stroke="${C.border}" stroke-width="1.5"/>
<g transform="translate(${x + 40} ${y + 44})">${ICONS[i]}</g>
${text(x + 136, y + 84, head, { size: 34, family: SERIF })}
${text(x + 136, y + 134, l1, { size: 25, fill: C.muted })}
${text(x + 136, y + 170, l2, { size: 25, fill: C.muted })}
</g>`;
    })
    .join("");
  return header(lang, 4) + title(local, 0.1, s.s4Title) + cards + caption(local, 5.6, s.s4Caption);
};

const sceneClose = (local, lang) => {
  const s = STRINGS[lang];
  return (
    mark(W / 2 - 60, 300, 120, { draw: 1, opacity: prog(local, 0.2, 0.8) }) +
    rise(local, 0.6, text(W / 2, 540, s.name, { size: 96, family: SERIF, anchor: "middle" }), { dist: 18 }) +
    rise(local, 1.4, text(W / 2, 640, s.close[0], { size: 44, family: SERIF, fill: C.accent, anchor: "middle" })) +
    rise(local, 2.1, text(W / 2, 710, s.close[1], { size: 28, fill: C.muted, anchor: "middle" })) +
    rise(local, 2.8, text(W / 2, 840, s.site, { size: 40, family: MONO, fill: C.fg, anchor: "middle", spacing: 1 }))
  );
};

const DRAW = { title: sceneTitle, range: sceneRange, measure: sceneMeasure, replay: sceneReplay, more: sceneMore, close: sceneClose };

/** The whole frame at second `t`: the background, and the scene it falls in, faded at both ends. */
export const frame = (t, lang = "en") => {
  const clampedT = Math.max(0, Math.min(DURATION - 1 / FPS, t));
  const scene = SCENES.find((s) => clampedT >= s.start && clampedT < s.end) ?? SCENES[SCENES.length - 1];
  const local = clampedT - scene.start;
  const remaining = scene.end - clampedT;
  const opacity = Math.min(easeOut(local / 0.5), easeOut(remaining / 0.6));
  const body = DRAW[scene.key](local, lang);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><radialGradient id="glow" cx="0.2" cy="0.15" r="0.8"><stop offset="0" stop-color="${C.accentSoft}" stop-opacity="0.55"/><stop offset="1" stop-color="${C.bg}" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<g opacity="${fmt(opacity)}">${body}</g>
</svg>`;
};

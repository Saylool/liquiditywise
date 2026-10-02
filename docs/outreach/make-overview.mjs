// Writes the one-to-two page product overview for the grant form as a plain
// PDF (Helvetica, ASCII only), with no dependencies: node make-overview.mjs out.pdf
import { writeFileSync } from "node:fs";

const out = process.argv[2] ?? "liquiditywise-overview.pdf";
const W = 595, H = 842, MARGIN = 56;

const sections = [
  ["h1", "LiquidityWise"],
  ["sub", "Product overview - an independent, educational advisor for Uniswap v3 and v4 liquidity providers"],
  ["p", "liquiditywise.com  |  github.com/Saylool/liquiditywise (MIT)  |  x.com/LiquidityWise"],
  ["h2", "The problem"],
  ["p", "Providing liquidity on Uniswap means choosing a price range. Too narrow and a position stops earning the moment the price moves; too wide and it earns very little. Most guides hand over a number the reader cannot check, mostly in English, and a language model asked to explain it can invent one."],
  ["h2", "What LiquidityWise does"],
  ["b", "Works out a suggested price range from how far a pair has actually moved, for v3 and v4 pools on Ethereum, Base, Arbitrum, Unichain, OP Mainnet and Polygon."],
  ["b", "Shows where the best-earning liquidity sits, measured on chain: the fees each position earned since it last changed, over its value now. The page says what that figure leaves out."],
  ["b", "Lists v4 hooks with the permissions each one has, and warns where a hook can alter a swap."],
  ["b", "Shows the positions of any public address, with optional Telegram alerts when one leaves its range."],
  ["b", "Interface and explanations in ten languages: English, Turkish, German, Spanish, Arabic, Hindi, Chinese (simplified and traditional), Russian, Portuguese."],
  ["h2", "Why it can be trusted"],
  ["b", "Every figure is computed by code from the pool's own data and cross-checked. The language model only explains it and is never allowed to state a number."],
  ["b", "It never asks a wallet for a signature or a transaction, and keeps nothing about who reads the site."],
  ["b", "It is monitored (data sources probed hourly, outages reported) and covered by over 4,000 automated tests. The code is open under the MIT licence."],
  ["h2", "Use so far (first week measured, 25 Sep - 1 Oct 2026)"],
  ["b", "981 pages opened by people (bots excluded); 32 different pools opened; 12 searches."],
  ["b", "Readers in all ten languages; the largest were English (455), Chinese (377) and Turkish (42)."],
  ["b", "Model cost for the week: about USD 1. Telegram alerts are new: 0 chats following an address so far."],
  ["b", "No TVL, volume or revenue: it is a read-only educational tool."],
  ["h2", "What the grant would pay for (six months)"],
  ["b", "Months 1-2: positions on Arbitrum (no data source answers today) and v4 positions."],
  ["b", "Months 3-4: native-speaker review of the ten languages and a public methodology page."],
  ["b", "Months 5-6: promote the Telegram alerts where the largest readers already are; publish the weekly usage counts."],
  ["p", "Requested: USD 25,400 = engineering 390 h x USD 50 (19,500) + language review (3,000, estimate) + independent method review (2,000, estimate) + running costs 6 x USD 150 (900)."],
  ["small", "Independent educational project. Not affiliated with Uniswap Labs or the Uniswap Foundation. Not financial advice."],
];

const style = {
  h1: { font: "F2", size: 26, gap: 10, before: 0 },
  sub: { font: "F1", size: 12, gap: 6, before: 0 },
  h2: { font: "F2", size: 13, gap: 3, before: 8 },
  p: { font: "F1", size: 10.5, gap: 4, before: 0 },
  b: { font: "F1", size: 10.5, gap: 2, before: 0, indent: 14 },
  small: { font: "F1", size: 9, gap: 0, before: 8 },
};

const widthOf = (text, size, bold) => {
  let w = 0;
  for (const ch of text) {
    if ("iljtfI.,;:!'|() -".includes(ch)) w += ch === " " ? 0.278 : 0.3;
    else if ("mwMW".includes(ch)) w += 0.83;
    else if (/[A-Z]/.test(ch)) w += 0.68;
    else if (/[0-9]/.test(ch)) w += 0.556;
    else w += 0.52;
  }
  return w * size * (bold ? 1.06 : 1);
};
const wrap = (text, size, bold, max) => {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line === "" ? word : `${line} ${word}`;
    if (widthOf(next, size, bold) > max && line !== "") {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line !== "") lines.push(line);
  return lines;
};
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const pages = [[]];
let y = H - MARGIN;
for (const [kind, text] of sections) {
  const s = style[kind];
  const bold = s.font === "F2";
  const indent = s.indent ?? 0;
  const lines = wrap(kind === "b" ? text : text, s.size, bold, W - 2 * MARGIN - indent - 6);
  const lead = s.size * 1.28;
  const needed = s.before + lines.length * lead + s.gap;
  if (y - needed < MARGIN) {
    pages.push([]);
    y = H - MARGIN;
  } else y -= s.before;
  const page = pages[pages.length - 1];
  lines.forEach((line, i) => {
    y -= lead;
    if (kind === "b" && i === 0) page.push(`BT /F1 ${s.size} Tf ${MARGIN} ${y.toFixed(1)} Td (-) Tj ET`);
    page.push(`BT /${s.font} ${s.size} Tf ${MARGIN + indent} ${y.toFixed(1)} Td (${esc(line)}) Tj ET`);
  });
  y -= s.gap;
}

const objects = [];
const add = (body) => objects.push(body) && objects.length;
const catalog = add("");
const pagesObj = add("");
const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
const kids = pages.map((ops) => {
  const stream = ops.join("\n");
  const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  return add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`);
});
objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;

let pdf = "%PDF-1.4\n";
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xref = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(out, pdf, "latin1");
console.log(`wrote ${out}: ${pages.length} page(s), ${pdf.length} bytes`);

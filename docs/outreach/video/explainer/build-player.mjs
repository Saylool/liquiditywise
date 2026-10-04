// Writes the explainer as one HTML file that plays scene.mjs in a browser:
// the scene code inlined, the site's three fonts embedded, and a player of a
// few lines — click to pause, arrows to seek, a button for each language.
//
//   node docs/outreach/video/explainer/build-player.mjs [--out file.html]
//
// Nothing is fetched at play time; the file stands on its own, so it can be
// sent as an attachment or dropped into a static host.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fonts = resolve(here, "../../../../src/app/fonts");
const outIndex = process.argv.indexOf("--out");
const out = outIndex === -1 ? join(here, "..", "liquiditywise-explainer.html") : process.argv[outIndex + 1];

const face = (family, file, extra = "") =>
  `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${readFileSync(join(fonts, file)).toString("base64")}) format("woff2");${extra}}`;

/* The scene as a plain script: its `export` keywords dropped, nothing else touched. */
const scene = readFileSync(join(here, "scene.mjs"), "utf8").replace(/^export /gm, "");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LiquidityWise — explainer</title>
<style>
${face("Instrument Serif", "InstrumentSerif-Regular.woff2")}
${face("Geist", "Geist-Variable.woff2", "font-weight:100 900;")}
${face("Geist Mono", "GeistMono-Variable.woff2", "font-weight:100 900;")}
html,body{margin:0;height:100%;background:#120f14;color:#b5a6b3;font-family:Geist,sans-serif}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px;box-sizing:border-box}
#stage{width:min(100%,calc((100vh - 90px) * 16 / 9));aspect-ratio:16/9;cursor:pointer;position:relative}
#stage svg{width:100%;height:100%;display:block;border-radius:12px}
#bar{position:absolute;left:0;right:0;bottom:0;height:3px;background:#352b35;border-radius:0 0 12px 12px;overflow:hidden}
#bar i{display:block;height:100%;width:0;background:#ee9cbe}
#controls{display:flex;gap:10px;align-items:center;font-size:14px}
button{font:inherit;color:#f5edf3;background:#1c171e;border:1px solid #352b35;border-radius:999px;padding:6px 14px;cursor:pointer}
button[aria-pressed="true"]{border-color:#ee9cbe;color:#ee9cbe}
#hint{opacity:.7}
</style>
</head>
<body>
<div id="stage"><div id="svg"></div><div id="bar"><i></i></div></div>
<div id="controls">
<button id="en" aria-pressed="true">English</button>
<button id="tr" aria-pressed="false">Türkçe</button>
<button id="replay">↺</button>
<span id="hint">click: pause · ← →: 5 s</span>
</div>
<script>
${scene}
const stage = document.getElementById("svg"), bar = document.querySelector("#bar i");
let lang = "en", t = 0, playing = true, last = performance.now();
const show = () => { stage.innerHTML = frame(t, lang); bar.style.width = (100 * t / DURATION) + "%"; };
const tick = (now) => {
  if (playing) { t += (now - last) / 1000; if (t >= DURATION) { t = DURATION - 1 / FPS; playing = false; } show(); }
  last = now; requestAnimationFrame(tick);
};
document.getElementById("stage").addEventListener("click", () => { playing = !playing; if (playing && t >= DURATION - 1 / FPS) t = 0; });
document.getElementById("replay").addEventListener("click", () => { t = 0; playing = true; });
for (const code of ["en", "tr"]) document.getElementById(code).addEventListener("click", () => {
  lang = code; for (const other of ["en", "tr"]) document.getElementById(other).setAttribute("aria-pressed", String(other === code)); show();
});
addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") t = Math.min(DURATION - 1 / FPS, t + 5);
  else if (e.key === "ArrowLeft") t = Math.max(0, t - 5);
  else if (e.key === " ") { e.preventDefault(); playing = !playing; }
  else return;
  show();
});
document.fonts.ready.then(() => { last = performance.now(); requestAnimationFrame(tick); });
</script>
</body>
</html>
`;
writeFileSync(out, html);
console.log(`${out} (${(html.length / 1024).toFixed(0)} KB)`);

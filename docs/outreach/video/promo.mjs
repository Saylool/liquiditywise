// The 30-second promo: the generated background, re-tinted for each caption,
// the captions drawn here (so they are spelled right), and a voice-over.
//
//   node docs/outreach/video/promo.mjs --bg assets/intro-bg.mp4 --voice voice.mp3 [--shots shots.json] [--out promo.mp4]
//
// No footage of the site and no generated interface: only light, words and
// the address. Run on the voice from Higgsfield, or any other.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const bg = arg("bg");
const voice = arg("voice");
const out = arg("out", "liquiditywise-promo.mp4");
const shotsFile = arg("shots", null);
if (!bg || !voice) {
  console.error("usage: promo.mjs --bg intro-bg.mp4 --voice voice.mp3 [--out out.mp4]");
  process.exit(1);
}

const W = 1920, H = 1080, FPS = 30;
const dir = mkdtempSync(join(tmpdir(), "lw-short-"));
const run = (args) => execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });
const durationOf = (file) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]).toString());

const LEAD = 1.5, TAIL = 4;
const voiceLength = durationOf(voice);
const total = LEAD + voiceLength + TAIL;

const defaultShots = [
  { hue: 0, lines: [{ t: "LiquidityWise", size: 150, y: 520, weight: 700 }, { t: "Every figure computed by code. Never guessed by AI.", size: 48, y: 620, weight: 400 }] },
  { hue: 35, lines: [{ t: "Every figure computed by code", size: 90, y: 560, weight: 700 }] },
  { hue: 80, lines: [{ t: "Explained in plain language", size: 90, y: 520, weight: 700 }, { t: "in 10 languages", size: 90, y: 630, weight: 700 }] },
  { hue: -40, lines: [{ t: "Where the best-earning liquidity sits", size: 80, y: 520, weight: 700 }, { t: "measured on chain", size: 56, y: 620, weight: 400 }] },
  { hue: 0, lines: [{ t: "liquiditywise.com", size: 120, y: 480, weight: 700 }, { t: "Independent and educational.", size: 48, y: 580, weight: 400 }, { t: "Not affiliated with Uniswap Labs. Not financial advice.", size: 40, y: 650, weight: 400 }, { t: "Made with AI: visuals and voice-over.", size: 34, y: 760, weight: 400 }] },
];
const shots = shotsFile === null ? defaultShots : JSON.parse((await import("node:fs")).readFileSync(shotsFile, "utf8"));
const per = total / shots.length;

const files = [];
for (const [i, shot] of shots.entries()) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${shot.lines
    .map(({ t, size, y, weight }) => `<text x="50%" y="${y}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${weight === 700 ? "#ffffff" : "#cfd8ff"}">${t}</text>`)
    .join("")}</svg>`;
  const png = join(dir, `s${i}.png`);
  await sharp(Buffer.from(svg)).png().toFile(png);
  const file = join(dir, `s${i}.mp4`);
  run([
    "-stream_loop", "-1", "-ss", String((i * 1.3) % 6), "-i", bg, "-loop", "1", "-i", png,
    "-filter_complex",
    `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},hue=h=${shot.hue},eq=brightness=-0.1[b];[b][1:v]overlay=0:0:format=auto,fade=t=in:d=0.5,fade=t=out:st=${(per - 0.5).toFixed(2)}:d=0.5[v]`,
    "-map", "[v]", "-t", per.toFixed(3), "-pix_fmt", "yuv420p", "-an", file,
  ]);
  files.push(file);
}

const list = join(dir, "list.txt");
writeFileSync(list, files.map((f) => `file '${f}'`).join("\n"));
const silent = join(dir, "silent.mp4");
run(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", silent]);
run([
  "-i", silent, "-i", voice,
  "-filter_complex", `[1:a]adelay=${Math.round(LEAD * 1000)}|${Math.round(LEAD * 1000)},apad[a]`,
  "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", total.toFixed(2), "-movflags", "+faststart", out,
]);
console.log(`wrote ${out} (${total.toFixed(1)}s, voice ${voiceLength.toFixed(1)}s)`);

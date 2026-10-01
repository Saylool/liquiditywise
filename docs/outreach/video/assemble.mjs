// Builds the promo video: an AI-made background with the name drawn over it
// (so the name is spelled right), then the real screen recording, then a
// closing card. Needs ffmpeg and, from the repo, sharp.
//
//   node docs/outreach/video/assemble.mjs --bg bg.mp4 --screen screen.mov \
//        [--voice voice.mp3] [--out liquiditywise-promo.mp4]
//
// The intro and the closing card are the only generated parts; everything
// between them is the real site.
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
const screen = arg("screen");
const voice = arg("voice", null);
const out = arg("out", "liquiditywise-promo.mp4");
if (!bg || !screen) {
  console.error("usage: assemble.mjs --bg bg.mp4 --screen screen.mov [--voice voice.mp3] [--out out.mp4]");
  process.exit(1);
}

const W = 1920, H = 1080, FPS = 30, CARD = 5;
const dir = mkdtempSync(join(tmpdir(), "lw-promo-"));
const run = (args) => execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });

const card = async (file, lines) => {
  const text = lines
    .map(({ t, size, y, weight, fill }) => `<text x="50%" y="${y}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${t}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${text}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
};

await card(join(dir, "intro.png"), [
  { t: "LiquidityWise", size: 150, y: 520, weight: 700, fill: "#ffffff" },
  { t: "Every figure computed by code. Never guessed by AI.", size: 48, y: 620, weight: 400, fill: "#cfd8ff" },
]);
await card(join(dir, "outro.png"), [
  { t: "liquiditywise.com", size: 120, y: 500, weight: 700, fill: "#ffffff" },
  { t: "Independent and educational. Not affiliated with Uniswap Labs.", size: 44, y: 600, weight: 400, fill: "#cfd8ff" },
  { t: "Not financial advice.", size: 44, y: 665, weight: 400, fill: "#cfd8ff" },
]);

const segment = (name, png, flags = []) => {
  const file = join(dir, `${name}.mp4`);
  run([
    ...flags, "-i", bg, "-loop", "1", "-i", png,
    "-filter_complex", `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},eq=brightness=-0.08[b];[b][1:v]overlay=0:0:format=auto,fade=t=in:d=0.6,fade=t=out:st=${CARD - 0.6}:d=0.6[v]`,
    "-map", "[v]", "-t", String(CARD), "-pix_fmt", "yuv420p", "-an", file,
  ]);
  return file;
};
const intro = segment("intro", join(dir, "intro.png"));
const outro = segment("outro", join(dir, "outro.png"), ["-stream_loop", "-1"]);

const main = join(dir, "main.mp4");
run([
  "-i", screen,
  "-vf", `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x0b0b10,fps=${FPS}`,
  "-pix_fmt", "yuv420p", "-an", main,
]);

const list = join(dir, "list.txt");
writeFileSync(list, [intro, main, outro].map((f) => `file '${f}'`).join("\n"));
const silent = join(dir, "silent.mp4");
run(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", silent]);

if (voice === null) {
  run(["-i", silent, "-c", "copy", out]);
} else {
  // The voice starts when the intro ends and is never cut off by the closing card.
  run(["-i", silent, "-i", voice, "-filter_complex", `[1:a]adelay=${CARD * 1000}|${CARD * 1000},apad[a]`, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", out]);
}
console.log(`wrote ${out}`);

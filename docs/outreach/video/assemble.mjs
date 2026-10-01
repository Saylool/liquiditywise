// Builds the promo video: an AI-made background with the name drawn over it
// (so the name is spelled right), then the real screen recordings with the
// voice-over, then a closing card. Needs ffmpeg and, from the repo, sharp.
//
//   node docs/outreach/video/assemble.mjs --bg assets/intro-bg.mp4 --scenes ~/Desktop/scenes [--out promo.mp4]
//
// `--scenes` is a folder holding, for each scene N of voiceover-script.md,
// the screen recording N.(mov|mp4|mkv) and the voice N.(mp3|m4a|wav|aac).
// Each scene is fitted to its own voice, so the two can be recorded apart:
// a recording longer than its voice is sped up (at most 1.5x, then cut), a
// shorter one holds its last frame. The voice always finishes before the next
// scene starts. Without --scenes, give one recording and one voice:
//   --screen screen.mov --voice voice.mp3
//
// The intro and the closing card are the only generated parts; everything
// between them is the real site.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
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
const scenesDir = arg("scenes", null);
const screen = arg("screen", null);
const voice = arg("voice", null);
const out = arg("out", "liquiditywise-promo.mp4");
if (!bg || (scenesDir === null && (screen === null || voice === null))) {
  console.error("usage: assemble.mjs --bg intro-bg.mp4 (--scenes DIR | --screen S --voice V) [--out out.mp4]");
  process.exit(1);
}

const W = 1920, H = 1080, FPS = 30, CARD = 5, TAIL = 0.6, MAX_SPEEDUP = 1.5;
const dir = mkdtempSync(join(tmpdir(), "lw-promo-"));
const run = (args) => execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });
const durationOf = (file) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]).toString());

const pairs = [];
if (scenesDir !== null) {
  const files = readdirSync(scenesDir);
  for (let n = 1; ; n += 1) {
    const video = files.find((f) => new RegExp(`^${n}\\.(mov|mp4|mkv)$`, "i").test(f));
    const audio = files.find((f) => new RegExp(`^${n}\\.(mp3|m4a|wav|aac)$`, "i").test(f));
    if (video === undefined && audio === undefined) break;
    if (video === undefined || audio === undefined) {
      console.error(`scene ${n} needs both a recording and a voice`);
      process.exit(1);
    }
    pairs.push({ n, video: join(scenesDir, video), audio: join(scenesDir, audio) });
  }
} else {
  pairs.push({ n: 1, video: screen, audio: voice });
}
if (pairs.length === 0) {
  console.error("no scenes found: name the files 1.mov, 1.mp3, 2.mov, 2.mp3, …");
  process.exit(1);
}

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

const AUDIO = ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"];
const card_ = (name, png, flags) => {
  const file = join(dir, `${name}.mp4`);
  run([
    ...flags, "-i", bg, "-loop", "1", "-i", png, ...AUDIO,
    "-filter_complex", `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},eq=brightness=-0.08[b];[b][1:v]overlay=0:0:format=auto,fade=t=in:d=0.6,fade=t=out:st=${CARD - 0.6}:d=0.6[v]`,
    "-map", "[v]", "-map", "2:a", "-t", String(CARD), "-pix_fmt", "yuv420p", "-c:a", "aac", file,
  ]);
  return file;
};
const intro = card_("intro", join(dir, "intro.png"), []);
const outro = card_("outro", join(dir, "outro.png"), ["-stream_loop", "-1"]);

const scenes = pairs.map(({ n, video, audio }) => {
  const dv = durationOf(video);
  const da = durationOf(audio);
  const target = da + TAIL;
  const speed = Math.min(Math.max(dv / target, 1), MAX_SPEEDUP);
  const fitted = dv / speed;
  /* Longer than the voice even sped up: cut. Shorter: hold the last frame. */
  const filters = [
    `setpts=PTS/${speed}`,
    `scale=${W}:${H}:force_original_aspect_ratio=decrease`,
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x0b0b10`,
    `fps=${FPS}`,
    ...(fitted < target ? [`tpad=stop_mode=clone:stop_duration=${(target - fitted).toFixed(3)}`] : []),
  ].join(",");
  const file = join(dir, `scene-${n}.mp4`);
  run([
    "-i", video, "-i", audio,
    "-filter_complex", `[0:v]${filters}[v];[1:a]aresample=48000,apad[a]`,
    "-map", "[v]", "-map", "[a]", "-t", target.toFixed(3), "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", file,
  ]);
  console.log(`scene ${n}: voice ${da.toFixed(1)}s, recording ${dv.toFixed(1)}s${speed > 1 ? ` (sped up ${speed.toFixed(2)}x)` : ""}${fitted > target + 0.05 ? " — CUT, record it shorter" : ""}`);
  return file;
});

const list = join(dir, "list.txt");
writeFileSync(list, [intro, ...scenes, outro].map((f) => `file '${f}'`).join("\n"));
run(["-f", "concat", "-safe", "0", "-i", list, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", out]);
console.log(`wrote ${out} (${durationOf(out).toFixed(1)}s)`);
if (!existsSync(out)) process.exit(1);

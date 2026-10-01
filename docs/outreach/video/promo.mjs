// The promo: real pictures of the site, moved slowly behind captions drawn
// here (so they are spelled right), and a voice-over.
//
//   node docs/outreach/video/promo.mjs --voice voice.mp3 --shots shots-site.json [--dir assets/shots] [--bg intro-bg.mp4] [--out promo.mp4]
//
// A shot is { image, weight, lines } — an image from --dir, how long it stays
// relative to the others, and its caption lines — or { hue, weight, lines }
// over the generated --bg clip. The pictures are screenshots of the real
// pages; nothing here draws an interface.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const voice = arg("voice");
const shotsFile = arg("shots");
const imageDir = arg("dir", "docs/outreach/video/assets/shots");
const bg = arg("bg", "docs/outreach/video/assets/intro-bg.mp4");
const out = arg("out", "liquiditywise-promo.mp4");
if (!voice || !shotsFile) {
  console.error("usage: promo.mjs --voice voice.mp3 --shots shots.json [--dir DIR] [--bg clip.mp4] [--out out.mp4]");
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
const shots = JSON.parse(readFileSync(shotsFile, "utf8"));
const sum = shots.reduce((s, { weight = 1 }) => s + weight, 0);

const caption = async (png, shot) => {
  const lines = shot.lines;
  const panel =
    shot.image === undefined
      ? ""
      : `<rect x="140" y="${lines[0].y - lines[0].size * 0.95}" width="1640" height="${lines.at(-1).y + 28 - (lines[0].y - lines[0].size * 0.95)}" rx="22" fill="rgba(8,8,12,0.78)"/>`;
  const text = lines
    .map(({ t, size, y, weight }) => `<text x="50%" y="${y}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${weight === 700 ? "#ffffff" : "#d6dcff"}">${t}</text>`)
    .join("");
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${panel}${text}</svg>`)).png().toFile(png);
};

const files = [];
for (const [i, shot] of shots.entries()) {
  const seconds = (total * (shot.weight ?? 1)) / sum;
  const frames = Math.round(seconds * FPS);
  const png = join(dir, `s${i}.png`);
  await caption(png, shot);
  const file = join(dir, `s${i}.mp4`);
  const fades = `fade=t=in:d=0.5,fade=t=out:st=${(seconds - 0.5).toFixed(2)}:d=0.5`;
  if (shot.image !== undefined) {
    /* A screenshot, cut to 16:9, upscaled, and moved slowly: a push-in that drifts down the page. */
    run([
      "-loop", "1", "-i", join(imageDir, shot.image), "-loop", "1", "-i", png,
      "-filter_complex",
      `[0:v]crop=800:450:0:25,scale=3840:2160:flags=lanczos,zoompan=z='1+0.10*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+${i % 2 === 0 ? "" : "-"}20*on/${frames}':d=${frames}:s=${W}x${H}:fps=${FPS}[b];[b][1:v]overlay=0:0:format=auto,${fades}[v]`,
      "-map", "[v]", "-t", seconds.toFixed(3), "-pix_fmt", "yuv420p", "-an", file,
    ]);
  } else {
    run([
      "-stream_loop", "-1", "-ss", String((i * 1.3) % 6), "-i", bg, "-loop", "1", "-i", png,
      "-filter_complex",
      `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},hue=h=${shot.hue ?? 0},eq=brightness=-0.1[b];[b][1:v]overlay=0:0:format=auto,${fades}[v]`,
      "-map", "[v]", "-t", seconds.toFixed(3), "-pix_fmt", "yuv420p", "-an", file,
    ]);
  }
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

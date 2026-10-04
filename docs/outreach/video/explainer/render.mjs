// Renders the explainer to an MP4: every frame of scene.mjs through sharp, then
// ffmpeg. Run from the repository root, which has sharp:
//
//   node docs/outreach/video/explainer/render.mjs [--lang en|tr] [--out file.mp4] [--preview]
//
// `--preview` writes two PNGs per scene at telling moments instead of the
// video, to look at before spending the minutes a full render takes.
//
// The frames are set in the site's own faces: before sharp loads, a fontconfig
// file is written that points at src/app/fonts, since librsvg (what sharp
// draws text with) finds fonts through fontconfig and nothing else.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { DURATION, FPS, frame, SCENES } from "./scene.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fontsDir = resolve(here, "../../../../src/app/fonts");
const fontCache = join(tmpdir(), "lw-explainer-fontconfig");
mkdirSync(fontCache, { recursive: true });
const fontsConf = join(tmpdir(), "lw-explainer-fonts.conf");
writeFileSync(
  fontsConf,
  `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n  <dir>${fontsDir}</dir>\n  <dir>/System/Library/Fonts</dir>\n  <dir>/Library/Fonts</dir>\n  <dir>/usr/share/fonts</dir>\n  <cachedir>${fontCache}</cachedir>\n</fontconfig>\n`,
);
process.env.FONTCONFIG_FILE = fontsConf;

const require = createRequire(join(process.cwd(), "package.json"));
const sharp = require("sharp");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const lang = arg("lang", "en");
const out = arg("out", join(here, "..", `liquiditywise-explainer${lang === "en" ? "" : `-${lang}`}.mp4`));
const preview = process.argv.includes("--preview");

const png = (t, file) => sharp(Buffer.from(frame(t, lang))).png().toFile(file);

if (preview) {
  const dir = join(process.env.TMPDIR ?? tmpdir(), "anim", `preview-${lang}`);
  mkdirSync(dir, { recursive: true });
  const moments = SCENES.flatMap((s) => [s.start + Math.min(2.5, (s.end - s.start) / 2), s.end - 1.2]);
  await Promise.all(moments.map((t, i) => png(t, join(dir, `${String(i).padStart(2, "0")}-${t.toFixed(1)}s.png`))));
  console.log(dir);
} else {
  const dir = mkdtempSync(join(tmpdir(), "lw-explainer-"));
  const total = Math.round(DURATION * FPS);
  const started = Date.now();
  let next = 0;
  const worker = async () => {
    while (next < total) {
      const i = next++;
      await png(i / FPS, join(dir, `f${String(i).padStart(5, "0")}.png`));
      if (i % 300 === 0) console.log(`${i}/${total} frames, ${((Date.now() - started) / 1000).toFixed(0)}s`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  execFileSync(
    "ffmpeg",
    [
      "-y", "-hide_banner", "-loglevel", "error",
      "-framerate", String(FPS), "-i", join(dir, "f%05d.png"),
      "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
      "-shortest",
      "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "64k",
      "-movflags", "+faststart",
      out,
    ],
    { stdio: "inherit" },
  );
  rmSync(dir, { recursive: true, force: true });
  console.log(`${out} — ${total} frames in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

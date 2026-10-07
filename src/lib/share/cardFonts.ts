import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { processShared } from "../cache/processShared";

/*
 * The site's own faces for the share card: Instrument Serif for the pair,
 * Geist for the words and Geist Mono for the figures, the three the pages are
 * set in (app/layout.tsx).
 *
 * As TTF, beside the woff2 the pages load. The image renderer reads ttf, otf
 * and woff and nothing else, so each woff2 was decompressed once (2026-10-07,
 * with Google's own woff2 decoder) and the result committed, for the reason
 * the fonts are committed at all: nothing is fetched at build or at run. For
 * Instrument Serif that is the very file the woff2 was made from, 377 glyphs
 * in and out. The two Geist families are variable fonts, whose `fvar` table
 * the renderer's parser cannot read, so each was instanced at its regular
 * weight — 400, the one weight the card asks for — with fontTools, and the
 * static result is what is here: 975 and 1,159 glyphs, as in the variable
 * files, and 90 and 102 KB against 170 and 173.
 *
 * Read once per process, from the project directory the server runs in, and
 * never allowed to fail the card: a file that could not be read leaves the
 * renderer its own face, which is Geist, rather than leaving a shared link a
 * broken image. The renderer replaces its default with whatever is given, so
 * Geist is given explicitly, not assumed.
 *
 * Scripts none of the three carry — Arabic, Devanagari, Han — the renderer
 * fetches a Noto face for as it draws, from Google Fonts; a card in those
 * languages needs that outbound call from the server.
 */

export type CardFont = {
  readonly name: string;
  readonly data: ArrayBuffer;
  readonly weight: 400;
  readonly style: "normal";
};

export const CARD_FONT_FILES: readonly { readonly name: string; readonly file: string }[] = [
  { name: "Geist", file: "Geist-Regular.ttf" },
  { name: "Geist Mono", file: "GeistMono-Regular.ttf" },
  { name: "Instrument Serif", file: "InstrumentSerif-Regular.ttf" },
];

const FONTS_DIRECTORY = join("src", "app", "fonts");

const load = async (): Promise<readonly CardFont[]> => {
  const loaded = await Promise.all(
    CARD_FONT_FILES.map(async ({ name, file }): Promise<CardFont | null> => {
      try {
        const bytes = await readFile(join(process.cwd(), FONTS_DIRECTORY, file));
        return { name, data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, weight: 400, style: "normal" };
      } catch {
        return null;
      }
    }),
  );
  const fonts = loaded.filter((font): font is CardFont => font !== null);

  /* All or none: a card set half in the site's faces and half in the renderer's would be worse than one in the renderer's. */
  return fonts.length === CARD_FONT_FILES.length ? fonts : [];
};

/** The card's fonts, read once; empty when any could not be read, which leaves the renderer its own. */
export const loadCardFonts = (): Promise<readonly CardFont[]> => processShared("share.card-fonts", load);

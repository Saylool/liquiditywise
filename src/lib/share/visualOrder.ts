/*
 * The order words are drawn in on a card set in a right-to-left language.
 *
 * The card's renderer (satori, under next/og) shapes Arabic letters correctly
 * — each word joins as it should — but lays every line out left to right and
 * knows nothing of the bidirectional algorithm: a sentence's words come out
 * in logical order, reading backwards. Measured on 2026-10-07 on the
 * position card: "مركز Uniswap v3 مفتوح، بسعر اليوم" drew as "مركز" first at
 * the left, "اليوم" last at the right.
 *
 * This writes the visual order the renderer should draw, for a line it will
 * lay out left to right: the sequence of runs reversed, the words inside a
 * right-to-left run reversed, and a left-to-right run — Latin words, figures,
 * a URL — kept as it is, since those read left to right inside the line.
 * A word with no strong direction (a dot, a dash) goes with the run it
 * follows. Word-level only: letters inside a word are the font's business.
 *
 * Not a bidi algorithm; enough for a card of short lines, and a line that
 * is all one direction comes out unchanged in reading order. The web page
 * needs none of this — the browser does it.
 */

const RTL = /[֐-׿؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LTR = /[A-Za-z0-9À-ɏ]/;

type Run = { dir: "rtl" | "ltr" | "neutral"; readonly words: string[] };

export const visualOrder = (line: string): string => {
  const runs: Run[] = [];
  for (const word of line.split(" ")) {
    const dir: Run["dir"] = RTL.test(word) ? "rtl" : LTR.test(word) ? "ltr" : "neutral";
    const last = runs[runs.length - 1];
    if (last !== undefined && (last.dir === dir || dir === "neutral")) last.words.push(word);
    else if (last !== undefined && last.dir === "neutral") {
      last.dir = dir;
      last.words.push(word);
    } else runs.push({ dir, words: [word] });
  }
  return runs
    .reverse()
    .map((run) => (run.dir === "ltr" ? run.words : [...run.words].reverse()).join(" "))
    .join(" ");
};

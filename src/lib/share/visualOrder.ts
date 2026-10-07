/*
 * A right-to-left card line, cut into the runs its renderer can lay out.
 *
 * The card's renderer (satori, under next/og) shapes Arabic letters — each
 * word joins as it should — but lays a string out left to right and knows
 * nothing of the bidirectional algorithm: a sentence's words come out in
 * logical order, reading backwards. Measured on 2026-10-07 on the position
 * card: "مركز Uniswap v3 مفتوح، بسعر اليوم" drew "مركز" first, at the left.
 * Reversing the string's words fixed one line and broke every line that
 * wrapped, since the second row then held the sentence's start.
 *
 * So a line is not drawn as one string. It is cut into runs — each Arabic
 * word its own run, and a stretch of Latin words, figures or a URL one run
 * kept whole, since it reads left to right inside the line — and the card
 * draws the runs as flex items from right to left, wrapping. Reading order
 * is then the logical order, on every row, with no reversal anywhere. A
 * word with no strong direction (a dot, a dash) goes with the run before it.
 *
 * Not a bidi algorithm; enough for a card of short lines. The web page
 * needs none of this — the browser does it.
 */

const RTL = /[֐-׿؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LTR = /[A-Za-z0-9À-ɏ]/;

export type Run = { readonly dir: "rtl" | "ltr"; readonly text: string };

export const lineRuns = (line: string): readonly Run[] => {
  const runs: { dir: Run["dir"] | "neutral"; words: string[] }[] = [];
  for (const word of line.split(" ").filter((part) => part !== "")) {
    const dir = RTL.test(word) ? "rtl" : LTR.test(word) ? "ltr" : "neutral";
    const last = runs[runs.length - 1];
    /* An Arabic word is a run of its own; Latin words join the Latin run before them; a neutral joins whatever came before. */
    if (last !== undefined && dir === "neutral") last.words.push(word);
    else if (last !== undefined && dir === "ltr" && last.dir !== "rtl") {
      last.dir = "ltr";
      last.words.push(word);
    } else if (last !== undefined && last.dir === "neutral") {
      last.dir = dir;
      last.words.push(word);
    } else runs.push({ dir, words: [word] });
  }
  return runs.map(({ dir, words }) => ({ dir: dir === "neutral" ? "ltr" : dir, text: words.join(" ") }));
};

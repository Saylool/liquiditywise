import { describe, expect, it } from "vitest";

import { getDictionary } from "./dictionaries";

/*
 * Traditional Chinese, held to the one thing its neighbour cannot check.
 *
 * `translated.test.ts` asks whether a language differs from English. That
 * question is free here: Traditional Chinese differs from English whatever
 * is in it, including a byte-for-byte copy of the Simplified dictionary. The
 * question worth asking is whether it differs from *that*.
 *
 * It is asked with characters rather than with strings, because characters
 * give an answer with no judgement in it. The list below is every character
 * the Simplified dictionary uses that has a different Traditional form — 发,
 * 网, 数 and 244 others, taken from OpenCC's own STCharacters table. None of
 * them belongs in Traditional copy, and a conversion that missed a sentence,
 * or a Simplified sentence pasted in later, puts one back.
 *
 * One character is deliberately absent. 群 looks like a leak by that rule —
 * STCharacters answers 羣 for it — but 羣 is Hong Kong's form and Taiwan's
 * own table converts it straight back to 群, so 群 is what Traditional copy
 * written for Taiwan should say. The rule that built this list is therefore
 * "has a different Traditional form, and Taiwan does not return it".
 *
 * Characters that are the same in both scripts — 面, 只, 持有, 深色 — are not
 * in the list and never could be, which is why this has no false positives
 * to teach anyone to ignore.
 */
const SIMPLIFIED_ONLY =
  "与东两个为么义书买产仅从仓们优会侧储兑关内写决况减凭则创删别办务动势区协单卖却历参双发变叠号响围图场块声处复够头学实宽对导尝尽层币带帮并应开弃张强归当录径态总恒户执扩报担拟拥择损换摆摊撑数断无时显术机权条来构标样档检横没浅测浏涨点状独现画盖盘码础离称笔签紧约纯纳纸线组细终经绑结绕给绝统继续编缘网脚节获补装见观规览计订认让议记讲许论设访证识诉词译试话询该语误说请诺读谁调谓谢财败账货贴贵费资赚赠跃转轮较辅输边达过迈运还这进远连选邻释针钟钥钮钱铺链锁错长门闭问间队阴际险随页项顺须顾预频题额风验齐";

/** Every string in a dictionary, by the path it sits at. */
const strings = (value: unknown, path = ""): readonly (readonly [string, string])[] => {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => strings(item, `${path}[${index}]`));
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => strings(item, `${path}.${key}`));
  }

  return [];
};

describe("the Traditional Chinese dictionary", () => {
  const traditional = strings(getDictionary("zh-Hant"));
  const simplified = new Map(strings(getDictionary("zh")));

  it("knows what it is checking", () => {
    // A guard on the guard: an empty list would make every loop below vacuous.
    expect(SIMPLIFIED_ONLY.length).toBeGreaterThan(200);
    expect(traditional.length).toBeGreaterThan(300);
  });

  it("carries no character that only exists in the Simplified script", () => {
    const simplifiedOnly = new Set([...SIMPLIFIED_ONLY]);
    const leaks = traditional
      .filter(([, value]) => [...value].some((character) => simplifiedOnly.has(character)))
      .map(([path, value]) => `${path}: ${value.slice(0, 40)}`);

    expect(leaks).toEqual([]);
  });

  /*
   * The strings that are the same in both are the ones written entirely in
   * characters the two scripts share — 深色, 持有, 地址. There are a handful,
   * and a copied dictionary would not have a handful, it would have all of
   * them.
   */
  it("is not the Simplified dictionary under another name", () => {
    const han = traditional.filter(([, value]) => /[\u4e00-\u9fff]/.test(value));
    const identical = han.filter(([path, value]) => simplified.get(path) === value);

    expect(han.length).toBeGreaterThan(300);
    expect(identical.length).toBeLessThan(han.length / 10);
  });

  /*
   * And the decisions a character table cannot make. Each of these was read
   * in context before it was chosen: OpenCC's Taiwan phrase table would have
   * written the first form of each pair, which is either the mainland's or
   * the programming sense of a word this page uses in another.
   */
  it("uses Taiwan's word, not the mainland's or the compiler's", () => {
    const all = traditional.map(([, value]) => value).join("\n");

    for (const [mainland, taiwan] of [
      ["賬戶", "帳戶"],
      ["只讀", "唯讀"],
      ["許可權", "權限"],
      ["引數", "參數"],
      ["宣告的費率", "聲明的費率"],
      ["繫結", "綁定"],
      ["連線錢包", "連接錢包"],
      ["擴充套件", "擴充"],
      ["識別符號", "識別碼"],
      ["髮生", "發生"],
      ["舍入", "捨入"],
    ]) {
      expect(all, `${mainland} should be ${taiwan}`).not.toContain(mainland);
    }
  });

  /* Taiwan quotes with 「」; the mainland with “”. */
  it("quotes the way Taiwan quotes", () => {
    const all = traditional.map(([, value]) => value).join("");

    expect(all).not.toContain("\u201c");
    expect(all).not.toContain("\u201d");
    expect(all).toContain("\u300c");
  });
});

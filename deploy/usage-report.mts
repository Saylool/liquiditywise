/*
 * The weekly report from the journal's lines, under plain Node. Everything it
 * decides is in src/lib/usage/, under test; this file reads stdin and prints.
 *
 *   journalctl ... -o short-iso --utc | TELEGRAM_LINKS=3 EMAIL_SUBSCRIBERS=2 node usage-report.mts --from 2026-09-17 --to 2026-09-23
 */

import { priceOf } from "../src/lib/ai/modelPrices.ts";
import { parseUsageLine, type UsageLine } from "../src/lib/usage/usageLines.ts";
import { weeklyReport } from "../src/lib/usage/weeklyReport.ts";

const argument = (name: string): string => {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (value === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`usage: usage-report.mts --from YYYY-MM-DD --to YYYY-MM-DD (missing ${name})`);
  }
  return value;
};

const main = async (): Promise<void> => {
  const from = argument("--from");
  const to = argument("--to");

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const lines = Buffer.concat(chunks)
    .toString("utf8")
    .split("\n")
    .map(parseUsageLine)
    .filter((line): line is UsageLine => line !== null);

  /* A count, or nothing: the script hands over what redis-cli answered, and an empty answer is the store not asked. */
  const count = (value: string | undefined): number | null => {
    const trimmed = value?.trim() ?? "";
    return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
  };
  const telegramLinks = count(process.env.TELEGRAM_LINKS);
  const emailSubscribers = count(process.env.EMAIL_SUBSCRIBERS);

  process.stdout.write(`${weeklyReport({ lines, from, to, telegramLinks, emailSubscribers, priceOf })}\n`);
};

main().catch((error: unknown) => {
  console.error(`usage-report: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

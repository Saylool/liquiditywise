# Uniswap Discord — a question, not a pitch

The server's rules say "No advertising or spamming". So this is a question, asked once, in a channel that allows posts (`general`), after a few days of taking part. It names the site only because people asking "what is it?" need somewhere to look; leave the link out if a mod asks.

Why it matters now: the Uniswap Foundation passed on the grant on 2026-10-05 for one reason — no readers yet. Their grants manager wrote that he would look again "if a Uniswap community or LP group starts sending readers your way and that readership holds past the first few weeks". This post is where that starts, so it has to be worth answering, not worth muting.

The Builder role is selected, but no extra channels opened for it (checked 2026-10-01). Look again and use any channel meant for builders or ecosystem projects instead of `general`; the second post below is for such a channel.

## 1. In `general` — one question (updated 2026-10-07)

---

Quick question for LPs here. I'm measuring "where the best-earning v3 liquidity sits" by fee yield on chain: fees each in-range position earned since its last change, divided by its value now, annualised, taking the top fifth among positions unchanged for 3+ days. Is that a fair way to define "smart" liquidity, or does it mislead?

Related: for any open v3 position I now compute the whole-life result — every fee it earned (from the position manager's own fee-growth accounting, not the subgraph's), what it holds now, what the deposits would be worth if simply held, and the difference split into fees and the range effect. If you have a position you already know the numbers for, I'd like to hear whether it agrees.

(It's on liquiditywise.com/smart-money and liquiditywise.com/holdings — an independent, open-source educational tool, not affiliated with Uniswap Labs. Measurements, not advice.)

---

## 2. In a builders / ecosystem channel, if one opens — a short introduction

Post this only where projects are meant to introduce themselves. Attach the explainer video (`docs/outreach/video/liquiditywise-explainer.mp4`, 69 s, no voice) rather than a screenshot.

---

LiquidityWise — an independent, open-source (MIT) educational advisor for Uniswap v3 and v4 LPs, in 10 languages.

What it does: works out a price range from how far a pair actually moved over the last 30 days; replays that range over the month that already happened (days inside, fees on a deposit of your size, result against holding); replays a simple re-centring strategy beside it; shows where the best-earning liquidity sits, measured on chain; gives every open v3 position a whole-life record of fees and result against holding; checks every v4 hook for verified source on Sourcify/Blockscout; and sends optional Telegram alerts when a position nears, leaves or re-enters its range. Nine networks: Ethereum, Base, Arbitrum, Unichain, OP Mainnet, Polygon, BNB Chain, Avalanche, Celo.

What it is not: it never asks a wallet to sign anything, every figure is computed by code and labelled a measurement, and the AI that explains a page is never allowed to state a number of its own.

Site: liquiditywise.com · how every figure is made: liquiditywise.com/method · embed/API: liquiditywise.com/developers · code: github.com/Saylool/liquiditywise

Feedback is the point. Especially on whether "fee yield" is a fair reading of smart liquidity, and on what the position record leaves out.

---

## After posting

- Note the date and channel here, and do not post again in the same channel for at least two weeks; answer every reply instead.
- The site's Monday usage report shows whether readers came and stayed; that is the number to bring back to the Foundation.

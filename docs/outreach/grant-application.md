# Uniswap Foundation grant — application draft

Form: https://share.hsforms.com/1fxQjPQTgTYmPwlYxxKlSGQsdca9 (Uniswap Foundation Grants, category: Ecosystem — tooling). Requirements stated on developers.uniswap.org: something deployed on Unichain and/or Uniswap v4 or a working prototype, documentation with setup and demo, and measurable impact. Check the form's own fields before sending. Fill in every `[…]` from facts, never from hopes.

## One-line summary
LiquidityWise is an independent, educational advisor for Uniswap v3 and v4 liquidity providers, in ten languages, where every figure is computed by code and the language model is never allowed to state one.

## The problem
Concentrated liquidity is hard to reason about, and most of the material is in English, written as advice. A provider choosing a range has to trust a number they cannot check, and a model asked to explain it can invent one.

## What exists today (liquiditywise.com)
- Price-range analysis from how far a pair has actually moved, for v3 and v4 pools on Ethereum, Base, Arbitrum, Unichain, OP Mainnet and Polygon.
- A v4 hook directory showing which permissions a hook has, and a warning wherever a hook can alter swaps.
- "Where the best-earning liquidity sits": a measured, on-chain fee yield per position, kept over time for trends (Ethereum, Base, OP Mainnet, Polygon).
- A holdings view for any public address, and an optional Telegram bot for range alerts.
- The interface and explanations in ten languages: English, Turkish, German, Spanish, Arabic, Hindi, Chinese (simplified and traditional), Russian, Portuguese.
- No signature or transaction is ever requested from a wallet; nothing is kept about who reads the site.

## Why it fits
Education and multilingual reach for Uniswap's own products, with an honesty rule (numbers from code, not from a model) that is easy for others to copy. [Say here which of the Foundation's stated priorities this serves, in its own words from the current page.]

## What the grant would pay for
[Pick only what is true and sized: e.g. data and RPC costs for every chain at a higher refresh rate; a source for Arbitrum positions, which has none today; independent review of the methodology; native-speaker review of the ten languages; a public methodology page.]

## Evidence
- Live site and the 2-minute demo: [link]
- Open methodology: the `/smart-money` page states how "smart" is decided and what the figure leaves out.
- Usage, from the site's own report (counts only, never who). First week measured, 25 Sep – 1 Oct 2026, seven days up to the moment of counting:
  - 981 pages opened by people (1,779 more by bots, excluded); 32 different pools opened; 12 searches.
  - Readers in ten languages; the largest were English (455) and Chinese (377), then Turkish (42).
  - Six networks read; mostly Ethereum (72 pool opens), then Polygon (5), Base (3).
  - About $1 of model spend for the week: the explanations cost almost nothing to run.
  - Telegram: 0 chats following an address so far. The bot and the smart-money pages are new; do not claim adoption of them.
  - Replace with the latest full-week figures when sending; keep the date range beside them.
- Code: [link if the repository is made public; otherwise say it is available to reviewers on request].

## Milestones
1. [Milestone, deliverable, date]
2. [Milestone, deliverable, date]
3. [Milestone, deliverable, date]

## Team
[Name, role, where to reach, public work.]

## Risks and how they are handled
- **Third-party data** (subgraphs, RPC): probed hourly, cached, and the site says where a source cannot answer.
- **Misread as advice**: every page carries the educational disclaimer; nothing predicts prices or promises returns.
- **Independence**: not affiliated with Uniswap Labs or the Uniswap Foundation, and says so on every page.

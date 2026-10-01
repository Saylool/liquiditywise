# Voice-over script (English) — about 105 seconds

Six scenes, matching [demo-script.md](demo-script.md). Record **each scene's voice and screen separately**, then name the files `1.mp3` + `1.mov`, `2.mp3` + `2.mov`, … in one folder. `assemble.mjs` fits each recording to its voice, adds the 5-second intro and closing card, and writes the .mp4:

```bash
node docs/outreach/video/assemble.mjs --bg docs/outreach/video/assets/intro-bg.mp4 --scenes ~/Desktop/scenes --out liquiditywise-promo.mp4
```

Speak calmly, about 150 words a minute. The 5-second intro has no voice. If a recording is much longer than its voice, the tool speeds it up (at most 1.5×) and then cuts it: it says so, and you re-record that scene shorter. A shorter recording simply holds its last frame.

If the voice is synthetic, add one line under the video: "Voice-over generated with AI."

| # | Screen (record this) | Voice | Words |
|---|----------------------|-------|-------|
| 1 | Front page, liquiditywise.com | "Providing liquidity on Uniswap means choosing a price range, and most guides just hand you a number. LiquidityWise works it out from how far the pair has really moved, and explains it." | 33 |
| 2 | Search a pair, open its pool: range, fees, impermanent loss | "Search any pair and open its pool. The range, the fees and the impermanent loss are all computed by code, from the pool's own data, and cross-checked. Only then does a language model describe them, and it is never allowed to state a number itself." | 46 |
| 3 | The same pool; switch the language to Turkish, then Hindi | "Everything is available in ten languages, each in the words its readers actually use for fees and impermanent loss. Switch to Turkish, or Hindi, and the explanation follows." | 29 |
| 4 | `/smart-money`: pairs, a median range, the trend, the holders | "This page asks which liquidity earned the most. It reads positions from the chain, takes the fees each one earned since it last changed, and divides by what it is worth now. Then it shows where the top fifth sits, how that moved over the week, and which holders keep appearing. It also says what the figure leaves out." | 61 |
| 5 | Holdings with a public address (yours), then the Telegram bot message | "Paste any public address to see its positions. An optional Telegram bot tells you when one leaves its range. The site never asks a wallet to sign or send anything." | 31 |
| 6 | `/about` | "LiquidityWise is independent and educational, and not affiliated with Uniswap Labs. liquiditywise.com." | 14 |

Total about 214 words, about 85 seconds of voice plus the pauses between scenes.

## Recording notes
- Record scene 4 only once the trend and holders sections have filled (about two days of measurements); until then the page says "not yet".
- Use your own address in scene 5, never someone else's.
- Do not say anything that is not on the screen at that moment.

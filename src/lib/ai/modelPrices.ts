/*
 * What each model this application may call charges, in US dollars per
 * million tokens — the figures in interpretationModel.ts, checked against
 * OpenAI's pricing page on 2026-09-13, as numbers the weekly report can
 * multiply. A test holds this list and that one together, so a model cannot
 * be added without its price.
 *
 * No imports: deploy/usage-report.mts reads it under plain Node.
 */
export type ModelPrice = { readonly inputPerMillion: number; readonly outputPerMillion: number };

export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  "gpt-5.6-luna": { inputPerMillion: 0.2, outputPerMillion: 1.2 },
  "gpt-5.6-terra": { inputPerMillion: 2, outputPerMillion: 12 },
  "gpt-5.6-sol": { inputPerMillion: 4, outputPerMillion: 20 },
  "gpt-6-astra": { inputPerMillion: 10, outputPerMillion: 50 },
  "gpt-5-mini": { inputPerMillion: 0.25, outputPerMillion: 2 },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
};

/**
 * The price for a model as the provider reported it. A provider can answer
 * with a dated build of an alias (`gpt-5.6-luna-2026-08-01`), which is charged
 * as the alias.
 */
export const priceOf = (model: string): ModelPrice | null =>
  MODEL_PRICES[model] ??
  Object.entries(MODEL_PRICES).find(([name]) => model.startsWith(`${name}-`))?.[1] ??
  null;

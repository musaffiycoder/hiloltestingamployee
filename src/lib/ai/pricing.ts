// Claude narxlari (USD, 1 mln token uchun). Manba: Anthropic rasmiy narxlari (claude-api ma'lumotnomasi).
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

/** Taxminiy narx (USD). Noma'lum model uchun Opus 5.5 narxi olinadi. */
export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const key = Object.keys(PRICES).find((k) => model === k || model.startsWith(`${k}-`)) ?? "claude-opus-5-5";
  const p = PRICES[key];
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

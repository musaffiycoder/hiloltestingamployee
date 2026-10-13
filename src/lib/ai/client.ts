import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export class AiError extends Error {
  constructor(
    public code: "not_configured" | "refusal" | "truncated" | "invalid_output" | "api",
    message: string,
  ) {
    super(message);
  }
}

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

/** Standart model: claude-opus-5-5. Arzonroq model uchun env orqali almashtiriladi (qaror — loyiha egasiniki). */
export function aiModels() {
  return {
    analysis: process.env.ANTHROPIC_ANALYSIS_MODEL || "claude-opus-5-5",
    grader: process.env.ANTHROPIC_GRADER_MODEL || process.env.ANTHROPIC_ANALYSIS_MODEL || "claude-opus-5-5",
  };
}

/** Testlar uchun almashtiriladigan minimal interfeys. */
export type AiClient = {
  messages: { create: (params: Record<string, unknown>) => Promise<unknown> };
};

type MessageLike = {
  stop_reason?: string | null;
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

let cached: Anthropic | null = null;
function realClient(): AiClient {
  if (!aiConfigured()) throw new AiError("not_configured", "ANTHROPIC_API_KEY sozlanmagan");
  cached ??= new Anthropic({ maxRetries: 2, timeout: 50_000 });
  return cached as unknown as AiClient;
}

export type JsonCall<T> = {
  model: string;
  system: string;
  user: string;
  jsonSchema: object;
  parse: (raw: unknown) => T;
  maxTokens: number;
  effort: "low" | "medium" | "high";
  client?: AiClient;
};

export type JsonResult<T> = { data: T; inputTokens: number; outputTokens: number; model: string };

/**
 * Tuzilmali (JSON schema) chaqiruv. Eslatma: Claude Opus 5.5 da `temperature` va `thinking: disabled`
 * 400 qaytaradi — shu sabab yuborilmaydi; chuqurlik `output_config.effort` bilan boshqariladi.
 */
export async function callJson<T>(o: JsonCall<T>): Promise<JsonResult<T>> {
  const client = o.client ?? realClient();
  let inTok = 0;
  let outTok = 0;
  let lastErr = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    let msg: MessageLike;
    try {
      msg = (await client.messages.create({
        model: o.model,
        max_tokens: o.maxTokens,
        system: o.system,
        messages: [
          {
            role: "user",
            content: attempt === 0 ? o.user : `${o.user}\n\n(Oldingi javob yaroqsiz edi: ${lastErr}. Sxemaga aniq mos JSON qaytar.)`,
          },
        ],
        output_config: { effort: o.effort, format: { type: "json_schema", schema: o.jsonSchema } },
      })) as MessageLike;
    } catch (e) {
      throw new AiError("api", `Claude API xatosi: ${(e as Error).message}`);
    }
    inTok += msg.usage?.input_tokens ?? 0;
    outTok += msg.usage?.output_tokens ?? 0;

    if (msg.stop_reason === "refusal") throw new AiError("refusal", "Model so'rovni rad etdi (xavfsizlik filtri)");
    if (msg.stop_reason === "max_tokens") throw new AiError("truncated", "Javob token chegarasida uzildi");

    const text = (msg.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    try {
      const data = o.parse(JSON.parse(text));
      return { data, inputTokens: inTok, outputTokens: outTok, model: o.model };
    } catch (e) {
      lastErr = (e as Error).message.slice(0, 200);
    }
  }
  throw new AiError("invalid_output", `Model yaroqli JSON qaytarmadi: ${lastErr}`);
}

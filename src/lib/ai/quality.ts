// Tahlil sifati: (1) formula bilan hisoblangan faktlar (model qayta "o'ylab" chiqarmasin),
// (2) tahlil natijasini tekshiruvchi sof funksiyalar. Effort pasayganda sifatni ushlab turadi.
import type { AnalysisInput } from "./prompts";
import type { Analysis } from "./schemas";

type Q = AnalysisInput["questions"][number];

/** true = to'g'ri (≥70%), false = xato, null = baholanmagan. */
export function questionOk(q: Pick<Q, "score">): boolean | null {
  if (q.score === null || q.score === undefined) return null;
  return q.score >= 0.7;
}

const codeOf = (comp: string) => comp.split(" ")[0];

/** Kompetensiya bo'yicha faktlar: qaysi savol, qaysi daraja, to'g'ri/xato va naqsh. */
export function competencyDigest(a: Pick<AnalysisInput, "questions" | "competencies">): string[] {
  const out: string[] = [];
  for (const c of a.competencies) {
    const qs = a.questions.filter((q) => codeOf(q.comp) === c.code).sort((x, y) => x.level - y.level);
    if (qs.length === 0) continue;
    const items = qs.map((q) => `savol ${q.n} (daraja ${q.level}, ${questionOk(q) === null ? "baholanmagan" : questionOk(q) ? "to'g'ri" : "XATO"})`);
    const wrong = qs.filter((q) => questionOk(q) === false);
    const right = qs.filter((q) => questionOk(q) === true);
    let pattern: string;
    if (wrong.length === 0) pattern = "hammasi to'g'ri";
    else if (right.length === 0) pattern = "hammasi xato (bilim bo'shlig'i)";
    else if (right.some((r) => wrong.some((w) => w.level < r.level))) {
      pattern = "NOMUVOFIQ: oson savolda xato, qiyin savolda to'g'ri — tasodif, e'tiborsizlik yoki bilimdagi alohida teshik; xulosani ehtiyotkor qil";
    } else if (wrong.every((w) => w.level >= c.target)) pattern = `faqat talab darajasi (${c.target}) va undan yuqorida tushish`;
    else pattern = "past darajalardan boshlab tushish (asosiy bilim teshigi)";
    out.push(`- ${c.code}: ${items.join("; ")} → ${right.length}/${qs.length} to'g'ri; naqsh: ${pattern}`);
  }
  const fastWrong = a.questions.filter((q) => questionOk(q) === false && q.timeSec < 10).map((q) => q.n);
  if (fastWrong.length) out.push(`- 10 soniyadan tez javob berilib xato qilingan savollar: ${fastWrong.join(", ")}`);
  return out;
}

/** Tahlil natijasini tekshirish. Bo'sh massiv = yaroqli. */
export function validateAnalysis(a: Analysis, input: AnalysisInput): string[] {
  const issues: string[] = [];
  const qByN = new Map(input.questions.map((q) => [q.n, q]));

  const have = new Set(a.competencyInsights.map((c) => c.code));
  const missing = input.competencies.filter((c) => !have.has(c.code)).map((c) => c.code);
  if (missing.length) issues.push(`competencyInsights da kompetensiyalar yetishmaydi: ${missing.join(", ")}`);

  const wrongCount = input.questions.filter((q) => questionOk(q) === false).length;
  if (wrongCount > 0 && a.errorDiagnostics.length < Math.min(3, wrongCount)) {
    issues.push(`errorDiagnostics juda kam (kamida ${Math.min(3, wrongCount)} ta kerak)`);
  }
  for (const e of a.errorDiagnostics) {
    const q = qByN.get(e.question);
    if (!q) issues.push(`errorDiagnostics: savol ${e.question} mavjud emas`);
    else if (questionOk(q) !== false) issues.push(`errorDiagnostics: savol ${e.question} xato emas (kalit bo'yicha to'g'ri yoki baholanmagan)`);
  }

  for (const [k, v] of [["strengths", a.strengths], ["weaknesses", a.weaknesses], ["opportunities", a.opportunities], ["threats", a.threats]] as const) {
    if (v.length < 3) issues.push(`${k} da kamida 3 ta band bo'lishi kerak`);
  }
  if (a.interviewQuestions.length !== 5) issues.push("interviewQuestions aynan 5 ta bo'lishi kerak");
  if (a.developmentPlan.length < 3) issues.push("developmentPlan da kamida 3 band bo'lishi kerak");
  if (a.developmentPlan.some((d) => d.resources.length < 2)) issues.push("developmentPlan har bandida kamida 2 ta resources bo'lishi kerak");
  if (!a.swotStrategy || a.swotStrategy.length < 80) issues.push("swotStrategy juda qisqa");

  const label = input.verdictLabel.toLowerCase();
  if (!a.executiveSummary.toLowerCase().includes(label)) issues.push(`executiveSummary da xulosa toifasi («${input.verdictLabel}») aytilmagan`);
  return issues;
}

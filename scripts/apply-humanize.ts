// Humanize natijasini tekshiradi va (--apply bilan) bazadagi o'sha savollarni joyida yangilaydi.
// Ishlatish: npx tsx scripts/apply-humanize.ts <asl.json> <yangi.json> [--apply]
// Tekshiruv: tuzilma, kalit, ball va bayroq o'zgarmagan; barcha raqamlar saqlangan; ichki so'zlar yo'q.
import fs from "node:fs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { validateQuestion, toDbShape } from "../src/lib/question-schema";

for (const line of readFileSync(resolve(__dirname, "../.env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

type Opt = string | { text: string; points?: number; flag?: boolean };
type Q = { position: string; competency: string; level: number; type: string; format?: string; stem: string; options?: Opt[]; correct?: number | number[]; rubric?: string[]; explanation?: string; timeLimitSec?: number };

const [origFile, newFile, flag] = process.argv.slice(2);
const parse = (f: string) => {
  const t = fs.readFileSync(f, "utf8");
  return JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1)) as Q[];
};
const orig = parse(origFile);
const next = parse(newFile);
const text = (o: Opt) => (typeof o === "string" ? o : o.text);
// Ichki havolalardagi raqamlar (yo'riqnoma bandi, daraja, kompetensiya kodi) ma'noga kirmaydi — solishtirishdan chiqariladi
const internal = (s: string) =>
  s.replace(/\d+(?:-, \d+)*(?:- va \d+)?-band\w*/g, "").replace(/\b\d-daraja\w*/g, "").replace(/\b[HSV]\d\b/g, "");
const nums = (s: string) => (internal(s).match(/\d+(?:[.,]\d+)*/g) ?? []).map((x) => x.replace(/[ ,.]/g, "")).sort();
const LEAK = /yashirin (tuzoq|imkoniyat|bog'liqlik)|\btuzoq\b|\b[345]-darajada\b|yo'riqnoma\w*\s+\d|\bqizil bayroq/i;
const LEAK_CS = /\bANIQ\b|[Ѐ-ӿ]/;

const errors: string[] = [];
const warns: string[] = [];
if (orig.length !== next.length) errors.push(`soni farq qiladi: ${orig.length} → ${next.length}`);
next.forEach((n, i) => {
  const o = orig[i];
  if (!o) return;
  const id = `#${i + 1} ${o.competency}`;
  for (const k of ["position", "competency", "level", "type", "timeLimitSec"] as const) if (o[k] !== n[k]) errors.push(`${id}: ${k} o'zgargan`);
  if (JSON.stringify(o.correct) !== JSON.stringify(n.correct)) errors.push(`${id}: correct o'zgargan`);
  if ((o.options?.length ?? 0) !== (n.options?.length ?? 0)) errors.push(`${id}: variantlar soni o'zgargan`);
  o.options?.forEach((op, k) => {
    const np = n.options?.[k];
    if (typeof op === "object" && (typeof np !== "object" || np.points !== op.points || !!np.flag !== !!op.flag)) errors.push(`${id}: ${k}-variant balli/bayrog'i o'zgargan`);
  });
  if ((o.rubric?.length ?? 0) !== (n.rubric?.length ?? 0)) errors.push(`${id}: rubrika bandlari soni o'zgargan`);
  // Raqamlar: savol + variantlar matnidagi barcha sonlar saqlanishi shart
  const before = nums([o.stem, ...(o.options ?? []).map(text)].join(" ")).join(",");
  const after = nums([n.stem, ...(n.options ?? []).map(text)].join(" ")).join(",");
  // ALLOW_NUMS="14,…" — ataylab olib tashlangan raqamli ishora (masalan, tuzoqni ochib qo'ygan gap) uchun
  const allowNums = (process.env.ALLOW_NUMS ?? "").split(",").includes(String(i + 1));
  if (before !== after) (allowNums ? warns : errors).push(`${id}: raqamlar o'zgargan${allowNums ? " (ruxsat berilgan)" : ""}`);
  if ([LEAK, LEAK_CS].some((r) => r.test([n.stem, ...(n.options ?? []).map(text)].join(" ")))) warns.push(`${id}: ichki so'z yoki kirill qolgan`);
  if (o.stem.includes("```") !== n.stem.includes("```") || o.stem.includes("|---") !== n.stem.includes("|---")) errors.push(`${id}: kod bloki/jadval tuzilishi o'zgargan`);
  if (n.options?.length) {
    const L = n.options.map((x) => text(x).length);
    const best = n.type === "SITUATIONAL" ? [n.options.reduce((b, x, k, a) => ((x as { points: number }).points > (a[b] as { points: number }).points ? k : b), 0)] : Array.isArray(n.correct) ? n.correct : [n.correct as number];
    const others = L.filter((_, k) => !best.includes(k));
    if (Math.max(...best.map((b) => L[b])) > Math.max(...others) * 1.15) warns.push(`${id}: to'g'ri javob ancha uzun bo'lib qolgan`);
  }
  const v = validateQuestion(n);
  if (!v.ok) errors.push(`${id}: ${v.errors.join("; ")}`);
});

console.log(errors.length ? `XATOLAR (${errors.length}):\n  ${errors.join("\n  ")}` : "Tuzilma, kalit va raqamlar: OK");
if (warns.length) console.log(`OGOHLANTIRISHLAR (${warns.length}):\n  ${warns.join("\n  ")}`);

if (flag === "--apply") {
  if (errors.length) {
    console.log("Xato bor — bazaga yozilmadi.");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  (async () => {
    let updated = 0;
    const missing: number[] = [];
    for (const [i, n] of next.entries()) {
      const o = orig[i];
      const row = await prisma.question.findFirst({
        where: { stem: o.stem, status: "ACTIVE", competency: { code: o.competency, position: { code: o.position } } },
        select: { id: true },
      });
      if (!row) {
        missing.push(i + 1);
        continue;
      }
      const shape = toDbShape((validateQuestion(n) as { ok: true; q: Parameters<typeof toDbShape>[0] }).q);
      await prisma.question.update({
        where: { id: row.id },
        data: {
          stem: n.stem,
          payload: shape.payload as Prisma.InputJsonValue,
          rubric: shape.rubric as Prisma.InputJsonValue | undefined,
          explanation: n.explanation,
        },
      });
      updated++;
    }
    console.log(`Yangilandi: ${updated}${missing.length ? `; bazada topilmadi: ${missing.join(", ")}` : ""}`);
    if (!missing.length) fs.writeFileSync(origFile, JSON.stringify(next, null, 1));
    await prisma.$disconnect();
  })();
}

import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ImportTool } from "./import-tool";

export const metadata: Metadata = { title: "Savollarni import qilish" };

export default async function ImportPage() {
  await requireUser();
  const positions = await db.position.findMany({
    orderBy: { title: "asc" },
    select: { code: true, title: true, competencies: { orderBy: { sortOrder: "asc" }, select: { code: true, name: true, target: true } } },
  });

  const catalog = positions
    .map((p) => `- "${p.code}" (${p.title}): ` + p.competencies.map((c) => `${c.code} = ${c.name} [talab ${c.target}]`).join("; "))
    .join("\n");

  const prompt = `Sen test tuzuvchi mutaxassissan. Quyidagi lavozim va kompetensiyalar uchun savollar tuz va FAQAT JSON qaytar (markdown, izoh yozma).

LAVOZIM KODLARI VA KOMPETENSIYALAR:
${catalog}

Daraja shkalasi: 1 Boshlang'ich, 2 Rivojlanayotgan, 3 Yaxshi, 4 Professional, 5 Ekspert.

CHIQISH FORMATI (JSON massiv):
[
  {"position":"backend","competency":"H2","level":3,"type":"MCQ_SINGLE","stem":"Savol matni","options":["A","B","C","D"],"correct":1,"explanation":"Nega aynan shu javob to'g'ri","timeLimitSec":60},
  {"position":"backend","competency":"H2","level":4,"type":"MCQ_MULTI","stem":"...","options":["...","...","...","...","..."],"correct":[0,3]},
  {"position":"backend","competency":"S2","level":4,"type":"SITUATIONAL","stem":"Vaziyat tavsifi","options":[{"text":"...","points":5},{"text":"...","points":3},{"text":"...","points":2},{"text":"...","points":1,"flag":true}]},
  {"position":"backend","competency":"H5","level":4,"type":"OPEN","stem":"...","rubric":["baholash bandi 1","baholash bandi 2","baholash bandi 3"]}
]
type: MCQ_SINGLE (bitta to'g'ri), MCQ_MULTI (2+ to'g'ri), SITUATIONAL (har variantga 1–5 ball, eng yaxshisi 5), OPEN (rubrika bilan). "correct" — 0 dan boshlanadigan indeks.

SIFAT QOIDALARI (juda muhim — savollar osonlikcha topib bo'lmasligi kerak):
1. To'g'ri javob variantlar ichida eng uzun bo'lmasin. Barcha variantlar uzunligi va tuzilishi (gap soni, tafsilot darajasi) teng bo'lsin.
2. Noto'g'ri variantlar ishonarli bo'lsin: haqiqiy amaliyotda uchraydigan xatolar, yarim to'g'ri tushunchalar. Kulgili yoki ochiq-oydin noto'g'ri variant yozma.
3. «hech qachon», «doim», «faqat», «hammasi to'g'ri», «hech biri» kabi so'zlardan noto'g'ri variantlarni belgilash uchun foydalanma.
4. To'g'ri javob savol matnidagi so'zlarni takrorlamasin.
5. To'g'ri javob joylashuvi (indeks) turlicha bo'lsin; bir indeksda 35% dan ko'p bo'lmasin.
6. Daraja oshgani sari savol chuqurlashsin: 1–2 daraja — ta'rif/tushuncha; 3 — odatiy vaziyatda qo'llash; 4 — murakkab trade-off, xavfsizlik, yuklama; 5 — nostandart muammo, arxitektura qarori.
7. Faqat o'zbek tilida (lotin), texnik atamalar inglizcha qolishi mumkin. Haqiqiy parol/token/kalit yozma.
8. Har bir savolga "explanation" yoz: nega to'g'ri javob to'g'ri va qaysi tuzoq noto'g'ri variantlarda.
9. SITUATIONAL savolda eng yaxshi variant «eng batafsil» bo'lmasin; 1 ball variantlar ichida halollik/xavfsizlik buzilishini ko'rsatadiganlariga "flag":true qo'y.

Menga N ta savol kerak: [lavozim], [kompetensiya], [daraja] uchun.`;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/hr/savollar" className="inline-flex items-center gap-1 text-[17px] text-brd">
        <span aria-hidden className="text-2xl leading-none">‹</span> Savollar banki
      </Link>
      <div>
        <h2 className="text-[28px] font-bold leading-tight">Savollarni import qilish</h2>
        <p className="mt-1 text-[15px] text-tx2">
          Gemini'dan olingan JSON'ni qo'ying. Import qilishdan oldin har bir savol tekshiriladi, to'g'ri javobni ochib beradigan
          ishoralar (uzunlik, so'z takrori va h.k.) ogohlantiriladi.
        </p>
      </div>
      <ImportTool prompt={prompt} />
    </div>
  );
}

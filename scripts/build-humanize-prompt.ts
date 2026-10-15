// Tayyor savollar JSON'ini «inson yozganday» qilish uchun Gemini prompti. Ma'no, raqam va kalit o'zgarmaydi.
// Ishlatish: npx tsx scripts/build-humanize-prompt.ts data/gemini/<lavozim>-v2.json
// Natija: data/gemini/<lavozim>-humanize.md — hammasini Gemini'ga tashlang, qaytgan JSON'ni check-humanize bilan tekshiring.
import fs from "node:fs";
import path from "node:path";
import { HUMANIZE_RULES } from "./humanize-rules";

const file = process.argv[2];
if (!file) throw new Error("JSON fayl yo'li kerak");
const items = JSON.parse(fs.readFileSync(file, "utf8")) as unknown[];
const out = path.join(path.dirname(file), path.basename(file).replace(/(-v\d+)?\.json$/, "") + "-humanize.md");

const prompt = `# Gemini prompt — savollarni insoniy tilda qayta yozish (humanize)

Sen tajribali o'zbek muharriri va shu sohadagi amaliyotchisan. Quyida ${items.length} ta test savoli JSON ko'rinishida berilgan. Ular mazmunan to'g'ri va qiyin, lekin matni AI yozganday sezilyapti. Vazifang — **faqat matn uslubini** tabiiy, ish joyidagi jonli o'zbek tiliga keltirish.

## O'ZGARTIRISH MUMKIN
- "stem" (savol matni), "options" ichidagi matnlar (SITUATIONAL'da "text"), "rubric" bandlari va "explanation" — faqat uslub jihatidan.

## O'ZGARTIRISH TAQIQLANADI (buzilsa javob yaroqsiz)
1. Elementlar soni (${items.length}) va tartibi.
2. "position", "competency", "level", "type", "format", "timeLimitSec", "correct", har variantning "points" va "flag" qiymati.
3. Variantlar soni va tartibi — to'g'ri javob qaysi o'rinda bo'lsa, o'sha o'rinda qolsin.
4. Barcha sonlar, foizlar, summalar, sanalar, vaqtlar, versiyalar, formulalar, kod, jadval qiymatlari va texnik nomlar (Payme, Click, App Store, SUMIFS, utm_source va h.k.) — aynan o'zidek.
5. Savolning ma'nosi, sharti va to'g'ri javobning mantiqi. Noto'g'ri variant noto'g'riligicha, to'g'risi to'g'riligicha qolsin.
6. Kod bloklari (\`\`\`), markdown jadvallar (| … |) va ro'yxatlar tuzilishi.
7. Variant uzunliklari nisbati: to'g'ri javob boshqalaridan uzun bo'lib qolmasin (±15%).

## USLUB QOIDALARI
${HUMANIZE_RULES}

## TEKSHIRISH (ichki, javobda ko'rsatma)
Har savol uchun: (a) ma'no va javob o'zgarmadimi; (b) barcha raqamlar joyidami; (c) nomzod bir o'qishda tushunadimi; (d) «yashirin tuzoq», «N-darajada», «yo'riqnomaning N-bandi» kabi ichki so'zlar qolmadimi; (e) JSON sintaksisi to'g'rimi.

## CHIQISH
Aynan ${items.length} ta elementdan iborat JSON massiv, kirish va izohsiz.

## SAVOLLAR (JSON)

\`\`\`json
${JSON.stringify(items, null, 1)}
\`\`\`
`;
fs.writeFileSync(out, prompt);
console.log(out, Math.round(prompt.length / 1000) + "k belgi");

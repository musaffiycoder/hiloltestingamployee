// Har bir lavozim kartasi uchun Gemini'ga tashlanadigan tayyor prompt fayllarini yaratadi.
// Natija: data/gemini/NN-<lavozim>.md (gitignored). Ishga tushirish: npx tsx scripts/build-gemini-prompts.ts
import fs from "node:fs";
import path from "node:path";

type Comp = { id: string; name: string; type: "soft" | "hard"; target: number; weight: number; critical: boolean };
type Pos = { id: string; title: string; card: string; competencies: Comp[] };

const ROOT = path.resolve(__dirname, "..");
const KARTALAR = path.resolve(ROOT, "..", "kartalar");
const TOTAL = 30;
const MAX_OPEN = 6;

const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data/competencies.json"), "utf8")) as { positions: Pos[] };

/** Savollar sonini vazn bo'yicha taqsimlash: kamida 2 (kritikda 3), jami TOTAL. */
function quotas(comps: Comp[]): Record<string, number> {
  const min = (c: Comp) => (c.critical ? 3 : 2);
  const sumW = comps.reduce((s, c) => s + c.weight, 0);
  const q: Record<string, number> = {};
  const frac: Record<string, number> = {};
  for (const c of comps) {
    const raw = (TOTAL * c.weight) / sumW;
    q[c.id] = Math.max(min(c), Math.floor(raw));
    frac[c.id] = raw - Math.floor(raw);
  }
  const sum = () => Object.values(q).reduce((s, x) => s + x, 0);
  while (sum() < TOTAL) {
    const c = [...comps].sort((a, b) => frac[b.id] - frac[a.id] || b.weight - a.weight)[0];
    q[c.id]++;
    frac[c.id] = -1;
    if (comps.every((x) => frac[x.id] === -1)) comps.forEach((x) => (frac[x.id] = x.weight / 100));
  }
  while (sum() > TOTAL) {
    const c = comps.filter((x) => q[x.id] > min(x)).sort((a, b) => a.weight - b.weight)[0];
    if (!c) break;
    q[c.id]--;
  }
  return q;
}

/** Talab darajasi atrofida darajalar: t, t-1, t+1, t-2, t+2; ortiqchasi t va t-1 ga qo'shiladi. */
function levelsFor(target: number, n: number): number[] {
  const order = [target, target - 1, target + 1, target - 2, target + 2, target - 3].filter((l) => l >= 1 && l <= 5);
  const uniq = [...new Set(order)];
  const out = uniq.slice(0, Math.min(n, uniq.length));
  let i = 0;
  while (out.length < n) out.push([target, target - 1, target][i++ % 3]);
  return out.sort((a, b) => a - b);
}

function slotsFor(pos: Pos) {
  const q = quotas(pos.competencies);
  type Slot = { comp: Comp; level: number; type: string };
  const slots: Slot[] = [];
  for (const c of pos.competencies) for (const l of levelsFor(c.target, q[c.id])) slots.push({ comp: c, level: l, type: "" });

  // OPEN: eng og'ir vazn (kritik/hard avval) bo'yicha MAX_OPEN ta kompetensiyaning talab-darajasidagi slotiga
  const ranked = [...pos.competencies].sort(
    (a, b) => Number(b.critical) - Number(a.critical) || b.weight - a.weight || Number(b.type === "hard") - Number(a.type === "hard"),
  );
  let opens = 0;
  for (const c of ranked) {
    if (opens >= MAX_OPEN) break;
    const s = slots.find((x) => x.comp.id === c.id && x.level === c.target && !x.type);
    if (s) {
      s.type = "OPEN";
      opens++;
    }
  }
  const multiCount: Record<string, number> = {};
  for (const s of slots) {
    if (s.type) continue;
    if (s.comp.type === "soft") {
      s.type = "SITUATIONAL";
    } else {
      // Qattiq ko'nikmalar: past darajalar MCQ_SINGLE, ≥3 darajadan har ikkinchisi MCQ_MULTI
      const k = (multiCount[s.comp.id] = (multiCount[s.comp.id] ?? 0) + 1);
      s.type = s.level >= 3 && k % 2 === 0 ? "MCQ_MULTI" : "MCQ_SINGLE";
    }
  }
  // Hard kompetensiyada ham kamida bitta SITUATIONAL (xavfsizlik/vaziyat) bo'lsin: eng yuqori MCQ_SINGLE'ni almashtirish emas, faqat Hxx n>=4 da
  for (const c of pos.competencies.filter((x) => x.type === "hard")) {
    const mine = slots.filter((s) => s.comp.id === c.id);
    if (mine.length >= 4 && !mine.some((s) => s.type === "SITUATIONAL")) {
      const cand = mine.filter((s) => s.type === "MCQ_SINGLE" && s.level >= 3).sort((a, b) => b.level - a.level)[0];
      if (cand) cand.type = "SITUATIONAL";
    }
  }
  return slots;
}

const TIME: Record<string, number> = { MCQ_SINGLE: 60, MCQ_MULTI: 90, SITUATIONAL: 90, OPEN: 240 };

function build(pos: Pos, num: number): string {
  const card = fs.readFileSync(path.join(KARTALAR, pos.card), "utf8");
  const general = fs.readFileSync(path.join(KARTALAR, "00-umumiy-qoidalar.md"), "utf8");
  const slots = slotsFor(pos);
  const typeCounts = slots.reduce<Record<string, number>>((m, s) => ((m[s.type] = (m[s.type] ?? 0) + 1), m), {});
  const totalSec = slots.reduce((s, x) => s + TIME[x.type], 0);

  const rows = slots
    .map((s, i) => `${String(i + 1).padStart(2, "0")}. competency="${s.comp.id}" (${s.comp.name}) · level=${s.level} · type=${s.type}${s.comp.critical ? " · KRITIK" : ""}`)
    .join("\n");
  const catalog = pos.competencies
    .map((c) => `- ${c.id} = ${c.name} [${c.type}, talab ${c.target}, vazn ${c.weight}%${c.critical ? ", KRITIK" : ""}]`)
    .join("\n");

  return `# Gemini prompt — ${pos.title}

> Qanday ishlatiladi: shu faylning **hammasini** Gemini (2.5 Pro / eng kuchli model) ga bitta xabarda tashlang. U sizga bitta JSON qaytaradi.
> JSON ni Baholash platformasida **Savollar → Import** ga qo'ying. Savollar «qoralama» holatida tushadi, sifat ogohlantirishlari ko'rsatiladi.

---

## ROL VA MAQSAD

Sen — psixometrika va ${pos.title} sohasi bo'yicha tajribali test tuzuvchi mutaxassissan. Quyida Hilol Nashr (Dasturlash bo'limi) uchun **${pos.title}** lavozimining baholash kartasi berilgan. Shu kartaga tayanib, **aynan ${TOTAL} ta** savoldan iborat bitta test tuz.

Test ham **nomzodni qabul qilish**, ham **mavjud xodimni baholash** uchun ishlatiladi. Savollar real ish vaziyatlarini o'lchashi, yodlab olib bo'lmaydigan va taxmin qilib topib bo'lmaydigan bo'lishi shart. Test egasi AVVALGI AI tuzgan savollardan norozi bo'lgan: «to'g'ri javob doim eng uzun va eng batafsil, qolganlari qisqa va ochiq-oydin xato» edi. Bunday savol yozma.

## PLATFORMA IMKONIYATLARI (muhim)

- Nomzod savollarni **ixtiyoriy tartibda** yechadi: qiyinini o'tkazib, keyin qaytib kelishi mumkin. Shuning uchun **har bir savol mustaqil** bo'lsin: «oldingi savoldagi kod», «yuqoridagi vaziyat» kabi bog'liqlik yozma. Kontekst kerak bo'lsa, savolning o'zida to'liq keltir.
- Bir testda jami ${TOTAL} tadan ko'p savol bo'lmaydi. Taxminiy umumiy vaqt: ${Math.round(totalSec / 60)} daqiqa.

## LAVOZIM KOMPETENSIYALARI

Lavozim kodi (JSON'dagi "position" maydoni): **"${pos.id}"**

${catalog}

## SAVOLLAR REJASI (BLUEPRINT) — qat'iy amal qil

Quyidagi ${TOTAL} ta joyning har biri uchun aynan bitta savol yoz. competency, level va type o'zgarmasin. Tartibni ham saqla.

${rows}

Jami: ${Object.entries(typeCounts).map(([k, v]) => `${k} ${v}`).join(" · ")}.

Level ma'nosi: 1 Boshlang'ich, 2 Rivojlanayotgan, 3 Yaxshi, 4 Professional, 5 Ekspert. Savol qiyinligi **shu darajaning kartadagi "Ball ko'rsatkichlari" qatoriga** mos kelsin: o'sha daraja odamigina to'g'ri javob bera oladi, bir pog'ona pastdagi odam esa ishonarli xatoga tushadi.

## SAVOL TURLARI VA JSON FORMATI

Faqat bitta JSON massiv qaytar. Markdown, izoh, kirish so'zi yozma. Har element:

MCQ_SINGLE — bitta to'g'ri javob, 4 ta variant:
{"position":"${pos.id}","competency":"H1","level":3,"type":"MCQ_SINGLE","stem":"...","options":["...","...","...","..."],"correct":2,"explanation":"...","timeLimitSec":60}

MCQ_MULTI — 2 yoki 3 ta to'g'ri javob, 5 yoki 6 ta variant; "correct" — indekslar massivi:
{"position":"${pos.id}","competency":"H2","level":4,"type":"MCQ_MULTI","stem":"... (nechta javob kerakligini savolda ayt)","options":["...","...","...","...","..."],"correct":[0,3],"explanation":"...","timeLimitSec":90}

SITUATIONAL — real vaziyat; har variantga 1–5 ball (5 = eng yaxshi harakat). 4 ta variant, ballar turlicha: kamida bitta 5, bitta 3–4, bitta 1–2. Halollik/xavfsizlikni buzadigan variantga "flag":true qo'y (masalan xatoni yashirish, ma'lumotni sizdirish):
{"position":"${pos.id}","competency":"S2","level":4,"type":"SITUATIONAL","stem":"Vaziyat...","options":[{"text":"...","points":5},{"text":"...","points":4},{"text":"...","points":2},{"text":"...","points":1,"flag":true}],"explanation":"...","timeLimitSec":90}

OPEN — erkin matn javob; AI va inson baholaydi. "rubric" — 3 dan 6 gacha **tekshiriladigan** band (har biri «javobda X bor/yo'q» deb aniq javob beriladigan):
{"position":"${pos.id}","competency":"H1","level":4,"type":"OPEN","stem":"... (nima yozish kerakligi va taxminiy hajmi: 4–8 gap)","rubric":["...","...","..."],"explanation":"...","timeLimitSec":240}

Maydonlar: position (doim "${pos.id}"), competency (${pos.competencies.map((c) => c.id).join(", ")}), level (1–5), type, stem (savol matni, 10–1500 belgi), options, correct / rubric, explanation (nega aynan shu javob to'g'ri va qaysi tuzoq qaysi variantda; 1000 belgigacha), timeLimitSec (15–900).

## SIFAT QOIDALARI — buzilsa savol yaroqsiz

**To'g'ri javobni ishora qilib qo'yish taqiqlanadi:**
1. To'g'ri javob variantlar ichida eng uzun bo'lmasin. Barcha variantlar uzunligi (belgi soni ±20%), gap soni va tafsilot darajasi teng bo'lsin.
2. Noto'g'ri variantlar — **haqiqiy amaliyotda uchraydigan xatolar**: mutaxassis ham bir lahza ikkilanadigan, yarim to'g'ri, eskirgan yoki boshqa kontekstda to'g'ri bo'lgan yondashuvlar. Kulgili yoki ochiq-oydin xato variant yozma.
3. «doim», «hech qachon», «faqat», «hammasi», «hech biri», «barcha holatlarda» kabi mutlaq so'zlar noto'g'ri variantlarni «bo'yash» uchun ishlatilmasin. Ishlatilsa — to'g'ri variantlarda ham teng ishlat.
4. «Hammasi to'g'ri» / «Hech biri» / «A va B» turidagi variant yozma.
5. To'g'ri javob savol matnidagi so'zlarni qaytarmasin; noto'g'ri variantlar ham savol so'zlarini teng miqdorda ishlatsin.
6. To'g'ri javobning joylashuvi (indeks) MCQ_SINGLE savollar bo'yicha 0, 1, 2, 3 ga taxminan teng taqsimlansin; bitta indeks 35% dan oshmasin. Ketma-ket ikki savolda bir xil indeks bo'lmasin.
7. Variantlar grammatik jihatdan savolga bir xil mos kelsin, uslubi bir xil bo'lsin (hammasi gap yoki hammasi ibora).
8. SITUATIONAL: eng yaxshi (5 ball) variant eng batafsil/eng uzun bo'lmasin. Ba'zi savollarda eng yaxshi harakat «ko'proq ish qilish» emas, aksincha «to'xtab, so'rash», «eskalatsiya qilish» yoki «rad etish» bo'lsin. «Ideal xodim» shabloni (hammani xabardor qil, hammasini hujjatlashtir, hamma bilan kelish) har savolda eng yaxshi javob bo'lib qolmasin — ssenariyga qarab farqlansin.
9. Variantlar bir-biridan haqiqatan farq qilsin (mazmuni bo'yicha), faqat so'zlari emas.

**Mazmun qoidalari:**
10. Har bir savol kartadagi o'sha kompetensiyaning o'sha darajadagi ko'rsatkichlariga tayansin; savol kartada yo'q narsani so'ramasin.
11. Daraja oshgani sari tafsilot emas, **qaror murakkabligi** oshsin: 1–2 daraja — ta'rif/oddiy qo'llash; 3 — odatiy ish vaziyatida to'g'ri harakat; 4 — trade-off, xavf, yuklama, bir nechta cheklov; 5 — nostandart muammo, standart/arxitektura qarori, boshqalarni o'rgatish.
12. Texnik savollarda aniq, qisqa kod/log/SQL/konfiguratsiya parchasi (3–15 qator) ishlat; mavhum «nima deb o'ylaysiz» savol yozma. Parcha mustaqil yetarli bo'lsin.
13. Vaziyatli savollarda aniq raqam va rollar bo'lsin (muddat, jamoa soni, mijoz ta'siri, kim nima dedi) — umumiy «jamoada nizo chiqdi» deb yozma.
14. Faqat o'zbek tilida (lotin yozuvi); texnik atamalar inglizcha qolishi mumkin. Savol matnida o'zbekcha tabiiy, ish joyidagi til ishlat.
15. Haqiqiy parol, token, API kalit, shaxsiy ma'lumot yozma — faqat soxta namunalar (masalan sk_test_XXXX, example.com).
16. Bir-biriga o'xshash yoki bir mavzuni takrorlovchi savollar bo'lmasin. Mavzular kompetensiya ichida ham xilma-xil bo'lsin.
17. AI kompetensiyasi (nomida «AI» bor) bo'lsa — kartadagi A (prompt yozish → OPEN), B (AI javobidagi yashirin xatoni topish → MCQ_MULTI yoki OPEN, savolda AI javobi to'liq keltiriladi), C (maxfiy ma'lumotni AI ga bermaslik → SITUATIONAL) bo'limlariga bo'lib yoz.
18. OPEN savol rubrikasi: har band aniq tekshiriladi; «yaxshi yozilgan», «mantiqli» kabi mavhum band yozma. Kamida bitta band «xavfli/xato yondashuvdan qochgan» turidagi bo'lsin.

## O'Z-O'ZINI TEKSHIRISH (javobda ko'rsatma — faqat ichki)

JSON'ni berishdan oldin har savol uchun jimgina tekshir: (a) blueprint'dagi competency/level/type to'g'rimi; (b) to'g'ri javob eng uzun yoki eng batafsil emasmi; (c) har bir noto'g'ri variantni kim va nega tanlashi mumkinligini ayta olasanmi — ayta olmasang qayta yoz; (d) savol boshqa savolga bog'liq emasmi; (e) correct indekslari 0 dan boshlanadimi va options uzunligidan kichikmi; (f) JSON sintaksisi to'g'rimi (oxirgi elementdan keyin vergul yo'q).

## CHIQISH

Aynan ${TOTAL} ta elementdan iborat JSON massiv. Boshqa hech narsa.

---

## KARTA: ${pos.title}

${card}

---

## UMUMIY QOIDALAR (barcha kartalar uchun)

${general}
`;
}

const outDir = path.join(ROOT, "data/gemini");
fs.mkdirSync(outDir, { recursive: true });
const index: string[] = ["# Gemini promptlari", "", "Har fayl — bitta lavozim. Faylning hammasini Gemini'ga tashlang, natijadagi JSON'ni Savollar → Import ga qo'ying.", ""];
data.positions.forEach((p, i) => {
  const name = `${String(i + 1).padStart(2, "0")}-${p.id}.md`;
  fs.writeFileSync(path.join(outDir, name), build(p, i + 1));
  const slots = slotsFor(p);
  index.push(`- ${name} — ${p.title}: ${slots.length} savol (${[...new Set(slots.map((s) => s.type))].join(", ")})`);
  console.log(name, slots.length, slots.map((s) => `${s.comp.id}L${s.level}${s.type[0]}`).join(" "));
});
fs.writeFileSync(path.join(outDir, "README.md"), index.join("\n") + "\n");

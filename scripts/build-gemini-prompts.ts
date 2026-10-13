// Har bir lavozim kartasi uchun Gemini'ga tashlanadigan tayyor prompt fayllarini yaratadi.
// Natija: data/gemini/NN-<lavozim>.md (gitignored). Ishga tushirish: npx tsx scripts/build-gemini-prompts.ts
import fs from "node:fs";
import path from "node:path";

type Comp = { id: string; name: string; type: "soft" | "hard"; target: number; weight: number; critical: boolean };
type Pos = { id: string; title: string; card: string; competencies: Comp[] };

const ROOT = path.resolve(__dirname, "..");
const KARTALAR = path.resolve(ROOT, "..", "kartalar");
const TOTAL = 30; // kompetensiyalar uchun; +5 ta qadriyat savoli (V1) = jami 35
// Notion yo'riqnomalarida faqat 3 (Yaxshi) va 4 (Professional) talab qilinadi — savollar faqat shu ikki darajada.
const VALUE_LEVELS = [3, 3, 4, 4, 4];
const FULL = TOTAL + VALUE_LEVELS.length;
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
  // Faqat yo'riqnomadagi talab darajalari: target 3 → hammasi 3; target ≥4 → yarmi 3, yarmi 4.
  if (target < 4) return Array.from({ length: n }, () => 3);
  const low = Math.floor(n / 2);
  return Array.from({ length: n }, (_, i) => (i < low ? 3 : 4));
}

function slotsFor(pos: Pos) {
  const comps = pos.competencies.filter((c) => c.id !== "V1");
  const q = quotas(comps);
  type Slot = { comp: Comp; level: number; type: string };
  const slots: Slot[] = [];
  for (const c of comps) for (const l of levelsFor(c.target, q[c.id])) slots.push({ comp: c, level: l, type: "" });

  // OPEN: eng og'ir vazn (kritik/hard avval) bo'yicha MAX_OPEN ta kompetensiyaning talab-darajasidagi slotiga
  const ranked = [...comps].sort(
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
  for (const c of comps.filter((x) => x.type === "hard")) {
    const mine = slots.filter((s) => s.comp.id === c.id);
    if (mine.length >= 4 && !mine.some((s) => s.type === "SITUATIONAL")) {
      const cand = mine.filter((s) => s.type === "MCQ_SINGLE" && s.level >= 3).sort((a, b) => b.level - a.level)[0];
      if (cand) cand.type = "SITUATIONAL";
    }
  }
  const v1 = pos.competencies.find((c) => c.id === "V1");
  if (v1) for (const l of VALUE_LEVELS) slots.push({ comp: v1, level: l, type: "SITUATIONAL" });
  return slots;
}

/** Lavozim bo'yicha 5 ta qadriyat mavzusi (yo'riqnomadagi javobgarlik/qizil bayroqlardan). */
const VALUE_THEMES: Record<string, string[]> = {
  backend: [
    "Xato yoki incident'ni yashirmaslik: o'z kodidagi xatoni release'dan keyin aniqlash va rahbarga darhol xabar berish",
    "Vakolatsiz production/DB/server o'zgartirishga vasvasa (tez tuzatib qo'yish, ruxsatsiz hotfix)",
    "Maxfiy kod, token, API kalit yoki mijoz ma'lumotini ruxsat etilmagan AI servis yoki tashqi kanalga bermaslik",
    "Test o'tkazmasdan topshirish bosimi (muddat, PM yoki rahbar istagi) va test natijasi haqida rost aytish",
    "Berilgan akkaunt, parol va kirish huquqlaridan noto'g'ri foydalanmaslik (boshqasiga berish, shaxsiy maqsad)",
  ],
  frontend: [
    "Test o'tkazmasdan yoki topilgan muhim xatoni yashirib buildni PM yoki do'kon tekshiruviga topshirmaslik",
    "App Store Connect/Google Play'da vakolatsiz o'zgartirish yoki imzo kalit/sertifikatni noto'g'ri saqlash va berish",
    "Maxfiy kod, token, kalit yoki foydalanuvchi ma'lumotini ruxsat etilmagan AI servisga kiritmaslik",
    "Release holati, crash va kechikish haqida rost hisobot (yaxshi ko'rinish uchun yumshatmaslik)",
    "Foydalanuvchi ma'lumoti, log va analitikada maxfiylik; berilgan kirish huquqlaridan to'g'ri foydalanish",
  ],
  pm: [
    "Loyiha holati, muddat va xavf haqida rahbariyatga rost hisobot (kechikishni yashirmaslik)",
    "Xodim natijasi haqida adolatli, misolli fikr; shaxsiy munosabat ta'sir qilmasligi",
    "Maxfiy ma'lumot, kirish ma'lumotlari va hujjatlarni AI yoki tashqi kanallarga bermaslik",
    "Test/smoke natijasini buzib ko'rsatish bosimi (mijoz yoki rahbar shoshiltirsa) va xatoni yozib borish",
    "Boshqa PM yoki xodim bilan resurs/ustuvorlik nizosida xolislik va kelishuvga rioya qilish",
  ],
  bosh_pm: [
    "Ma'muriy kirish huquqlari (GitLab, AWS, Apple Developer, Firebase) ni xavfsiz boshqarish; ruxsatsiz berish yoki shaxsiy foydalanish vasvasasi",
    "Domen, to'lov, buxgalteriya bilan bog'liq ishlarda rostlik va shaffoflik",
    "Loyihalar holati, resurs va xavf haqida rahbarga rost hisobot",
    "Xodimlar haqida adolatli fikr va ularning ma'lumotlari maxfiyligi",
    "Maxfiy kalit, sertifikat va credentiallarni xavfsiz topshirish (messenjerda ochiq yubormaslik)",
  ],
  bolim_boshligi: [
    "Rahbariyatga bo'lim holati, xavf, budjet va KPI haqida rost hisobot (yomon natijani yashirmaslik, ko'rsatkichni «chiroyli qilmaslik»)",
    "Xodimlar haqida adolatli qaror: maosh, bonus, intizomiy chora, loyihadan almashtirish; tanish-bilishchilik va shaxsiy munosabatdan xoli bo'lish",
    "Korporativ akkauntlar (Google, Facebook, Yandex, Apple), bank va to'lov ma'lumotlarini xavfsiz boshqarish va ularni shaxsiy maqsadda ishlatmaslik",
    "Manfaatlar to'qnashuvi: tashqi pudratchi, bank yoki yetkazib beruvchi bilan shaxsiy manfaat vasvasasi",
    "Xodimlarning shaxsiy ma'lumotlari va ichki tijorat sirlarini oshkor qilmaslik; bosim ostida ham tartibga rioya",
  ],
  dizayner: [
    "Hisobot jadvaliga bajarilmagan yoki tasdiqlanmagan ishni kiritmaslik (ish haqi hisobiga ta'sir qiladi)",
    "Dizayn fayllarini shaxsiy akkauntda saqlamaslik va uchinchi shaxslarga bermaslik",
    "Litsenziyasiz shrift, rasm yoki materialdan foydalanib mualliflik huquqini buzmaslik",
    "Maxfiy loyiha materiallarini (maket, brend, hujjat) tashqariga yoki AI servisga bermaslik",
    "O'z xatosini yoki muddat kechikishini tan olish va vaqtida xabar berish",
  ],
  kontent_menejer: [
    "Nashr huquqi tasdiqlanmagan kitobni ilovaga joylamaslik (rahbar yoki muddat bosimida ham)",
    "Narxni tasdiqlanmagan holda o'zgartirmaslik yoki noto'g'ri narx qo'ymaslik",
    "Kitob fayllarini tarqatmaslik, shaxsiy qurilma/akkauntda saqlamaslik",
    "Reyestr va hisobotga rost va to'liq ma'lumot kiritish (xatoni yashirmaslik)",
    "App Store/Google Play kabinet kirish ma'lumotlarini himoya qilish va boshqasiga bermaslik",
  ],
  support: [
    "Foydalanuvchidan parol, bank karta kodi yoki autentifikatsiya ma'lumotini so'ramaslik va oshkor qilmaslik",
    "Muhim yoki kritik murojaatni yashirmaslik, o'z vaqtida eskalatsiya qilish",
    "Tasdiqlanmagan yechim yoki muddatni foydalanuvchiga va'da qilmaslik",
    "Foydalanuvchining shaxsiy ma'lumotlari va akkaunt ma'lumotlari maxfiyligi (hamkasbga ham ortiqcha bermaslik)",
    "Qo'pol yoki bosimli foydalanuvchiga ham xushmuomala, rost va vakolat doirasida javob berish",
  ],
};

/** Lavozimga xos qo'shimcha ko'rsatma (prompt boshiga qo'shiladi). */
const POSITION_NOTES: Record<string, string> = {
  bosh_pm:
    "**Bosh PM va oddiy PM farqi:** Bosh PM boshqa PMlarni **boshqarmaydi**, ularga bo'ysundirmaydi va baholamaydi (PMlar bo'lim boshlig'iga hisobot beradi). Uning vazifalari PM bilan deyarli bir xil, faqat qo'shimcha ma'muriy-texnik vazifalari bor: domen, AWS S3, Apple sertifikat va provisioning, GitLab va asosiy tizimlarning ma'muriy huquqlari, Firebase. Shuning uchun: (1) PM bilan umumiy vaziyatlar (sprint, talab, smoke test, release) PM savollari kabi bo'lsin; (2) «PMlarni boshqarish, baholash, ustuvorlik berish» vaziyatlari yozilmasin; (3) Karta jadvalidagi «PMlarni o'stiradi, mentorlik» kabi 5-daraja ko'rsatkichlari faqat tengdosh darajasidagi tajriba ulashish deb tushunilsin; (4) ma'muriy-texnik vazifalar (kirish huquqi, kalit, sertifikat, domen) bo'yicha savollar ko'proq bo'lsin.",
  pm:
    "**PM va Bosh PM:** Bosh PM lavozimi PM bilan deyarli bir xil (u ham boshqa PMlarni boshqarmaydi), shu sabab savollar ikkala lavozim uchun ham mos bo'ladigan umumiy PM vaziyatlariga tayansin.",
};

const TIME: Record<string, number> = { MCQ_SINGLE: 60, MCQ_MULTI: 90, SITUATIONAL: 90, OPEN: 240 };

function build(pos: Pos, num: number, onlySlots?: ReturnType<typeof slotsFor>, existing: string[] = []): string {
  const card = fs.readFileSync(path.join(KARTALAR, pos.card), "utf8");
  const general = fs.readFileSync(path.join(KARTALAR, "00-umumiy-qoidalar.md"), "utf8");
  // Notion lavozim yo'riqnomasidan olingan haqiqiy ish vazifalari (data/yoriqnomalar/<id>.md)
  const duties = fs.readFileSync(path.join(ROOT, "data/yoriqnomalar", `${pos.id}.md`), "utf8");
  const slots = onlySlots ?? slotsFor(pos);
  const FULL_N = slots.length;
  const typeCounts = slots.reduce<Record<string, number>>((m, s) => ((m[s.type] = (m[s.type] ?? 0) + 1), m), {});
  const totalSec = slotsFor(pos).reduce((s, x) => s + TIME[x.type], 0);

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

Sen — psixometrika va ${pos.title} sohasi bo'yicha tajribali test tuzuvchi mutaxassissan. Quyida Hilol Nashr (Dasturlash bo'limi) uchun **${pos.title}** lavozimining baholash kartasi berilgan. Shu kartaga tayanib, **aynan ${FULL_N} ta** savoldan iborat bitta test tuz.

Test ham **nomzodni qabul qilish**, ham **mavjud xodimni baholash** uchun ishlatiladi. Savollar real ish vaziyatlarini o'lchashi, yodlab olib bo'lmaydigan va taxmin qilib topib bo'lmaydigan bo'lishi shart. Test egasi AVVALGI AI tuzgan savollardan norozi bo'lgan: «to'g'ri javob doim eng uzun va eng batafsil, qolganlari qisqa va ochiq-oydin xato» edi. Bunday savol yozma.

${POSITION_NOTES[pos.id] ? `## LAVOZIMGA XOS ESLATMA\n\n${POSITION_NOTES[pos.id]}\n\n` : ""}## PLATFORMA IMKONIYATLARI (muhim)

- Nomzod savollarni **ixtiyoriy tartibda** yechadi: qiyinini o'tkazib, keyin qaytib kelishi mumkin. Shuning uchun **har bir savol mustaqil** bo'lsin: «oldingi savoldagi kod», «yuqoridagi vaziyat» kabi bog'liqlik yozma. Kontekst kerak bo'lsa, savolning o'zida to'liq keltir.
- Bir testda jami ${FULL} ta savol bo'ladi (30 ta kompetensiya + 5 ta qadriyat). Taxminiy umumiy vaqt: ${Math.round(totalSec / 60)} daqiqa.

## LAVOZIM KOMPETENSIYALARI

Lavozim kodi (JSON'dagi "position" maydoni): **"${pos.id}"**

${catalog}

## HAQIQIY ISH VAZIFALARI (Notion lavozim yo'riqnomasidan)

Quyidagi matn shu lavozimning rasmiy yo'riqnomasidan olingan. **Barcha savollar shu real vazifa, vosita va javobgarliklarga tayansin.** Savol «umuman dasturchi/menejer» emas, aynan «Hilol Nashr»dagi shu lavozim egasi duch keladigan vaziyatni o'lchasin: yo'riqnomadagi jarayonlar (masalan, release, narx, eskalatsiya, hisobot), vositalar (Figma, App Store Connect, Play Console, Jira/ClickUp, EPUBCheck va h.k.) va «Qizil bayroqlar»da sanalgan xatti-harakatlar.

${duties}

**Ish vaziyatiga bog'lash qoidalari:**
- Kamida savollarning yarmi yuqoridagi vazifalardan (raqamlangan bo'limlardan) bevosita olingan aniq ish vaziyati bo'lsin; qaysi vazifaga tayanganini "explanation" ichida bir jumla bilan ko'rsat.
- «Umumiy» (jamoada nizo chiqdi, vaqt yetmayapti kabi) savol yozma; har vaziyatda rol, vosita, raqam (muddat, foydalanuvchi soni, narx, versiya) va oqibat bo'lsin.
- Qizil bayroqlardagi xatti-harakatlar (yashirish, vakolatsiz o'zgartirish, maxfiy ma'lumotni sizdirish) SITUATIONAL savollarda "flag":true variantlar sifatida ishlatilsin.

${onlySlots ? "" : `## QADRIYATLAR (V1) — 5 ta savol

V1 «Qadriyatlar: halollik, maxfiylik va mas'uliyat» — **kritik** kompetensiya: bu yerda past natija umumiy ballga qaramay «mos emas»ga olib keladi. 5 ta savol (blueprint oxirida) faqat **SITUATIONAL** bo'lsin.

**O'lchov birliklari (daraja ko'rsatkichlari):**

| Daraja | Xatti-harakat |
|---|---|
| 3 — Yaxshi | Odatiy vaziyatda halol: xatosini o'zi aytadi, maxfiy ma'lumotni himoya qiladi, vakolat doirasida ishlaydi. |
| 4 — Professional | Bosim, manfaat va shaxsiy munosabat sharoitida ham tamoyilda qoladi; buzilishni to'g'ri kanal orqali xabar qiladi; xavfni oldindan ochiq aytadi. |

Daraja 3 dan past natija — qoida buzilishini yoki bosim ostida yashirishni bildiradi.

**5 ta mavzu (har biri bitta savol; tartibda):**

${(VALUE_THEMES[pos.id] ?? []).map((t, i) => `${i + 1}. ${t}  — daraja ${VALUE_LEVELS[i]}`).join("\n")}

**Qadriyat savollari uchun maxsus qoidalar:**
- Har savol real dilemma bo'lsin: halol yo'lning **narxi** bo'lsin (muddat o'tadi, rahbar norozi bo'ladi, do'st xafa bo'ladi, bonus xavf ostida). «Albatta rostini ayt» deb turgan savol yozma.
- Variantlar axloqiy darajasi bo'yicha farqlansin, ammo qoidabuzar variant ham ishonarli ko'rinsin (kimdir uni «oqilona» deb tanlashi mumkin). Vaa'z ohangidan qoch.
- Halollik, maxfiylik, vakolat yoki xavfsizlikni buzadigan variantga albatta "flag":true va 1–2 ball ber. 5 ball — halol va amaliy yo'l (faqat «jim qol» yoki «hammasini oshkor qil» emas, to'g'ri kanal va vaqt).
- 5 ball variant eng uzun yoki eng «ideal» ko'rinishda bo'lmasin; 3–4 ball variantlar ham real va qisman to'g'ri bo'lsin.
- Yo'riqnomadagi «Javobgarligi» bo'limidagi xatti-harakatlarni (yashirish, vakolatsiz o'zgartirish, sirni oshkor qilish) asos qil.

`}${existing.length ? `## ALLAQACHON MAVJUD SAVOLLAR (takrorlama)\n\nQuyidagi mavzular testda bor. Yangi savollar ularni takrorlamasin, boshqa vaziyat va mavzu olsin:\n\n${existing.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n` : ""}## SAVOLLAR REJASI (BLUEPRINT) — qat'iy amal qil

Quyidagi ${FULL_N} ta joyning har biri uchun aynan bitta savol yoz. competency, level va type o'zgarmasin. Tartibni ham saqla.

${rows}

Jami: ${Object.entries(typeCounts).map(([k, v]) => `${k} ${v}`).join(" · ")}.

**Faqat ikki daraja ishlatiladi** (lavozim yo'riqnomasidagi talablar bilan bir xil; boshqa daraja yozilmaydi):
- **3 — Yaxshi:** tegishli ko'nikmani odatiy vaziyatlarda mustaqil qo'llaydi.
- **4 — Professional:** murakkab vaziyatlarda ham ko'nikmasini mustaqil va sifatli qo'llaydi (va kerak bo'lsa boshqalarning ishini tashkil eta oladi).

Test xodim yo'riqnomadagi talabga javob beradimi-yo'qmi shuni o'lchaydi: «ekspert» yoki o'quv-tajriba darajasidagi (yangi standart yaratish, kompaniya darajasida tizim qurish) savol yozma. Savol qiyinligi kartadagi shu daraja qatoriga mos kelsin: 3-daraja savolga odatiy ish tajribasi yetadi, 4-daraja savolda esa murakkab trade-off va xavfni hisobga olish kerak. Bir pog'ona past darajadagi odam ishonarli xatoga tushsin.

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

Maydonlar: position (doim "${pos.id}"), competency (${pos.competencies.map((c) => c.id).join(", ")}), level (faqat 3 yoki 4), type, stem (savol matni, 10–1500 belgi), options, correct / rubric, explanation (nega aynan shu javob to'g'ri va qaysi tuzoq qaysi variantda; 1000 belgigacha), timeLimitSec (15–900).

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
11. 4-daraja 3-darajadan tafsilot bilan emas, **qaror murakkabligi** bilan farq qilsin: 3 — odatiy ish vaziyatida to'g'ri harakat; 4 — trade-off, xavf, yuklama, bir nechta cheklov va oqibatlarni hisobga olish. 5 yoki 1–2 darajali savol yozma.
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

Aynan ${FULL_N} ta elementdan iborat JSON massiv. Boshqa hech narsa.

---

## KARTA: ${pos.title}

${card}

---

## UMUMIY QOIDALAR (barcha kartalar uchun)

${general}
`;
}

const missingArgIdx = process.argv.indexOf("--missing");
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

// --missing <lavozim> <mavjud-savollar.json>: yangi rejaga nisbatan yetishmayotgan joylar uchun alohida prompt
if (missingArgIdx !== -1) {
  const [code, file] = [process.argv[missingArgIdx + 1], process.argv[missingArgIdx + 2]];
  const pos = data.positions.find((p) => p.id === code);
  if (!pos) throw new Error("lavozim topilmadi: " + code);
  const have = new Map<string, number>();
  for (const q of JSON.parse(fs.readFileSync(file, "utf8")) as { competency: string; level: number }[]) {
    const k = `${q.competency}:${q.level}`;
    have.set(k, (have.get(k) ?? 0) + 1);
  }
  const need = slotsFor(pos).filter((s) => {
    const k = `${s.comp.id}:${s.level}`;
    const left = have.get(k) ?? 0;
    if (left > 0) { have.set(k, left - 1); return false; }
    return true;
  });
  // Mavjud savol rejaga sig'masa (ortiqcha), uning o'rniga so'ralmasligi uchun: SKIP="H5:3,..."
  for (const sk of (process.env.SKIP ?? "").split(",").filter(Boolean)) {
    const i = need.findIndex((s) => `${s.comp.id}:${s.level}` === sk);
    if (i !== -1) need.splice(i, 1);
  }
  const name = `${code}-qoshimcha.md`;
  const existingStems = (JSON.parse(fs.readFileSync(file, "utf8")) as { stem: string }[]).map((q) => q.stem.replace(/\s+/g, " ").slice(0, 110) + "…");
  fs.writeFileSync(path.join(outDir, name), build(pos, 0, need, existingStems));
  console.log(name, need.length, "yetishmayotgan joy:", need.map((s) => `${s.comp.id}L${s.level}${s.type[0]}`).join(" "));
}

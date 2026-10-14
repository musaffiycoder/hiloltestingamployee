// Har bir lavozim kartasi uchun Gemini'ga tashlanadigan tayyor prompt fayllarini yaratadi.
// Natija: data/gemini/NN-<lavozim>.md (gitignored). Ishga tushirish: npx tsx scripts/build-gemini-prompts.ts
import fs from "node:fs";
import path from "node:path";

type Comp = { id: string; name: string; type: "soft" | "hard"; target: number; weight: number; critical: boolean };
type Pos = { id: string; title: string; card: string; department?: string; competencies: Comp[] };

const ROOT = path.resolve(__dirname, "..");
const KARTALAR = path.resolve(ROOT, "..", "kartalar");
const TOTAL = 35; // kompetensiyalar uchun; +5 ta qadriyat savoli (V1) = jami 40
// Notion yo'riqnomalarida faqat 3 (Yaxshi) va 4 (Professional) talab qilinadi — savollar faqat shu ikki darajada.
const VALUE_LEVELS = [3, 3, 4, 4, 4];
const FULL = TOTAL + VALUE_LEVELS.length;
/** OPEN (keys/ishlab chiqarish) savollari soni — AI kompetensiyasining OPEN savolidan tashqari. */
const MAX_OPEN = 7;

/**
 * Savol formati — turdan tashqari «nimani qildiradi»: oson, sog'lom fikr bilan topiladigan savollarning oldini oladi.
 * KNOW — amaliy texnik bilim; CALC — berilgan raqamlardan hisoblash; DIAG — artefaktdagi xatolarni topish;
 * TRADEOFF — ikkala yo'l ham professional, farq — ustuvorlik/cheklov; CASE — ma'lumotli keys tahlili va qaror;
 * PRODUCE — ish natijasini yozish (kontent, kod, TZ, javob, reja).
 */
type Fmt = "KNOW" | "CALC" | "DIAG" | "TRADEOFF" | "CASE" | "PRODUCE" | "OCALC";
const FORMAT_DESC: Record<Fmt, string> = {
  KNOW: "amaliy texnik bilim — platforma/vosita/standart bo'yicha aniq fakt, cheklov, sozlama yoki xatti-harakat (havaskor bilmaydi)",
  CALC: "hisob-kitob — savol matnida raqamli ma'lumot (jadval/statistika), nomzod ko'rsatkichni hisoblaydi; noto'g'ri variantlar — tipik hisob xatolari natijasi",
  DIAG: "xatoni topish — to'liq artefakt (ssenariy, post, kod, jadval, TZ, log, hisobot) beriladi, ichida 2–3 ta professional xato; nomzod ularni tanlaydi",
  TRADEOFF: "trade-off vaziyat — 4 variantning hammasi tajribali mutaxassis haqiqatda qiladigan harakat; farq ustuvorlik, tartib, vaqt va cheklovda",
  CASE: "keys — ma'lumot (jadval, brif, xabarlar, ko'rsatkichlar) berilgan murakkab vaziyat; nomzod tahlil qilib qaror va asos yozadi",
  PRODUCE: "ishlab chiqarish topshirig'i — nomzod real ish natijasini yozadi (kontent matni, ssenariy, kod, TZ, javob xati, formula, reja); AI rubrika bo'yicha baholaydi",
  OCALC: "metrika keysi — xom ma'lumot beriladi; nomzod ko'rsatkichlarni hisoblaydi (formulasi bilan), talqin qiladi va xulosa/qaror yozadi",
};

const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data/competencies.json"), "utf8")) as { positions: Pos[] };

/** Savollar sonini vazn bo'yicha taqsimlash: kamida 2 (kritikda 3), jami TOTAL. */
const isAI = (c: Comp) => /\bAI\b/.test(c.name);
/** AI kompetensiyasi: bilim, prompt qoidalari, prompt yozish, AI javobini tekshirish, xavfsiz foydalanish. */
const AI_SLOTS: { level: number; type: string; format: Fmt; aspect: string }[] = [
  { level: 3, type: "MCQ_SINGLE", format: "KNOW", aspect: "AI bilimi va qoidalari" },
  { level: 3, type: "MCQ_MULTI", format: "DIAG", aspect: "prompt qoidalari (prompt bo'laklaridagi xatolarni topish)" },
  { level: 4, type: "OPEN", format: "PRODUCE", aspect: "A. prompt yozish" },
  { level: 4, type: "MCQ_MULTI", format: "DIAG", aspect: "B. AI javobidagi yashirin xatolarni topish" },
  { level: 4, type: "SITUATIONAL", format: "TRADEOFF", aspect: "C. xavfsiz va mas'uliyatli foydalanish" },
];

function quotas(comps: Comp[]): Record<string, number> {
  const min = (c: Comp) => (isAI(c) ? AI_SLOTS.length : c.critical ? 3 : 2);
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

function levelsFor(target: number, n: number): number[] {
  // Faqat yo'riqnomadagi talab darajalari: target 3 → hammasi 3; target ≥4 → yarmi 3, yarmi 4.
  if (target < 4) return Array.from({ length: n }, () => 3);
  const low = Math.floor(n / 2);
  return Array.from({ length: n }, (_, i) => (i < low ? 3 : 4));
}

type Slot = { comp: Comp; level: number; type: string; format?: Fmt; aspect?: string };

function slotsFor(pos: Pos) {
  const comps = pos.competencies.filter((c) => c.id !== "V1");
  const q = quotas(comps);
  const slots: Slot[] = [];
  for (const c of comps) for (const l of levelsFor(c.target, q[c.id])) slots.push({ comp: c, level: l, type: "" });
  const free = (c: Comp) => slots.filter((x) => x.comp.id === c.id && !x.type).sort((a, b) => b.level - a.level);

  // AI kompetensiyasi uchun qat'iy tuzilma (5 ta savol, har biri alohida jihatni o'lchaydi)
  const ai = comps.find(isAI);
  if (ai) {
    const mine = slots.filter((s) => s.comp.id === ai.id);
    // talab 3 bo'lsa hamma AI savoli ham 3-darajada (yo'riqnomadan yuqori daraja so'ralmaydi)
    AI_SLOTS.forEach((a, i) => mine[i] && Object.assign(mine[i], { type: a.type, format: a.format, aspect: a.aspect, level: ai.target < 4 ? 3 : a.level }));
  }

  // OPEN: (1) har hard kompetensiyaga bittadan (vazn bo'yicha), (2) vazni ≥8 soft'larga keys, (3) og'ir hard'larga ikkinchisi
  const hard = comps.filter((c) => c.type === "hard" && !isAI(c)).sort((a, b) => b.weight - a.weight);
  const soft = comps.filter((c) => c.type === "soft" && c.weight >= 8).sort((a, b) => b.weight - a.weight);
  const openFmt: Fmt[] = ["PRODUCE", "OCALC", "CASE"];
  let opens = 0;
  const addOpen = (c: Comp, f: Fmt) => {
    if (opens >= MAX_OPEN) return;
    const s = free(c)[0];
    if (!s || free(c).length < 2) return; // kompetensiyada yopiq savol ham qolsin
    Object.assign(s, { type: "OPEN", format: f });
    opens++;
  };
  hard.forEach((c, i) => addOpen(c, openFmt[i % openFmt.length]));
  soft.forEach((c) => addOpen(c, "CASE"));
  hard.forEach((c, i) => addOpen(c, openFmt[(i + 1) % openFmt.length]));

  // Qolganlari: hard — KNOW / CALC / DIAG / TRADEOFF aylanmasi; soft — TRADEOFF, TRADEOFF, DIAG
  const HARD_ROT: [string, Fmt][] = [["MCQ_SINGLE", "CALC"], ["MCQ_MULTI", "DIAG"], ["MCQ_SINGLE", "KNOW"], ["SITUATIONAL", "TRADEOFF"]];
  const SOFT_ROT: [string, Fmt][] = [["SITUATIONAL", "TRADEOFF"], ["SITUATIONAL", "TRADEOFF"], ["MCQ_MULTI", "DIAG"]];
  for (const c of comps) {
    // «Diqqat / aniqlik / xatosiz ishlash» — artefaktdagi xatolarni topish bilan o'lchanadi
    const careful: [string, Fmt][] = [["MCQ_MULTI", "DIAG"], ["SITUATIONAL", "TRADEOFF"]];
    const rot = c.type === "hard" ? HARD_ROT : /diqqat|aniqlik|xatosiz/i.test(c.name) ? careful : SOFT_ROT;
    // Raqamli ko'rsatkichi yo'q kompetensiyada (masalan, Docs/Drive, Figma) hisob o'rniga amaliy bilim
    const numeric = !/docs|drive|figma|mualliflik|brend|xavfsizlik|maxfiylik/i.test(c.name);
    free(c).forEach((s, i) => {
      const [type, format] = rot[i % rot.length];
      Object.assign(s, { type, format: format === "CALC" && !numeric ? "KNOW" : format });
    });
  }
  const v1 = pos.competencies.find((c) => c.id === "V1");
  if (v1) for (const l of VALUE_LEVELS) slots.push({ comp: v1, level: l, type: "SITUATIONAL", format: "TRADEOFF" });
  return slots;
}

/** Lavozim bo'yicha o'lchanadigan metrikalar va o'lchov birliklari — nomzod ularni bilishi va hisoblay olishi kerak. */
const METRICS: Record<string, string> = {
  backend:
    "p50/p95/p99 latency (ms), RPS/throughput, error rate (%), uptime va SLA (99,9% = oyiga ~43 daqiqa ruxsat etilgan uzilish), MTTR/MTTD, DB so'rov vaqti va EXPLAIN (Seq Scan vs Index Scan, rows, cost), index selektivligi, N+1 so'rovlar soni, connection pool to'yinishi, cache hit ratio (%), queue lag, Big-O, test coverage (%) va uning cheklovi, deploy chastotasi va change failure rate (DORA).",
  frontend:
    "crash-free users/sessions (%), ANR rate (Play Console, 0,47% chegara), cold/warm start vaqti (ms), kadr tezligi (60/120 FPS, 16,6 ms/kadr, jank), build hajmi (APK/AAB/IPA, MB), xotira sarfi, tarmoq so'rovlari soni va hajmi, D1/D7/D30 retention, store reytingi, staged rollout (%), Flutter DevTools ko'rsatkichlari (rebuild soni, raster/UI thread vaqti), widget test/golden test qamrovi.",
  pm:
    "velocity (story point/sprint), sprint commitment bajarilishi (%), burndown/burnup, cycle time va lead time (kun), WIP, scope creep (%), defect leakage (prod'ga o'tgan xato ÷ jami xato), reopen rate, on-time delivery (%), kritik yo'l (critical path), PERT baho ((O + 4M + P) ÷ 6), resurs bandligi (%), RICE/ICE ustuvorlik bali.",
  bosh_pm:
    "velocity, cycle/lead time, on-time delivery (%), defect leakage, release chastotasi, crash-free (%), PERT baho, resurs bandligi (%), sertifikat va domen muddati (kun qoldi), AWS S3 xarajati (saqlash GB-oy, egress GB), kirish huquqlari auditi (faol akkaunt soni, ortiqcha admin), uptime (%).",
  bolim_boshligi:
    "KPI va OKR bajarilishi (%), budjet og'ishi (reja vs fakt, %), resurs bandligi va bench (%), xodimlar aylanmasi (attrition, %), yetkazib berish prognozliligi (rejalangan ÷ bajarilgan), defect leakage, crash-free (%), to'lov konversiyasi va muvaffaqiyatsiz tranzaksiya ulushi (%), loyiha tannarxi (odam-soat × stavka), ROI.",
  dizayner:
    "kontrast nisbati (WCAG AA: matn 4,5:1, katta matn 3:1), tegish maydoni (iOS 44×44 pt, Android 48×48 dp), 8-pt grid va spacing tokenlari, tipografik shkala, pt/dp/px va @1x/@2x/@3x eksport, safe area, chop etish uchun 300 DPI, CMYK vs RGB, bleed (3 mm), usability ko'rsatkichlari (task success %, vaqt, xato soni, SUS bali), Figma auto layout/variants/tokens.",
  kontent_menejer:
    "EPUBCheck xato/ogohlantirish turlari (ERROR, WARNING), EPUB 3 tuzilmasi (OPF, nav, spine, metadata), rasm o'lchami va hajmi (px, KB), metadata to'liqligi (%), App Store narx tierlari va Google Play narxi (so'm, komissiya 15%/30%, soliq), konversiya (ko'rish → xarid, %), qaytarish (refund) ulushi, reyestr aniqligi (xato yozuv ÷ jami), nashr muddati (kun), sotuv hisoboti (dona, tushum).",
  support:
    "FRT — birinchi javob vaqti (daqiqa), ART/resolution time, SLA bajarilishi (%), FCR — birinchi murojaatda hal qilish (%), CSAT (%), reopen rate, eskalatsiya ulushi (%), backlog va uning yoshi, murojaatlar toifasi bo'yicha ulush, median vs o'rtacha vaqt farqi.",
  smm_menejer:
    "reach va impressions farqi, ER reach bo'yicha ((layk + izoh + saqlash + ulashish) ÷ reach × 100) va obunachi bo'yicha ER farqi, Telegram view rate (ko'rish ÷ obunachi), Reels/TikTok retention va o'rtacha ko'rish vaqti, 3 soniyalik hook ushlab qolish (%), saqlash va ulashish ulushi, obunachi o'sishi (net = yangi − chiqqan, %), CTR (bosish ÷ ko'rish), UTM parametrlari (utm_source/medium/campaign/content, katta-kichik harf sezgirligi), havoladan savdoga konversiya (%), izohga javob vaqti, reja bajarilishi (chiqqan ÷ rejadagi), Google Sheets formulalari (SUMIF, COUNTIF, AVERAGEIF, XLOOKUP, QUERY, pivot).",
};

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
  smm_menejer: [
    "Diniy mazmun va brend tasdig'idan o'tmagan ssenariy, matn yoki videoni joylamaslik (trend, muddat yoki rahbar bosimida ham)",
    "Kontent natijasi va hisobot raqamlari haqida rost ma'lumot (raqamni bo'rttirmaslik, yomon natijani yashirmaslik)",
    "Ustoz, mehmon va face roziligisiz tasvir yoki ovozdan (shu jumladan AI bilan) foydalanmaslik; litsenziyasiz musiqa, rasm, shrift ishlatmaslik",
    "Diniy savolga o'zi hukm chiqarmaslik; izoh va xabarlarga qo'pol yoki tekshirilmagan javob bermaslik",
    "Akkaunt va parollarni himoya qilish, korxona kanalini shaxsiy maqsadda ishlatmaslik, maxfiy ma'lumotni (e'lon qilinmagan kitob, aksiya, narx) oshkor qilmaslik yoki ruxsatsiz AI'ga kiritmaslik",
  ],
};

/** Lavozimga xos qo'shimcha ko'rsatma (prompt boshiga qo'shiladi). */
const POSITION_NOTES: Record<string, string> = {
  bosh_pm:
    "**Bosh PM va oddiy PM farqi:** Bosh PM boshqa PMlarni **boshqarmaydi**, ularga bo'ysundirmaydi va baholamaydi (PMlar bo'lim boshlig'iga hisobot beradi). Uning vazifalari PM bilan deyarli bir xil, faqat qo'shimcha ma'muriy-texnik vazifalari bor: domen, AWS S3, Apple sertifikat va provisioning, GitLab va asosiy tizimlarning ma'muriy huquqlari, Firebase. Shuning uchun: (1) PM bilan umumiy vaziyatlar (sprint, talab, smoke test, release) PM savollari kabi bo'lsin; (2) «PMlarni boshqarish, baholash, ustuvorlik berish» vaziyatlari yozilmasin; (3) Karta jadvalidagi «PMlarni o'stiradi, mentorlik» kabi 5-daraja ko'rsatkichlari faqat tengdosh darajasidagi tajriba ulashish deb tushunilsin; (4) ma'muriy-texnik vazifalar (kirish huquqi, kalit, sertifikat, domen) bo'yicha savollar ko'proq bo'lsin; (5) «Loyihalar portfeli» — Bosh PMning o'ziga biriktirilgan bir nechta loyihasi (boshqa PMlarning loyihalari emas), «yetakchilik» va «ish yukini baholash» — faqat o'z loyihasiga biriktirilgan dasturchi va dizayner doirasida; (6) «Loyihalararo muammolar» — o'z loyihalari orasidagi va umumiy texnik tizimlar (GitLab, sertifikat, domen, S3) bilan bog'liq xavflarni oldindan ko'rib, bo'lim boshlig'iga hisobot berish.",
  smm_menejer:
    "**SMM menejer — Marketing bo'limi, dasturlash emas.** Vaziyatlar Hilol Nashr ijtimoiy tarmoqlari (Instagram, Telegram, TikTok, Facebook, YouTube Shorts) atrofida bo'lsin: kitob chiqishi, aksiya, tadbir, face va ustoz bilan syomka, Production (videograf-montajor, grafik dizayner) bilan ishlash, izohlar, Google Sheets hisobot, UTM. Kontent ma'rifiy va diniy mazmunli: har bir matn va video diniy mazmun tekshiruvchisi va bevosita rahbar (marketolog) tasdig'idan o'tadi; fatvo/hukm so'raladigan savolga SMM menejer o'zi javob bermaydi, ustozga uzatadi. Savollarda haqiqiy diniy hukm yoki oyat/hadis matnini o'ylab topma — kerak bo'lsa «diniy savol» deb umumiy tasvirla. Analitika savollarida aniq raqamlar bilan hisob-kitob ber (ER = (layk + izoh + saqlash + ulashish) ÷ reach, reja bajarilishi = chiqqan ÷ rejadagi) va formulalar (SUMIF, COUNTIF, XLOOKUP, QUERY, pivot) amaliy vaziyatda bo'lsin.",
  pm:
    "**PM va Bosh PM:** Bosh PM lavozimi PM bilan deyarli bir xil (u ham boshqa PMlarni boshqarmaydi), shu sabab savollar ikkala lavozim uchun ham mos bo'ladigan umumiy PM vaziyatlariga tayansin.",
};

/** Vaqt formatga qarab (sekund). */
const TIME: Record<Fmt, number> = { KNOW: 90, CALC: 150, DIAG: 180, TRADEOFF: 120, CASE: 420, PRODUCE: 480, OCALC: 420 };
const timeOf = (s: Slot) => TIME[s.format ?? "KNOW"];

function build(pos: Pos, num: number, onlySlots?: ReturnType<typeof slotsFor>, existing: string[] = []): string {
  const card = fs.readFileSync(path.join(KARTALAR, pos.card), "utf8");
  const general = fs.readFileSync(path.join(KARTALAR, "00-umumiy-qoidalar.md"), "utf8");
  // Notion lavozim yo'riqnomasidan olingan haqiqiy ish vazifalari (data/yoriqnomalar/<id>.md)
  const duties = fs.readFileSync(path.join(ROOT, "data/yoriqnomalar", `${pos.id}.md`), "utf8");
  const slots = onlySlots ?? slotsFor(pos);
  const FULL_N = slots.length;
  const typeCounts = slots.reduce<Record<string, number>>((m, s) => ((m[s.type] = (m[s.type] ?? 0) + 1), m), {});
  const fmtCounts = slots.reduce<Record<string, number>>((m, s) => ((m[s.format ?? "-"] = (m[s.format ?? "-"] ?? 0) + 1), m), {});
  const totalSec = slotsFor(pos).reduce((s, x) => s + timeOf(x), 0);

  const rows = slots
    .map(
      (s, i) =>
        `${String(i + 1).padStart(2, "0")}. competency="${s.comp.id}" (${s.comp.name}) · level=${s.level} · type=${s.type} · format=${s.format} · timeLimitSec=${timeOf(s)}${s.comp.critical ? " · KRITIK" : ""}${s.aspect ? ` · jihat: ${s.aspect}` : ""}`,
    )
    .join("\n");
  const catalog = pos.competencies
    .map((c) => `- ${c.id} = ${c.name} [${c.type}, talab ${c.target}, vazn ${c.weight}%${c.critical ? ", KRITIK" : ""}]`)
    .join("\n");

  return `# Gemini prompt — ${pos.title}

> Qanday ishlatiladi: shu faylning **hammasini** Gemini (2.5 Pro / eng kuchli model) ga bitta xabarda tashlang. U sizga bitta JSON qaytaradi.
> JSON ni Baholash platformasida **Savollar → Import** ga qo'ying.

---

## ROL VA MAQSAD

Sen — ${pos.title} sohasida 10+ yil ishlagan amaliyotchi va texnik intervyu o'tkazuvchi ekspertsan (psixometrika bo'yicha ham tajribang bor). Quyida Hilol Nashr (${pos.department ?? "Dasturlash bo'limi"}) uchun **${pos.title}** lavozimining baholash kartasi berilgan. Shu kartaga tayanib, **aynan ${FULL_N} ta** savoldan iborat **texnik baholash testi** tuz.

Test ham **nomzodni qabul qilish**, ham **mavjud xodimni baholash** uchun ishlatiladi. Bu — umumiy savodxonlik yoki odob testi EMAS, **kasbiy texnik imtihon**: u faqat shu ishni haqiqatan qila oladigan odamni boshqalardan ajratishi kerak.

**Test egasining avvalgi testlar haqidagi aniq e'tirozlari (takrorlama):**
1. «Savollar juda sodda — 3 yoshli bola ham topadi.» Masalan: «Do'stingizning kiyim do'koni bor, u Hilol Nashr sahifasi statistikasini so'radi — nima qilasiz?» — javob sog'lom fikr bilan ko'rinib turibdi, kasbiy bilim kerak emas.
2. Variantlardan biri ochiq-oydin axloqsiz, qo'pol, dangasa yoki «qoidani buz» bo'lsa — hamma uni tashlab yuboradi, savol hech narsani o'lchamaydi.
3. To'g'ri javob doim eng uzun va eng «ideal» ko'rinadi.
4. Test o'lchov birliklari va metrikalarni so'ramaydi: nomzod ko'rsatkich nimaligini, formulasini, qayerda va qanday o'lchanishini bilishi tekshirilmaydi.
5. Amaliy topshiriq yo'q: nomzod hech narsa yozmaydi, hisoblamaydi, tahlil qilmaydi.

${POSITION_NOTES[pos.id] ? `## LAVOZIMGA XOS ESLATMA\n\n${POSITION_NOTES[pos.id]}\n\n` : ""}## QIYINLIK STANDARTI — eng muhim bo'lim

**«Havaskor testi».** Har savolni yozgach o'zingdan so'ra: aqlli, o'qimishli, lekin shu sohada hech ishlamagan odam (masalan, iqtisodchi yoki o'qituvchi) bu savolni faqat sog'lom fikr, odob yoki «eng mas'uliyatli ko'ringan variant» bo'yicha to'g'ri yecha oladimi? **Yecha olsa — savol yaroqsiz, qayta yoz.**

Har bir savol (V1 dan tashqari) quyidagilardan kamida bittasini **talab qilsin**:
- berilgan raqamlardan hisob-kitob (formula, ulush, o'sish, o'rtacha/median, konversiya);
- to'liq artefaktni o'qish va undagi professional xatoni ko'rish (kod, log, jadval, ssenariy, post matni, TZ, sozlama, hisobot);
- platforma/vosita/standartning aniq texnik bilimi (cheklov, sozlama nomi, algoritm xatti-harakati, format talabi, limit, formula sintaksisi);
- ikkita professional to'g'ri yondashuvdan birini **noaniq mezon** bo'yicha tanlash (ma'lumotdagi tuzoq, kichik namuna, noto'g'ri davr, outlier, noto'g'ri maxraj).

**Darajalar qiyinligi:**
- **3 — Yaxshi:** 1–2 yillik amaliyotchi biladigan, kitobdan emas ishdan o'rganiladigan bilim. Bir qadamli hisob yoki bitta artefakt xatosi. Junior/havaskor bu yerda xato qiladi.
- **4 — Professional:** ko'p qadamli fikrlash (≥2 hisob yoki ≥2 cheklov), ma'lumotda yashirin tuzoq (masalan: reach o'rniga impressions bilan hisoblangan ER, bitta viral post o'rtachani buzgan, davrlar teng emas, UTM'da katta-kichik harf farqi), bir nechta to'g'ri yo'ldan eng to'g'risi.
- Ekspert (5) yoki boshlang'ich (1–2) darajadagi savol yozma, lekin 3-daraja ham **oson emas**.

**Kutilgan natija:** kuchli mutaxassis ~70–80%, o'rtacha nomzod ~40–50%, havaskor ≤25% (taxmin darajasi) to'playdi.

**Taqiqlangan andozalar (V1 dan tashqari hamma savolda):**
- Variantlardan birida yolg'on, yashirish, qo'pollik, dangasalik, e'tiborsizlik, vakolatsiz ish, «qoidani buz» bo'lishi. Hamma variant — ishini biladigan odam haqiqatda qilishi mumkin bo'lgan harakat.
- Lavozimga aloqasiz yoki maishiy vaziyat (do'st, qarindosh, shaxsiy iltimos).
- «Rahbarga aytasizmi yoki yo'qmi», «tekshirasizmi yoki tekshirmaysizmi» kabi savollar — javobi ochiq.
- Ta'rif yodlatish («ER nima?»): bilim doim aniq ma'lumot ustida qo'llansin («mana statistika — ER nechaga teng va bu post kuchlimi?»).
- To'g'ri javob savol matnidagi kalit so'zni takrorlashi yoki eng «xavfsiz/mas'uliyatli» eshitilishi.

**Noto'g'ri variantlar (distraktorlar) qanday yoziladi:** har biri — junior yoki yarim-mutaxassisning **aniq, nomlangan xatosi** natijasi: noto'g'ri maxraj, noto'g'ri davr, eskirgan qoida, boshqa platformada to'g'ri bo'lgan qoida, formula sintaksisidagi tipik xato, o'rtacha vs median, korrelyatsiyani sabab deb bilish va h.k. Hisob savolida har noto'g'ri variant aynan shu xato bilan hisoblangan **haqiqiy son** bo'lsin. "explanation"da har noto'g'ri variant qaysi xatodan kelib chiqishini qisqa yoz.

## O'LCHOV BIRLIKLARI VA METRIKALAR

Bu lavozimda o'lchanadigan asosiy ko'rsatkichlar:

${METRICS[pos.id] ?? "Kartadagi hard kompetensiyalarda tilga olingan ko'rsatkichlar."}

Qoidalar:
- **Kamida 8 ta savol** (CALC, OCALC va qisman DIAG/KNOW formatlarida) shu metrikalarni bevosita tekshirsin: ta'rifi va formulasi, qayerda (qaysi vosita/hisobot/ekranda) va qanday o'lchanadi, berilgan ma'lumotdan hisoblash, natijani to'g'ri talqin qilish, qaysi holatda ko'rsatkich chalg'itadi.
- Raqamlar real ko'rinsin (yumaloq emas: 12 437, 3,8%, 1 h 14 min) va hisoblash kalkulyatorsiz 1–2 daqiqada bajarilsin.
- Hisob savolida to'g'ri javobni o'zing **ikki marta hisoblab** tekshir.

## FORMATLAR (blueprint'dagi "format" maydoni)

${(Object.keys(FORMAT_DESC) as Fmt[]).map((f) => `- **${f}** — ${FORMAT_DESC[f]}.`).join("\n")}

**OPEN (CASE, PRODUCE, OCALC) talablari:**
- Savol matnida ishlash uchun **to'liq material** bo'lsin: markdown jadval, brif, xom statistika, kod, matn qoralamasi, mijoz xabari — nomzod tashqi manbasiz ishlay oladigan.
- Topshiriq aniq: nima yoziladi, qaysi formatda, hajmi (masalan: «Reels ssenariysi: hook (≤3 s), 3 ta sahna, CTA; 120–200 so'z»; «formula va natija, keyin 3–5 gap xulosa»).
- Kamida yarmida **yashirin tuzoq** bo'lsin (noto'g'ri raqam, litsenziyasiz musiqa, tasdiqlanmagan matn, ma'lumotdagi outlier, xavfsizlik teshigi) — nomzod uni o'zi sezishi kerak; rubrikada «tuzoqni sezdi va to'g'ri hal qildi» bandi bo'lsin.
- "rubric": **4–7 band**, har biri aniq tekshiriladi («ER ni reach bo'yicha 8,1% deb hisobladi», «hook birinchi 3 soniyada savol yoki ziddiyat bilan boshlanadi», «CTA bitta va o'lchanadigan (UTM havola)»). «Yaxshi yozilgan», «mantiqli» kabi mavhum band yozma. Hisob topshirig'ida kutilgan **son** rubrikada yozilsin.
- PRODUCE topshiriqlarida natija haqiqiy ish mahsuloti bo'lsin (post, ssenariy, TZ, javob xati, kod, formula, prompt) — AI uni to'liq tahlil qiladi.

**SITUATIONAL (TRADEOFF) talablari:**
- 4 variantning **hammasi** professional, halol va o'z ishini biladigan odam qiladigan harakat. Farq — ustuvorlik, tartib, vaqt, resurs va oqibatlarni hisobga olishda.
- Ballar: odatda 5 / 4 / 3 / 2 (1 ball faqat jiddiy kasbiy xatoga). "flag" ishlatma (faqat V1 da).
- To'g'ri tanlov uchun savoldagi **aniq faktni** (raqam, muddat, platforma xususiyati, cheklov) hisobga olish kerak bo'lsin; o'sha faktsiz boshqa variant eng yaxshi bo'lardi.
- «Hammani xabardor qil, hammasini hujjatlashtir, hamma bilan kelish» shabloni eng yaxshi javob bo'lib qolmasin.

**MCQ_MULTI (DIAG):** artefakt to'liq keltirilsin (kod blok, jadval yoki iqtibos); 5–6 variant, 2–3 tasi to'g'ri; noto'g'ri variantlar artefaktda **to'g'ri qilingan**, lekin xatoga o'xshab ko'rinadigan joylar bo'lsin.

## PLATFORMA IMKONIYATLARI

- Nomzod savollarni **ixtiyoriy tartibda** yechadi. Shuning uchun **har bir savol mustaqil** bo'lsin: «oldingi savoldagi jadval» kabi bog'liqlik yozma; kerakli material savolning o'zida to'liq bo'lsin.
- Savol matni markdown'ni ko'rsatadi: jadval (| ... |) va kod bloklari (\`\`\`) ishlating.
- Bir testda jami ${FULL} ta savol (35 ta kompetensiya + 5 ta qadriyat). Taxminiy umumiy vaqt: ${Math.round(totalSec / 60)} daqiqa.

## LAVOZIM KOMPETENSIYALARI

Lavozim kodi (JSON'dagi "position" maydoni): **"${pos.id}"**

${catalog}

## HAQIQIY ISH VAZIFALARI (Notion lavozim yo'riqnomasidan)

Quyidagi matn shu lavozimning rasmiy yo'riqnomasidan olingan. **Barcha savollar shu real vazifa, vosita va javobgarliklarga tayansin** — aynan Hilol Nashrdagi shu lavozim egasi duch keladigan ish.

${duties}

**Ish vaziyatiga bog'lash qoidalari:**
- Har savol yuqoridagi raqamlangan vazifalardan biriga tayansin; qaysi biriga tayanganini "explanation"da bir jumla bilan ko'rsat.
- Har vaziyatda rol, vosita, raqam (muddat, ko'rsatkich, versiya, narx, hajm) va oqibat bo'lsin.
- «Qizil bayroqlar»dagi xatti-harakatlar ochiq variant sifatida emas, faqat **OPEN keyslardagi yashirin tuzoq** sifatida (nomzod o'zi sezishi kerak) yoki V1 da ishlatilsin.

${onlySlots ? "" : `## QADRIYATLAR (V1) — 5 ta savol

V1 «Qadriyatlar: halollik, maxfiylik va mas'uliyat» — **kritik** kompetensiya. 5 ta savol (blueprint oxirida) faqat **SITUATIONAL** bo'lsin.

**O'lchov birliklari (daraja ko'rsatkichlari):**

| Daraja | Xatti-harakat |
|---|---|
| 3 — Yaxshi | Odatiy vaziyatda halol: xatosini o'zi aytadi, maxfiy ma'lumotni himoya qiladi, vakolat doirasida ishlaydi. |
| 4 — Professional | Bosim, manfaat va shaxsiy munosabat sharoitida ham tamoyilda qoladi; buzilishni to'g'ri kanal orqali xabar qiladi; xavfni oldindan ochiq aytadi. |

**5 ta mavzu (har biri bitta savol; tartibda):**

${(VALUE_THEMES[pos.id] ?? []).map((t, i) => `${i + 1}. ${t}  — daraja ${VALUE_LEVELS[i]}`).join("\n")}

**Qadriyat savollari — «kulrang» dilemmalar:**
- Ikki **qonuniy** maqsad to'qnashsin (muddat va sifat, jamoa manfaati va qoida, rahbar iltimosi va tartib, foydalanuvchiga yordam va maxfiylik). Halol yo'lning aniq **narxi** bo'lsin.
- Qoidaga zid variant (agar bo'lsa) «oqilona yorliq» ko'rinishida bo'lsin: sohada ko'p qilinadigan, ishonarli asosi bor, «hamma shunday qiladi» deyiladigan qadam. U "flag":true va 1–2 ball oladi. Ochiq yolg'on, o'g'irlik yoki qo'pollik variantini yozma.
- Kamida 2 ta savolda **hech bir variant qoidani buzmaydi** — farq to'g'ri kanal, vaqt, kimga va qanday aytishda (5 / 4 / 3 / 2 ball).
- 5 ball variant eng uzun, eng «ideal» yoki eng ko'p odamni jalb qiladigan bo'lmasin. Vaa'z ohangidan qoch.

`}${existing.length ? `## ALLAQACHON MAVJUD SAVOLLAR (takrorlama)\n\nQuyidagi mavzular testda bor. Yangi savollar ularni takrorlamasin:\n\n${existing.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n` : ""}## SAVOLLAR REJASI (BLUEPRINT) — qat'iy amal qil

Quyidagi ${FULL_N} ta joyning har biri uchun aynan bitta savol yoz. competency, level, type, format va timeLimitSec o'zgarmasin. Tartibni ham saqla.

${rows}

Jami turlar: ${Object.entries(typeCounts).map(([k, v]) => `${k} ${v}`).join(" · ")}. Formatlar: ${Object.entries(fmtCounts).map(([k, v]) => `${k} ${v}`).join(" · ")}.

## JSON FORMATI

Faqat bitta JSON massiv qaytar. Markdown, izoh, kirish so'zi yozma. "format" maydonini ham qo'sh. Har element:

MCQ_SINGLE — bitta to'g'ri javob, 4 ta variant:
{"position":"${pos.id}","competency":"H1","level":3,"type":"MCQ_SINGLE","format":"CALC","stem":"...","options":["...","...","...","..."],"correct":2,"explanation":"...","timeLimitSec":150}

MCQ_MULTI — 2 yoki 3 ta to'g'ri javob, 5 yoki 6 ta variant; "correct" — indekslar massivi; nechta javob kerakligini savolda ayt:
{"position":"${pos.id}","competency":"H2","level":4,"type":"MCQ_MULTI","format":"DIAG","stem":"...","options":["...","...","...","...","..."],"correct":[0,3],"explanation":"...","timeLimitSec":180}

SITUATIONAL — har variantga 1–5 ball, 4 ta variant, ballar turlicha:
{"position":"${pos.id}","competency":"S2","level":4,"type":"SITUATIONAL","format":"TRADEOFF","stem":"...","options":[{"text":"...","points":5},{"text":"...","points":3},{"text":"...","points":4},{"text":"...","points":2}],"explanation":"...","timeLimitSec":120}

OPEN — erkin javob; AI va inson rubrika bo'yicha baholaydi:
{"position":"${pos.id}","competency":"H1","level":4,"type":"OPEN","format":"PRODUCE","stem":"... (material + aniq topshiriq + hajm)","rubric":["...","...","...","..."],"explanation":"... (namunaviy kuchli javob qisqacha va tuzoq)","timeLimitSec":480}

Maydonlar: position (doim "${pos.id}"), competency (${pos.competencies.map((c) => c.id).join(", ")}), level (faqat 3 yoki 4), type, format, stem (10–3000 belgi), options, correct / rubric, explanation (1000 belgigacha), timeLimitSec (blueprint'dagi qiymat).

## NAMUNA: yomon va yaxshi savol (faqat qiyinlik darajasini ko'rsatish uchun; o'z savollaringni shu lavozim va kompetensiyaga moslab yoz)

YOMON (sog'lom fikr bilan topiladi):
«Do'stingiz Hilol Nashr sahifasi statistikasini so'radi. Nima qilasiz?» — A) beraman; B) rahbardan so'rayman; C) yolg'on statistika beraman; D) e'tibor bermayman.

YAXSHI (CALC, level 3 — faqat metrikani biladigan odam topadi):
«Instagram Reels statistikasi (7 kun): reach 12 400, impressions 15 900, layk 610, izoh 48, saqlash 230, ulashish 112, profilga o'tish 95. Bo'limda ER = (layk + izoh + saqlash + ulashish) ÷ reach. ER nechaga teng?» — A) 6,3% (impressions'ga bo'lingan); B) 5,3% (faqat layk + izoh); C) 8,1% ✔; D) 8,8% (profilga o'tish ham qo'shilgan).

YAXSHI (OCALC, level 4): 6 ta postning jadvali (reach, ko'rish, saqlash, ulashish, havola bosish, UTM bo'yicha buyurtma) beriladi, bittasi reklamada ko'tarilgan va o'rtachani buzadi; nomzod ER va konversiyani hisoblaydi, reklamaga qaysi organik postni tavsiya qilishini asoslaydi; rubrika: to'g'ri sonlar, reklama postini ajratgani, median ishlatgani, savdoga o'tishni UTM bo'yicha baholagani, aniq qaror.

## SIFAT QOIDALARI — buzilsa savol yaroqsiz

1. To'g'ri javob variantlar ichida eng uzun bo'lmasin. Barcha variantlar uzunligi (±20%), gap soni va tafsilot darajasi teng.
2. To'g'ri javob indeksi MCQ_SINGLE'larda 0–3 ga teng taqsimlansin; bitta indeks 35% dan oshmasin; ketma-ket ikki savolda bir xil indeks bo'lmasin. SITUATIONAL'da 5 ball variant joyi ham aralashsin.
3. «doim», «hech qachon», «faqat», «hammasi», «umuman» kabi mutlaq so'zlar bilan noto'g'ri variantni «bo'yama».
4. «Hammasi to'g'ri» / «Hech biri» / «A va B» variant yozma.
5. Variantlar grammatik va uslubiy bir xil, mazmunan haqiqatan farqli.
6. Har savol kartadagi shu kompetensiyaning shu darajadagi ko'rsatkichlariga tayansin.
7. Faqat o'zbek tilida (lotin yozuvi); texnik atamalar inglizcha qolishi mumkin. Kirill harfi ishlatma.
8. Haqiqiy parol, token, shaxsiy ma'lumot yozma — faqat soxta namunalar (sk_test_XXXX, example.com).
9. Diniy hukm, oyat yoki hadis matnini o'ylab topma.
10. Savollar mavzusi takrorlanmasin; bir kompetensiya ichida ham turli vazifa va vositalarni qamra.
11. AI kompetensiyasi (nomida «AI» bor) — 5 ta savol, blueprint'dagi jihatlar bo'yicha:
   - KNOW — AI bilimi real holatda (hallucination qanday ushlanadi, kontekst cheklovi, nega eskirgan ma'lumot beradi, kompaniya AI qoidalari) — ta'rif emas, qaror;
   - DIAG (prompt qoidalari) — 5–6 ta prompt bo'lagi; qaysilarida aniq xato bor (kontekst yo'q, format yo'q, maxfiy ma'lumot bor, tekshirish so'ralmagan);
   - PRODUCE (prompt yozish) — aniq ish masalasi va materiali; nomzod to'liq prompt yozadi; rubrikada rol, kontekst, cheklov, format, misol, maxfiylik, natijani tekshirish;
   - DIAG (AI javobi) — AI javobi to'liq keltiriladi, ichida 3 ta yashirin xato (uydirma fakt, mantiq/hisob, xavfsizlik/huquq);
   - TRADEOFF (xavfsiz foydalanish) — hamma variant AI'dan foydalanishning real usuli; farq maxfiylik darajasi, tekshirish va ruxsatda.

## O'Z-O'ZINI TEKSHIRISH (javobda ko'rsatma — faqat ichki)

Har savol uchun jimgina tekshir: (a) blueprint'dagi competency/level/type/format to'g'rimi; (b) **havaskor testi**dan o'tadimi — sog'lom fikr bilan topilmaydimi; (c) V1 dan tashqari savolda axloqsiz/dangasa variant yo'qmi; (d) har noto'g'ri variant qaysi aniq kasbiy xatodan kelib chiqqanini ayta olasanmi; (e) hisob savollarida javobni qayta hisobladingmi; (f) to'g'ri javob eng uzun emasmi; (g) savol mustaqilmi; (h) JSON sintaksisi to'g'rimi.

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
  // AI_ONLY=1: faqat AI kompetensiyasi, joylar daraja + tur bo'yicha solishtiriladi
  const aiOnly = !!process.env.AI_ONLY;
  const key = (c: string, l: number, t: string) => (aiOnly ? `${c}:${l}:${t}` : `${c}:${l}`);
  const have = new Map<string, number>();
  for (const q of JSON.parse(fs.readFileSync(file, "utf8")) as { competency: string; level: number; type: string }[]) {
    const k = key(q.competency, q.level, q.type);
    have.set(k, (have.get(k) ?? 0) + 1);
  }
  const need = slotsFor(pos).filter((s) => {
    if (aiOnly && !isAI(s.comp)) return false;
    const k = key(s.comp.id, s.level, s.type);
    const left = have.get(k) ?? 0;
    if (left > 0) { have.set(k, left - 1); return false; }
    return true;
  });
  // Mavjud savol rejaga sig'masa (ortiqcha), uning o'rniga so'ralmasligi uchun: SKIP="H5:3,..."
  for (const sk of (process.env.SKIP ?? "").split(",").filter(Boolean)) {
    const i = need.findIndex((s) => `${s.comp.id}:${s.level}` === sk);
    if (i !== -1) need.splice(i, 1);
  }
  const name = aiOnly ? `${code}-ai-qoshimcha.md` : `${code}-qoshimcha.md`;
  const existingStems = (JSON.parse(fs.readFileSync(file, "utf8")) as { stem: string }[]).map((q) => q.stem.replace(/\s+/g, " ").slice(0, 110) + "…");
  fs.writeFileSync(path.join(outDir, name), build(pos, 0, need, existingStems));
  console.log(name, need.length, "yetishmayotgan joy:", need.map((s) => `${s.comp.id}L${s.level}${s.type[0]}`).join(" "));
}

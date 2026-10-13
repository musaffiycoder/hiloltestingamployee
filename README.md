# Baholash (app)

Lavozim kartalari asosida nomzod va xodimlarni baholash platformasi.
Lavozim kartalari (1–5 daraja, talab, vazn, kritik belgisi) asosida baholash.

## Stack
Next.js 16 (App Router) · React 19 · Tailwind v4 · Prisma 6 · PostgreSQL (lokal / Neon) · jose (JWT cookie)

## Ishga tushirish
```bash
cp .env.example .env        # DATABASE_URL, AUTH_SECRET, SEED_ADMIN_* ni to'ldiring
npm install
npx prisma migrate dev
npm run seed                # data/ papkasidagi matritsa va savollarni yuklaydi, admin yaratadi
npm run dev -- -p 3100
npm test                    # skoring mantiqi testlari
```

## Tuzilma
- `src/lib/scoring.ts` — daraja, umumiy ball, xulosa (sof funksiyalar, testlangan)
- `src/lib/attempt.ts` — urinishni hisoblash (javob → ball → natija)
- `src/app/hr/*` — HR panel (dashboard, natijalar, takliflar, lavozim kartalari)
- `src/app/t/[token]/*` — nomzod/xodim test oqimi (token havola)
- `data/` — **git'ga kiritilmaydi**: `competencies.json` (talablar matritsasi) va `questions-backend.ts` (javob kalitlari bor savollar). Tafsilot: `data/README.md`

## Deploy
Ilova: **Vercel** (funksiyalar `iad1`, `vercel.json`). Ma'lumotlar bazasi: **Neon** (Postgres, `us-east-2` — shu hududga yaqin).

Vercel'da (Production) o'rnatiladigan o'zgaruvchilar: `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED`, `AUTH_SECRET` (yangi, lokal bilan bir xil emas).
Migratsiya deploydan oldin qo'lda: `npx prisma migrate deploy` (`DATABASE_URL_UNPOOLED` orqali). Taklif havolalari so'rov manzilidan quriladi, shuning uchun alohida URL o'zgaruvchisi kerak emas.

```bash
vercel deploy --prod
```

## AI tahlil (Claude)
Manba qoidalar: `PROMPT-TEST-TAHLIL.md`. Uch bosqich — **raqamlarni formula hisoblaydi, AI faqat matn yozadi**:
1. Ochiq javoblarni baholash (`src/lib/ai/review.ts → gradeOpenAnswers`): **ikki mustaqil baholovchi** (A: bandma-band,
   B: mazmun → rubrika); farq > 0.25 yoki ishonch < 0.6 bo'lsa «ko'rib chiqish kerak». 15 belgidan qisqa javob API'siz 0 ball.
   Dastlabki AI bali (`Response.aiScore`) HR o'zgartirsa ham saqlanadi.
2. Yakuniy raqamlar — `computeAttempt` (formula; AI ballari saqlanadi).
3. Chuqur tahlil (`generateAnalysis`): profil, SWOT, javob naqshlari, kompetensiya tahlili, reja, `dataGaps`.

Yoqish: `ANTHROPIC_API_KEY` (Vercel → Production env + lokal `.env`). Natija sahifasida «AI tahlil» tabi.
Testlar: `npm test` (stub klient), `npm run test:integration` (bazaga ulangan, vaqtinchalik yozuv).

**Kalibrlash** (`/hr/kalibrlash`): HR javobni AI ballini ko'rmasdan baholaydi; tizim kelishuvni o'lchaydi
(±1 pog'ona ≥ 85%, o'rtacha farq ≤ 0.15, siljish ≤ 0.1, kamida 20 namuna). HR o'zgartirishlari ham hisobga olinadi.

Model: `claude-opus-5-5` (env: `ANTHROPIC_ANALYSIS_MODEL`, `ANTHROPIC_GRADER_MODEL`); chuqurlik: `ANTHROPIC_ANALYSIS_EFFORT`,
`ANTHROPIC_GRADER_EFFORT` (standart `high`). Haqiqiy chaqiruv sinovi: `npx tsx --env-file=.env --conditions=react-server scripts/test-ai-live.ts`
(pul sarflaydi; ≈ 0.25 USD, tahlil ~90 s — shu sabab natija sahifasida `maxDuration = 300`).

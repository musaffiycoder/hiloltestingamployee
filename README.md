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

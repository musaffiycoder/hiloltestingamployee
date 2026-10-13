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
Ilova: Vercel. Ma'lumotlar bazasi: Neon (Postgres). Vercel'da `DATABASE_URL` (Neon pooled), `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` o'rnatiladi; migratsiya: `npx prisma migrate deploy`.

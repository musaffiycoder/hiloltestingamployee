import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Funksiya instansiyasi qachon yaratilgani: "sovuq start" belgisi uchun
const bootedAt = Date.now();

/** Sog'liq va kechikish o'lchovi. Maxfiy ma'lumot qaytarmaydi. */
export async function GET() {
  const t0 = performance.now();
  await db.$queryRaw`select 1`;
  const first = performance.now() - t0;
  const t1 = performance.now();
  await db.$queryRaw`select 1`;
  const second = performance.now() - t1;
  const t2 = performance.now();
  await db.position.count();
  const count = performance.now() - t2;
  return NextResponse.json(
    {
      ok: true,
      instanceAgeSec: Math.round((Date.now() - bootedAt) / 1000),
      dbFirstQueryMs: Math.round(first),
      dbSecondQueryMs: Math.round(second),
      dbCountMs: Math.round(count),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

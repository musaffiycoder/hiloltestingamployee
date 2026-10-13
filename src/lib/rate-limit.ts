import "server-only";
import { headers } from "next/headers";
import { db } from "./db";

/**
 * Qat'iy oynali hisoblagich (bazada): `limit` ta urinishdan keyin `windowSec` davomida bloklaydi.
 * Qaytaradi: true — ruxsat, false — limit oshgan.
 */
export async function allow(key: string, limit: number, windowSec: number): Promise<boolean> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSec * 1000);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;
  return (rows[0]?.count ?? 1) <= limit;
}

/** Muvaffaqiyatli kirishdan keyin hisoblagichni tozalash. */
export async function reset(key: string) {
  await db.rateLimit.deleteMany({ where: { key } });
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

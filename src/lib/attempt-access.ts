import "server-only";
import { db } from "./db";

/** Token bo'yicha taklifni va uning faol (tugallanmagan) urinishini qaytaradi. */
export async function getAssessmentByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) return null;
  return db.assessment.findUnique({
    where: { token },
    include: { position: true, attempts: { orderBy: { startedAt: "desc" }, take: 1 } },
  });
}

export function isExpired(a: { dueAt: Date | null; status: string }) {
  return a.status === "EXPIRED" || (a.dueAt !== null && a.dueAt.getTime() < Date.now() && a.status !== "SUBMITTED");
}

import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { initials, shortDate } from "@/lib/format";
import type { VerdictKey } from "@/lib/scoring";
import { Explorer } from "./explorer";
import type { Row } from "./results-view";

export const metadata: Metadata = { title: "Natijalar" };

const FILTER_KEYS = ["all", "mos", "shartli", "dev", "no", "review", "critical"] as const;

export default async function ResultsPage({ searchParams }: PageProps<"/hr/natijalar">) {
  await requireUser();
  const sp = await searchParams;
  const f = typeof sp.f === "string" && (FILTER_KEYS as readonly string[]).includes(sp.f) ? (sp.f as (typeof FILTER_KEYS)[number]) : "all";

  // Bitta so'rov: hamma natija (nomzod ham, xodim ham). Filtr/qidiruv brauzerda.
  const results = await db.attemptResult.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      attemptId: true,
      overallPct: true,
      verdict: true,
      redFlags: true,
      needsReview: true,
      criticalFail: true,
      decision: true,
      createdAt: true,
      attempt: { select: { assessment: { select: { subjectName: true, mode: true, position: { select: { title: true } } } } } },
    },
  });

  const rows: Row[] = results.map((r) => {
    const a = r.attempt.assessment;
    return {
      attemptId: r.attemptId,
      name: a.subjectName,
      initials: initials(a.subjectName),
      position: a.position.title,
      pct: r.overallPct,
      verdict: r.verdict as VerdictKey,
      flags: Array.isArray(r.redFlags) ? r.redFlags.length : 0,
      needsReview: r.needsReview,
      decision: r.decision,
      date: shortDate(r.createdAt),
      mode: a.mode,
      criticalFail: r.criticalFail,
    };
  });

  return <Explorer rows={rows} initialFilter={f} />;
}

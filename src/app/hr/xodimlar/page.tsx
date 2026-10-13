import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, Pill, VerdictChip } from "@/components/ui";
import { initials, shortDate } from "@/lib/format";
import type { VerdictKey } from "@/lib/scoring";

export const metadata: Metadata = { title: "Xodimlar baholashi" };

export default async function EmployeesPage() {
  await requireUser();
  const results = await db.attemptResult.findMany({
    where: { attempt: { assessment: { mode: "EVALUATION" } } },
    orderBy: { createdAt: "desc" },
    include: {
      attempt: {
        include: {
          assessment: { include: { position: true } },
          scores: { include: { competency: true } },
        },
      },
    },
  });

  // Ism + lavozim bo'yicha guruhlash; eng yangi natija birinchi
  const groups = new Map<string, typeof results>();
  for (const r of results) {
    const k = `${r.attempt.assessment.subjectName}::${r.attempt.assessment.positionId}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  if (groups.size === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <div className="text-3xl text-tx2" aria-hidden>◍</div>
        <div className="font-bold">Hali xodim baholanmagan</div>
        <p className="max-w-md text-sm text-tx2">
          Taklif yaratishda «Xodimni baholash» rejimini tanlang. Natijalar, dinamika va rivojlanish zonalari shu yerda ko'rinadi.
        </p>
        <Link href="/hr/takliflar" className="inline-flex min-h-11 items-center rounded-full bg-br px-5 text-sm font-bold text-onbr">
          Baholash yaratish
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groups.values()].map((list) => {
        const [latest, prev] = list;
        const a = latest.attempt;
        const delta = prev ? Math.round(latest.overallPct - prev.overallPct) : null;
        const gaps = a.scores
          .filter((s) => s.level < s.competency.target)
          .sort((x, y) => x.level - x.competency.target - (y.level - y.competency.target))
          .slice(0, 3);
        return (
          <Card key={latest.id} className="p-4">
            <Link href={`/hr/natijalar/${a.id}`} className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-soft text-sm font-bold">{initials(a.assessment.subjectName)}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{a.assessment.subjectName}</div>
                <div className="truncate text-xs text-tx2">
                  {a.assessment.position.title} · oxirgi baholash {shortDate(latest.createdAt)}
                </div>
              </div>
              {delta !== null && <Pill tone={delta >= 0 ? "ok" : "warn"}>{delta >= 0 ? "▲ +" : "▼ "}{delta}%</Pill>}
              <VerdictChip verdict={latest.verdict as VerdictKey} />
              <b className="font-display text-2xl">{Math.round(latest.overallPct)}%</b>
            </Link>
            {gaps.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <span className="text-xs font-bold uppercase tracking-wide text-tx2">Rivojlanish zonasi:</span>
                {gaps.map((g) => (
                  <Pill key={g.id} tone="warn">
                    {g.competency.code} {g.competency.name} · {g.level} / {g.competency.target}
                  </Pill>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

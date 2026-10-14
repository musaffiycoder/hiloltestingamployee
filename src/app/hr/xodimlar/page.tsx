import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, Pill, Ico } from "@/components/ui";
import { initials, shortDate } from "@/lib/format";
import { TrendingDown, TrendingUp, UsersRound } from "lucide-react";

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
        <UsersRound size={34} strokeWidth={1.8} className="text-tx2" aria-hidden />
        <div className="text-[17px] font-semibold">Hali xodim baholanmagan</div>
        <p className="max-w-md text-[15px] text-tx2">
          Taklif yaratishda «Xodimni baholash» rejimini tanlang. Natijalar, dinamika va rivojlanish zonalari shu yerda ko'rinadi.
        </p>
        <Link href="/hr/takliflar" className="inline-flex h-11 items-center rounded-full bg-brf px-6 text-[17px] font-semibold text-onbr">
          Baholash yaratish
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="px-1 text-[34px] font-bold leading-tight">Xodimlar</h2>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[...groups.values()].map((list) => {
          const [latest, prev] = list;
          const a = latest.attempt;
          const delta = prev ? Math.round(latest.overallPct - prev.overallPct) : null;
          const gaps = a.scores
            .filter((s) => s.level < s.competency.target)
            .sort((x, y) => x.level - x.competency.target - (y.level - y.competency.target))
            .slice(0, 3);
          return (
            <Link key={latest.id} href={`/hr/natijalar/${a.id}`} className="flex flex-col rounded-2xl bg-card p-4 transition-colors hover:bg-soft/60">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-soft text-[13px] font-semibold">
                  {initials(a.assessment.subjectName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-semibold">{a.assessment.subjectName}</span>
                  <span className="block truncate text-[13px] text-tx2">
                    {a.assessment.position.title} · {shortDate(latest.createdAt)}
                  </span>
                </span>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft" aria-hidden>
                  <span className="block h-full rounded-full bg-br" style={{ width: `${latest.overallPct}%` }} />
                </span>
                <span className="text-right">
                  <b className="block text-[28px] font-bold leading-none tabular-nums">{Math.round(latest.overallPct)}%</b>
                  {delta !== null && (
                    <span className={`text-[12px] font-semibold ${delta >= 0 ? "text-ok" : "text-warn"}`}>
                      <Ico icon={delta >= 0 ? TrendingUp : TrendingDown} size={13} className="mr-0.5" />
                      {delta >= 0 ? "+" : ""}
                      {delta}% oldingidan
                    </span>
                  )}
                </span>
              </div>
              {gaps.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {gaps.map((g) => (
                    <Pill key={g.id} tone="warn">
                      {g.competency.code} · {g.level}/{g.competency.target}
                    </Pill>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

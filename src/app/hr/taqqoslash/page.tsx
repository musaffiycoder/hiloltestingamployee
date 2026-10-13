import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, LevelChip, VerdictChip } from "@/components/ui";
import { Radar } from "@/components/svg-charts";
import { initials } from "@/lib/format";
import type { VerdictKey } from "@/lib/scoring";

export const metadata: Metadata = { title: "Taqqoslash" };

const COLORS = ["var(--br)", "var(--navy)", "#D6A45B"];

export default async function ComparePage({ searchParams }: PageProps<"/hr/taqqoslash">) {
  await requireUser();
  const sp = await searchParams;
  const ids = (typeof sp.ids === "string" ? sp.ids : "").split(",").filter(Boolean).slice(0, 3);
  if (ids.length < 2) notFound();

  const attempts = await db.attempt.findMany({
    where: { id: { in: ids } },
    include: {
      assessment: { include: { position: { include: { competencies: { orderBy: { sortOrder: "asc" } } } } } },
      result: true,
      scores: true,
    },
  });
  const ordered = ids.map((id) => attempts.find((a) => a.id === id)).filter((a) => a && a.result) as typeof attempts;
  if (ordered.length < 2) notFound();

  const positionIds = new Set(ordered.map((a) => a.assessment.positionId));
  if (positionIds.size > 1) {
    return (
      <Card className="p-8 text-center">
        <p className="font-bold">Faqat bir xil lavozim nomzodlarini taqqoslash mumkin.</p>
        <Link href="/hr/natijalar" className="mt-3 inline-block text-sm font-bold text-brd">← Nomzodlarga qaytish</Link>
      </Card>
    );
  }

  const position = ordered[0].assessment.position;
  const comps = position.competencies.filter((c) => ordered.some((a) => a.scores.some((s) => s.competencyId === c.id)));
  const level = (a: (typeof ordered)[number], cid: string) => a.scores.find((s) => s.competencyId === cid)?.level ?? null;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/hr/natijalar" className="text-sm font-semibold text-tx2 hover:text-brd">← Nomzodlar</Link>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Card className="p-4">
          <h2 className="mb-2 text-[15px] font-bold">Taqqoslash · {position.title}</h2>
          <Radar
            axes={comps.map((c) => ({ code: c.code, name: c.name, critical: c.critical }))}
            series={[
              { name: "Talab", values: comps.map((c) => c.target), color: "var(--tx2)", dashed: true },
              ...ordered.map((a, i) => ({
                name: a.assessment.subjectName,
                values: comps.map((c) => level(a, c.id) ?? 0),
                color: COLORS[i],
                fill: i === 0,
              })),
            ]}
          />
          <div className="flex flex-wrap justify-center gap-3 text-xs font-semibold text-tx2">
            {ordered.map((a, i) => (
              <span key={a.id}><b style={{ color: COLORS[i] }}>━</b> {a.assessment.subjectName}</span>
            ))}
            <span><b>╌</b> Talab</span>
          </div>
        </Card>

        <div className={`grid gap-3 ${ordered.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {ordered.map((a, i) => (
            <Card key={a.id} className="p-4">
              <Link href={`/hr/natijalar/${a.id}`} className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold" style={{ background: COLORS[i], color: "#1a0c02" }}>
                  {initials(a.assessment.subjectName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{a.assessment.subjectName}</div>
                  <b className="font-display text-xl">{Math.round(a.result!.overallPct)}%</b>
                </div>
              </Link>
              <div className="mt-2"><VerdictChip verdict={a.result!.verdict as VerdictKey} /></div>
              <div className="mt-3 flex flex-col gap-1.5">
                {comps.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-tx2" title={c.name}>{c.code}</span>
                    <span className="flex-1 border-b border-dotted border-line" />
                    <LevelChip level={level(a, c.id)} />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

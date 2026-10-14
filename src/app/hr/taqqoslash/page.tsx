import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, LevelChip, SectionTitle } from "@/components/ui";
import { Radar } from "@/components/svg-charts";
import { initials } from "@/lib/format";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
        <p className="text-[17px] font-semibold">Faqat bir xil lavozim nomzodlarini taqqoslash mumkin.</p>
        <Link href="/hr/natijalar" className="mt-3 inline-flex items-center text-[17px] text-brd">
          <ChevronLeft size={20} aria-hidden className="-ml-1" />
          Nomzodlarga qaytish
        </Link>
      </Card>
    );
  }

  const position = ordered[0].assessment.position;
  const comps = position.competencies.filter((c) => ordered.some((a) => a.scores.some((s) => s.competencyId === c.id)));
  const level = (a: (typeof ordered)[number], cid: string) => a.scores.find((s) => s.competencyId === cid)?.level ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/hr/natijalar" className="inline-flex items-center gap-1 text-[17px] text-brd">
        <ChevronLeft size={22} aria-hidden className="-ml-1.5" /> Nomzodlar
      </Link>

      <header className="px-1">
        <h2 className="text-[34px] font-bold leading-tight">Taqqoslash</h2>
        <p className="mt-1 text-[15px] text-tx2">{position.title}</p>
      </header>

      <section>
        <SectionTitle>Kompetensiyalar</SectionTitle>
        <Card className="p-4">
          <div className="mx-auto max-w-md">
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
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-[13px] text-tx2">
            {ordered.map((a, i) => (
              <span key={a.id}>
                <b style={{ color: COLORS[i] }}>━</b> {a.assessment.subjectName}
              </span>
            ))}
            <span><b>╌</b> Talab</span>
          </div>
        </Card>
      </section>

      <div className={`grid grid-cols-[minmax(0,1fr)] gap-6 ${ordered.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        {ordered.map((a, i) => (
          <section key={a.id}>
            <SectionTitle>{a.assessment.subjectName}</SectionTitle>
            <Card>
              <Link href={`/hr/natijalar/${a.id}`} className="flex items-center gap-3 border-b border-line px-4 py-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
                  style={{ background: COLORS[i], color: i === 1 ? "var(--bg)" : "#1a0c02" }}
                >
                  {initials(a.assessment.subjectName)}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[22px] leading-tight tabular-nums">{Math.round(a.result!.overallPct)}%</b>
                </span>
                <ChevronRight size={18} aria-hidden className="shrink-0 text-tx2" />
              </Link>
              <ul>
                {comps.map((c, k) => (
                  <li
                    key={c.id}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 ${k < comps.length - 1 ? "border-b border-line" : ""}`}
                  >
                    <span className="min-w-0 truncate text-[15px]" title={c.name}>
                      <span className="mr-2 font-mono text-xs text-tx2">{c.code}</span>
                      {c.name}
                    </span>
                    <LevelChip level={level(a, c.id)} />
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}

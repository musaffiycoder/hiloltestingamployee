import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { initials, shortDate } from "@/lib/format";
import type { VerdictKey } from "@/lib/scoring";
import type { Prisma } from "@prisma/client";
import { ResultsView, type Row } from "./results-view";

export const metadata: Metadata = { title: "Nomzodlar" };

const FILTERS: { key: string; label: string; where: Prisma.AttemptResultWhereInput }[] = [
  { key: "all", label: "Barchasi", where: {} },
  { key: "mos", label: "Mos", where: { verdict: "MOS" } },
  { key: "shartli", label: "Shartli mos", where: { verdict: "SHARTLI_MOS" } },
  { key: "dev", label: "Rivojlantirish kerak", where: { verdict: "RIVOJLANTIRISH" } },
  { key: "no", label: "Mos emas", where: { verdict: "MOS_EMAS" } },
  { key: "review", label: "Ko'rib chiqish kerak", where: { needsReview: true } },
  { key: "critical", label: "Kritik past", where: { criticalFail: true } },
];

export default async function ResultsPage({ searchParams }: PageProps<"/hr/natijalar">) {
  await requireUser();
  const sp = await searchParams;
  const f = typeof sp.f === "string" ? sp.f : "all";
  const view = sp.v === "cards" ? "cards" : "table";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0];

  const [results, counts] = await Promise.all([
    db.attemptResult.findMany({
      where: {
        AND: [
          filter.where,
          { attempt: { assessment: { mode: "RECRUITING", ...(q ? { subjectName: { contains: q, mode: "insensitive" as const } } : {}) } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { attempt: { include: { assessment: { include: { position: true } } } } },
    }),
    Promise.all(
      FILTERS.map((x) =>
        db.attemptResult.count({ where: { AND: [x.where, { attempt: { assessment: { mode: "RECRUITING" } } }] } }),
      ),
    ),
  ]);

  const rows: Row[] = results.map((r) => ({
    attemptId: r.attemptId,
    name: r.attempt.assessment.subjectName,
    initials: initials(r.attempt.assessment.subjectName),
    position: r.attempt.assessment.position.title,
    pct: r.overallPct,
    verdict: r.verdict as VerdictKey,
    flags: Array.isArray(r.redFlags) ? r.redFlags.length : 0,
    needsReview: r.needsReview,
    decision: r.decision,
    date: shortDate(r.createdAt),
  }));

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { f, v: view, q, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && v !== "all" && !(k === "v" && v === "table")) p.set(k, v);
    const s = p.toString();
    return `/hr/natijalar${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((x, i) => (
          <Link
            key={x.key}
            href={href({ f: x.key })}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold ${
              f === x.key ? "bg-br text-[#1a0c02]" : "bg-card text-tx hover:bg-soft border border-line"
            }`}
          >
            {x.label}
            <span className={f === x.key ? "opacity-70" : "text-tx2"}>{counts[i]}</span>
          </Link>
        ))}
        <div className="ml-auto flex gap-1 rounded-full bg-soft p-1" role="group" aria-label="Ko'rinish">
          {(
            [
              ["table", "Jadval"],
              ["cards", "Kartochka"],
            ] as const
          ).map(([k, l]) => (
            <Link
              key={k}
              href={href({ v: k })}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${view === k ? "bg-card shadow-soft" : "text-tx2"}`}
              aria-current={view === k ? "true" : undefined}
            >
              {l}
            </Link>
          ))}
        </div>
      </div>

      <form action="/hr/natijalar" className="flex gap-2">
        {f !== "all" && <input type="hidden" name="f" value={f} />}
        {view !== "table" && <input type="hidden" name="v" value={view} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="⌕ Ism bo'yicha qidirish…"
          className="h-11 w-full max-w-sm rounded-full border border-line bg-card px-4 text-sm outline-none focus:border-br focus:ring-2 focus:ring-br/30"
        />
      </form>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="text-3xl text-tx2" aria-hidden>◔</div>
          <div className="font-bold">{q || f !== "all" ? "Mos natija topilmadi" : "Hali nomzod yo'q"}</div>
          <p className="text-sm text-tx2">
            {q || f !== "all" ? "Filtrni o'zgartirib ko'ring." : "Birinchi taklifni yuboring — natijalar shu yerda paydo bo'ladi."}
          </p>
          <Link href="/hr/takliflar" className="inline-flex min-h-11 items-center rounded-full bg-br px-5 text-sm font-bold text-[#1a0c02]">
            Taklif yuborish
          </Link>
        </Card>
      ) : (
        <ResultsView rows={rows} view={view} />
      )}
    </div>
  );
}

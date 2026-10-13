import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
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
    <div className="flex flex-col gap-4">
      {/* iOS qidiruv maydoni */}
      <form action="/hr/natijalar" className="relative">
        {f !== "all" && <input type="hidden" name="f" value={f} />}
        {view !== "table" && <input type="hidden" name="v" value={view} />}
        <Search size={17} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tx2" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Qidirish"
          aria-label="Ism bo'yicha qidirish"
          className="h-10 w-full rounded-[10px] bg-soft pl-9 pr-3 text-[17px] outline-none placeholder:text-tx2"
        />
      </form>

      {/* Filtrlar: gorizontal aylanadigan chiplar */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0 [scrollbar-width:none]">
        {FILTERS.map((x, i) => (
          <Link
            key={x.key}
            href={href({ f: x.key })}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium ${
              f === x.key ? "bg-brf text-onbr" : "bg-card text-tx"
            }`}
            aria-current={f === x.key ? "true" : undefined}
          >
            {x.label}
            <span className={f === x.key ? "opacity-70" : "text-tx2"}>{counts[i]}</span>
          </Link>
        ))}
      </div>

      {/* Ko'rinish: iOS segmented control */}
      <div className="grid w-full max-w-[220px] grid-cols-2 self-end rounded-[10px] bg-soft p-0.5" role="group" aria-label="Ko'rinish">
        {(
          [
            ["table", "Ro'yxat"],
            ["cards", "Kartochka"],
          ] as const
        ).map(([k, l]) => (
          <Link
            key={k}
            href={href({ v: k })}
            className={`rounded-lg py-1.5 text-center text-[13px] font-semibold ${
              view === k ? "bg-card shadow-[0_1px_3px_rgba(0,0,0,0.18)]" : ""
            }`}
            aria-current={view === k ? "true" : undefined}
          >
            {l}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="text-4xl text-tx2" aria-hidden>◔</div>
          <div className="text-[17px] font-semibold">{q || f !== "all" ? "Mos natija topilmadi" : "Hali nomzod yo'q"}</div>
          <p className="text-[15px] text-tx2">
            {q || f !== "all" ? "Filtrni o'zgartirib ko'ring." : "Birinchi taklifni yuboring — natijalar shu yerda paydo bo'ladi."}
          </p>
          <Link href="/hr/takliflar" className="inline-flex h-11 items-center rounded-full bg-brf px-6 text-[17px] font-semibold text-onbr">
            Taklif yuborish
          </Link>
        </Card>
      ) : (
        <ResultsView rows={rows} view={view} />
      )}
    </div>
  );
}

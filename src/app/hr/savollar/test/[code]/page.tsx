import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronLeft, Clock3, Flag, ListChecks, Pencil, Scale, ShieldAlert, X } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getPositionPlan } from "@/lib/test-config";
import { Card, Ico, LevelChip, Pill, SectionTitle } from "@/components/ui";
import { RichText } from "@/components/rich-text";
import { QUESTION_TYPE_LABELS } from "@/lib/labels";
import { fmtDuration } from "../../tests-overview";
import { TestSettings } from "./settings";

export const metadata: Metadata = { title: "Test" };

type Opt = string | { text: string; points?: number; flag?: boolean };

export default async function TestPage({ params }: { params: Promise<{ code: string }> }) {
  const viewer = await requireUser();
  const canWrite = viewer.role !== "MANAGER";
  const { code } = await params;
  const position = await db.position.findUnique({
    where: { code },
    include: {
      competencies: {
        orderBy: { sortOrder: "asc" },
        include: { questions: { where: { status: "ACTIVE" }, orderBy: [{ level: "asc" }, { createdAt: "asc" }] } },
      },
    },
  });
  if (!position) notFound();
  const [plan, departments, drafts] = await Promise.all([
    getPositionPlan(position.id),
    db.department.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.question.count({ where: { status: "DRAFT", competency: { positionId: position.id } } }),
  ]);
  const minutes = plan.timeLimitMin ?? plan.estimatedMin;
  const countBy = new Map(plan.competencies.map((c) => [c.id, c]));
  let no = 0;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/hr/savollar" className="inline-flex items-center gap-1 self-start text-[15px] font-semibold text-brd">
        <ChevronLeft size={17} aria-hidden /> Testlar
      </Link>

      <div>
        <h2 className="font-display text-[28px] font-bold leading-tight">{position.title} testi</h2>
        <p className="mt-1 text-[15px] text-tx2">
          Testning to&apos;liq ko&apos;rinishi: har savolda to&apos;g&apos;ri javob yashil, noto&apos;g&apos;ri variantlar qizil bilan belgilangan.
          Javob kalitlari faqat HR ga ko&apos;rinadi.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: ListChecks, l: "Testda", v: `${plan.total} savol`, d: `bankda ${plan.competencies.reduce((s, c) => s + c.available, 0)} faol` },
          { icon: Clock3, l: "Vaqt", v: fmtDuration(minutes), d: plan.timeLimitMin ? "qo'lda belgilangan" : "savollar bo'yicha" },
          { icon: Scale, l: "Kompetensiya", v: `${plan.competencies.length}`, d: drafts ? `${drafts} ta qoralama` : "qoralama yo'q" },
        ].map((k) => (
          <Card key={k.l} className="p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-tx2">
              <Ico icon={k.icon} size={13} className="mr-1" />
              {k.l}
            </div>
            <div className="mt-1.5 font-display text-[22px] font-bold leading-none text-navy md:text-[26px]">{k.v}</div>
            <div className="mt-1 text-[12px] text-tx2">{k.d}</div>
          </Card>
        ))}
      </div>

      <TestSettings
        positionId={position.id}
        departmentId={position.departmentId}
        departments={departments}
        timeLimitMin={plan.timeLimitMin}
        estimatedMin={plan.estimatedMin}
        readOnly={!canWrite}
      />
      {canWrite && (
        <p className="-mt-3 px-1 text-[13px] text-tx2">
          Har kompetensiyadan nechta savol tushishini{" "}
          <Link href={`/hr/konstruktor/${position.code}`} className="font-semibold text-brd">
            Test konstruktorida
          </Link>{" "}
          sozlaysiz.
        </p>
      )}

      {position.competencies.map((c) => {
        const pc = countBy.get(c.id);
        if (!c.questions.length) return null;
        return (
          <section key={c.id}>
            <SectionTitle
              aside={
                <span className="text-[13px] text-tx2">
                  testda {pc?.count ?? 0} / bankda {c.questions.length}
                </span>
              }
            >
              {c.code} · {c.name}
              {c.critical && <Ico icon={ShieldAlert} size={13} className="ml-1.5 text-bad" />}
            </SectionTitle>
            <div className="flex flex-col gap-3">
              {c.questions.map((x) => {
                no++;
                const opts = ((x.payload as { options?: Opt[] } | null)?.options ?? []) as Opt[];
                const key = (x.answerKey as { correct?: number | number[] } | null)?.correct;
                const correct = new Set(Array.isArray(key) ? key : typeof key === "number" ? [key] : []);
                const maxPts = Math.max(0, ...opts.map((o) => (typeof o === "object" ? (o.points ?? 0) : 0)));
                const rubric = (x.rubric as { points?: string[] } | null)?.points ?? [];
                return (
                  <Card key={x.id} className="p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-[13px] font-bold text-tx2">#{no}</span>
                      <LevelChip level={x.level} />
                      <Pill tone="soft">{QUESTION_TYPE_LABELS[x.type]}</Pill>
                      <Pill tone="soft">{x.timeLimitSec}s</Pill>
                      {canWrite && (
                        <Link href={`/hr/savollar/${x.id}`} className="ml-auto inline-flex h-8 items-center gap-1 rounded-full bg-tint px-3 text-[13px] font-semibold text-brd">
                          <Pencil size={13} aria-hidden /> Tahrirlash
                        </Link>
                      )}
                    </div>
                    <RichText text={x.stem} className="text-[15px] leading-relaxed" />

                    {opts.length > 0 && (
                      <ul className="mt-3 overflow-hidden rounded-xl border border-line">
                        {opts.map((o, k) => {
                          const pts = typeof o === "object" ? o.points : undefined;
                          const flag = typeof o === "object" && o.flag;
                          const ok = pts !== undefined ? pts === maxPts : correct.has(k);
                          const partial = pts !== undefined && !ok && pts >= 3;
                          return (
                            <li
                              key={k}
                              className={`flex items-start gap-3 px-3 py-2.5 text-[15px] ${k < opts.length - 1 ? "border-b border-line" : ""} ${ok ? "bg-ok-t" : ""}`}
                            >
                              <span className={`mt-0.5 shrink-0 ${ok ? "text-ok" : partial ? "text-warn" : "text-bad"}`} aria-label={ok ? "to'g'ri" : "noto'g'ri"}>
                                {ok ? <Check size={16} strokeWidth={2.6} /> : <X size={16} strokeWidth={2.6} />}
                              </span>
                              <span className="flex-1">
                                <span className="mr-1.5 font-semibold text-tx2">{String.fromCharCode(65 + k)}.</span>
                                {typeof o === "string" ? o : o.text}
                              </span>
                              {pts !== undefined && <span className="shrink-0 text-[13px] font-semibold tabular-nums text-tx2">{pts} ball</span>}
                              {flag && (
                                <span className="shrink-0 text-bad" title="Qizil bayroq">
                                  <Flag size={14} strokeWidth={2.4} className="fill-current" aria-hidden />
                                  <span className="sr-only">qizil bayroq</span>
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {x.type === "OPEN" && rubric.length > 0 && (
                      <div className="mt-3 rounded-xl bg-soft p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-tx2">Baholash rubrikasi</div>
                        <ul className="mt-1 list-disc pl-5 text-[15px]">
                          {rubric.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {x.explanation && (
                      <p className="mt-3 text-[13px] leading-relaxed text-tx2">
                        <b className="font-semibold">Izoh:</b> {x.explanation}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

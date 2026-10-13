import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { computeAttempt } from "@/lib/attempt";
import { Card, LevelChip, Pill, SectionTitle, VerdictChip } from "@/components/ui";
import { Radar, ScoreRing } from "@/components/svg-charts";
import { QUESTION_TYPE_LABELS, VERDICTS } from "@/lib/labels";
import { shortDate, timeAgo } from "@/lib/format";
import type { VerdictKey } from "@/lib/scoring";
import { addComment, setDecision } from "./actions";
import { OverrideButton } from "./override";
import { AiPanel } from "./ai-panel";
import { AnalysisView } from "./analysis-view";
import { ContextForm } from "./context-form";
import { AutoRefresh } from "./auto-refresh";
import { aiConfigured } from "@/lib/ai/client";
import type { StoredAnalysis } from "@/lib/ai/schemas";

export const metadata: Metadata = { title: "Nomzod natijasi" };
// AI tahlil server action'i shu marshrutda ishlaydi (Fluid Compute: 300 s gacha)
export const maxDuration = 300;

type Opt = string | { text: string; points?: number };
const optText = (o: Opt) => (typeof o === "string" ? o : o.text);

const TABS = [
  { key: "sum", label: "Xulosa" },
  { key: "ans", label: "Javoblar" },
  { key: "beh", label: "Xatti-harakat" },
  { key: "ai", label: "AI tahlil" },
] as const;

export default async function ResultPage({ params, searchParams }: PageProps<"/hr/natijalar/[id]">) {
  const viewer = await requireUser();
  const canWrite = viewer.role !== "MANAGER";
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as (typeof TABS)[number]["key"]) : "sum";

  const pending = await db.attempt.findUnique({
    where: { id },
    select: { finishedAt: true, result: { select: { id: true } } },
  });
  if (pending?.finishedAt && !pending.result) await computeAttempt(id);

  const attempt = await db.attempt.findUnique({
    where: { id },
    include: {
      assessment: { include: { position: { include: { competencies: { orderBy: { sortOrder: "asc" } } } } } },
      result: true,
      scores: true,
      signals: { orderBy: { at: "asc" } },
      comments: { orderBy: { at: "desc" }, include: { author: { select: { name: true } } } },
      responses: { include: { question: { include: { competency: true } } } },
    },
  });
  if (!attempt || !attempt.result) notFound();

  const { assessment, result } = attempt;
  const verdict = result.verdict as VerdictKey;
  const scoreByComp = new Map(attempt.scores.map((s) => [s.competencyId, s.level]));
  const askedComp = new Set(attempt.responses.map((r) => r.question.competencyId));
  const comps = assessment.position.competencies.filter((c) => askedComp.has(c.id));

  const wSum = comps.reduce((s, c) => s + c.weight, 0) || 1;
  const requiredPct = Math.round((comps.reduce((s, c) => s + c.target * c.weight, 0) / (5 * wSum)) * 100);
  const durationMin = attempt.finishedAt
    ? Math.max(1, Math.round((attempt.finishedAt.getTime() - attempt.startedAt.getTime()) / 60000))
    : null;
  const flags = (Array.isArray(result.redFlags) ? result.redFlags : []) as { t: string; q: string; question?: string }[];

  const rows = comps.map((c) => ({ c, level: scoreByComp.get(c.id) ?? null }));
  const gaps = rows.filter((r) => r.level !== null && r.level < r.c.target).sort((a, b) => a.level! - a.c.target - (b.level! - b.c.target));
  const strong = rows.filter((r) => r.level !== null && r.level >= r.c.target);

  const answerText = (r: (typeof attempt.responses)[number]) => {
    const p = r.payload as { selected?: number | number[] | null; text?: string };
    const opts = ((r.question.payload as { options?: Opt[] })?.options ?? []) as Opt[];
    if (r.question.type === "OPEN") return p.text?.trim() || "(javob yo'q)";
    if (Array.isArray(p.selected)) return p.selected.map((i) => opts[i] && optText(opts[i])).filter(Boolean).join(" · ") || "(tanlanmagan)";
    if (typeof p.selected === "number" && opts[p.selected]) return optText(opts[p.selected]);
    return "(javob yo'q)";
  };
  const correctText = (r: (typeof attempt.responses)[number]) => {
    const key = (r.question.answerKey as { correct?: number | number[] } | null)?.correct;
    const opts = ((r.question.payload as { options?: Opt[] })?.options ?? []) as Opt[];
    if (r.question.type === "SITUATIONAL") {
      const best = opts.map((o, i) => ({ o, i })).sort((a, b) => ((b.o as { points?: number }).points ?? 0) - ((a.o as { points?: number }).points ?? 0))[0];
      return best ? optText(best.o) : "—";
    }
    if (r.question.type === "OPEN") {
      const pts = (r.question.rubric as { points?: string[] } | null)?.points;
      return pts?.length ? pts.map((p) => `• ${p}`).join("\n") : "Rubrika belgilanmagan";
    }
    if (Array.isArray(key)) return key.map((i) => optText(opts[i])).join(" · ");
    if (typeof key === "number") return optText(opts[key]);
    return "—";
  };

  const ordered = attempt.responses
    .slice()
    .sort((a, b) => a.question.competency.sortOrder - b.question.competency.sortOrder || a.question.level - b.question.level);
  const maxTime = Math.max(1, ...ordered.map((r) => r.timeMs));
  const avgTime = ordered.length ? ordered.reduce((s, r) => s + r.timeMs, 0) / ordered.length : 0;
  const signalGroups = Object.entries(
    attempt.signals.reduce<Record<string, number>>((m, s) => ((m[s.type] = (m[s.type] ?? 0) + 1), m), {}),
  );
  const SIGNAL_LABEL: Record<string, string> = { focus_lost: "Oyna fokusi yo'qoldi", paste: "Matn qo'yildi (paste)" };

  const interviewQs = (gaps.length ? gaps : rows.filter((r) => r.c.critical)).slice(0, 5).map(
    (r) => `${r.c.name}: oxirgi real vaziyatni aytib bering — nima qildingiz va natija qanday bo'ldi?`,
  );
  const plan = gaps.slice(0, 3).map(
    (r) => `${r.c.name} — ${r.c.target - (r.level ?? 0) > 1 ? "4" : "2"} haftalik maqsadli mashq va mentor`,
  );

  const analysis = (result.analysis ?? null) as StoredAnalysis | null;
  const ungradedOpen = ordered.filter(
    (r) => r.question.type === "OPEN" && r.scoreSource !== "human" && r.scoreSource !== "ai" && !r.reviewed,
  ).length;

  const now = new Date();
  // Yakunlangandan keyin AI fonda ishlaydi (after): 10 daqiqagacha «tayyorlanmoqda» ko'rsatiladi
  const preparing =
    !analysis && aiConfigured() && !!attempt.finishedAt && now.getTime() - attempt.finishedAt.getTime() < 10 * 60 * 1000;

  const tabHref = (k: string) => `/hr/natijalar/${id}${k === "sum" ? "" : `?tab=${k}`}`;

  // Javoblar bo'limlar (kompetensiya) bo'yicha guruhlanadi — iOS "grouped" ro'yxat
  const answerGroups = comps
    .map((c) => ({ c, items: ordered.filter((r) => r.question.competencyId === c.id) }))
    .filter((g) => g.items.length > 0);
  const critLow = rows.filter((r) => r.c.critical && r.level !== null && r.level <= 2);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/hr/natijalar" className="inline-flex items-center gap-1 text-[17px] text-brd print:hidden">
        <span aria-hidden className="text-2xl leading-none">‹</span> Nomzodlar
      </Link>

      {/* Profil sarlavhasi (iOS) */}
      <section className="flex flex-col items-center gap-3 text-center">
        <ScoreRing pct={result.overallPct} threshold={requiredPct} size={132} />
        <div>
          <h2 className="text-[28px] font-bold leading-tight">{assessment.subjectName}</h2>
          <p className="mt-0.5 text-[15px] text-tx2">
            {assessment.position.title} · {shortDate(attempt.finishedAt ?? attempt.startedAt)}
            {durationMin ? ` · ${durationMin} daqiqa` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <VerdictChip verdict={verdict} />
          <span className="text-[13px] font-medium text-tx2">Talab: {requiredPct}%</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {result.needsReview && <Pill tone="warn">◔ Qo'lda ko'rib chiqish kerak — natija vaqtinchalik</Pill>}
          {result.decision === "ADVANCE" && <Pill tone="ok">Keyingi bosqichga</Pill>}
          {result.decision === "REJECT" && <Pill tone="bad">Rad etildi</Pill>}
        </div>

        {canWrite ? (
        <div className="flex w-full max-w-md flex-col gap-2 print:hidden">
          <form action={setDecision.bind(null, attempt.id, "ADVANCE")}>
            <button className="h-[50px] w-full rounded-full bg-brf text-[17px] font-semibold text-onbr">
              Intervyuga taklif qilish
            </button>
          </form>
          <div className="grid grid-cols-2 gap-2">
            <form action={setDecision.bind(null, attempt.id, "REJECT")}>
              <button className="h-11 w-full rounded-full bg-bad-t text-[17px] font-semibold text-bad">Rad etish</button>
            </form>
            <a
              href={`/hr/natijalar/${attempt.id}/pdf`}
              className="flex h-11 w-full items-center justify-center rounded-full bg-tint text-[17px] font-semibold text-brd print:hidden"
            >
              PDF yuklab olish
            </a>
          </div>
          {result.decision && (
            <form action={setDecision.bind(null, attempt.id, null)}>
              <button className="h-10 w-full text-[15px] font-medium text-brd">Qarorni bekor qilish</button>
            </form>
          )}
        </div>
        ) : (
          <p className="text-[13px] text-tx2">Menejer sifatida natijani faqat ko'rishingiz mumkin. Qarorni HR qabul qiladi.</p>
        )}
      </section>

      {result.criticalFail && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl bg-bad-t p-4 text-[15px] text-bad">
          <span aria-hidden className="text-lg leading-none">⛨</span>
          <div>
            <b className="font-semibold">Kritik kompetensiya talabdan past</b>
            {critLow.length > 0 && (
              <> — {critLow.map((r) => `${r.c.code} (${r.c.name}) ${r.level} / ${r.c.target}`).join(", ")}</>
            )}
            . Avtomatik «{VERDICTS.MOS_EMAS.label}». Yakuniy qaror HR da.
          </div>
        </div>
      )}

      {/* iOS segmented control */}
      <nav className="grid grid-cols-4 rounded-[10px] bg-soft p-0.5 print:hidden" aria-label="Bo'limlar" role="tablist">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            role="tab"
            aria-selected={tab === t.key}
            className={`rounded-lg py-1.5 text-center text-[13px] font-semibold ${
              tab === t.key ? "bg-card shadow-[0_1px_3px_rgba(0,0,0,0.18)]" : "text-tx"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          {tab === "sum" && (
            <>
              <section>
                <SectionTitle>Kompetensiyalar</SectionTitle>
                <Card className="p-4">
                  <div className="mx-auto max-w-md">
                    <Radar
                      axes={comps.map((c) => ({ code: c.code, name: c.name, critical: c.critical }))}
                      series={[
                        { name: "Talab", values: comps.map((c) => c.target), color: "var(--navy)", dashed: true },
                        { name: "Natija", values: comps.map((c) => scoreByComp.get(c.id) ?? 0), color: "var(--br)", fill: true },
                      ]}
                    />
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 text-[13px] text-tx2">
                    <span><b className="text-br">━</b> Natija</span>
                    <span><b className="text-navy">╌</b> Talab darajasi</span>
                    <span>⛨ kritik</span>
                  </div>
                </Card>
              </section>

              <section>
                <SectionTitle>Talabdan farq</SectionTitle>
                <Card>
                  <ul>
                    {rows.map(({ c, level }, i) => {
                      const gap = level === null ? null : level - c.target;
                      return (
                        <li key={c.id} className={`flex items-center gap-3 px-4 py-3 ${i < rows.length - 1 ? "border-b border-line" : ""}`}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="shrink-0 font-mono text-xs text-tx2">{c.code}</span>
                              <span className="text-[15px] font-medium leading-snug">{c.name}</span>
                              {c.critical && <span className="text-xs text-bad" title="Kritik">⛨</span>}
                            </div>
                            <div className="relative mt-2 h-1.5 rounded-full bg-soft">
                              <div className="h-full rounded-full bg-br" style={{ width: `${((level ?? 0) / 5) * 100}%` }} />
                              <div
                                className="absolute -top-1 w-0.5 rounded bg-tx"
                                style={{ left: `${(c.target / 5) * 100}%`, height: 14 }}
                                title={`Talab ${c.target}`}
                              />
                            </div>
                          </div>
                          <LevelChip level={level} />
                          <span
                            className={`w-9 text-right text-[15px] font-semibold tabular-nums ${
                              gap === null ? "text-tx2" : gap > 0 ? "text-ok" : gap < 0 ? "text-warn" : "text-tx2"
                            }`}
                          >
                            {gap === null ? "—" : gap > 0 ? `+${gap}` : gap < 0 ? `−${Math.abs(gap)}` : "="}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </section>

              <section>
                <SectionTitle>Qizil bayroqlar</SectionTitle>
                <Card>
                  {flags.length === 0 ? (
                    <p className="flex items-center gap-2 px-4 py-3.5 text-[15px] font-medium text-ok">
                      <span aria-hidden>✓</span> Qizil bayroqlar yo'q
                    </p>
                  ) : (
                    <ul>
                      {flags.map((f, i) => (
                        <li key={i} className={`px-4 py-3 ${i < flags.length - 1 ? "border-b border-line" : ""}`}>
                          <div className="text-[15px] font-semibold text-bad">✕ {f.t}</div>
                          <div className="mt-0.5 text-[15px]">«{f.q}»</div>
                          {f.question && <div className="mt-1 text-[13px] text-tx2">Savol: {f.question}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </section>
            </>
          )}

          {tab === "ans" && (
            <>
              {answerGroups.map(({ c, items }) => (
                <section key={c.id}>
                  <SectionTitle>
                    {c.code} · {c.name}
                  </SectionTitle>
                  <Card>
                    {items.map((r, i) => {
                      const score = r.score;
                      const no = ordered.indexOf(r) + 1;
                      return (
                        <details key={r.id} className={`group ${i < items.length - 1 ? "border-b border-line" : ""}`}>
                          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                            <div className="min-w-0 flex-1">
                              <div className="line-clamp-2 text-[15px] font-medium">{no}. {r.question.stem}</div>
                              <div className="mt-0.5 text-[13px] text-tx2">
                                daraja {r.question.level} · {QUESTION_TYPE_LABELS[r.question.type]}
                              </div>
                            </div>
                            <span
                              className={`shrink-0 text-[15px] font-semibold tabular-nums ${
                                score === null ? "text-warn" : score >= 0.7 ? "text-ok" : score >= 0.4 ? "text-warn" : "text-bad"
                              }`}
                            >
                              {score === null ? "—" : `${Math.round(score * 100)}%`}
                            </span>
                            <span aria-hidden className="text-tx2 transition-transform group-open:rotate-90">›</span>
                          </summary>
                          <div className="flex flex-col gap-3 bg-soft/50 px-4 py-3">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-tx2">Nomzod javobi</div>
                              <div className="mt-1 whitespace-pre-wrap text-[15px]">{answerText(r)}</div>
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-tx2">Rubrika / to'g'ri javob</div>
                              <div className="mt-1 whitespace-pre-wrap text-[15px]">{correctText(r)}</div>
                            </div>
                            {r.question.explanation && <p className="text-[13px] text-tx2">{r.question.explanation}</p>}
                            {r.scoreSource === "ai" && r.rationale && (
                              <div className="rounded-xl bg-card p-3 text-[15px]">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-tx2">
                                  AI asosi · ishonch {Math.round((r.confidence ?? 0) * 100)}%
                                  {(r.confidence ?? 1) < 0.6 && <span className="ml-2 text-warn">ko'rib chiqing</span>}
                                  {r.flagged && <span className="ml-2 text-bad">⚑ baholovchiga ko'rsatma urinishi</span>}
                                </div>
                                <p className="mt-1">{r.rationale}</p>
                              </div>
                            )}
                            <p className="text-[13px] text-tx2">
                              {score === null
                                ? "Baholanmagan"
                                : `${r.scoreSource === "human" ? "Qo'lda" : "Avto"}: ${Math.round(score * 100)}%`}
                              {r.overrideReason ? ` · sabab: ${r.overrideReason}` : ""}
                            </p>
                            {canWrite && (
                              <div className="print:hidden">
                                <OverrideButton responseId={r.id} current={score} />
                              </div>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </Card>
                </section>
              ))}
            </>
          )}

          {tab === "ai" && (
            <>
              <section>
                <SectionTitle>Chuqur tahlil</SectionTitle>
                <div className="print:hidden">
                  <AiPanel
                    attemptId={attempt.id}
                    configured={aiConfigured() && canWrite}
                    ungradedOpen={ungradedOpen}
                    hasAnalysis={!!analysis}
                  />
                </div>
                {!canWrite && (
                  <p className="mt-2 px-1 text-[13px] text-tx2">Menejer sifatida tahlilni faqat ko'rishingiz mumkin.</p>
                )}
              </section>

              {!analysis ? (
                preparing ? (
                  <Card className="flex items-center gap-3 p-5 text-[15px]">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-br border-t-transparent" aria-hidden />
                    <span>
                      AI tahlil tayyorlanmoqda — ochiq javoblar baholanib, chuqur tahlil yozilmoqda (1–4 daqiqa). Sahifa o'zi yangilanadi.
                    </span>
                    <AutoRefresh />
                  </Card>
                ) : (
                  <Card className="p-5 text-[15px] text-tx2">
                    Hali AI tahlili yaratilmagan. Raqamlar (ball, daraja, xulosa toifasi) formuladan olinadi; AI faqat
                    javoblar mazmuniga tayanib matn yozadi.
                  </Card>
                )
              ) : (
                <>
                  <AnalysisView analysis={analysis} isEmployee={assessment.mode === "EVALUATION"} />
                  <p className="px-4 text-[13px] text-tx2">
                    AI matni — dalil va tavsiya, qaror HR da.{result.analysisModel ? ` Model: ${result.analysisModel}.` : ""}
                    {result.analysisAt ? ` ${timeAgo(result.analysisAt, now)}.` : ""}
                  </p>
                </>
              )}

              <section>
                <SectionTitle>HR konteksti (real ish natijalari)</SectionTitle>
                <ContextForm attemptId={attempt.id} initial={result.hrContext ?? ""} canWrite={canWrite} />
              </section>

              <section>
                <a
                  href={`/hr/natijalar/${attempt.id}/pdf`}
                  className="flex h-[50px] items-center justify-center rounded-full bg-navy text-[17px] font-semibold text-cream"
                >
                  PDF hisobotni yuklab olish
                </a>
              </section>
            </>
          )}

          {tab === "beh" && (
            <>
              <section>
                <SectionTitle>Har bir savolga sarflangan vaqt</SectionTitle>
                <Card className="p-4">
                  {ordered.length === 0 ? (
                    <p className="text-[15px] text-tx2">Ma'lumot yo'q.</p>
                  ) : (
                    <>
                      <div className="flex h-28 items-end gap-1" role="img" aria-label="Savollar bo'yicha sarflangan vaqt">
                        {ordered.map((r) => (
                          <div
                            key={r.id}
                            className="flex-1 rounded-t bg-br/80"
                            style={{ height: `${Math.max(4, (r.timeMs / maxTime) * 100)}%` }}
                            title={`${Math.round(r.timeMs / 1000)} soniya`}
                          />
                        ))}
                      </div>
                      <p className="mt-2 text-[13px] text-tx2">
                        Savol 1 → {ordered.length} · o'rtacha {Math.floor(avgTime / 60000)}:
                        {String(Math.round((avgTime % 60000) / 1000)).padStart(2, "0")}
                      </p>
                    </>
                  )}
                </Card>
              </section>
              <section>
                <SectionTitle>Signallar</SectionTitle>
                <Card>
                  {signalGroups.length === 0 ? (
                    <p className="px-4 py-3.5 text-[15px] text-tx2">Signal qayd etilmagan.</p>
                  ) : (
                    <ul>
                      {signalGroups.map(([type, n], i) => (
                        <li
                          key={type}
                          className={`flex items-center justify-between px-4 py-3 text-[15px] ${
                            i < signalGroups.length - 1 ? "border-b border-line" : ""
                          }`}
                        >
                          <span>{SIGNAL_LABEL[type] ?? type}</span>
                          <span className="font-semibold tabular-nums text-tx2">× {n}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <p className="mt-2 px-4 text-[13px] text-tx2">Signal, dalil emas. Qaror HR da.</p>
              </section>
            </>
          )}
        </div>

        {/* Yon rail: tavsiya, reja, izohlar */}
        <aside className="flex flex-col gap-6 print:hidden">
          <section>
            <SectionTitle aside={<Pill tone="brand">Qoida asosida qoralama</Pill>}>Tavsiya</SectionTitle>
            <Card>
              <div className="border-b border-line px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-tx2">Kuchli tomonlar</div>
                <p className="mt-1 text-[15px]">
                  {strong.length
                    ? strong.slice(0, 3).map((r) => r.c.name).join(", ") + " — talabga teng yoki yuqori."
                    : "Talabga to'liq yetgan kompetensiya yo'q."}
                </p>
              </div>
              <div className={`px-4 py-3 ${interviewQs.length > 0 ? "border-b border-line" : ""}`}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-tx2">Xavflar</div>
                <p className="mt-1 text-[15px]">
                  {gaps.length
                    ? gaps.slice(0, 3).map((r) => `${r.c.code} ${r.c.name}: ${r.level} / ${r.c.target}`).join("; ")
                    : "Talabdan past kompetensiya yo'q."}
                </p>
              </div>
              {interviewQs.length > 0 && (
                <div className="px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-tx2">Intervyu savollari</div>
                  <ol className="mt-1 flex flex-col gap-2 text-[15px]">
                    {interviewQs.map((q, i) => (
                      <li key={i}>
                        <b className="mr-1 text-brd">{i + 1}.</b>
                        {q}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </Card>
          </section>

          {plan.length > 0 && (
            <section>
              <SectionTitle>Rivojlanish rejasi</SectionTitle>
              <Card>
                <ul>
                  {plan.map((p, i) => (
                    <li key={p} className={`flex gap-3 px-4 py-3 text-[15px] ${i < plan.length - 1 ? "border-b border-line" : ""}`}>
                      <span className="text-ok" aria-hidden>✓</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          <section>
            <SectionTitle>Izohlar</SectionTitle>
            <Card>
              {attempt.comments.length === 0 && <p className="px-4 py-3.5 text-[15px] text-tx2">Hozircha izoh yo'q.</p>}
              {attempt.comments.map((c) => (
                <div key={c.id} className="border-b border-line px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <b className="text-[15px] font-semibold">{c.author.name}</b>
                    <span className="text-[13px] text-tx2">{timeAgo(c.at, now)}</span>
                  </div>
                  <p className="mt-0.5 text-[15px]">{c.text}</p>
                </div>
              ))}
              <form action={addComment} className="flex items-end gap-2 p-2">
                <input type="hidden" name="attemptId" value={attempt.id} />
                <textarea
                  name="text"
                  required
                  maxLength={1000}
                  rows={1}
                  placeholder="Izoh yozing…"
                  aria-label="Izoh"
                  className="min-h-10 flex-1 resize-none rounded-[20px] bg-soft px-4 py-2 text-[15px] outline-none"
                />
                <button
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brf text-lg font-bold text-onbr"
                  aria-label="Yuborish"
                >
                  ↑
                </button>
              </form>
            </Card>
          </section>
        </aside>
      </div>
    </div>
  );
}

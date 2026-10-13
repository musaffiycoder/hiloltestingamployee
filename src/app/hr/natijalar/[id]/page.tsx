import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, LevelChip, Pill, VerdictChip } from "@/components/ui";
import { Radar, ScoreRing } from "@/components/svg-charts";
import { QUESTION_TYPE_LABELS, VERDICTS } from "@/lib/labels";
import { initials, shortDate, timeAgo } from "@/lib/format";
import type { VerdictKey } from "@/lib/scoring";
import { addComment, setDecision } from "./actions";
import { OverrideButton } from "./override";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Nomzod natijasi" };

type Opt = string | { text: string; points?: number };
const optText = (o: Opt) => (typeof o === "string" ? o : o.text);

const TABS = [
  { key: "sum", label: "Xulosa" },
  { key: "ans", label: "Javoblar" },
  { key: "beh", label: "Xatti-harakat" },
] as const;

export default async function ResultPage({ params, searchParams }: PageProps<"/hr/natijalar/[id]">) {
  await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as (typeof TABS)[number]["key"]) : "sum";

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

  const tabHref = (k: string) => `/hr/natijalar/${id}${k === "sum" ? "" : `?tab=${k}`}`;
  const now = new Date();

  return (
    <div className="flex flex-col gap-5">
      <Link href="/hr/natijalar" className="text-sm font-semibold text-tx2 hover:text-brd print:hidden">← Nomzodlar</Link>

      {/* Sarlavha kartasi */}
      <Card className="flex flex-wrap items-center gap-5 p-5">
        <ScoreRing pct={result.overallPct} threshold={requiredPct} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-soft text-sm font-bold">{initials(assessment.subjectName)}</span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-2xl font-bold text-navy">{assessment.subjectName}</h2>
              <p className="truncate text-sm text-tx2">
                {assessment.position.title} · {shortDate(attempt.finishedAt ?? attempt.startedAt)}
                {durationMin ? ` · ${durationMin} daqiqa` : ""}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <VerdictChip verdict={verdict} />
            <span className="text-xs font-bold text-tx2">┃ Talab: {requiredPct}%</span>
            {result.needsReview && <Pill tone="warn">◔ Qo'lda ko'rib chiqish kerak — natija vaqtinchalik</Pill>}
            {result.decision === "ADVANCE" && <Pill tone="ok">Keyingi bosqichga</Pill>}
            {result.decision === "REJECT" && <Pill tone="bad">Rad etildi</Pill>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <form action={setDecision.bind(null, attempt.id, "ADVANCE")}>
            <button className="min-h-11 rounded-full bg-br px-5 text-sm font-bold text-[#1a0c02]">Intervyuga taklif qilish</button>
          </form>
          <form action={setDecision.bind(null, attempt.id, "REJECT")}>
            <button className="min-h-11 rounded-full bg-bad-t px-5 text-sm font-bold text-bad">Rad etish</button>
          </form>
          <PrintButton />
          <Link href={`/hr/natijalar?v=cards`} className="inline-flex min-h-11 items-center rounded-full bg-soft px-5 text-sm font-bold">
            Taqqoslash
          </Link>
        </div>
      </Card>

      {result.criticalFail && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl bg-bad-t p-4 text-sm text-bad">
          <span aria-hidden>⛨</span>
          <div>
            <b>Kritik kompetensiya talabdan past</b> —{" "}
            {rows
              .filter((r) => r.c.critical && r.level !== null && r.level <= 2)
              .map((r) => `${r.c.code} (${r.c.name}) ${r.level} / ${r.c.target}`)
              .join(", ")}
            . Avtomatik «{VERDICTS.MOS_EMAS.label}». Yakuniy qaror HR da.
          </div>
        </div>
      )}

      {/* Tablar */}
      <div className="flex gap-1 rounded-full bg-soft p-1 print:hidden" role="tablist">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            role="tab"
            aria-selected={tab === t.key}
            className={`rounded-full px-4 py-2 text-sm font-bold ${tab === t.key ? "bg-card shadow-soft" : "text-tx2"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          {tab === "sum" && (
            <>
              <Card className="p-4">
                <h3 className="mb-2 text-[15px] font-bold">Kompetensiyalar — natija va talab</h3>
                <div className="mx-auto max-w-md">
                  <Radar
                    axes={comps.map((c) => ({ code: c.code, name: c.name, critical: c.critical }))}
                    series={[
                      { name: "Talab", values: comps.map((c) => c.target), color: "var(--navy)", dashed: true },
                      { name: "Natija", values: comps.map((c) => scoreByComp.get(c.id) ?? 0), color: "var(--br)", fill: true },
                    ]}
                  />
                </div>
                <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold text-tx2">
                  <span><b className="text-br">━</b> Natija</span>
                  <span><b className="text-navy">╌</b> Talab darajasi</span>
                  <span>⛨ kritik</span>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="mb-3 text-[15px] font-bold">Farq (gap)</h3>
                <div className="flex flex-col gap-3">
                  {rows.map(({ c, level }) => {
                    const gap = level === null ? null : level - c.target;
                    return (
                      <div key={c.id} className="flex items-center gap-3">
                        <span className="w-8 font-mono text-xs text-tx2">{c.code}</span>
                        <span className="w-44 shrink-0 truncate text-sm font-semibold sm:w-60" title={c.name}>
                          {c.name} {c.critical && <span className="text-bad">⛨</span>}
                        </span>
                        <LevelChip level={level} />
                        <div className="relative hidden h-2.5 flex-1 rounded-full bg-soft sm:block">
                          <div className="h-full rounded-full bg-br" style={{ width: `${((level ?? 0) / 5) * 100}%` }} />
                          <div className="absolute -top-1 h-4.5 w-0.5 rounded bg-navy" style={{ left: `${(c.target / 5) * 100}%`, height: 18 }} title={`Talab ${c.target}`} />
                        </div>
                        <span
                          className={`ml-auto w-20 rounded-full px-2 py-1 text-center text-[11px] font-bold ${
                            gap === null ? "bg-soft text-tx2" : gap > 0 ? "bg-ok-t text-ok" : gap < 0 ? "bg-warn-t text-warn" : "bg-soft text-tx2"
                          }`}
                        >
                          {gap === null ? "—" : gap > 0 ? `↑ +${gap}` : gap < 0 ? `↓ −${Math.abs(gap)}` : "= talab"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="mb-3 text-[15px] font-bold">Qizil bayroqlar</h3>
                {flags.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm font-semibold text-ok"><span>✓</span> Qizil bayroqlar yo'q</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {flags.map((f, i) => (
                      <div key={i} className="rounded-xl bg-bad-t p-3">
                        <div className="text-sm font-bold text-bad">✕ {f.t}</div>
                        <div className="mt-1 text-xs text-tx2">«{f.q}»</div>
                        {f.question && <div className="mt-1 text-[11px] text-tx2">Savol: {f.question}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}

          {tab === "ans" &&
            ordered.map((r, i) => {
              const score = r.score;
              return (
                <Card key={r.id} className="p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <b className="text-sm">Savol {i + 1}</b>
                    <Pill>{r.question.competency.code}</Pill>
                    <Pill tone="soft">daraja {r.question.level}</Pill>
                    <Pill tone="soft">{QUESTION_TYPE_LABELS[r.question.type]}</Pill>
                    <span className="ml-auto text-sm font-bold">
                      {score === null ? <span className="text-warn">baholanmagan</span> : `${r.scoreSource === "human" ? "Qo'lda" : "Avto"}: ${Math.round(score * 100)}%`}
                    </span>
                  </div>
                  <p className="text-sm font-semibold">{r.question.stem}</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-tx2">Nomzod javobi</div>
                      <div className="whitespace-pre-wrap rounded-xl bg-soft p-3 text-sm">{answerText(r)}</div>
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-tx2">Rubrika / to'g'ri javob</div>
                      <div className="whitespace-pre-wrap rounded-xl bg-soft p-3 text-sm">{correctText(r)}</div>
                    </div>
                  </div>
                  {r.question.explanation && <p className="mt-2 text-xs text-tx2">{r.question.explanation}</p>}
                  {r.overrideReason && <p className="mt-2 text-xs font-semibold text-tx2">Qo'lda o'zgartirildi — sabab: {r.overrideReason}</p>}
                  <div className="mt-3 flex items-center gap-3 print:hidden">
                    <OverrideButton responseId={r.id} current={score} />
                  </div>
                </Card>
              );
            })}

          {tab === "beh" && (
            <Card className="p-4">
              <h3 className="mb-3 text-[15px] font-bold">Har bir savolga sarflangan vaqt</h3>
              {ordered.length === 0 ? (
                <p className="text-sm text-tx2">Ma'lumot yo'q.</p>
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
                  <p className="mt-2 text-xs text-tx2">
                    Savol 1 → {ordered.length} · o'rtacha {Math.floor(avgTime / 60000)}:{String(Math.round((avgTime % 60000) / 1000)).padStart(2, "0")}
                  </p>
                </>
              )}
              <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-tx2">Signallar</h3>
              {signalGroups.length === 0 ? (
                <p className="text-sm text-tx2">Signal qayd etilmagan.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {signalGroups.map(([type, n]) => (
                    <li key={type} className="flex items-center gap-3 text-sm">
                      <span aria-hidden className="text-tx2">◦</span>
                      <span className="flex-1 font-semibold">{SIGNAL_LABEL[type] ?? type}</span>
                      <span className="font-bold">× {n}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs font-semibold text-tx2">Signal, dalil emas. Qaror HR da.</p>
            </Card>
          )}
        </div>

        {/* O'ng rail */}
        <aside className="flex flex-col gap-5 print:hidden">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-bold">Tavsiya</h3>
              <Pill tone="brand">Qoida asosida qoralama</Pill>
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-tx2">Kuchli tomonlar</div>
            <p className="mb-3 mt-1 text-sm">
              {strong.length ? strong.slice(0, 3).map((r) => r.c.name).join(", ") + " — talabga teng yoki yuqori." : "Talabga to'liq yetgan kompetensiya yo'q."}
            </p>
            <div className="text-[11px] font-bold uppercase tracking-wide text-tx2">Xavflar</div>
            <p className="mb-3 mt-1 text-sm">
              {gaps.length
                ? gaps.slice(0, 3).map((r) => `${r.c.code} ${r.c.name}: ${r.level} / ${r.c.target}`).join("; ")
                : "Talabdan past kompetensiya yo'q."}
            </p>
            {interviewQs.length > 0 && (
              <>
                <div className="text-[11px] font-bold uppercase tracking-wide text-tx2">Intervyu savollari</div>
                <ol className="mt-1 flex flex-col gap-1.5 text-sm">
                  {interviewQs.map((q, i) => (
                    <li key={i}><b className="mr-1 text-brd">{i + 1}.</b>{q}</li>
                  ))}
                </ol>
              </>
            )}
          </Card>

          {plan.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-2 text-[15px] font-bold">Rivojlanish rejasi</h3>
              <ul className="flex flex-col gap-1.5 text-sm">
                {plan.map((p) => (
                  <li key={p} className="flex gap-2"><span className="text-ok">✓</span>{p}</li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-4">
            <h3 className="mb-2 text-[15px] font-bold">Izohlar</h3>
            <div className="flex flex-col gap-2">
              {attempt.comments.length === 0 && <p className="text-sm text-tx2">Hozircha izoh yo'q.</p>}
              {attempt.comments.map((c) => (
                <div key={c.id} className="rounded-xl bg-soft p-2.5 text-sm">
                  <b>{c.author.name}:</b> {c.text}
                  <div className="mt-0.5 text-[11px] text-tx2">{timeAgo(c.at, now)}</div>
                </div>
              ))}
            </div>
            <form action={addComment} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="attemptId" value={attempt.id} />
              <textarea
                name="text"
                required
                maxLength={1000}
                rows={2}
                placeholder="Izoh yozing…"
                className="w-full rounded-xl border border-line bg-card p-2.5 text-sm outline-none focus:border-br"
              />
              <button className="min-h-10 self-end rounded-full bg-soft px-4 text-sm font-bold">Yuborish</button>
            </form>
          </Card>
        </aside>
      </div>
    </div>
  );
}

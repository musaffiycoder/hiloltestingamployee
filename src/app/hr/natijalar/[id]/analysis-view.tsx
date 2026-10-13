import { Card, SectionTitle } from "@/components/ui";
import type { StoredAnalysis } from "@/lib/ai/schemas";

type Gap = string | { gap: string; why?: string; howToClose?: string };

/** AI tahlil ko'rinishi. Eski (v1) va yangi (v2) saqlangan shakllar bilan ishlaydi. */
export function AnalysisView({ analysis, isEmployee }: { analysis: StoredAnalysis; isEmployee: boolean }) {
  const a = analysis;
  const tone = "text-[13px] font-semibold uppercase tracking-wide";
  return (
    <>
      {a.warnings.length > 0 && (
        <div role="alert" className="rounded-2xl bg-warn-t p-4 text-[15px] text-warn">
          {a.warnings.map((w) => (
            <p key={w}>⚠︎ {w}</p>
          ))}
        </div>
      )}

      {a.executiveSummary && (
        <section>
          <SectionTitle>Qisqa xulosa</SectionTitle>
          <Card className="border-l-4 border-l-brf p-4 text-[16px] leading-relaxed">{a.executiveSummary}</Card>
        </section>
      )}

      <section>
        <SectionTitle>Umumiy tahlil</SectionTitle>
        <Card className="p-4 text-[15px] leading-relaxed">{a.overallNarrative}</Card>
      </section>

      <section>
        <SectionTitle>SWOT</SectionTitle>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          {(
            [
              ["Kuchli tomonlar", a.strengths, "text-ok"],
              ["Zaif tomonlar", a.weaknesses, "text-warn"],
              [isEmployee ? "O'sish imkoniyatlari" : "Imkoniyatlar", a.opportunities, "text-brd"],
              ["Xavflar", a.threats, "text-bad"],
            ] as const
          ).map(([title, items, c]) => (
            <Card key={title} className="p-4">
              <div className={`${tone} ${c}`}>{title}</div>
              <ul className="mt-2 flex flex-col gap-1.5 text-[15px]">
                {items.length === 0 && <li className="text-tx2">—</li>}
                {items.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="text-tx2">•</span>
                    {t}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {a.competencyInsights.length > 0 && (
        <section>
          <SectionTitle>Kompetensiyalar bo'yicha</SectionTitle>
          <Card>
            {a.competencyInsights.map((c, i) => (
              <details key={c.code} className={`group ${i < a.competencyInsights.length - 1 ? "border-b border-line" : ""}`} open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="font-mono text-xs text-tx2">{c.code}</span>
                  <span className="flex-1 text-[15px] font-medium">{c.name}</span>
                  <span aria-hidden className="text-lg text-tx2 transition-transform group-open:rotate-90">›</span>
                </summary>
                <div className="flex flex-col gap-2 bg-soft/50 px-4 py-3 text-[15px] leading-relaxed">
                  <p>{c.analysis}</p>
                  {c.evidence && (
                    <p className="text-tx2">
                      <b className="font-semibold">Dalil:</b> {c.evidence}
                    </p>
                  )}
                  {c.reliability && (
                    <p className="text-tx2">
                      <b className="font-semibold">Ishonchlilik:</b> {c.reliability}
                    </p>
                  )}
                  {c.nextStep && (
                    <p className="text-brd">
                      <b className="font-semibold">Keyingi qadam:</b> {c.nextStep}
                    </p>
                  )}
                </div>
              </details>
            ))}
          </Card>
        </section>
      )}

      {(a.errorDiagnostics?.length ?? 0) > 0 && (
        <section>
          <SectionTitle>Xatolar diagnostikasi</SectionTitle>
          <Card>
            {a.errorDiagnostics.map((e, i) => (
              <div key={i} className={`px-4 py-3 text-[15px] ${i < a.errorDiagnostics.length - 1 ? "border-b border-line" : ""}`}>
                <div className="text-[13px] font-semibold text-tx2">
                  Savol {e.question} · {e.competency}
                </div>
                <p className="mt-1">
                  <b className="font-semibold">Tanlov:</b> {e.chose}
                </p>
                <p className="mt-1">
                  <b className="font-semibold">Nimani ko'rsatadi:</b> {e.shows}
                </p>
                <p className="mt-1 text-brd">
                  <b className="font-semibold">Tuzatish:</b> {e.fix}
                </p>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>Javob naqshlari va ishonchlilik</SectionTitle>
        <Card>
          {(
            [
              ["Qiyinlik bo'yicha", a.answerPatterns.difficulty],
              ["Noto'g'ri variantlar", a.answerPatterns.distractors],
              ["Vaqt", a.answerPatterns.time],
              ["Qiyoslash", a.answerPatterns.comparison],
              ["Natijaga ishonch", a.answerPatterns.reliability ?? ""],
            ] as const
          )
            .filter(([, v]) => v)
            .map(([k, v], i, arr) => (
              <div key={k} className={`px-4 py-3 ${i < arr.length - 1 ? "border-b border-line" : ""}`}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-tx2">{k}</div>
                <p className="mt-1 text-[15px]">{v}</p>
              </div>
            ))}
        </Card>
      </section>

      {(a.interviewQuestions?.length ?? 0) > 0 && (
        <section>
          <SectionTitle>{isEmployee ? "Rahbar bilan suhbat uchun savollar" : "Intervyu uchun savollar"}</SectionTitle>
          <Card>
            {a.interviewQuestions.map((q, i) => (
              <div key={i} className={`px-4 py-3 text-[15px] ${i < a.interviewQuestions.length - 1 ? "border-b border-line" : ""}`}>
                <p className="font-semibold">
                  {i + 1}. {q.question}
                </p>
                <p className="mt-1 text-tx2">Tekshiradi: {q.verifies}</p>
                <p className="mt-1 text-ok">Yaxshi javobda: {q.lookFor}</p>
              </div>
            ))}
          </Card>
        </section>
      )}

      {(a.roleRisks?.length ?? 0) > 0 && (
        <section>
          <SectionTitle>{isEmployee ? "Lavozimdagi xavflar" : "Qabul qilinsa — xavflar"}</SectionTitle>
          <Card className="p-4">
            <ul className="flex flex-col gap-1.5 text-[15px]">
              {a.roleRisks.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="text-bad">•</span>
                  {t}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>Rivojlantirish rejasi</SectionTitle>
        <Card>
          {a.developmentPlan.map((d, i) => (
            <div key={i} className={`px-4 py-3 ${i < a.developmentPlan.length - 1 ? "border-b border-line" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-tint text-[13px] font-bold text-brd">{d.priority}</span>
                <span className="flex-1 text-[15px] font-semibold">{d.area}</span>
                {d.horizon && <span className="rounded-full bg-soft px-2.5 py-0.5 text-[12px] font-semibold">{d.horizon}</span>}
              </div>
              <p className="mt-1 text-[15px]">{d.recommendation}</p>
              <p className="mt-1 text-[13px] text-tx2">
                {d.format} · {d.courseSuggestion} · {d.estimatedDuration}
              </p>
              {d.successMetric && <p className="mt-1 text-[13px] text-ok">Mezon: {d.successMetric}</p>}
            </div>
          ))}
        </Card>
      </section>

      <section>
        <SectionTitle>Yakuniy tavsiya</SectionTitle>
        <Card className="p-4 text-[15px] leading-relaxed">
          <p>{a.recommendation}</p>
          {(a.recommendationReasons?.length ?? 0) > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {a.recommendationReasons.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="text-tx2">•</span>
                  {t}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {a.dataGaps.length > 0 && (
        <section>
          <SectionTitle>Ishonchlilikni oshirish uchun</SectionTitle>
          <Card>
            {(a.dataGaps as Gap[]).map((g, i, arr) => {
              const o = typeof g === "string" ? { gap: g } : g;
              return (
                <div key={i} className={`px-4 py-3 text-[15px] ${i < arr.length - 1 ? "border-b border-line" : ""}`}>
                  <p className="font-semibold">{o.gap}</p>
                  {"why" in o && o.why && <p className="mt-1 text-tx2">{o.why}</p>}
                  {"howToClose" in o && o.howToClose && (
                    <p className="mt-1 text-brd">
                      <b className="font-semibold">Nima qilish kerak:</b> {o.howToClose}
                    </p>
                  )}
                </div>
              );
            })}
          </Card>
        </section>
      )}
    </>
  );
}

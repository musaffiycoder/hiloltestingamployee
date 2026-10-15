import type { Metadata } from "next";
import { RichText, stemPreview } from "@/components/rich-text";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, Pill, SectionTitle } from "@/components/ui";
import { calibrationStats, MAE_TARGET, MIN_SAMPLES, WITHIN_ONE_TARGET, type Pair } from "@/lib/calibration";
import { Rater } from "./rater";

export const metadata: Metadata = { title: "Kalibrlash" };

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default async function CalibrationPage() {
  const me = await requireUser();
  const canWrite = me.role !== "MANAGER";

  const [ratings, overrides, queue] = await Promise.all([
    db.calibrationRating.findMany({
      where: { response: { aiScore: { not: null } } },
      include: { response: { include: { question: { select: { stem: true } } } }, rater: { select: { name: true } } },
      orderBy: { at: "desc" },
    }),
    db.response.findMany({
      where: { aiScore: { not: null }, scoreSource: "human", reviewed: true, score: { not: null } },
      select: { id: true, aiScore: true, score: true, question: { select: { stem: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.response.findMany({
      where: { aiScore: { not: null }, question: { type: "OPEN" }, ratings: { none: { raterId: me.id } } },
      include: { question: { select: { stem: true, rubric: true, level: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
  ]);

  const blind: Pair[] = ratings.map((r) => ({ ai: r.response.aiScore as number, human: r.score }));
  const overrideP: Pair[] = overrides.map((o) => ({ ai: o.aiScore as number, human: o.score as number }));
  const all = [...blind, ...overrideP];
  const stats = calibrationStats(all);

  const next = queue[0];
  const rubric = ((next?.question.rubric as { points?: string[] } | null)?.points ?? []) as string[];
  const text = ((next?.payload as { text?: string } | undefined)?.text ?? "").trim();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-7">
      <header className="px-1">
        <h2 className="text-[34px] font-bold leading-tight">Kalibrlash</h2>
        <p className="mt-1 text-[15px] text-tx2">
          AI ballari sizning bahoyingizga qanchalik mos? Quyida javobni AI ballini ko'rmasdan baholaysiz; tizim farqni
          o'lchaydi. HR qo'lda o'zgartirgan ballar ham avtomatik hisobga olinadi.
        </p>
      </header>

      <section>
        <SectionTitle>Kelishuv</SectionTitle>
        <Card className="p-4">
          {stats.n === 0 ? (
            <p className="text-[15px] text-tx2">
              Hali ma'lumot yo'q. AI ochiq javoblarni baholagach, ular shu yerda ko'r-ko'rona baholash uchun paydo bo'ladi.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                {[
                  ["Namuna", String(stats.n), stats.n >= MIN_SAMPLES],
                  [`±1 pog'ona (≥${Math.round(WITHIN_ONE_TARGET * 100)}%)`, pct(stats.withinOne), stats.withinOne >= WITHIN_ONE_TARGET],
                  [`O'rtacha farq (≤${MAE_TARGET})`, stats.mae.toFixed(2), stats.mae <= MAE_TARGET],
                  ["Siljish (AI − odam)", `${stats.bias >= 0 ? "+" : ""}${stats.bias.toFixed(2)}`, Math.abs(stats.bias) <= 0.1],
                ].map(([k, v, ok]) => (
                  <div key={k as string} className="rounded-2xl bg-soft p-3">
                    <div className={`text-[22px] font-bold tabular-nums ${ok ? "text-ok" : "text-warn"}`}>{v as string}</div>
                    <div className="mt-0.5 text-[11px] font-semibold text-tx2">{k as string}</div>
                  </div>
                ))}
              </div>
              <p className={`mt-3 text-[15px] font-medium ${stats.ready ? "text-ok" : "text-warn"}`}>{stats.verdict}</p>
              <p className="mt-1 text-[13px] text-tx2">
                Manba: ko'r-ko'rona baholar {blind.length} ta, HR o'zgartirishlari {overrideP.length} ta.
              </p>
            </>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle aside={<span className="text-[13px] text-tx2">{queue.length} ta qoldi</span>}>Ko'r-ko'rona baholash</SectionTitle>
        {!next ? (
          <Card className="p-5 text-[15px] text-tx2">Baholash uchun javob yo'q. Hamma mavjud javoblar siz tomondan baholangan.</Card>
        ) : !canWrite ? (
          <Card className="p-5 text-[15px] text-tx2">Menejer sifatida baholay olmaysiz (faqat ko'rish).</Card>
        ) : (
          <Card className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-tx2">Savol · qiyinlik {next.question.level}/5</div>
            <RichText text={next.question.stem} className="mt-1 text-[16px]" />
            {rubric.length > 0 && (
              <div className="mt-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-tx2">Rubrika</div>
                <ul className="mt-1 list-disc pl-5 text-[15px]">
                  {rubric.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
            )}
            <div className="mt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-tx2">Javob</div>
              <div className="mt-1 whitespace-pre-wrap rounded-xl bg-soft p-3 text-[15px]">{text || "(bo'sh)"}</div>
            </div>
            <div className="mt-4">
              <Rater key={next.id} responseId={next.id} />
            </div>
          </Card>
        )}
      </section>

      {all.length > 0 && (
        <section>
          <SectionTitle>So'nggi solishtirishlar</SectionTitle>
          <Card>
            <ul>
              {[
                ...ratings.slice(0, 15).map((r) => ({ id: r.id, stem: r.response.question.stem, ai: r.response.aiScore as number, human: r.score, src: "ko'r-ko'rona" })),
                ...overrides.slice(0, 15).map((o) => ({ id: o.id, stem: o.question.stem, ai: o.aiScore as number, human: o.score as number, src: "HR o'zgartirdi" })),
              ].map((x, i, arr) => {
                const d = x.ai - x.human;
                return (
                  <li key={x.id + x.src} className={`flex items-center gap-3 px-4 py-3 ${i < arr.length - 1 ? "border-b border-line" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-[15px] font-medium">{stemPreview(x.stem)}</div>
                      <div className="text-[13px] text-tx2">{x.src}</div>
                    </div>
                    <span className="text-[15px] tabular-nums text-tx2">AI {pct(x.ai)} · odam {pct(x.human)}</span>
                    <Pill tone={Math.abs(d) <= 0.25 ? "ok" : "warn"}>{d > 0 ? "+" : ""}{Math.round(d * 100)}</Pill>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}

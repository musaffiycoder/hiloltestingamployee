"use client";

import { useMemo, useState, useTransition } from "react";
import { CircleCheck, Clock3, ListChecks, Minus, Plus, RotateCcw, Scale, ShieldAlert, TriangleAlert } from "lucide-react";
import { Button, Card, Ico, SectionTitle } from "@/components/ui";
import type { PositionPlan } from "@/lib/test-config";
import { distributeByWeight } from "@/lib/test-config-math";
import { resetTestConfig, saveTestConfig, type SaveState } from "../actions";

const seg = (on: boolean) =>
  `flex h-8 flex-1 items-center justify-center rounded-[8px] text-[13px] font-semibold ${on ? "bg-card text-tx shadow-sm" : "text-tx2"}`;

export function BuilderEditor({ plan, readOnly }: { plan: PositionPlan; readOnly: boolean }) {
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(plan.competencies.map((c) => [c.code, c.count])));
  const [order, setOrder] = useState(plan.order);
  const [timeMode, setTimeMode] = useState<"auto" | "manual">(plan.timeLimitMin ? "manual" : "auto");
  const [timeMin, setTimeMin] = useState(plan.timeLimitMin ?? plan.estimatedMin);
  const bank = plan.competencies.reduce((s, c) => s + c.available, 0);
  const [targetTotal, setTargetTotal] = useState(Math.min(40, bank));
  const [state, setState] = useState<SaveState>(null);
  const [pending, start] = useTransition();

  const total = useMemo(() => Object.values(counts).reduce((s, n) => s + n, 0), [counts]);
  const estMin = useMemo(
    () => Math.round(plan.competencies.reduce((s, c) => s + (counts[c.code] ?? 0) * c.avgSec, 0) / 60),
    [counts, plan.competencies],
  );
  const missingCritical = plan.competencies.filter((c) => c.critical && c.available > 0 && (counts[c.code] ?? 0) === 0);
  const tooTight = timeMode === "manual" && timeMin < estMin * 0.7;

  const set = (code: string, n: number, max: number) => setCounts((p) => ({ ...p, [code]: Math.max(0, Math.min(max, n)) }));
  const save = () =>
    start(async () => {
      setState(
        await saveTestConfig({
          positionId: plan.positionId,
          perCompetency: counts,
          timeLimitMin: timeMode === "manual" ? timeMin : null,
          order,
        }),
      );
    });
  const reset = () =>
    start(async () => {
      const r = await resetTestConfig(plan.positionId);
      setCounts(Object.fromEntries(plan.competencies.map((c) => [c.code, c.available])));
      setOrder("competency");
      setTimeMode("auto");
      setState(r);
    });

  return (
    <div className="flex flex-col gap-6">
      {/* Xulosa */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: ListChecks, l: "Savollar", v: `${total}`, d: `bankda ${bank}` },
          { icon: Clock3, l: "Vaqt", v: `${timeMode === "manual" ? timeMin : estMin} daq`, d: timeMode === "manual" ? "qo'lda belgilangan" : "savollar bo'yicha" },
          { icon: Scale, l: "Kompetensiyalar", v: `${plan.competencies.filter((c) => (counts[c.code] ?? 0) > 0).length}`, d: `jami ${plan.competencies.length}` },
        ].map((k) => (
          <Card key={k.l} className="p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-tx2">
              <Ico icon={k.icon} size={13} className="mr-1" />
              {k.l}
            </div>
            <div className="mt-1.5 font-display text-[28px] font-bold leading-none text-navy">{k.v}</div>
            <div className="mt-1 text-[12px] text-tx2">{k.d}</div>
          </Card>
        ))}
      </div>

      {!readOnly && (
        <section>
          <SectionTitle>Tez taqsimlash</SectionTitle>
          <Card className="flex flex-wrap items-center gap-3 p-4">
            <label className="flex items-center gap-2 text-[15px]">
              Jami
              <input
                type="number"
                min={5}
                max={bank}
                value={targetTotal}
                onChange={(e) => setTargetTotal(Number(e.target.value) || 0)}
                className="h-9 w-20 rounded-[10px] bg-soft px-3 text-center text-[17px] tabular-nums outline-none"
              />
              savolni
            </label>
            <Button variant="secondary" className="min-h-9 px-4 text-[15px]" onClick={() => setCounts(distributeByWeight(plan.competencies, targetTotal))}>
              vazn bo'yicha taqsimlash
            </Button>
            <Button
              variant="ghost"
              className="min-h-9 px-3 text-[15px]"
              onClick={() => setCounts(Object.fromEntries(plan.competencies.map((c) => [c.code, c.available])))}
            >
              Hammasini olish
            </Button>
          </Card>
        </section>
      )}

      {/* Kompetensiyalar */}
      <section>
        <SectionTitle aside={<span className="text-[13px] text-tx2">vazn · bankda · testda</span>}>Kompetensiyalar</SectionTitle>
        <Card>
          <ul>
            {plan.competencies.map((c, i) => {
              const n = counts[c.code] ?? 0;
              return (
                <li key={c.code} className={`flex items-center gap-3 px-4 py-3 ${i < plan.competencies.length - 1 ? "border-b border-line" : ""}`}>
                  <span className="w-9 shrink-0 text-[13px] font-bold text-brd">{c.code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">
                      {c.name}
                      {c.critical && <Ico icon={ShieldAlert} size={13} className="ml-1.5 text-bad" />}
                    </span>
                    <span className="block text-[12px] text-tx2">
                      vazn {c.weight}% · bankda {c.available} ta
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={readOnly || n === 0}
                      onClick={() => set(c.code, n - 1, c.available)}
                      aria-label={`${c.code}: kamaytirish`}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-soft text-brd disabled:opacity-30"
                    >
                      <Minus size={16} aria-hidden />
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={c.available}
                      value={n}
                      disabled={readOnly}
                      onChange={(e) => set(c.code, Number(e.target.value) || 0, c.available)}
                      aria-label={`${c.code}: savollar soni`}
                      className="h-8 w-12 rounded-[8px] bg-transparent text-center text-[17px] font-semibold tabular-nums outline-none"
                    />
                    <button
                      type="button"
                      disabled={readOnly || n >= c.available}
                      onClick={() => set(c.code, n + 1, c.available)}
                      aria-label={`${c.code}: ko'paytirish`}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-soft text-brd disabled:opacity-30"
                    >
                      <Plus size={16} aria-hidden />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
        {missingCritical.length > 0 && (
          <p className="mt-2 px-4 text-[13px] font-medium text-warn">
            <Ico icon={TriangleAlert} size={13} className="mr-1" />
            Kritik kompetensiya testga kirmagan: {missingCritical.map((c) => c.code).join(", ")}. Ular bo'yicha natija chiqmaydi.
          </p>
        )}
      </section>

      {/* Vaqt va tartib */}
      <section>
        <SectionTitle>Vaqt va tartib</SectionTitle>
        <Card className="flex flex-col gap-4 p-4">
          <div>
            <div className="mb-1.5 text-[15px] font-semibold">Umumiy vaqt</div>
            <div className="flex rounded-[10px] bg-soft p-0.5" role="radiogroup" aria-label="Umumiy vaqt">
              <button type="button" disabled={readOnly} role="radio" aria-checked={timeMode === "auto"} onClick={() => setTimeMode("auto")} className={seg(timeMode === "auto")}>
                Savollar bo'yicha (~{estMin} daq)
              </button>
              <button type="button" disabled={readOnly} role="radio" aria-checked={timeMode === "manual"} onClick={() => setTimeMode("manual")} className={seg(timeMode === "manual")}>
                Qo'lda belgilash
              </button>
            </div>
            {timeMode === "manual" && (
              <label className="mt-3 flex items-center gap-2 text-[15px]">
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={timeMin}
                  disabled={readOnly}
                  onChange={(e) => setTimeMin(Number(e.target.value) || 0)}
                  className="h-9 w-20 rounded-[10px] bg-soft px-3 text-center text-[17px] tabular-nums outline-none"
                />
                daqiqa
              </label>
            )}
            {tooTight && (
              <p className="mt-2 text-[13px] font-medium text-warn">
                <Ico icon={TriangleAlert} size={13} className="mr-1" />
                Vaqt savollar uchun tavsiya etilganidan ancha kam (~{estMin} daq) — nomzodlar ulgurmasligi mumkin.
              </p>
            )}
          </div>
          <div>
            <div className="mb-1.5 text-[15px] font-semibold">Savollar tartibi</div>
            <div className="flex rounded-[10px] bg-soft p-0.5" role="radiogroup" aria-label="Savollar tartibi">
              <button type="button" disabled={readOnly} role="radio" aria-checked={order === "competency"} onClick={() => setOrder("competency")} className={seg(order === "competency")}>
                Kompetensiyalar bo'yicha
              </button>
              <button type="button" disabled={readOnly} role="radio" aria-checked={order === "mixed"} onClick={() => setOrder("mixed")} className={seg(order === "mixed")}>
                Aralash
              </button>
            </div>
          </div>
        </Card>
      </section>

      {state && (
        <p role="status" className={`px-4 text-[14px] font-medium ${state.ok ? "text-ok" : "text-bad"}`}>
          <Ico icon={state.ok ? CircleCheck : TriangleAlert} className="mr-1" />
          {state.message}
        </p>
      )}

      {readOnly ? (
        <p className="px-4 text-[13px] text-tx2">Menejer sifatida sozlamani faqat ko'rishingiz mumkin.</p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={save} disabled={pending || total < 5} className="sm:flex-1">
            {pending ? "Saqlanmoqda…" : `Saqlash · ${total} ta savol`}
          </Button>
          {plan.configured && (
            <Button variant="ghost" onClick={reset} disabled={pending}>
              <RotateCcw size={16} aria-hidden /> Standartga qaytarish
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

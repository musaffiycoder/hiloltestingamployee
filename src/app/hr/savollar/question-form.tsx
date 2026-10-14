"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { analyzeQuestion } from "@/lib/question-quality";
import { deleteQuestion, saveQuestion } from "./actions";
import { Check, Flag, Info, Plus, TriangleAlert, X } from "lucide-react";
import { Ico } from "@/components/ui";

export type PositionOpt = { code: string; title: string; competencies: { code: string; name: string }[] };
type QType = "MCQ_SINGLE" | "MCQ_MULTI" | "SITUATIONAL" | "OPEN";
type Opt = { text: string; correct: boolean; points: number; flag: boolean };

export type FormInitial = {
  id?: string;
  position: string;
  competency: string;
  level: number;
  type: QType;
  stem: string;
  options: Opt[];
  rubric: string[];
  explanation: string;
  timeLimitSec: number;
  status: "ACTIVE" | "DRAFT" | "RETIRED";
};

const TYPE_LABEL: Record<QType, string> = {
  MCQ_SINGLE: "Bitta javobli test",
  MCQ_MULTI: "Ko'p javobli test",
  SITUATIONAL: "Vaziyatli savol",
  OPEN: "Ochiq javob",
};

const blankOpt = (): Opt => ({ text: "", correct: false, points: 3, flag: false });
const row = "flex min-h-[48px] items-center gap-3 px-4";
const inputCls = "min-w-0 flex-1 bg-transparent text-right text-[17px] outline-none placeholder:text-tx2/60";

export function QuestionForm({ positions, initial }: { positions: PositionOpt[]; initial: FormInitial }) {
  const router = useRouter();
  const [f, setF] = useState<FormInitial>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const set = <K extends keyof FormInitial>(k: K, v: FormInitial[K]) => setF((p) => ({ ...p, [k]: v }));

  const comps = positions.find((p) => p.code === f.position)?.competencies ?? [];
  const isChoice = f.type !== "OPEN";

  const warnings = useMemo(
    () =>
      analyzeQuestion({
        type: f.type,
        stem: f.stem,
        options: f.options.filter((o) => o.text.trim()).map((o) => ({ text: o.text, correct: o.correct, points: o.points })),
      }),
    [f.type, f.stem, f.options],
  );

  const setOpt = (i: number, patch: Partial<Opt>) =>
    set("options", f.options.map((o, k) => (k === i ? { ...o, ...patch } : o)));

  const buildQuestion = () => {
    const base = {
      position: f.position,
      competency: f.competency,
      level: f.level,
      stem: f.stem.trim(),
      explanation: f.explanation.trim() || undefined,
      timeLimitSec: f.timeLimitSec,
    };
    const opts = f.options.filter((o) => o.text.trim());
    if (f.type === "MCQ_SINGLE")
      return { ...base, type: f.type, options: opts.map((o) => o.text.trim()), correct: opts.findIndex((o) => o.correct) };
    if (f.type === "MCQ_MULTI")
      return {
        ...base,
        type: f.type,
        options: opts.map((o) => o.text.trim()),
        correct: opts.flatMap((o, i) => (o.correct ? [i] : [])),
      };
    if (f.type === "SITUATIONAL")
      return {
        ...base,
        type: f.type,
        options: opts.map((o) => ({ text: o.text.trim(), points: o.points, ...(o.flag ? { flag: true } : {}) })),
      };
    return { ...base, type: f.type, rubric: f.rubric.map((r) => r.trim()).filter(Boolean) };
  };

  const save = (status: FormInitial["status"]) => {
    setErrors([]);
    start(async () => {
      try {
        const res = await saveQuestion({ id: f.id, question: buildQuestion(), status });
        if (!res.ok) return setErrors(res.errors);
        router.push("/hr/savollar");
        router.refresh();
      } catch {
        setErrors(["Saqlab bo'lmadi. Ruxsatingizni (faqat ko'rish huquqi) yoki ulanishni tekshiring."]);
      }
    });
  };

  const remove = () => {
    if (!f.id || !confirm("Savolni o'chirasizmi? Javoblari bo'lsa, arxivga o'tkaziladi.")) return;
    start(async () => {
      await deleteQuestion(f.id!);
      router.push("/hr/savollar");
      router.refresh();
    });
  };

  const sectionTitle = "mb-2 px-4 text-[13px] font-semibold uppercase tracking-wide text-tx2";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <div className={sectionTitle}>Joylashuv</div>
        <div className="overflow-hidden rounded-2xl bg-card">
          <label className={row}>
            <span className="w-28 shrink-0 text-[17px]">Lavozim</span>
            <select
              value={f.position}
              onChange={(e) => {
                const p = positions.find((x) => x.code === e.target.value);
                setF((s) => ({ ...s, position: e.target.value, competency: p?.competencies[0]?.code ?? "" }));
              }}
              className={`${inputCls} text-brd`}
            >
              {positions.map((p) => (
                <option key={p.code} value={p.code}>{p.title}</option>
              ))}
            </select>
          </label>
          <div className="ml-4 h-px bg-line" />
          <label className={row}>
            <span className="w-28 shrink-0 text-[17px]">Kompetensiya</span>
            <select value={f.competency} onChange={(e) => set("competency", e.target.value)} className={`${inputCls} text-brd`}>
              {comps.map((c) => (
                <option key={c.code} value={c.code}>{c.code} · {c.name}</option>
              ))}
            </select>
          </label>
          <div className="ml-4 h-px bg-line" />
          <div className={row}>
            <span className="w-28 shrink-0 text-[17px]">Daraja</span>
            <div className="ml-auto grid w-full max-w-[220px] grid-cols-5 rounded-[10px] bg-soft p-0.5" role="radiogroup" aria-label="Daraja">
              {[1, 2, 3, 4, 5].map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={f.level === l}
                  onClick={() => set("level", l)}
                  className={`rounded-lg py-1.5 text-[13px] font-semibold ${f.level === l ? "bg-card shadow-[0_1px_3px_rgba(0,0,0,0.18)]" : ""}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="ml-4 h-px bg-line" />
          <label className={row}>
            <span className="w-28 shrink-0 text-[17px]">Tur</span>
            <select
              value={f.type}
              onChange={(e) => {
                const t = e.target.value as QType;
                setF((s) => ({
                  ...s,
                  type: t,
                  options: t === "OPEN" ? s.options : s.options.length >= 3 ? s.options : [blankOpt(), blankOpt(), blankOpt(), blankOpt()],
                  rubric: s.rubric.length ? s.rubric : ["", ""],
                }));
              }}
              className={`${inputCls} text-brd`}
            >
              {(Object.keys(TYPE_LABEL) as QType[]).map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </select>
          </label>
          <div className="ml-4 h-px bg-line" />
          <label className={row}>
            <span className="w-28 shrink-0 text-[17px]">Vaqt (soniya)</span>
            <input
              type="number"
              min={15}
              max={900}
              value={f.timeLimitSec}
              onChange={(e) => set("timeLimitSec", Number(e.target.value) || 90)}
              className={inputCls}
            />
          </label>
        </div>
      </div>

      <div>
        <div className={sectionTitle}>Savol matni</div>
        <textarea
          value={f.stem}
          onChange={(e) => set("stem", e.target.value)}
          rows={4}
          placeholder="Savolni yozing…"
          className="w-full rounded-2xl bg-card p-4 text-[17px] leading-relaxed outline-none focus:ring-2 focus:ring-br/40"
        />
      </div>

      {isChoice ? (
        <div>
          <div className={sectionTitle}>
            {f.type === "SITUATIONAL" ? "Variantlar va ballar (1–5)" : f.type === "MCQ_MULTI" ? "Variantlar (to'g'rilarini belgilang)" : "Variantlar (bittasini belgilang)"}
          </div>
          <ul className="overflow-hidden rounded-2xl bg-card">
            {f.options.map((o, i) => (
              <li key={i} className={`flex items-start gap-3 px-4 py-3 ${i < f.options.length - 1 ? "border-b border-line" : ""}`}>
                {f.type !== "SITUATIONAL" ? (
                  <button
                    type="button"
                    role={f.type === "MCQ_MULTI" ? "checkbox" : "radio"}
                    aria-checked={o.correct}
                    aria-label={`${String.fromCharCode(65 + i)} to'g'ri`}
                    onClick={() =>
                      f.type === "MCQ_SINGLE"
                        ? set("options", f.options.map((x, k) => ({ ...x, correct: k === i })))
                        : setOpt(i, { correct: !o.correct })
                    }
                    className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] text-xs font-bold ${
                      o.correct ? "border-ok bg-ok text-white" : "border-tx2/50"
                    }`}
                  >
                    {o.correct ? <Check size={14} strokeWidth={3} aria-hidden /> : null}
                  </button>
                ) : (
                  <select
                    value={o.points}
                    onChange={(e) => setOpt(i, { points: Number(e.target.value) })}
                    aria-label="Ball"
                    className="mt-0.5 h-8 w-14 shrink-0 rounded-lg bg-soft text-center text-[15px] font-semibold"
                  >
                    {[1, 2, 3, 4, 5].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}
                <textarea
                  value={o.text}
                  onChange={(e) => setOpt(i, { text: e.target.value })}
                  rows={2}
                  placeholder={`${String.fromCharCode(65 + i)} variant`}
                  className="min-w-0 flex-1 resize-none bg-transparent text-[17px] outline-none placeholder:text-tx2/60"
                />
                {f.type === "SITUATIONAL" && (
                  <button
                    type="button"
                    aria-pressed={o.flag}
                    aria-label="Qizil bayroq"
                    title="Qizil bayroq: tanlansa natijada ogohlantirish chiqadi"
                    onClick={() => setOpt(i, { flag: !o.flag })}
                    className={`mt-0.5 h-8 shrink-0 rounded-full px-2.5 text-[13px] font-semibold ${o.flag ? "bg-bad-t text-bad" : "bg-soft text-tx2"}`}
                  >
                    <Flag size={15} strokeWidth={2.4} className={o.flag ? "fill-current" : ""} aria-hidden />
                  </button>
                )}
                {f.options.length > 3 && (
                  <button
                    type="button"
                    aria-label="Variantni o'chirish"
                    onClick={() => set("options", f.options.filter((_, k) => k !== i))}
                    className="mt-0.5 flex h-8 shrink-0 items-center px-1 text-tx2"
                  >
                    <X size={18} aria-hidden />
                  </button>
                )}
              </li>
            ))}
            {f.options.length < 6 && (
              <li className="border-t border-line">
                <button type="button" onClick={() => set("options", [...f.options, blankOpt()])} className="h-12 w-full px-4 text-left text-[17px] text-brd">
                  <Plus size={18} aria-hidden className="mr-1 inline-block align-[-0.2em]" />
                  Variant qo'shish
                </button>
              </li>
            )}
          </ul>
        </div>
      ) : (
        <div>
          <div className={sectionTitle}>Rubrika (baholash bandlari)</div>
          <ul className="overflow-hidden rounded-2xl bg-card">
            {f.rubric.map((r, i) => (
              <li key={i} className={`flex items-center gap-3 px-4 ${i < f.rubric.length - 1 ? "border-b border-line" : ""}`}>
                <input
                  value={r}
                  onChange={(e) => set("rubric", f.rubric.map((x, k) => (k === i ? e.target.value : x)))}
                  placeholder={`Band ${i + 1}`}
                  className="h-12 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-tx2/60"
                />
                {f.rubric.length > 2 && (
                  <button type="button" aria-label="Bandni o'chirish" onClick={() => set("rubric", f.rubric.filter((_, k) => k !== i))} className="flex items-center text-tx2">
                    <X size={18} aria-hidden />
                  </button>
                )}
              </li>
            ))}
            <li className="border-t border-line">
              <button type="button" onClick={() => set("rubric", [...f.rubric, ""])} className="h-12 w-full px-4 text-left text-[17px] text-brd">
                <Plus size={18} aria-hidden className="mr-1 inline-block align-[-0.2em]" />
                Band qo'shish
              </button>
            </li>
          </ul>
        </div>
      )}

      <div>
        <div className={sectionTitle}>Izoh (ixtiyoriy, faqat HR ko'radi)</div>
        <textarea
          value={f.explanation}
          onChange={(e) => set("explanation", e.target.value)}
          rows={2}
          className="w-full rounded-2xl bg-card p-4 text-[15px] outline-none focus:ring-2 focus:ring-br/40"
        />
      </div>

      {warnings.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-warn-t" role="status">
          <div className="px-4 pt-3 text-[13px] font-semibold uppercase tracking-wide text-warn">Sifat tekshiruvi</div>
          <ul className="px-4 pb-3 pt-1">
            {warnings.map((w) => (
              <li key={w.code} className="py-1 text-[15px]">
                <Ico icon={w.severity === "warn" ? TriangleAlert : Info} className="mr-1" />
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {errors.length > 0 && (
        <ul role="alert" className="rounded-2xl bg-bad-t px-4 py-3 text-[15px] text-bad">
          {errors.map((e, i) => <li key={i}>• {e}</li>)}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={() => save("ACTIVE")}
          disabled={pending}
          className="h-[50px] rounded-full bg-brf text-[17px] font-semibold text-onbr disabled:opacity-50"
        >
          {pending ? "Saqlanmoqda…" : f.status === "ACTIVE" && f.id ? "Saqlash" : "Saqlash va faollashtirish"}
        </button>
        <button
          onClick={() => save("DRAFT")}
          disabled={pending}
          className="h-11 rounded-full bg-tint text-[17px] font-semibold text-brd disabled:opacity-50"
        >
          Qoralama sifatida saqlash
        </button>
        {f.id && (
          <button onClick={remove} disabled={pending} className="h-11 text-[17px] font-medium text-bad">
            O'chirish
          </button>
        )}
      </div>
    </div>
  );
}

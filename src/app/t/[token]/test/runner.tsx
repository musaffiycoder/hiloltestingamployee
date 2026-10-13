"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { finishAttempt, logSignal, saveResponse } from "../actions";

export type RunnerQuestion = {
  id: string;
  type: "MCQ_SINGLE" | "MCQ_MULTI" | "SITUATIONAL" | "OPEN";
  stem: string;
  options: { text: string; idx: number }[];
  multi: boolean;
  section: string;
  timeLimitSec: number;
  saved: { selected?: number | number[] | null; text?: string } | null;
};

type Answer = { selected: number | number[] | null; text: string };

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Runner({
  token,
  positionTitle,
  questions,
  remainingSec,
}: {
  token: string;
  positionTitle: string;
  questions: RunnerQuestion[];
  remainingSec: number;
}) {
  const [index, setIndex] = useState(() => {
    const firstOpen = questions.findIndex((q) => !q.saved);
    return firstOpen === -1 ? 0 : firstOpen;
  });
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(
      questions.map((q) => [q.id, { selected: q.saved?.selected ?? (q.multi ? [] : null), text: q.saved?.text ?? "" }]),
    ),
  );
  const [left, setLeft] = useState(remainingSec);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [pending, startTransition] = useTransition();
  const startedAt = useRef(0);
  const finished = useRef(false);

  const q = questions[index];
  const a = answers[q.id];
  const isLast = index === questions.length - 1;
  const answeredCount = questions.filter((x) => {
    const v = answers[x.id];
    return v && (Array.isArray(v.selected) ? v.selected.length > 0 : v.selected !== null || v.text.trim().length > 0);
  }).length;

  const persist = useCallback(
    async (question: RunnerQuestion, ans: Answer) => {
      setSaving("saving");
      try {
        const res = await saveResponse(token, {
          questionId: question.id,
          selected: ans.selected,
          text: ans.text,
          timeMs: Date.now() - startedAt.current,
        });
        setSaving(res.ok ? "saved" : "error");
      } catch {
        setSaving("error");
      }
    },
    [token],
  );

  const submit = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    startTransition(async () => {
      await persist(q, answers[q.id]);
      await finishAttempt(token);
    });
  }, [answers, persist, q, token]);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  // Taymer
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left === 0) submit();
  }, [left, submit]);

  // Fokus yo'qolishi signali (rozilik asosida, neytral)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") void logSignal(token, "focus_lost");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [token]);

  // Sahifani yopishdan oldin ogohlantirish
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (!finished.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const go = async (next: number) => {
    await persist(q, a);
    startedAt.current = Date.now();
    setIndex(next);
    window.scrollTo({ top: 0 });
  };

  const setSelected = (i: number) => {
    setAnswers((prev) => {
      const cur = prev[q.id];
      if (q.multi) {
        const arr = Array.isArray(cur.selected) ? cur.selected : [];
        const next = arr.includes(i) ? arr.filter((x) => x !== i) : [...arr, i];
        return { ...prev, [q.id]: { ...cur, selected: next } };
      }
      return { ...prev, [q.id]: { ...cur, selected: i } };
    });
  };

  const warn = left <= 300;

  return (
    <div className="mesh-bg min-h-screen pb-32">
      <header className="glass sticky top-0 z-20 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{positionTitle}</div>
            <div className="text-xs text-tx2" aria-live="polite">
              {saving === "saving" ? "Saqlanmoqda…" : saving === "error" ? "Saqlanmadi — qayta urinib ko'ring" : "Saqlandi ✓"}
            </div>
          </div>
          <div
            className={`rounded-full px-3 py-1.5 font-mono text-sm font-bold ${warn ? "bg-warn-t text-warn" : "bg-card text-tx"}`}
            aria-label={`Qolgan vaqt ${fmt(left)}`}
          >
            ⏱ {fmt(left)}
          </div>
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 px-4 pb-3" aria-hidden>
          {questions.map((x, i) => (
            <span
              key={x.id}
              className={`h-1.5 flex-1 rounded-full ${i === index ? "bg-br" : i < index ? "bg-navy/60" : "bg-soft"}`}
            />
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6">
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-4 right-0 select-none font-display text-[110px] font-bold leading-none text-transparent opacity-30"
            style={{ WebkitTextStroke: "1.5px var(--line)" }}
          >
            {String(index + 1).padStart(2, "0")}
          </div>
          <p className="relative text-xs font-bold uppercase tracking-wide text-brd">
            {q.section} · Savol {index + 1} / {questions.length}
          </p>
          <h1 className="relative mt-2 text-xl font-bold leading-snug sm:text-2xl">{q.stem}</h1>
          {q.type === "MCQ_MULTI" || (q.multi && q.type === "MCQ_SINGLE") ? (
            <p className="relative mt-1 text-sm text-tx2">Bir nechtasini tanlang.</p>
          ) : null}
        </div>

        {q.type === "OPEN" ? (
          <div className="mt-6">
            <textarea
              value={a.text}
              onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: { ...p[q.id], text: e.target.value } }))}
              onBlur={() => persist(q, a)}
              onPaste={() => void logSignal(token, "paste")}
              rows={8}
              maxLength={5000}
              className="w-full rounded-2xl border border-line bg-card p-4 text-[15px] leading-relaxed outline-none focus:border-br focus:ring-2 focus:ring-br/30"
              placeholder="Javobingizni yozing…"
              aria-label="Javob"
            />
            <div className="mt-1 text-right text-xs text-tx2">{a.text.trim() ? a.text.trim().split(/\s+/).length : 0} so'z</div>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-3" role={q.multi ? "group" : "radiogroup"} aria-label="Variantlar">
            {q.options.map((opt, pos) => {
              const i = opt.idx;
              const checked = Array.isArray(a.selected) ? a.selected.includes(i) : a.selected === i;
              return (
                <li key={i}>
                  <button
                    type="button"
                    role={q.multi ? "checkbox" : "radio"}
                    aria-checked={checked}
                    onClick={() => setSelected(i)}
                    className={`flex min-h-14 w-full items-start gap-3 rounded-2xl border p-4 text-left text-[15px] leading-snug ${
                      checked ? "border-br bg-tint ring-2 ring-br" : "border-line bg-card hover:border-br/60"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border text-xs font-bold ${
                        q.multi ? "rounded-md" : "rounded-full"
                      } ${checked ? "border-br bg-br text-[#1a0c02]" : "border-line"}`}
                    >
                      {checked ? "✓" : String.fromCharCode(65 + pos)}
                    </span>
                    <span>{opt.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <nav className="glass fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-xl items-center gap-2 rounded-full p-2 shadow-soft" aria-label="Test boshqaruvi">
        <button
          onClick={() => go(index - 1)}
          disabled={index === 0 || pending}
          className="h-12 rounded-full px-5 text-sm font-bold text-tx2 disabled:opacity-40"
        >
          ← Oldingi
        </button>
        <span className="flex-1 text-center text-xs font-semibold text-tx2">
          {answeredCount} / {questions.length} javob
        </span>
        {isLast ? (
          <button
            onClick={() => setConfirmFinish(true)}
            disabled={pending}
            className="h-12 rounded-full bg-br px-6 text-sm font-bold text-[#1a0c02] disabled:opacity-60"
          >
            Yakunlash
          </button>
        ) : (
          <button
            onClick={() => go(index + 1)}
            disabled={pending}
            className="h-12 rounded-full bg-br px-6 text-sm font-bold text-[#1a0c02] disabled:opacity-60"
          >
            Keyingi →
          </button>
        )}
      </nav>

      {confirmFinish && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="fin-title">
          <div className="w-full max-w-md rounded-[24px] bg-card p-6 shadow-soft">
            <h2 id="fin-title" className="text-lg font-bold">Testni yakunlaysizmi?</h2>
            <p className="mt-2 text-sm text-tx2">
              {questions.length - answeredCount > 0
                ? `${questions.length - answeredCount} ta savol javobsiz qoldi. `
                : ""}
              Yakunlagandan keyin javoblarni o'zgartirib bo'lmaydi.
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmFinish(false)} className="h-12 flex-1 rounded-full bg-soft text-sm font-bold">
                Qaytish
              </button>
              <button onClick={submit} disabled={pending} className="h-12 flex-1 rounded-full bg-br text-sm font-bold text-[#1a0c02] disabled:opacity-60">
                {pending ? "Yuborilmoqda…" : "Yakunlash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

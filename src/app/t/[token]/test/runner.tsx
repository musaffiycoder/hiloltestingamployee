"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { finishAttempt, logSignal, saveResponse } from "../actions";
import { Check, ChevronLeft, ChevronRight, Flag, LayoutGrid } from "lucide-react";
import { Ico } from "@/components/ui";

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
  const [showMap, setShowMap] = useState(false);
  const [marked, setMarked] = useState<Set<string>>(new Set());
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
  const unanswered = questions.length - answeredCount;
  const nextOpen = () => {
    for (let k = 1; k <= questions.length; k++) {
      const j = (index + k) % questions.length;
      if (!isAnswered(questions[j])) return j;
    }
    return -1;
  };

  const persist = useCallback(
    async (question: RunnerQuestion, ans: Answer) => {
      setSaving("saving");
      try {
        const now = Date.now();
        const delta = Math.min(now - startedAt.current, 20 * 60 * 1000);
        startedAt.current = now;
        const res = await saveResponse(token, {
          questionId: question.id,
          selected: ans.selected,
          text: ans.text,
          timeMs: delta,
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
    try {
      const raw = sessionStorage.getItem(`marked:${token}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage faqat mount'dan keyin o'qiladi
      if (raw) setMarked(new Set(JSON.parse(raw) as string[]));
    } catch {}
  }, [token]);

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
    if (next < 0 || next >= questions.length) return;
    setShowMap(false);
    await persist(q, a);
    startedAt.current = Date.now();
    setIndex(next);
    window.scrollTo({ top: 0 });
  };

  const isAnswered = (x: RunnerQuestion) => {
    const v = answers[x.id];
    return !!v && (Array.isArray(v.selected) ? v.selected.length > 0 : v.selected !== null || v.text.trim().length > 0);
  };
  const toggleMark = () =>
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(q.id)) next.delete(q.id);
      else next.add(q.id);
      try {
        sessionStorage.setItem(`marked:${token}`, JSON.stringify([...next]));
      } catch {}
      return next;
    });

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
    <div className="mesh-bg min-h-screen pb-28">
      {/* iOS navigatsiya paneli + progress */}
      <header className="glass sticky top-0 z-20 border-x-0 border-t-0">
        <div className="mx-auto flex h-12 max-w-2xl items-center gap-3 px-4">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{positionTitle}</div>
            <div className="text-[11px] text-tx2" aria-live="polite">
              {saving === "saving" ? "Saqlanmoqda…" : saving === "error" ? "Saqlanmadi — qayta urinib ko'ring" : <>Saqlandi <Ico icon={Check} size={12} /></>}
            </div>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-[15px] font-semibold tabular-nums ${warn ? "bg-warn-t text-warn" : "bg-soft text-tx"}`}
            aria-label={`Qolgan vaqt ${fmt(left)}`}
          >
            {fmt(left)}
          </div>
        </div>
        <div className="h-0.5 w-full bg-soft" aria-hidden>
          <div className="h-full bg-br transition-[width] duration-300" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-6">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-tx2">
            {q.section} · {index + 1} / {questions.length}
          </p>
          <button
            type="button"
            onClick={toggleMark}
            aria-pressed={marked.has(q.id)}
            className={`h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold ${marked.has(q.id) ? "bg-brf text-onbr" : "bg-soft text-tx2"}`}
          >
            {marked.has(q.id) ? (
              <>
                <Ico icon={Flag} size={14} className="mr-1 fill-current" />Belgilandi
              </>
            ) : (
              <>
                <Ico icon={Flag} size={14} className="mr-1" />Keyinroq qaytaman
              </>
            )}
          </button>
        </div>
        <h1 className="mt-2 px-1 text-[22px] font-semibold leading-snug">{q.stem}</h1>
        {q.multi && q.type !== "OPEN" && <p className="mt-1 px-1 text-[15px] text-tx2">Bir nechtasini tanlang.</p>}

        {q.type === "OPEN" ? (
          <div className="mt-5">
            <textarea
              value={a.text}
              onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: { ...p[q.id], text: e.target.value } }))}
              onBlur={() => persist(q, a)}
              onPaste={() => void logSignal(token, "paste")}
              rows={8}
              maxLength={5000}
              className="w-full rounded-2xl bg-card p-4 text-[17px] leading-relaxed outline-none focus:ring-2 focus:ring-br/40"
              placeholder="Javobingizni yozing…"
              aria-label="Javob"
            />
            <div className="mt-1 px-1 text-right text-[13px] text-tx2">
              {a.text.trim() ? a.text.trim().split(/\s+/).length : 0} so'z
            </div>
          </div>
        ) : (
          /* iOS inset grouped ro'yxat: qatorlar hairline bilan ajratilgan, tanlangan qatorda belgi */
          <ul className="mt-5 overflow-hidden rounded-2xl bg-card" role={q.multi ? "group" : "radiogroup"} aria-label="Variantlar">
            {q.options.map((opt, pos) => {
              const i = opt.idx;
              const checked = Array.isArray(a.selected) ? a.selected.includes(i) : a.selected === i;
              return (
                <li key={i} className={pos < q.options.length - 1 ? "border-b border-line" : ""}>
                  <button
                    type="button"
                    role={q.multi ? "checkbox" : "radio"}
                    aria-checked={checked}
                    onClick={() => setSelected(i)}
                    className={`flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left text-[17px] leading-snug ${
                      checked ? "bg-tint/60" : ""
                    }`}
                  >
                    <span className="flex-1">{opt.text}</span>
                    <span
                      aria-hidden
                      className={`flex h-6 w-6 shrink-0 items-center justify-center text-lg font-bold text-brd ${
                        checked ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <Check size={20} strokeWidth={2.6} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* Pastki toolbar */}
      <nav className="glass fixed inset-x-0 bottom-0 z-30 border-x-0 border-b-0" aria-label="Test boshqaruvi"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 pt-2">
          <button
            onClick={() => go(index - 1)}
            disabled={index === 0 || pending}
            className="h-11 rounded-full px-3 text-[17px] font-medium text-brd disabled:opacity-30"
          >
            <Ico icon={ChevronLeft} size={18} /> Oldingi
          </button>
          <button
            onClick={() => setShowMap(true)}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-soft text-[15px] font-semibold"
            aria-label="Barcha savollar ro'yxati"
          >
            <LayoutGrid size={18} aria-hidden />
            <span>
              {answeredCount} / {questions.length}
            </span>
            {marked.size > 0 && (
              <span className="inline-flex items-center gap-1 text-brd">
                <Ico icon={Flag} size={14} className="fill-current" />
                {marked.size}
              </span>
            )}
          </button>
          {isLast ? (
            <button
              onClick={() => (unanswered > 0 ? setShowMap(true) : setConfirmFinish(true))}
              disabled={pending}
              className="h-11 rounded-full bg-brf px-5 text-[17px] font-semibold text-onbr disabled:opacity-50"
            >
              Yakunlash
            </button>
          ) : (
            <button
              onClick={() => go(index + 1)}
              disabled={pending}
              className="h-11 rounded-full bg-brf px-5 text-[17px] font-semibold text-onbr disabled:opacity-50"
            >
              Keyingi <Ico icon={ChevronRight} size={18} />
            </button>
          )}
        </div>
      </nav>

      {showMap && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label="Savollar xaritasi" onClick={() => setShowMap(false)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[22px] bg-card p-5 sm:rounded-[22px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">Savollar</h2>
              <button onClick={() => setShowMap(false)} className="h-9 rounded-full bg-soft px-4 text-[15px] font-semibold">Yopish</button>
            </div>
            <p className="mt-1 text-[13px] text-tx2">Istalgan savolga o'ting — qiyin savolni qoldirib, keyin qaytishingiz mumkin. Javoblar avtomatik saqlanadi.</p>
            <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-8">
              {questions.map((x, i) => {
                const ans = isAnswered(x);
                const mk = marked.has(x.id);
                return (
                  <button
                    key={x.id}
                    onClick={() => go(i)}
                    aria-label={`Savol ${i + 1}${ans ? ", javob berilgan" : ", javobsiz"}${mk ? ", belgilangan" : ""}`}
                    className={`relative flex h-11 items-center justify-center rounded-xl text-[15px] font-semibold tabular-nums ${
                      i === index ? "ring-2 ring-brf" : ""
                    } ${ans ? "bg-tint text-brd" : "bg-soft text-tx"}`}
                  >
                    {i + 1}
                    {mk && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brf text-onbr" aria-hidden><Flag size={9} strokeWidth={3} className="fill-current" /></span>}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-tx2">
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-tint align-middle" />javob berilgan</span>
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-soft align-middle" />javobsiz</span>
              <span><Ico icon={Flag} size={12} className="mr-1 fill-current text-brd" />keyinroq qaytaman</span>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              {nextOpen() !== -1 && (
                <button onClick={() => go(nextOpen())} className="h-12 rounded-full bg-tint text-[17px] font-semibold text-brd">
                  Keyingi javobsiz savolga
                </button>
              )}
              <button
                onClick={() => {
                  setShowMap(false);
                  setConfirmFinish(true);
                }}
                className="h-12 rounded-full bg-brf text-[17px] font-semibold text-onbr"
              >
                Testni yakunlash{unanswered > 0 ? ` (${unanswered} ta javobsiz)` : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmFinish && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="fin-title">
          <div className="w-full max-w-sm overflow-hidden rounded-[22px] bg-card">
            <div className="p-5 text-center">
              <h2 id="fin-title" className="text-[17px] font-semibold">Testni yakunlaysizmi?</h2>
              <p className="mt-1 text-[15px] text-tx2">
                {questions.length - answeredCount > 0 ? `${questions.length - answeredCount} ta savol javobsiz qoldi. ` : ""}
                Yakunlagandan keyin javoblarni o'zgartirib bo'lmaydi.
              </p>
            </div>
            <div className="grid grid-cols-2 border-t border-line text-[17px]">
              <button onClick={() => setConfirmFinish(false)} className="h-12 border-r border-line font-medium text-brd">
                Qaytish
              </button>
              <button onClick={submit} disabled={pending} className="h-12 font-semibold text-brd disabled:opacity-50">
                {pending ? "Yuborilmoqda…" : "Yakunlash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

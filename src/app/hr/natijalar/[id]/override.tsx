"use client";

import { useState, useTransition } from "react";
import { overrideResponse } from "./actions";

const SCORES = [0, 0.25, 0.5, 0.75, 1];
const REASONS = ["Rubrika bo'yicha", "Avto-baho xato", "Qo'shimcha kontekst", "Boshqa"];

export function OverrideButton({ responseId, current }: { responseId: string; current: number | null }) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<number | null>(current);
  const [reason, setReason] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  const save = () => {
    if (score === null || !reason) return;
    const fd = new FormData();
    fd.set("responseId", responseId);
    fd.set("score", String(score));
    fd.set("reason", reason);
    start(async () => {
      await overrideResponse(fd);
      setOpen(false);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    });
  };

  const chip = (on: boolean) =>
    `min-h-10 rounded-full px-4 text-sm font-bold ${on ? "bg-brf text-onbr" : "bg-soft text-tx"}`;

  return (
    <>
      <button onClick={() => setOpen(true)} className="min-h-9 rounded-full bg-soft px-3 text-xs font-bold hover:brightness-95">
        Qo'lda o'zgartirish
      </button>
      {done && (
        <div role="status" className="glass fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-bold md:bottom-6">
          O'zgarish saqlandi ✓ · tarixda qayd etildi
        </div>
      )}
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`ov-${responseId}`}
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-md rounded-[24px] bg-card p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
            <h3 id={`ov-${responseId}`} className="text-lg font-bold">Qo'lda o'zgartirish</h3>
            <div className="mt-4 text-xs font-bold uppercase tracking-wide text-tx2">Yangi ball</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {SCORES.map((s) => (
                <button key={s} onClick={() => setScore(s)} className={chip(score === s)}>
                  {Math.round(s * 100)}%
                </button>
              ))}
            </div>
            <div className="mt-4 text-xs font-bold uppercase tracking-wide text-tx2">Sabab (majburiy)</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)} className={chip(reason === r)}>
                  {r}
                </button>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setOpen(false)} className="h-12 flex-1 rounded-full bg-soft text-sm font-bold">
                Bekor qilish
              </button>
              <button
                onClick={save}
                disabled={score === null || !reason || pending}
                className="h-12 flex-1 rounded-full bg-br text-sm font-bold text-onbr disabled:opacity-50"
              >
                {pending ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

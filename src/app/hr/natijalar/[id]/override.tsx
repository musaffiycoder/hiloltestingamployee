"use client";

import { useState, useTransition } from "react";
import { overrideResponse } from "./actions";
import { Check, CircleCheck } from "lucide-react";
import { Ico } from "@/components/ui";

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

  const canSave = score !== null && reason !== null && !pending;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-9 rounded-full bg-tint px-4 text-[15px] font-semibold text-brd"
      >
        Qo'lda o'zgartirish
      </button>
      {done && (
        <div role="status" className="glass fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[15px] font-medium md:bottom-6">
          <Ico icon={CircleCheck} className="mr-1" />
          O'zgarish saqlandi · tarixda qayd etildi
        </div>
      )}
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`ov-${responseId}`}
          onClick={() => setOpen(false)}
        >
          {/* iOS modal sheet: yuqorida Bekor qilish / sarlavha / Saqlash */}
          <div
            className="w-full max-w-md overflow-hidden rounded-t-[22px] bg-bg sm:rounded-[22px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-tx2/30 sm:hidden" aria-hidden />
            <div className="grid grid-cols-[1fr_auto_1fr] items-center px-3 pb-2 pt-2">
              <button onClick={() => setOpen(false)} className="justify-self-start px-2 py-2 text-[17px] text-brd">
                Bekor qilish
              </button>
              <h3 id={`ov-${responseId}`} className="text-[17px] font-semibold">
                Qo'lda o'zgartirish
              </h3>
              <button
                onClick={save}
                disabled={!canSave}
                className="justify-self-end px-2 py-2 text-[17px] font-semibold text-brd disabled:opacity-35"
              >
                {pending ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            </div>

            <div className="flex flex-col gap-5 px-4 pb-6 pt-2">
              <div>
                <div className="mb-2 px-4 text-[13px] font-semibold uppercase tracking-wide text-tx2">Yangi ball</div>
                <div className="grid grid-cols-5 rounded-[10px] bg-soft p-0.5" role="radiogroup" aria-label="Yangi ball">
                  {SCORES.map((s) => (
                    <button
                      key={s}
                      role="radio"
                      aria-checked={score === s}
                      onClick={() => setScore(s)}
                      className={`rounded-lg py-1.5 text-[13px] font-semibold tabular-nums ${
                        score === s ? "bg-card shadow-[0_1px_3px_rgba(0,0,0,0.18)]" : ""
                      }`}
                    >
                      {Math.round(s * 100)}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 px-4 text-[13px] font-semibold uppercase tracking-wide text-tx2">Sabab (majburiy)</div>
                <ul className="overflow-hidden rounded-2xl bg-card" role="radiogroup" aria-label="Sabab">
                  {REASONS.map((r, i) => (
                    <li key={r} className={i < REASONS.length - 1 ? "border-b border-line" : ""}>
                      <button
                        role="radio"
                        aria-checked={reason === r}
                        onClick={() => setReason(r)}
                        className="flex min-h-12 w-full items-center justify-between px-4 text-left text-[17px]"
                      >
                        {r}
                        <Check size={18} strokeWidth={2.6} aria-hidden className={`shrink-0 text-brd ${reason === r ? "" : "opacity-0"}`} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitCalibration } from "./actions";

const SCORES = [0, 0.25, 0.5, 0.75, 1] as const;

export function Rater({ responseId }: { responseId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (picked === null) return;
    setError(null);
    start(async () => {
      try {
        const r = await submitCalibration({ responseId, score: picked });
        if (!r.ok) return setError("Saqlanmadi");
        setPicked(null);
        router.refresh();
      } catch {
        setError("Saqlab bo'lmadi (ruxsat yoki ulanishni tekshiring)");
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 rounded-[10px] bg-soft p-0.5" role="radiogroup" aria-label="Baho">
        {SCORES.map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={picked === s}
            onClick={() => setPicked(s)}
            className={`rounded-lg py-2 text-[15px] font-semibold tabular-nums ${picked === s ? "bg-card shadow-[0_1px_3px_rgba(0,0,0,0.18)]" : ""}`}
          >
            {Math.round(s * 100)}%
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-[13px] font-medium text-bad">{error}</p>}
      <button
        onClick={save}
        disabled={picked === null || pending}
        className="h-[50px] rounded-full bg-brf text-[17px] font-semibold text-onbr disabled:opacity-40"
      >
        {pending ? "Saqlanmoqda…" : "Saqlash va keyingisi"}
      </button>
    </div>
  );
}

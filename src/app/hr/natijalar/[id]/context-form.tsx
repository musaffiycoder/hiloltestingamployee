"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveContext } from "./actions";

export function ContextForm({ attemptId, initial, canWrite }: { attemptId: string; initial: string; canWrite: boolean }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!canWrite}
        rows={5}
        maxLength={4000}
        placeholder="Masalan: oxirgi chorakdagi code review natijalari, incidentlar, rahbar bahosi, KPI. AI tahlil buni test natijasi bilan solishtiradi."
        className="w-full rounded-2xl bg-card p-4 text-[15px] leading-relaxed outline-none focus:ring-2 focus:ring-br/40"
      />
      {canWrite && (
        <div className="flex items-center gap-3">
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveContext(attemptId, text);
                setMsg(r.ok ? "Saqlandi. Tahlilni yangilasangiz, hisobga olinadi." : r.message);
                router.refresh();
              })
            }
            className="h-10 rounded-full bg-tint px-5 text-[15px] font-semibold text-brd disabled:opacity-50"
          >
            {pending ? "Saqlanmoqda…" : "Kontekstni saqlash"}
          </button>
          {msg && <span className="text-[13px] text-tx2">{msg}</span>}
        </div>
      )}
    </div>
  );
}

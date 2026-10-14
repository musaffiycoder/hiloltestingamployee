"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ico } from "@/components/ui";
import type { VerdictKey } from "@/lib/scoring";
import { Check, ChevronRight, Flag, Hourglass } from "lucide-react";

export type Row = {
  attemptId: string;
  name: string;
  initials: string;
  position: string;
  pct: number;
  verdict: VerdictKey;
  flags: number;
  needsReview: boolean;
  decision: string | null;
  date: string;
  mode: "RECRUITING" | "EVALUATION";
  criticalFail: boolean;
};

function SelectDot({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] text-xs font-bold ${
        on ? "border-brf bg-brf text-onbr" : "border-tx2/50"
      }`}
    >
      {on ? <Check size={14} strokeWidth={3} aria-hidden /> : null}
    </button>
  );
}

export function ResultsView({ rows, view }: { rows: Row[]; view: "table" | "cards" }) {
  const router = useRouter();
  const [sel, setSel] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 3 ? s : [...s, id]));

  return (
    <div className="flex flex-col gap-3">
      {sel.length > 0 && (
        <div className="glass sticky top-14 z-10 flex items-center gap-2 rounded-2xl px-4 py-2">
          <span className="flex-1 text-[15px] font-semibold">{sel.length} ta tanlandi (max 3)</span>
          <button onClick={() => setSel([])} className="h-9 rounded-full px-3 text-[15px] text-brd">
            Bekor qilish
          </button>
          <button
            onClick={() => router.push(`/hr/taqqoslash?ids=${sel.join(",")}`)}
            disabled={sel.length < 2}
            className="h-9 rounded-full bg-brf px-4 text-[15px] font-semibold text-onbr disabled:opacity-40"
          >
            Taqqoslash
          </button>
        </div>
      )}

      {view === "table" ? (
        <ul className="overflow-hidden rounded-2xl bg-card">
          {rows.map((r, i) => {
            const on = sel.includes(r.attemptId);
            return (
              <li
                key={r.attemptId}
                className={`flex items-center gap-3 px-4 py-3 ${i < rows.length - 1 ? "border-b border-line" : ""}`}
              >
                <SelectDot on={on} label={`${r.name} ni taqqoslash uchun tanlash`} onClick={() => toggle(r.attemptId)} />
                <Link href={`/hr/natijalar/${r.attemptId}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-soft text-[13px] font-semibold">
                    {r.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-semibold">
                      {r.name}
                      {r.mode === "EVALUATION" && (
                        <span className="ml-2 rounded-full bg-soft px-2 py-0.5 align-middle text-[11px] font-semibold text-tx2">Xodim</span>
                      )}
                    </span>
                    <span className="block truncate text-[13px] text-tx2">
                      {r.position} · {r.date}
                      {r.flags > 0 && <span className="font-semibold text-bad">
                          {" · "}
                          <Ico icon={Flag} size={13} className="mr-0.5 fill-current" />
                          {r.flags}
                        </span>}
                      {r.flags === 0 && r.needsReview && <span className="font-semibold text-warn">
                          {" · "}
                          <Ico icon={Hourglass} size={13} className="mr-0.5" />
                          ko'rib chiqish
                        </span>}
                    </span>
                  </span>
                  <span className="hidden w-28 items-center gap-2 md:flex" aria-hidden>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft">
                      <span className="block h-full rounded-full bg-br" style={{ width: `${r.pct}%` }} />
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[17px] font-semibold tabular-nums">{Math.round(r.pct)}%</span>
                  </span>
                  <ChevronRight size={18} aria-hidden className="shrink-0 text-tx2" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const on = sel.includes(r.attemptId);
            return (
              <div key={r.attemptId} className={`relative rounded-2xl bg-card p-4 ${on ? "ring-2 ring-br" : ""}`}>
                <div className="absolute right-3 top-3">
                  <SelectDot on={on} label={`${r.name} ni taqqoslash uchun tanlash`} onClick={() => toggle(r.attemptId)} />
                </div>
                <Link href={`/hr/natijalar/${r.attemptId}`} className="block">
                  <div className="flex items-center gap-3 pr-9">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-soft text-[13px] font-semibold">
                      {r.initials}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[17px] font-semibold">
                        {r.name}
                        {r.mode === "EVALUATION" && (
                          <span className="ml-2 rounded-full bg-soft px-2 py-0.5 align-middle text-[11px] font-semibold text-tx2">Xodim</span>
                        )}
                      </div>
                      <div className="truncate text-[13px] text-tx2">
                        {r.position} · {r.date}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft" aria-hidden>
                      <span className="block h-full rounded-full bg-br" style={{ width: `${r.pct}%` }} />
                    </span>
                    <b className="text-[28px] font-bold leading-none tabular-nums">{Math.round(r.pct)}%</b>
                  </div>
                  {(r.flags > 0 || r.needsReview) && (
                    <div className="mt-2 text-[13px] font-semibold">
                      {r.flags > 0 ? (
                        <span className="text-bad">
                          <Ico icon={Flag} size={13} className="mr-1 fill-current" />
                          {r.flags} qizil bayroq
                        </span>
                      ) : (
                        <span className="text-warn">
                          <Ico icon={Hourglass} size={13} className="mr-1" />
                          ko'rib chiqish kerak
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

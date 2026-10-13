"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { VerdictChip } from "@/components/ui";
import type { VerdictKey } from "@/lib/scoring";

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
};

export function ResultsView({ rows, view }: { rows: Row[]; view: "table" | "cards" }) {
  const router = useRouter();
  const [sel, setSel] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 3 ? s : [...s, id]));

  const compare = () => router.push(`/hr/taqqoslash?ids=${sel.join(",")}`);

  return (
    <div className="flex flex-col gap-3">
      {sel.length > 0 && (
        <div className="glass sticky top-20 z-10 flex items-center gap-3 rounded-2xl px-4 py-2.5">
          <span className="flex-1 text-sm font-bold">{sel.length} ta tanlandi (max 3)</span>
          <button
            onClick={() => setSel([])}
            className="min-h-10 rounded-full px-3 text-sm font-semibold text-tx2 hover:bg-soft"
          >
            Bekor qilish
          </button>
          <button
            onClick={compare}
            disabled={sel.length < 2}
            className="min-h-10 rounded-full bg-br px-4 text-sm font-bold text-[#1a0c02] disabled:opacity-50"
          >
            Taqqoslash
          </button>
        </div>
      )}

      {view === "table" ? (
        <div className="overflow-x-auto rounded-[18px] border border-line bg-card shadow-soft">
          <div className="min-w-[720px] divide-y divide-line">
            {rows.map((r) => {
              const on = sel.includes(r.attemptId);
              return (
                <div key={r.attemptId} className="flex items-center gap-3 px-4 py-3 hover:bg-soft/50">
                  <button
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`${r.name} ni taqqoslash uchun tanlash`}
                    onClick={() => toggle(r.attemptId)}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${
                      on ? "border-br bg-br text-[#1a0c02]" : "border-line"
                    }`}
                  >
                    {on ? "✓" : ""}
                  </button>
                  <Link href={`/hr/natijalar/${r.attemptId}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-soft text-xs font-bold">
                      {r.initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{r.name}</span>
                      <span className="block truncate text-xs text-tx2">{r.position}</span>
                    </span>
                  </Link>
                  <div className="flex w-36 items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-soft">
                      <div className="h-full rounded-full bg-br" style={{ width: `${r.pct}%` }} />
                    </div>
                    <b className="w-10 text-right text-sm">{Math.round(r.pct)}%</b>
                  </div>
                  <div className="w-44"><VerdictChip verdict={r.verdict} /></div>
                  <span className="w-20 text-xs font-bold text-bad">
                    {r.flags > 0 ? `⚑ ${r.flags} bayroq` : r.needsReview ? <span className="text-warn">◔ ko'rib chiqish</span> : ""}
                  </span>
                  <span className="w-16 text-right text-xs text-tx2">{r.date}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const on = sel.includes(r.attemptId);
            return (
              <div
                key={r.attemptId}
                className={`relative rounded-[18px] border bg-card p-4 shadow-soft ${on ? "border-br ring-2 ring-br" : "border-line"}`}
              >
                <button
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`${r.name} ni taqqoslash uchun tanlash`}
                  onClick={() => toggle(r.attemptId)}
                  className={`absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold ${
                    on ? "border-br bg-br text-[#1a0c02]" : "border-line"
                  }`}
                >
                  {on ? "✓" : ""}
                </button>
                <Link href={`/hr/natijalar/${r.attemptId}`} className="block">
                  <div className="flex items-center gap-3 pr-8">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-soft text-xs font-bold">{r.initials}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{r.name}</div>
                      <div className="truncate text-xs text-tx2">{r.position}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <VerdictChip verdict={r.verdict} />
                    <b className="font-display text-2xl">{Math.round(r.pct)}%</b>
                  </div>
                  {(r.flags > 0 || r.needsReview) && (
                    <div className="mt-2 text-xs font-bold text-bad">
                      {r.flags > 0 ? `⚑ ${r.flags} qizil bayroq` : <span className="text-warn">◔ ko'rib chiqish kerak</span>}
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

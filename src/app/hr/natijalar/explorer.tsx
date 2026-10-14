"use client";

import Link from "next/link";
import { Search, SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ResultsView, type Row } from "./results-view";

type VKey = "all" | "flags" | "critical" | "review";
type ModeKey = "all" | "RECRUITING" | "EVALUATION";

const VERDICT_FILTERS: { key: VKey; label: string; test: (r: Row) => boolean }[] = [
  { key: "all", label: "Barchasi", test: () => true },
  { key: "flags", label: "Qizil bayroqli", test: (r) => r.flags > 0 },
  { key: "critical", label: "Kritik kompetensiya past", test: (r) => r.criticalFail },
  { key: "review", label: "Ko'rib chiqish kerak", test: (r) => r.needsReview },
];

const MODES: { key: ModeKey; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "RECRUITING", label: "Nomzodlar" },
  { key: "EVALUATION", label: "Xodimlar" },
];

/** Hamma natija bir marta yuklanadi; filtr, qidiruv va ko'rinish brauzerda — darhol ishlaydi. */
export function Explorer({ rows, initialFilter }: { rows: Row[]; initialFilter: VKey }) {
  const [mode, setMode] = useState<ModeKey>("all");
  const [vf, setVf] = useState<VKey>(initialFilter);
  const [q, setQ] = useState("");
  // Standart — kartochka; foydalanuvchi tanlovi brauzerda eslab qolinadi
  const [view, setViewState] = useState<"table" | "cards">("cards");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem("baholash_results_view") === "table") setViewState("table");
    } catch {}
  }, []);
  const setView = (v: "table" | "cards") => {
    setViewState(v);
    try {
      localStorage.setItem("baholash_results_view", v);
    } catch {}
  };

  const needle = q.trim().toLowerCase();
  const base = useMemo(
    () =>
      rows.filter(
        (r) =>
          (mode === "all" || r.mode === mode) &&
          (!needle || r.name.toLowerCase().includes(needle) || r.position.toLowerCase().includes(needle)),
      ),
    [rows, mode, needle],
  );
  const counts = useMemo(() => Object.fromEntries(VERDICT_FILTERS.map((f) => [f.key, base.filter(f.test).length])), [base]);
  const shown = useMemo(() => base.filter(VERDICT_FILTERS.find((f) => f.key === vf)!.test), [base, vf]);

  const nCand = rows.filter((r) => r.mode === "RECRUITING").length;
  const nEmp = rows.length - nCand;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:max-w-md md:flex-1">
          <Search size={17} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tx2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ism yoki lavozim bo'yicha qidirish"
            aria-label="Qidirish"
            className="h-10 w-full rounded-[10px] bg-soft pl-9 pr-3 text-[17px] outline-none placeholder:text-tx2"
          />
        </div>
        <div className="grid grid-cols-3 rounded-[10px] bg-soft p-0.5 md:w-80" role="group" aria-label="Kimlar">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              aria-pressed={mode === m.key}
              className={`rounded-lg py-1.5 text-center text-[13px] font-semibold ${mode === m.key ? "bg-card shadow-[0_1px_3px_rgba(0,0,0,0.18)]" : ""}`}
            >
              {m.label}
              <span className="ml-1 text-tx2">{m.key === "all" ? rows.length : m.key === "RECRUITING" ? nCand : nEmp}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 rounded-[10px] bg-soft p-0.5 md:ml-auto md:w-56" role="group" aria-label="Ko'rinish">
          {(
            [
              ["cards", "Kartochka"],
              ["table", "Ro'yxat"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              aria-pressed={view === k}
              className={`rounded-lg py-1.5 text-center text-[13px] font-semibold ${view === k ? "bg-card shadow-[0_1px_3px_rgba(0,0,0,0.18)]" : ""}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0 [scrollbar-width:none]">
        {VERDICT_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setVf(f.key)}
            aria-pressed={vf === f.key}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium ${
              vf === f.key ? "bg-brf text-onbr" : "bg-card text-tx"
            }`}
          >
            {f.label}
            <span className={vf === f.key ? "opacity-70" : "text-tx2"}>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-10 text-center">
          <SearchX size={34} strokeWidth={1.8} className="text-tx2" aria-hidden />
          <div className="text-[17px] font-semibold">{rows.length === 0 ? "Hali natija yo'q" : "Mos natija topilmadi"}</div>
          <p className="text-[15px] text-tx2">
            {rows.length === 0 ? "Birinchi taklifni yuboring — natijalar shu yerda paydo bo'ladi." : "Filtr yoki qidiruvni o'zgartirib ko'ring."}
          </p>
          {rows.length === 0 && (
            <Link href="/hr/takliflar" className="inline-flex h-11 items-center rounded-full bg-brf px-6 text-[17px] font-semibold text-onbr">
              Taklif yuborish
            </Link>
          )}
        </div>
      ) : (
        <ResultsView rows={shown} view={view} />
      )}
    </div>
  );
}

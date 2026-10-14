"use client";

import { useMemo, useState } from "react";
import { Search, SearchX, ShieldAlert, TriangleAlert } from "lucide-react";
import { Card, Ico, LevelChip, SectionTitle } from "@/components/ui";

export type CompetencyCard = {
  id: string;
  code: string;
  name: string;
  type: string;
  target: number;
  weight: number;
  critical: boolean;
  derived: boolean;
  counts: number[];
};
export type PositionCard = { code: string; title: string; competencies: CompetencyCard[] };

/** Faol savoli shundan kam kompetensiya — «savoli kam». */
const LOW = 3;

const chip = (on: boolean) =>
  `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium ${on ? "bg-brf text-onbr" : "bg-card text-tx"}`;

export function PositionsBrowser({ positions }: { positions: PositionCard[] }) {
  const [pos, setPos] = useState("all");
  const [q, setQ] = useState("");
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [onlyLow, setOnlyLow] = useState(false);
  const [kind, setKind] = useState<"all" | "soft" | "hard">("all");

  const needle = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      positions
        .filter((p) => pos === "all" || p.code === pos)
        .map((p) => ({
          ...p,
          competencies: p.competencies.filter((c) => {
            const total = c.counts.reduce((s, n) => s + n, 0);
            return (
              (!needle || c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle) || p.title.toLowerCase().includes(needle)) &&
              (!onlyCritical || c.critical) &&
              (!onlyLow || total < LOW) &&
              (kind === "all" || c.type.toLowerCase() === kind)
            );
          }),
        }))
        .filter((p) => p.competencies.length > 0),
    [positions, pos, needle, onlyCritical, onlyLow, kind],
  );
  const nComp = shown.reduce((s, p) => s + p.competencies.length, 0);
  const anyFilter = pos !== "all" || needle || onlyCritical || onlyLow || kind !== "all";

  return (
    <div className="flex flex-col gap-6">
      <header className="px-1">
        <h2 className="text-[34px] font-bold leading-tight">Lavozim kartalari</h2>
        <p className="mt-1 text-[15px] text-tx2">
          Talab darajasi, vazn va faol savollar qamrovi. <span className="text-brd">†</span> — yo'riqnomadan olingan, tasdiqlash kutilmoqda.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <div className="relative md:max-w-md">
          <Search size={17} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tx2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Kompetensiya nomi yoki kodi"
            aria-label="Kompetensiyani qidirish"
            className="h-10 w-full rounded-[10px] bg-soft pl-9 pr-3 text-[17px] outline-none placeholder:text-tx2"
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Lavozim">
          <button onClick={() => setPos("all")} aria-pressed={pos === "all"} className={chip(pos === "all")}>
            Hammasi
          </button>
          {positions.map((p) => (
            <button key={p.code} onClick={() => setPos(p.code)} aria-pressed={pos === p.code} className={chip(pos === p.code)}>
              {p.title}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-[10px] bg-soft p-0.5" role="group" aria-label="Ko'nikma turi">
            {(
              [
                ["all", "Hammasi"],
                ["soft", "Soft"],
                ["hard", "Hard"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${kind === k ? "bg-card shadow-[0_1px_3px_rgba(0,0,0,0.18)]" : "text-tx2"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <button onClick={() => setOnlyCritical((v) => !v)} aria-pressed={onlyCritical} className={chip(onlyCritical)}>
            <ShieldAlert size={15} aria-hidden /> Faqat kritik
          </button>
          <button onClick={() => setOnlyLow((v) => !v)} aria-pressed={onlyLow} className={chip(onlyLow)}>
            <TriangleAlert size={15} aria-hidden /> Savoli kam (&lt;{LOW})
          </button>
          {anyFilter && (
            <button
              onClick={() => {
                setPos("all");
                setQ("");
                setOnlyCritical(false);
                setOnlyLow(false);
                setKind("all");
              }}
              className="h-9 px-2 text-[15px] font-medium text-brd"
            >
              Tozalash
            </button>
          )}
          <span className="ml-auto text-[13px] text-tx2">{nComp} ta kompetensiya</span>
        </div>
      </div>

      {shown.length === 0 && (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <SearchX size={34} strokeWidth={1.8} className="text-tx2" aria-hidden />
          <div className="font-semibold">Mos kompetensiya topilmadi</div>
          <p className="text-sm text-tx2">Filtrlarni o'zgartiring yoki tozalang.</p>
        </Card>
      )}

      {shown.map((p) => {
        const all = positions.find((x) => x.code === p.code)!;
        const total = all.competencies.reduce((s, c) => s + c.counts.reduce((a, b) => a + b, 0), 0);
        return (
          <section key={p.code}>
            <SectionTitle aside={<span className="text-[13px] text-tx2">{total} faol savol</span>}>{p.title}</SectionTitle>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {p.competencies.map((c) => {
                const n = c.counts.reduce((s, x) => s + x, 0);
                return (
                  <Card key={c.id} className="flex flex-col p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-md bg-tint px-1.5 py-0.5 font-mono text-[12px] font-semibold text-brd">{c.code}</span>
                      <div className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">
                        {c.name}
                        {c.derived && (
                          <span title="Yo'riqnomadan olingan, tasdiqlash kerak" className="ml-1 text-brd">
                            †
                          </span>
                        )}
                      </div>
                      <LevelChip level={c.target} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-tx2">
                      <span>vazn {c.weight}%</span>
                      <span>{c.type === "SOFT" ? "soft" : "hard"}</span>
                      {c.critical && (
                        <span className="font-semibold text-bad">
                          <Ico icon={ShieldAlert} size={12} className="mr-0.5" />
                          kritik
                        </span>
                      )}
                      <span className={n < LOW ? "font-semibold text-warn" : ""}>{n} faol savol</span>
                    </div>
                    <div className="mt-auto flex items-center gap-1 pt-3" aria-label="Savollar soni daraja bo'yicha (1–5)">
                      {c.counts.map((cnt, k) => (
                        <span
                          key={k}
                          title={`${k + 1}-daraja: ${cnt} ta`}
                          className={`flex h-6 flex-1 items-center justify-center rounded-md text-xs font-semibold tabular-nums ${
                            cnt === 0 ? "border border-dashed border-line text-tx2" : "bg-soft"
                          } ${k + 1 === c.target ? "ring-2 ring-br" : ""}`}
                        >
                          {cnt}
                        </span>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
      <p className="px-4 text-[13px] text-tx2">Kataklar — 1–5 darajalar bo'yicha faol savollar soni. Punktir «0» — savol yo'q. Halqa — talab darajasi.</p>
    </div>
  );
}

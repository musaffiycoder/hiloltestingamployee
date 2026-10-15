import type { Metadata } from "next";
import { stemPreview } from "@/components/rich-text";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Flag, Info, ShieldAlert, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Card, Ico, Pill, SectionTitle } from "@/components/ui";
import { Sparkline } from "@/components/svg-charts";
import { aiCosts, departmentAnalytics, employeeGrowth, monthLabel, questionQuality } from "@/lib/analytics";
import { shortDate } from "@/lib/format";
import { QUESTION_TYPE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Analitika" };

const TABS = [
  { key: "bolim", label: "Bo'lim" },
  { key: "xodimlar", label: "Xodimlar rivoji" },
  { key: "savollar", label: "Savollar sifati" },
  { key: "ai", label: "AI xarajatlari" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v)}%`);
const usd = (v: number) => `$${v < 10 ? v.toFixed(2) : Math.round(v)}`;

function Kpi({ l, v, d }: { l: string; v: string; d?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-tx2">{l}</div>
      <div className="mt-1.5 font-display text-[30px] font-bold leading-none text-navy tabular-nums">{v}</div>
      {d && <div className="mt-1 text-[12px] text-tx2">{d}</div>}
    </Card>
  );
}

function Bar({ value, max = 100, tone = "br" }: { value: number; max?: number; tone?: "br" | "bad" | "ok" }) {
  const w = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const c = tone === "bad" ? "bg-bad" : tone === "ok" ? "bg-ok" : "bg-br";
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-soft" aria-hidden>
      <span className={`block h-full rounded-full ${c}`} style={{ width: `${w}%` }} />
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card className="flex items-start gap-3 p-5 text-[15px] text-tx2">
      <Info size={18} aria-hidden className="mt-0.5 shrink-0" />
      <p>{children}</p>
    </Card>
  );
}

async function DepartmentTab() {
  const d = await departmentAnalytics();
  if (!d.total) return <Empty>Hali yakunlangan test yo'q — natijalar paydo bo'lgach, bo'lim kesimi shu yerda ko'rinadi.</Empty>;
  const maxN = Math.max(1, ...d.trend.map((t) => t.n));
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi l="Yakunlangan testlar" v={String(d.total)} />
        <Kpi l="O'rtacha moslik" v={pct(d.avgPct)} d="barcha lavozimlar" />
        <Kpi l="Qizil bayroqli" v={String(d.withFlags)} d="natija" />
        <Kpi l="Faol lavozimlar" v={String(d.rows.filter((r) => r.n > 0).length)} d={`jami ${d.rows.length}`} />
      </div>

      <section>
        <SectionTitle>Lavozimlar bo'yicha</SectionTitle>
        <Card>
          <ul>
            {d.rows.map((r, i) => (
              <li key={r.code} className={`px-4 py-3 ${i < d.rows.length - 1 ? "border-b border-line" : ""}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[15px] font-semibold">{r.title}</span>
                  <span className="shrink-0 text-[17px] font-bold tabular-nums">{pct(r.avgPct)}</span>
                </div>
                <div className="mt-1.5">
                  <Bar value={r.avgPct ?? 0} />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-tx2">
                  <span>
                    {r.n} natija · {r.candidates} nomzod · {r.employees} xodim
                  </span>
                  {r.withFlags > 0 && (
                    <span className="text-bad">
                      <Ico icon={Flag} size={12} className="mr-0.5 fill-current" />
                      {r.withFlags} qizil bayroqli
                    </span>
                  )}
                  {r.weakest.length > 0 && (
                    <span>
                      zaif: {r.weakest.map((c) => `${c.code} (${(c.avgLevel as number).toFixed(1)}/${c.target})`).join(", ")}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Oylar bo'yicha (6 oy)</SectionTitle>
          <Card className="p-4">
            <ul className="flex flex-col gap-2.5">
              {d.trend.map((t) => (
                <li key={t.month} className="grid grid-cols-[52px_minmax(0,1fr)_86px] items-center gap-3 text-[13px]">
                  <span className="text-tx2">{monthLabel(t.month)}</span>
                  <Bar value={t.n} max={maxN} />
                  <span className="text-right tabular-nums">
                    <b className="font-semibold">{t.n}</b> · {pct(t.avgPct)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-tx2">Ustun — yakunlangan testlar soni; o'ngda — soni va o'rtacha moslik.</p>
          </Card>
        </section>

        <section>
          <SectionTitle>Bo'limdagi eng zaif kompetensiyalar</SectionTitle>
          <Card>
            {d.weakestOverall.length === 0 ? (
              <p className="p-4 text-[15px] text-tx2">Ma'lumot yetarli emas.</p>
            ) : (
              <ul>
                {d.weakestOverall.map((c, i) => (
                  <li key={c.name} className={`px-4 py-3 ${i < d.weakestOverall.length - 1 ? "border-b border-line" : ""}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-[15px] font-semibold">{c.name}</span>
                      <span className={`shrink-0 text-[15px] font-bold tabular-nums ${c.gap < 0 ? "text-bad" : "text-ok"}`}>
                        {c.gap > 0 ? "+" : ""}
                        {c.gap.toFixed(1)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-tx2">
                      talabdan o'rtacha farq · {c.n} baho · {c.positions.join(", ")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <p className="mt-2 px-4 text-[12px] text-tx2">Manfiy son — o'rtacha daraja lavozim talabidan past. O'quv rejasini shu yerdan boshlash foydali.</p>
        </section>
      </div>
    </div>
  );
}

async function EmployeesTab() {
  const people = await employeeGrowth();
  if (!people.length)
    return <Empty>Hali xodimlarni baholash (Xodim rejimi) natijalari yo'q. Xodim qayta baholanganda o'sish dinamikasi shu yerda ko'rinadi.</Empty>;
  const repeated = people.filter((p) => p.count > 1);
  const improved = repeated.filter((p) => (p.delta ?? 0) > 0).length;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi l="Baholangan xodimlar" v={String(people.length)} />
        <Kpi l="Qayta baholangan" v={String(repeated.length)} d="kamida 2 marta" />
        <Kpi l="O'sganlar" v={String(improved)} d={repeated.length ? `${Math.round((improved / repeated.length) * 100)}% qayta baholanganlardan` : "—"} />
        <Kpi l="O'rtacha so'nggi natija" v={pct(people.reduce((s, p) => s + p.lastPct, 0) / people.length)} />
      </div>
      <section>
        <SectionTitle>Xodimlar</SectionTitle>
        <Card>
          <ul>
            {people.map((p, i) => (
              <li key={`${p.name}-${p.position}`} className={i < people.length - 1 ? "border-b border-line" : ""}>
                <Link href={`/hr/natijalar/${p.lastAttemptId}`} className="block px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                      <span className="block truncate text-[12px] text-tx2">
                        {p.position} · {p.count} marta · so'nggi {shortDate(p.lastAt)}
                        {p.belowTarget > 0 && ` · ${p.belowTarget} ta kompetensiya talabdan past`}
                      </span>
                    </span>
                    {p.history.length > 1 && (
                      <span className="hidden w-20 text-brd sm:block">
                        <Sparkline values={p.history} />
                      </span>
                    )}
                    <span className="w-24 shrink-0 text-right">
                      <b className="block text-[17px] tabular-nums">{pct(p.lastPct)}</b>
                      {p.delta !== null && (
                        <span className={`text-[12px] font-semibold ${p.delta >= 0 ? "text-ok" : "text-warn"}`}>
                          <Ico icon={p.delta >= 0 ? ArrowUpRight : ArrowDownRight} size={12} className="mr-0.5" />
                          {p.delta >= 0 ? "+" : ""}
                          {Math.round(p.delta)}% ({pct(p.firstPct)} dan)
                        </span>
                      )}
                    </span>
                  </div>
                  {p.changes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.changes.map((c) => (
                        <Pill key={c.code} tone={c.to > (c.from as number) ? "ok" : "warn"}>
                          {c.code}: {c.from} → {c.to}
                        </Pill>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <p className="mt-2 px-4 text-[12px] text-tx2">Bir xodim — ism, aloqa ma'lumoti va lavozim bo'yicha birlashtiriladi. Teglar — birinchi va so'nggi baholash orasidagi daraja o'zgarishi.</p>
      </section>
    </div>
  );
}

async function QuestionsTab() {
  const q = await questionQuality();
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi l="Faol savollar" v={String(q.totalActive)} />
        <Kpi l="Javob berilgan" v={String(q.answered)} d="kamida 1 marta" />
        <Kpi l="Statistika yetarli" v={String(q.enoughData)} d={`${q.minN}+ javob`} />
        <Kpi l="Diqqat talab" v={String(q.flagged.length)} d="savol" />
      </div>
      {q.enoughData === 0 && (
        <Empty>
          Savol sifatini baholash uchun har savolga kamida {q.minN} ta javob kerak. Testlar ko'paygan sari bu yerda qaysi savol juda
          oson yoki qiyinligi, qaysi chalg'ituvchi variant hech tanlanmasligi va vaqt yetarliligi ko'rinadi.
        </Empty>
      )}
      {q.flagged.length > 0 && (
        <section>
          <SectionTitle>Diqqat talab qiladigan savollar</SectionTitle>
          <Card>
            <ul>
              {q.flagged.slice(0, 40).map((s, i) => (
                <li key={s.id} className={i < Math.min(40, q.flagged.length) - 1 ? "border-b border-line" : ""}>
                  <Link href={`/hr/savollar/${s.id}`} className="block px-4 py-3">
                    <div className="line-clamp-2 text-[15px]">{stemPreview(s.stem)}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-tx2">
                      <span>
                        {s.position} · {s.competency} · {s.level}-daraja · {QUESTION_TYPE_LABELS[s.type] ?? s.type}
                      </span>
                      <span>{s.n} javob</span>
                      {s.avgScore !== null && <span>o'rtacha ball {Math.round(s.avgScore * 100)}%</span>}
                      <span>
                        ~{s.avgTimeSec} / {s.limitSec} s
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {s.issues.map((x) => (
                        <Pill key={x} tone="warn">
                          <Ico icon={TriangleAlert} size={11} className="mr-1" />
                          {x}
                        </Pill>
                      ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
      {q.hardest.length > 0 && (
        <section>
          <SectionTitle>Eng qiyin savollar</SectionTitle>
          <Card className="p-4">
            <ul className="flex flex-col gap-3">
              {q.hardest.map((s) => (
                <li key={s.id}>
                  <Link href={`/hr/savollar/${s.id}`} className="block">
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate">{stemPreview(s.stem)}</span>
                      <b className="shrink-0 tabular-nums">{Math.round((s.avgScore as number) * 100)}%</b>
                    </div>
                    <div className="mt-1">
                      <Bar value={(s.avgScore as number) * 100} tone={(s.avgScore as number) < 0.3 ? "bad" : "br"} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}

async function AiTab() {
  const c = await aiCosts();
  const maxM = Math.max(0.01, ...c.byMonth.map((m) => m.analysis + m.grade));
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi l="Shu oy" v={usd(c.thisMonthUsd)} d="qayd etilgan sarf" />
        <Kpi l="Jami (qayd etilgan)" v={usd(c.totalUsd)} d={`${c.analysisCount} tahlil · ${c.gradeCount} baholash`} />
        <Kpi l="Bitta tahlil" v={c.avgAnalysisUsd === null ? "—" : usd(c.avgAnalysisUsd)} d="o'rtacha" />
        <Kpi l="Bitta nomzodga" v={c.avgPerCandidateUsd === null ? "—" : usd(c.avgPerCandidateUsd)} d="tahlil + baholash" />
      </div>
      {c.legacyAnalyses > 0 && (
        <Card className="flex items-start gap-3 p-4 text-[14px] text-tx2">
          <Info size={18} aria-hidden className="mt-0.5 shrink-0" />
          <p>
            Sarfni qayd etish yoqilgunga qadar yana {c.legacyAnalyses} ta tahlil qilingan. Ular uchun taxminiy sarf ~{usd(c.legacyUsd)}
            (bitta tahlil ~$0.50 hisobida) — yuqoridagi summalarga kirmagan.
          </p>
        </Card>
      )}
      <section>
        <SectionTitle>Oylar bo'yicha</SectionTitle>
        <Card className="p-4">
          <ul className="flex flex-col gap-2.5">
            {c.byMonth.map((m) => (
              <li key={m.month} className="grid grid-cols-[52px_minmax(0,1fr)_96px] items-center gap-3 text-[13px]">
                <span className="text-tx2">{monthLabel(m.month)}</span>
                <span className="flex h-2 w-full overflow-hidden rounded-full bg-soft" aria-hidden>
                  <span className="h-full bg-br" style={{ width: `${(m.analysis / maxM) * 100}%` }} />
                  <span className="h-full bg-brd/50" style={{ width: `${(m.grade / maxM) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums">
                  <b className="font-semibold">{usd(m.analysis + m.grade)}</b> · {m.n} tahlil
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-4 text-[12px] text-tx2">
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-br align-middle" />
              AI tahlil
            </span>
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brd/50 align-middle" />
              ochiq javoblarni baholash
            </span>
          </div>
        </Card>
      </section>
      <section>
        <SectionTitle>Tokenlar</SectionTitle>
        <Card className="grid grid-cols-2 divide-x divide-line">
          <div className="p-4">
            <div className="text-[12px] text-tx2">Kirish (input)</div>
            <div className="text-[20px] font-bold tabular-nums">{c.tokens.input.toLocaleString("ru-RU")}</div>
          </div>
          <div className="p-4">
            <div className="text-[12px] text-tx2">Chiqish (output)</div>
            <div className="text-[20px] font-bold tabular-nums">{c.tokens.output.toLocaleString("ru-RU")}</div>
          </div>
        </Card>
        <p className="mt-2 px-4 text-[12px] text-tx2">
          Narx Claude Opus 5.5 tarifi bo'yicha: 1 mln kirish tokeni $4, 1 mln chiqish tokeni $20. Haqiqiy hisob Anthropic kabinetida.
        </p>
      </section>
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const tab: TabKey = (TABS.map((t) => t.key) as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as TabKey) : "bolim";
  return (
    <div className="flex flex-col gap-6">
      <header className="px-1">
        <h2 className="text-[34px] font-bold leading-tight">Analitika</h2>
        <p className="mt-1 text-[15px] text-tx2">
          <Ico icon={ShieldAlert} size={14} className="mr-1" />
          Raqamlar faqat yakunlangan testlardan; natija toifalarga ajratilmaydi — foiz va daraja.
        </p>
      </header>
      <nav className="grid grid-cols-2 gap-0.5 rounded-[10px] bg-soft p-0.5 sm:grid-cols-4" aria-label="Analitika bo'limlari">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/hr/analitika?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`flex h-9 items-center justify-center rounded-[8px] text-[13px] font-semibold ${tab === t.key ? "bg-card text-tx shadow-sm" : "text-tx2"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "bolim" && <DepartmentTab />}
      {tab === "xodimlar" && <EmployeesTab />}
      {tab === "savollar" && <QuestionsTab />}
      {tab === "ai" && <AiTab />}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, Ico, SectionTitle } from "@/components/ui";
import { Sparkline } from "@/components/svg-charts";
import { timeAgo, weekBuckets } from "@/lib/format";
import { ArrowDown, CalendarClock, ChevronRight, CircleCheck, Hourglass, Send, ShieldAlert, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

export const metadata: Metadata = { title: "Bosh sahifa" };

const DAY = 24 * 3600 * 1000;

export default async function Dashboard() {
  const user = await requireUser();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const soon = new Date(now.getTime() + 3 * DAY);

  const [
    statusCounts,
    createdThisWeek,
    needsReview,
    criticalOpen,
    expiring,
    results,
    positions,
    assessmentDates,
    recentResults,
    recentAudit,
    advance,
  ] = await Promise.all([
    db.assessment.groupBy({ by: ["status"], _count: true }),
    db.assessment.count({ where: { createdAt: { gte: weekAgo } } }),
    db.attemptResult.count({ where: { needsReview: true } }),
    db.attemptResult.count({ where: { criticalFail: true, decision: null } }),
    db.assessment.count({ where: { status: { in: ["INVITED", "STARTED"] }, dueAt: { gte: now, lte: soon } } }),
    db.attemptResult.findMany({ select: { overallPct: true, createdAt: true } }),
    db.position.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    db.assessment.findMany({ select: { positionId: true, createdAt: true }, where: { createdAt: { gte: new Date(now.getTime() - 56 * DAY) } } }),
    db.attemptResult.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { attempt: { include: { assessment: { select: { subjectName: true } } } } },
    }),
    db.auditLog.findMany({ orderBy: { at: "desc" }, take: 6, include: { actor: { select: { name: true } } } }),
    db.attemptResult.count({ where: { decision: "ADVANCE" } }),
  ]);

  const count = (s: string) => statusCounts.find((x) => x.status === s)?._count ?? 0;
  const invited = count("INVITED"), started = count("STARTED"), submitted = count("SUBMITTED");
  const total = invited + started + submitted;
  const active = invited + started;
  const avg = results.length ? results.reduce((s, r) => s + r.overallPct, 0) / results.length : null;

  const kpis = [
    { l: "Faol baholashlar", n: String(active), d: `shu hafta ${createdThisWeek} ta yangi taklif`, tone: "soft" },
    { l: "Ko'rib chiqish kutmoqda", n: String(needsReview), d: needsReview ? "qo'lda baholash" : "hammasi tayyor", tone: needsReview ? "warn" : "ok" },
    { l: "O'rtacha moslik", n: avg === null ? "—" : `${Math.round(avg)}%`, d: `${results.length} natija`, tone: "soft" },
    { l: "Yakunlangan testlar", n: String(results.length), d: "jami natija", tone: "soft" },
  ] as const;

  const attention = [
    needsReview > 0 && { t: `${needsReview} ta natija qo'lda ko'rib chiqishni kutmoqda`, href: "/hr/natijalar?f=review", icon: Hourglass },
    criticalOpen > 0 && { t: `${criticalOpen} ta nomzodda kritik kompetensiya past — qaror kutilmoqda`, href: "/hr/natijalar?f=critical", icon: ShieldAlert },
    expiring > 0 && { t: `${expiring} ta taklif muddati 3 kun ichida tugaydi`, href: "/hr/takliflar", icon: CalendarClock },
  ].filter(Boolean) as { t: string; href: string; icon: LucideIcon }[];

  const funnel = [
    { t: "Taklif yuborildi", n: total },
    { t: "Boshladi", n: started + submitted },
    { t: "Yakunladi", n: submitted },
    { t: "Keyingi bosqich", n: advance },
  ];

  const posRows = positions.map((p) => {
    const dates = assessmentDates.filter((a) => a.positionId === p.id).map((a) => a.createdAt);
    return { ...p, series: weekBuckets(dates, 8, now), n: dates.length };
  });

  const actionLabel: Record<string, string> = {
    "invite.create": "Yangi taklif yaratildi",
    "invite.cancel": "Taklif bekor qilindi",
    "result.decision": "Qaror qayd etildi",
    "result.context": "Natijaga HR izohi qo'shildi",
    "result.pdf": "PDF hisobot yuklab olindi",
    "response.review": "Javob qo'lda qayta baholandi",
    "ai.analysis": "AI tahlil tayyorlandi",
    "ai.grade": "Ochiq javoblar AI bilan baholandi",
    "question.create": "Yangi savol qo'shildi",
    "question.update": "Savol tahrirlandi",
    "question.delete": "Savol o'chirildi",
    "question.import": "Savollar import qilindi",
    "question.status": "Savol holati o'zgartirildi",
    "question.activate_drafts": "Qoralama savollar faollashtirildi",
    "testconfig.update": "Test tarkibi o'zgartirildi",
    "testconfig.reset": "Test tarkibi standartga qaytarildi",
    "user.create": "Yangi foydalanuvchi qo'shildi",
    "user.password_change": "Parol almashtirildi",
  };
  const feed = [
    ...recentResults.map((r) => ({
      at: r.createdAt,
      t: `${r.attempt.assessment.subjectName} testni yakunladi`,
      d: `${Math.round(r.overallPct)}%`,
      href: `/hr/natijalar/${r.attemptId}`,
    })),
    ...recentAudit.map((a) => ({
      at: a.at,
      t: actionLabel[a.action] ?? "Tizimda o'zgarish",
      d: a.actor?.name ?? "Tizim",
      href: null as string | null,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 7);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-3xl font-bold text-navy">Xayrli kun, {user.name.split(" ")[0]}</h2>
        <p className="mt-1 text-sm text-tx2">
          {needsReview > 0 ? `Bugun ${needsReview} ta natija ko'rib chiqishga tayyor.` : "Hozircha e'tibor talab qiladigan natija yo'q."}
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Ko'rsatkichlar">
        {kpis.map((k) => (
          <Card key={k.l} className="p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-tx2">{k.l}</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold text-navy">{k.n}</span>
              <span className={`text-xs font-bold ${k.tone === "ok" ? "text-ok" : k.tone === "warn" ? "text-warn" : "text-tx2"}`}>
                {"trend" in k && <Ico icon={k.trend === "up" ? TrendingUp : TrendingDown} size={13} className="mr-1" />}
                {k.d}
              </span>
            </div>
          </Card>
        ))}
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Bugun e'tibor talab qiladi</SectionTitle>
          <Card className="divide-y divide-line">
            {attention.length === 0 && <p className="p-5 text-sm text-tx2">
                <Ico icon={CircleCheck} className="mr-1.5 text-ok" />
                Hammasi nazoratda.
              </p>}
            {attention.map((a) => (
              <Link key={a.href + a.t} href={a.href} className="flex items-center gap-3 p-4 hover:bg-soft/60">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-warn-t text-warn" aria-hidden>
                  <a.icon size={18} strokeWidth={2.2} />
                </span>
                <span className="flex-1 text-sm font-semibold">{a.t}</span>
                <ChevronRight size={18} className="shrink-0 text-tx2" aria-hidden />
              </Link>
            ))}
          </Card>
        </section>

        <section>
          <SectionTitle>Baholash voronkasi</SectionTitle>
          <Card className="flex flex-col gap-1 p-4">
            {funnel.map((f, i) => {
              const prev = i > 0 ? funnel[i - 1].n : null;
              const conv = prev ? Math.round((f.n / prev) * 100) : null;
              const w = total ? Math.max(6, (f.n / total) * 100) : 6;
              return (
                <div key={f.t}>
                  {conv !== null && <div className="py-0.5 pl-2 text-[11px] font-bold text-tx2">
                      <Ico icon={ArrowDown} size={11} className="mr-0.5" />
                      {conv}%
                    </div>}
                  <div className="relative h-10 overflow-hidden rounded-xl bg-soft">
                    <div className="absolute inset-y-0 left-0 rounded-xl bg-tint" style={{ width: `${w}%` }} />
                    <div className="relative flex h-full items-center justify-between px-3 text-sm font-bold">
                      <span>{f.t}</span>
                      <span>{f.n}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        </section>

        <section>
          <SectionTitle>Lavozimlar bo'yicha</SectionTitle>
          <Card className="divide-y divide-line">
            {posRows.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3.5">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.title}</span>
                <Sparkline values={p.series} />
                <span className="w-8 text-right text-sm font-bold">{p.n}</span>
              </div>
            ))}
          </Card>
          <p className="mt-2 text-xs text-tx2">So'nggi 8 hafta, yuborilgan takliflar soni.</p>
        </section>

        <section>
          <SectionTitle>So'nggi faollik</SectionTitle>
          <Card className="divide-y divide-line">
            {feed.length === 0 && <p className="p-5 text-sm text-tx2">Hali faollik yo'q.</p>}
            {feed.map((f, i) => {
              const inner = (
                <>
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-br" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{f.t}</div>
                    <div className="text-xs text-tx2">{f.d} · {timeAgo(f.at, now)}</div>
                  </div>
                </>
              );
              return f.href ? (
                <Link key={i} href={f.href} className="flex gap-3 p-3.5 hover:bg-soft/60">{inner}</Link>
              ) : (
                <div key={i} className="flex gap-3 p-3.5">{inner}</div>
              );
            })}
          </Card>
        </section>
      </div>

      {total === 0 && (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <Send size={30} strokeWidth={1.8} className="text-tx2" aria-hidden />
          <div className="font-bold">Hali nomzod yo'q</div>
          <p className="text-sm text-tx2">Birinchi taklifni yuboring — natijalar shu yerda paydo bo'ladi.</p>
          <Link href="/hr/takliflar" className="inline-flex min-h-11 items-center rounded-full bg-br px-5 text-sm font-bold text-onbr">
            Taklif yuborish
          </Link>
        </Card>
      )}
    </div>
  );
}

import Link from "next/link";
import { ChevronRight, Clock3, ListChecks, Scale, Search } from "lucide-react";
import { db } from "@/lib/db";
import { getPositionPlan } from "@/lib/test-config";
import { Card, Ico, SectionTitle } from "@/components/ui";
import { AddDepartment, DepartmentActions } from "./department-controls";

export const fmtDuration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} soat${m ? ` ${m} daq` : ""}` : `${m} daq`;
};

/** Savollar banki bosh ko'rinishi: bo'limlar bo'yicha test kartalari. */
export async function TestsOverview({ canWrite }: { canWrite: boolean }) {
  const [departments, positions, drafts] = await Promise.all([
    db.department.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.position.findMany({ orderBy: { title: "asc" }, select: { id: true, code: true, title: true, departmentId: true } }),
    db.question.groupBy({ by: ["competencyId"], where: { status: "DRAFT" }, _count: true }),
  ]);
  const plans = new Map(await Promise.all(positions.map(async (p) => [p.id, await getPositionPlan(p.id)] as const)));
  const draftComps = await db.competency.findMany({ where: { id: { in: drafts.map((d) => d.competencyId) } }, select: { id: true, positionId: true } });
  const draftsBy = new Map<string, number>();
  for (const d of drafts) {
    const pid = draftComps.find((c) => c.id === d.competencyId)?.positionId;
    if (pid) draftsBy.set(pid, (draftsBy.get(pid) ?? 0) + d._count);
  }

  const groups = [
    ...departments.map((d) => ({ id: d.id, name: d.name, items: positions.filter((p) => p.departmentId === d.id) })),
    { id: null, name: "Bo'limsiz", items: positions.filter((p) => !p.departmentId) },
  ].filter((g) => g.id !== null || g.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <form action="/hr/savollar" className="relative">
        <Search size={17} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tx2" />
        <input
          name="q"
          placeholder="Barcha savollardan qidirish"
          aria-label="Savol matni bo'yicha qidirish"
          className="h-10 w-full rounded-[10px] bg-soft pl-9 pr-3 text-[17px] outline-none placeholder:text-tx2"
        />
      </form>

      <div className="flex flex-wrap items-start gap-2">
        {canWrite && (
          <>
            <Link href="/hr/savollar/yangi" className="inline-flex h-10 items-center rounded-full bg-brf px-4 text-[15px] font-semibold text-onbr">
              + Savol
            </Link>
            <Link href="/hr/savollar/import" className="inline-flex h-10 items-center rounded-full bg-tint px-4 text-[15px] font-semibold text-brd">
              Import (JSON)
            </Link>
            <AddDepartment />
          </>
        )}
        <Link href="/hr/savollar?view=list" className="inline-flex h-10 items-center rounded-full bg-soft px-4 text-[15px] font-semibold text-tx">
          Barcha savollar ro&apos;yxati
        </Link>
      </div>

      {groups.map((g) => (
        <section key={g.id ?? "none"}>
          <SectionTitle
            aside={
              <span className="flex items-center gap-1 text-[13px] text-tx2">
                {g.items.length} ta test
                {canWrite && g.id && <DepartmentActions id={g.id} name={g.name} tests={g.items.length} />}
              </span>
            }
          >
            {g.name}
          </SectionTitle>
          {g.items.length === 0 ? (
            <Card className="p-5 text-[15px] text-tx2">
              Bu bo&apos;limda hali test yo&apos;q. Testni ochib, «Bo&apos;lim» maydonidan shu bo&apos;limni tanlang.
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((p) => {
                const plan = plans.get(p.id)!;
                const minutes = plan.timeLimitMin ?? plan.estimatedMin;
                const nDraft = draftsBy.get(p.id) ?? 0;
                return (
                  <Link key={p.id} href={`/hr/savollar/test/${p.code}`} className="group">
                    <Card className="flex h-full flex-col gap-3 p-4 transition-shadow group-hover:shadow-md">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[17px] font-semibold leading-snug">{p.title} testi</div>
                          <div className="mt-0.5 text-[13px] text-tx2">
                            {plan.timeLimitMin || plan.competencies.some((c) => c.count < c.available) ? "Sozlangan" : "Standart tarkib"}
                            {nDraft ? ` · ${nDraft} ta qoralama` : ""}
                          </div>
                        </div>
                        <ChevronRight size={18} aria-hidden className="mt-1 shrink-0 text-tx2 transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-[13px] text-tx2">
                        <span className="whitespace-nowrap">
                          <Ico icon={ListChecks} size={14} className="mr-1 text-brd" />
                          <b className="font-semibold tabular-nums text-tx">{plan.total}</b> savol
                        </span>
                        <span className="whitespace-nowrap">
                          <Ico icon={Clock3} size={14} className="mr-1 text-brd" />
                          <b className="font-semibold tabular-nums text-tx">{fmtDuration(minutes)}</b>
                        </span>
                        <span className="whitespace-nowrap">
                          <Ico icon={Scale} size={14} className="mr-1 text-brd" />
                          <b className="font-semibold tabular-nums text-tx">{plan.competencies.length}</b> kompetensiya
                        </span>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

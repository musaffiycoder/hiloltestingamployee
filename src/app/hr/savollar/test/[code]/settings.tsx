"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Clock3, FolderOpen, TriangleAlert } from "lucide-react";
import { Card, Ico } from "@/components/ui";
import { SectionTimeFields, validSectionTimes, type SectionTimes } from "@/components/section-times";
import { setPositionDepartment, setTestTime, type ActionState } from "../../test-actions";


function Status({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-[13px] font-medium ${state.ok ? "text-ok" : "text-bad"}`}>
      <Ico icon={state.ok ? CircleCheck : TriangleAlert} size={13} className="mr-1" />
      {state.message}
    </p>
  );
}

export function TestSettings({
  positionId,
  departmentId,
  departments,
  sections,
  readOnly,
}: {
  positionId: string;
  departmentId: string | null;
  departments: { id: string; name: string }[];
  sections: Record<"closed" | "open", { count: number; estimatedMin: number; timeMin: number | null }>;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [depState, setDepState] = useState<ActionState>(null);
  const [timeState, setTimeState] = useState<ActionState>(null);
  const [times, setTimes] = useState<SectionTimes>({ closed: sections.closed.timeMin, open: sections.open.timeMin });

  const saveTime = () =>
    start(async () => {
      const r = await setTestTime({ positionId, closedMin: times.closed, openMin: times.open });
      setTimeState(r);
      if (r?.ok) router.refresh();
    });

  return (
    <Card className="grid gap-5 p-4 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label htmlFor="dep" className="text-[15px] font-semibold">
          <Ico icon={FolderOpen} size={15} className="mr-1.5 text-brd" />
          Bo&apos;lim
        </label>
        <select
          id="dep"
          disabled={readOnly || pending}
          defaultValue={departmentId ?? ""}
          onChange={(e) =>
            start(async () => {
              const r = await setPositionDepartment(positionId, e.target.value || null);
              setDepState(r);
              if (r?.ok) router.refresh();
            })
          }
          className="h-10 rounded-[10px] bg-soft px-3 text-[15px] outline-none focus:ring-2 focus:ring-br/40"
        >
          <option value="">Bo&apos;limsiz</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <Status state={depState} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-semibold">
          <Ico icon={Clock3} size={15} className="mr-1.5 text-brd" />
          Bajarish vaqti
        </span>
        <SectionTimeFields estimates={sections} value={times} onChange={setTimes} readOnly={readOnly} />
        {!readOnly && (
          <button
            type="button"
            onClick={saveTime}
            disabled={pending || !validSectionTimes(times)}
            className="h-10 self-start rounded-full bg-brf px-5 text-[15px] font-semibold text-onbr disabled:opacity-40"
          >
            {pending ? "Saqlanmoqda…" : "Vaqtni saqlash"}
          </button>
        )}
        <Status state={timeState} />
      </div>
    </Card>
  );
}

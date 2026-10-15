"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Clock3, FolderOpen, TriangleAlert } from "lucide-react";
import { Card, Ico } from "@/components/ui";
import { setPositionDepartment, setTestTime, type ActionState } from "../../test-actions";

const seg = (on: boolean) =>
  `flex h-8 flex-1 items-center justify-center rounded-[8px] px-2 text-[13px] font-semibold ${on ? "bg-card text-tx shadow-sm" : "text-tx2"}`;
const num = "h-10 w-16 rounded-[10px] bg-soft px-2 text-center text-[17px] tabular-nums outline-none focus:ring-2 focus:ring-br/40";

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
  timeLimitMin,
  estimatedMin,
  readOnly,
}: {
  positionId: string;
  departmentId: string | null;
  departments: { id: string; name: string }[];
  timeLimitMin: number | null;
  estimatedMin: number;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [depState, setDepState] = useState<ActionState>(null);
  const [timeState, setTimeState] = useState<ActionState>(null);
  const [mode, setMode] = useState<"auto" | "manual">(timeLimitMin ? "manual" : "auto");
  const initial = timeLimitMin ?? estimatedMin;
  const [h, setH] = useState(Math.floor(initial / 60));
  const [m, setM] = useState(initial % 60);
  const total = h * 60 + m;
  const tooShort = mode === "manual" && total < estimatedMin * 0.7;

  const saveTime = () =>
    start(async () => {
      const r = await setTestTime({ positionId, minutes: mode === "manual" ? total : null });
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
        <div className="flex rounded-[10px] bg-soft p-0.5" role="radiogroup" aria-label="Bajarish vaqti">
          <button type="button" role="radio" aria-checked={mode === "auto"} disabled={readOnly} onClick={() => setMode("auto")} className={seg(mode === "auto")}>
            Avtomatik
          </button>
          <button type="button" role="radio" aria-checked={mode === "manual"} disabled={readOnly} onClick={() => setMode("manual")} className={seg(mode === "manual")}>
            Qo&apos;lda
          </button>
        </div>
        <p className="text-[13px] text-tx2">
          Savollar vaqtining yig&apos;indisi: {Math.floor(estimatedMin / 60)} soat {estimatedMin % 60} daqiqa
        </p>
        {mode === "manual" && (
          <div className="flex items-center gap-2 text-[15px]">
            <input
              type="number"
              min={0}
              max={10}
              value={h}
              disabled={readOnly}
              onChange={(e) => setH(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
              aria-label="Soat"
              className={num}
            />
            soat
            <input
              type="number"
              min={0}
              max={59}
              value={m}
              disabled={readOnly}
              onChange={(e) => setM(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
              aria-label="Daqiqa"
              className={num}
            />
            daqiqa
          </div>
        )}
        {tooShort && (
          <p className="text-[13px] font-medium text-warn">
            <Ico icon={TriangleAlert} size={13} className="mr-1" />
            Savollar uchun tavsiya etilganidan ancha kam — nomzodlar ulgurmasligi mumkin.
          </p>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={saveTime}
            disabled={pending || (mode === "manual" && (total < 5 || total > 600))}
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

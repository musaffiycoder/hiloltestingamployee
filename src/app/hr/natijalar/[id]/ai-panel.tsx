"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runAnalysis, runGrading, type AiActionResult } from "./actions";
import { Check, X } from "lucide-react";
import { Ico } from "@/components/ui";

export function AiPanel({
  attemptId,
  configured,
  ungradedOpen,
  hasAnalysis,
}: {
  attemptId: string;
  configured: boolean;
  ungradedOpen: number;
  hasAnalysis: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [log, setLog] = useState<AiActionResult[]>([]);
  const [step, setStep] = useState<string | null>(null);

  const run = (grading: boolean, analysis: boolean) => {
    setLog([]);
    start(async () => {
      const out: AiActionResult[] = [];
      if (grading) {
        setStep("Ochiq javoblar baholanmoqda…");
        const r = await runGrading(attemptId);
        out.push(r);
        setLog([...out]);
        if (!r.ok) {
          setStep(null);
          return;
        }
      }
      if (analysis) {
        setStep("Chuqur tahlil yozilmoqda… (bir necha o'n soniya)");
        const r = await runAnalysis(attemptId);
        out.push(r);
        setLog([...out]);
      }
      setStep(null);
      router.refresh();
    });
  };

  if (!configured) {
    return (
      <div className="rounded-2xl bg-warn-t p-4 text-[15px] text-warn">
        AI sozlanmagan. Vercel va <code className="font-mono">.env</code> ga <code className="font-mono">ANTHROPIC_API_KEY</code>{" "}
        qo'shing; shundan keyin bu yerda «Tahlil yaratish» tugmasi ishlaydi. Hozircha qoidaga asoslangan tavsiya ishlatiladi.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          disabled={pending}
          onClick={() => run(ungradedOpen > 0, true)}
          className="h-[50px] flex-1 rounded-full bg-brf text-[17px] font-semibold text-onbr disabled:opacity-50"
        >
          {pending ? (step ?? "Bajarilmoqda…") : hasAnalysis ? "Tahlilni yangilash" : "AI tahlil yaratish"}
        </button>
        {ungradedOpen > 0 && (
          <button
            disabled={pending}
            onClick={() => run(true, false)}
            className="h-[50px] rounded-full bg-tint px-5 text-[17px] font-semibold text-brd disabled:opacity-50"
          >
            Faqat javoblarni baholash ({ungradedOpen})
          </button>
        )}
      </div>
      {log.map((l, i) => (
        <p key={i} role={l.ok ? "status" : "alert"} className={`px-1 text-[15px] font-medium ${l.ok ? "text-ok" : "text-bad"}`}>
          <Ico icon={l.ok ? Check : X} size={13} className="mr-1" />
          {l.message}
        </p>
      ))}
    </div>
  );
}

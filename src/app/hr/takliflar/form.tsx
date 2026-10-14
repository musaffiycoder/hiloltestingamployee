"use client";

import { useActionState, useState } from "react";
import { createInvite, type InviteState } from "./actions";
import { Check } from "lucide-react";
import { Ico } from "@/components/ui";

const row = "flex min-h-[48px] items-center gap-3 px-4";
const lbl = "w-28 shrink-0 text-[17px]";
const ctl = "min-w-0 flex-1 bg-transparent text-right text-[17px] outline-none placeholder:text-tx2/60";

export function InviteForm({ positions }: { positions: { id: string; title: string; questions: number }[] }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInvite, {});
  const [copied, setCopied] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* iOS inset grouped: chap yorliq, o'ng qiymat, hairline ajratgich */}
      <div className="overflow-hidden rounded-2xl bg-card">
        <label className={row}>
          <span className={lbl}>Ism</span>
          <input name="subjectName" required className={ctl} placeholder="Sardor Yusupov" />
        </label>
        <div className="ml-4 h-px bg-line" />
        <label className={row}>
          <span className={lbl}>Aloqa</span>
          <input name="contact" className={ctl} placeholder="Email yoki telefon" />
        </label>
        <div className="ml-4 h-px bg-line" />
        <label className={row}>
          <span className={lbl}>Lavozim</span>
          <select name="positionId" required defaultValue="" className={`${ctl} text-brd`}>
            <option value="" disabled>
              Tanlang…
            </option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {p.questions} savol
              </option>
            ))}
          </select>
        </label>
        <div className="ml-4 h-px bg-line" />
        <label className={row}>
          <span className={lbl}>Rejim</span>
          <select name="mode" defaultValue="RECRUITING" className={`${ctl} text-brd`}>
            <option value="RECRUITING">Recruiting (nomzod)</option>
            <option value="EVALUATION">Xodimni baholash</option>
          </select>
        </label>
        <div className="ml-4 h-px bg-line" />
        <label className={row}>
          <span className={lbl}>Muddat</span>
          <input name="dueAt" type="date" className={`${ctl} text-brd`} />
        </label>
      </div>

      {state.error && (
        <p role="alert" className="px-4 text-[13px] font-medium text-bad">
          {state.error}
        </p>
      )}

      {state.link && (
        <div className="overflow-hidden rounded-2xl bg-ok-t p-4 text-[15px]">
          <div className="mb-2 font-semibold text-ok">Taklif yaratildi</div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-card px-2.5 py-2 font-mono text-xs">{state.link}</code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(state.link!);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="h-9 shrink-0 rounded-full bg-card px-4 text-[15px] font-semibold text-brd"
            >
              {copied ? (
                <>
                  Nusxalandi <Ico icon={Check} />
                </>
              ) : (
                "Nusxalash"
              )}
            </button>
          </div>
        </div>
      )}

      <button
        disabled={pending}
        className="h-[50px] rounded-full bg-brf text-[17px] font-semibold text-onbr disabled:opacity-50"
      >
        {pending ? "Yaratilmoqda…" : "Taklif yaratish"}
      </button>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { createInvite, type InviteState } from "./actions";

export function InviteForm({ positions }: { positions: { id: string; title: string; questions: number }[] }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInvite, {});
  const [copied, setCopied] = useState(false);
  const field =
    "h-11 w-full rounded-2xl border border-line bg-card px-4 text-sm outline-none focus:border-br focus:ring-2 focus:ring-br/30";
  const label = "flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wide text-tx2";

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className={label}>
        Ism
        <input name="subjectName" required className={field} placeholder="Sardor Yusupov" />
      </label>
      <label className={label}>
        Email yoki telefon
        <input name="contact" className={field} placeholder="+998 90 123 45 67" />
      </label>
      <label className={label}>
        Lavozim
        <select name="positionId" required className={field} defaultValue="">
          <option value="" disabled>Tanlang…</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} · {p.questions} savol
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Rejim
          <select name="mode" className={field} defaultValue="RECRUITING">
            <option value="RECRUITING">Recruiting (nomzod)</option>
            <option value="EVALUATION">Xodimni baholash</option>
          </select>
        </label>
        <label className={label}>
          Muddat
          <input name="dueAt" type="date" className={field} />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="rounded-xl bg-bad-t px-3 py-2 text-sm font-semibold text-bad">{state.error}</p>
      )}
      {state.link && (
        <div className="rounded-2xl bg-ok-t p-3 text-sm">
          <div className="mb-1 font-bold text-ok">Taklif yaratildi</div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-card px-2 py-1.5 font-mono text-xs">{state.link}</code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(state.link!);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded-full bg-card px-3 py-1.5 text-xs font-bold"
            >
              {copied ? "Nusxalandi ✓" : "Nusxalash"}
            </button>
          </div>
        </div>
      )}
      <button disabled={pending} className="h-12 rounded-full bg-br text-sm font-bold text-[#1a0c02] disabled:opacity-60">
        {pending ? "Yaratilmoqda…" : "Taklif yaratish"}
      </button>
    </form>
  );
}

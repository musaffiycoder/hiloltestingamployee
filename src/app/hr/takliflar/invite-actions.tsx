"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelInvite } from "./actions";
import { Check } from "lucide-react";

export function InviteActions({ id, link, status }: { id: string; link: string; status: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canCancel = status === "INVITED" || status === "STARTED";

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="h-9 rounded-full px-3 text-[15px] font-medium text-brd"
      >
        {copied ? <Check size={16} strokeWidth={2.6} aria-label="Nusxalandi" /> : "Nusxa"}
      </button>
      {canCancel && (
        <button
          disabled={pending}
          onClick={() => {
            const msg = status === "INVITED" ? "Taklifni o'chirasizmi?" : "Taklif muddatini tugatasizmi? Nomzod davom eta olmaydi.";
            if (!confirm(msg)) return;
            start(async () => {
              const r = await cancelInvite(id);
              if (!r.ok) setError(r.error);
              router.refresh();
            });
          }}
          className="h-9 rounded-full px-3 text-[15px] font-medium text-bad disabled:opacity-40"
        >
          {status === "INVITED" ? "O'chirish" : "To'xtatish"}
        </button>
      )}
      {error && <span role="alert" className="text-[13px] text-bad">{error}</span>}
    </div>
  );
}

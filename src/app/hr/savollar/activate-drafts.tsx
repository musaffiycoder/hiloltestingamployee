"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { activateDrafts } from "./actions";

export function ActivateDrafts({ position, count }: { position: string; count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending || count === 0}
      onClick={() => {
        if (!confirm(`${count} ta qoralama savolni faollashtirasizmi? Ular darhol testlarda ishlatiladi.`)) return;
        start(async () => {
          await activateDrafts(position || null);
          router.refresh();
        });
      }}
      className="h-10 rounded-full bg-brf px-4 text-[15px] font-semibold text-onbr disabled:opacity-40"
    >
      {pending ? "…" : `Hammasini faollashtirish (${count})`}
    </button>
  );
}

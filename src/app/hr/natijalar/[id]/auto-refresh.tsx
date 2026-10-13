"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** AI tahlil fonda tayyorlanayotganda sahifani vaqti-vaqti bilan yangilaydi. */
export function AutoRefresh({ everyMs = 8000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(t);
  }, [router, everyMs]);
  return null;
}

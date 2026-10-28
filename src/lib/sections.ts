// Test ikki bo'limdan iborat: avval test (yopiq) savollar, keyin yozma (ochiq) savollar.
// Har bo'limning o'z vaqti bor; bo'limlar aralashtirilmaydi. Bazaga murojaat yo'q — brauzerda ham ishlaydi.

export type Section = "closed" | "open";

export const SECTION_LABEL: Record<Section, string> = { closed: "Test savollari", open: "Yozma savollar" };

export const sectionOf = (type: string): Section => (type === "OPEN" ? "open" : "closed");

type AttemptTimes = {
  startedAt: Date;
  timeLimitSec: number | null;
  closedTimeSec: number | null;
  openTimeSec: number | null;
  openStartedAt: Date | null;
};

export type Timing =
  | { mode: "sections"; phase: Section; left: number; closedEnd: number; hasOpen: boolean }
  | { mode: "single"; left: number };

/**
 * Urinishning joriy bo'limi va qolgan vaqti (soniya).
 * Yozma bo'lim nomzod o'tganda yoki test bo'limi vaqti tugagan zahoti boshlanadi —
 * sahifani yopib qo'yish vaqtni to'xtatmaydi.
 * `fallbackSec` — eski urinishlarda (bitta umumiy vaqt) timeLimitSec bo'lmasa, savollar vaqti yig'indisi.
 */
export function timingOf(a: AttemptTimes, fallbackSec: number, now = Date.now()): Timing {
  const start = a.startedAt.getTime();
  if (a.closedTimeSec === null && a.openTimeSec === null) {
    const total = a.timeLimitSec ?? fallbackSec;
    return { mode: "single", left: Math.max(0, Math.floor(total - (now - start) / 1000)) };
  }
  const closedEnd = start + (a.closedTimeSec ?? 0) * 1000;
  const openSec = a.openTimeSec ?? 0;
  if (!a.openStartedAt && now < closedEnd) {
    return { mode: "sections", phase: "closed", left: Math.floor((closedEnd - now) / 1000), closedEnd, hasOpen: openSec > 0 };
  }
  const openStart = a.openStartedAt ? Math.min(a.openStartedAt.getTime(), closedEnd) : closedEnd;
  return {
    mode: "sections",
    phase: "open",
    left: Math.max(0, Math.floor((openStart + openSec * 1000 - now) / 1000)),
    closedEnd,
    hasOpen: openSec > 0,
  };
}

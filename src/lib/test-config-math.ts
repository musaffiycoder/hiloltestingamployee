// Konstruktor hisob-kitoblari (brauzerda ham ishlaydi — bazaga murojaat yo'q).

export type DistItem = { code: string; weight: number; available: number };

/**
 * Jami `total` ta savolni kompetensiyalar vazniga mutanosib taqsimlaydi (eng katta qoldiq usuli).
 * Har kompetensiyaga, savoli bo'lsa, kamida 1 ta; bankdagi sondan oshmaydi; ortgan joylar sig'adiganlarga beriladi.
 */
export function distributeByWeight(items: DistItem[], total: number): Record<string, number> {
  const usable = items.filter((i) => i.available > 0);
  const cap = usable.reduce((s, i) => s + i.available, 0);
  const target = Math.max(0, Math.min(Math.round(total), cap));
  const out: Record<string, number> = Object.fromEntries(items.map((i) => [i.code, 0]));
  if (!usable.length || target === 0) return out;

  const base = Math.min(usable.length, target);
  // Avval eng og'ir vaznlilarga 1 tadan
  for (const i of [...usable].sort((a, b) => b.weight - a.weight).slice(0, base)) out[i.code] = 1;
  let left = target - base;
  while (left > 0) {
    const open = usable.filter((i) => out[i.code] < i.available);
    if (!open.length) break;
    const wSum = open.reduce((s, i) => s + i.weight, 0) || open.length;
    const shares = open.map((i) => ({ i, raw: (left * (i.weight || 1)) / wSum }));
    let given = 0;
    for (const s of shares) {
      const add = Math.min(Math.floor(s.raw), s.i.available - out[s.i.code]);
      out[s.i.code] += add;
      given += add;
    }
    left -= given;
    if (left <= 0) break;
    // Qoldiqlar bo'yicha bittadan
    const byRem = shares
      .filter((s) => out[s.i.code] < s.i.available)
      .sort((a, b) => b.raw - Math.floor(b.raw) - (a.raw - Math.floor(a.raw)) || b.i.weight - a.i.weight);
    for (const s of byRem) {
      if (left <= 0) break;
      out[s.i.code] += 1;
      left -= 1;
    }
    if (!byRem.length) break;
  }
  return out;
}

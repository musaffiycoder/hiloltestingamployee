export function timeAgo(d: Date, now = new Date()): string {
  const sec = Math.round((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "hozir";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} daqiqa oldin`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} soat oldin`;
  const days = Math.round(h / 24);
  if (days === 1) return "kecha";
  if (days < 7) return `${days} kun oldin`;
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" });
}

export function shortDate(d: Date): string {
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function weekBuckets(dates: Date[], weeks = 8, now = new Date()): number[] {
  const out = Array<number>(weeks).fill(0);
  const WEEK = 7 * 24 * 3600 * 1000;
  for (const d of dates) {
    const idx = weeks - 1 - Math.floor((now.getTime() - d.getTime()) / WEEK);
    if (idx >= 0 && idx < weeks) out[idx]++;
  }
  return out;
}

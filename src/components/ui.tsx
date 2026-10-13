import { LEVEL_COLORS, VERDICTS, levelName } from "@/lib/labels";
import type { VerdictKey } from "@/lib/scoring";

/** iOS "inset grouped" konteyner: soya yo'q, fon farqi bilan ajraladi. */
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-2xl bg-card ${className}`}>{children}</div>;
}

/** iOS bo'lim sarlavhasi (katta harfli, kulrang). */
export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 px-4">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-tx2">{children}</h2>
      {aside}
    </div>
  );
}

export function LevelChip({ level }: { level: number | null }) {
  if (level === null) {
    return <span className="inline-flex h-7 items-center rounded-full bg-soft px-3 text-xs font-semibold text-tx2">—</span>;
  }
  const idx = Math.min(5, Math.max(1, Math.round(level))) - 1;
  const [bg, fg] = LEVEL_COLORS[idx];
  return (
    <span
      className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold"
      style={{ background: bg, color: fg }}
      title={levelName(level)}
    >
      <span className="text-sm font-bold tabular-nums">{level % 1 ? level.toFixed(1) : level}</span>
      <span className="hidden sm:inline">{levelName(level)}</span>
    </span>
  );
}

export function VerdictChip({ verdict }: { verdict: VerdictKey }) {
  const v = VERDICTS[verdict];
  return (
    <span
      className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold"
      style={{ background: v.bg, color: v.fg }}
    >
      <span aria-hidden>{v.icon}</span>
      {v.label}
    </span>
  );
}

export function Pill({ children, tone = "soft" }: { children: React.ReactNode; tone?: "soft" | "brand" | "ok" | "warn" | "bad" }) {
  const tones = {
    soft: "bg-soft text-tx2",
    brand: "bg-tint text-brd",
    ok: "bg-ok-t text-ok",
    warn: "bg-warn-t text-warn",
    bad: "bg-bad-t text-bad",
  } as const;
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const v = {
    primary: "bg-brf text-onbr",
    secondary: "bg-tint text-brd",
    ghost: "text-brd hover:bg-soft",
    danger: "bg-bad-t text-bad",
  }[variant];
  return (
    <button
      {...rest}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[17px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${v} ${className}`}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-soft" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-br" style={{ width: `${pct}%` }} />
    </div>
  );
}

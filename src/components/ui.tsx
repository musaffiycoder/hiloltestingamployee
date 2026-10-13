import { LEVEL_COLORS, VERDICTS, levelName } from "@/lib/labels";
import type { VerdictKey } from "@/lib/scoring";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[18px] border border-line bg-card shadow-soft ${className}`}>{children}</div>
  );
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-bold tracking-tight">{children}</h2>
      {aside}
    </div>
  );
}

export function LevelChip({ level }: { level: number | null }) {
  if (level === null) {
    return <span className="inline-flex h-7 items-center rounded-full bg-soft px-3 text-xs font-bold text-tx2">—</span>;
  }
  const idx = Math.min(5, Math.max(1, Math.round(level))) - 1;
  const [bg, fg] = LEVEL_COLORS[idx];
  return (
    <span
      className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-bold"
      style={{ background: bg, color: fg }}
      title={levelName(level)}
    >
      <span className="font-display text-sm">{level % 1 ? level.toFixed(1) : level}</span>
      <span className="hidden sm:inline">{levelName(level)}</span>
    </span>
  );
}

export function VerdictChip({ verdict }: { verdict: VerdictKey }) {
  const v = VERDICTS[verdict];
  return (
    <span
      className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-bold"
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
  return <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const v = {
    primary: "bg-br text-[#1a0c02] hover:brightness-105",
    secondary: "bg-soft text-tx hover:brightness-95",
    ghost: "text-tx2 hover:bg-soft",
    danger: "bg-bad-t text-bad hover:brightness-95",
  }[variant];
  return (
    <button
      {...rest}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-soft" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-br" style={{ width: `${pct}%` }} />
    </div>
  );
}

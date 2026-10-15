"use client";

import { Moon, Sun } from "lucide-react";

/** Yorug'/tungi rejim almashtirgichi. Holat <html data-theme> va localStorage'da (layout'dagi no-flash skripti o'qiydi). */
export function toggleTheme() {
  const el = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const current = el.dataset.theme ?? (systemDark ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  el.dataset.theme = next;
  try {
    localStorage.setItem("baholash_theme", next);
  } catch {}
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-brd hover:bg-soft ${className}`}
      aria-label="Yorug' yoki tungi rejimga o'tish"
      title="Yorug' / tungi rejim"
    >
      <Sun size={20} className="theme-ic-sun" aria-hidden />
      <Moon size={20} className="theme-ic-moon" aria-hidden />
    </button>
  );
}

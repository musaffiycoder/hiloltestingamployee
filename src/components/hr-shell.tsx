"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpenCheck,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Sun,
  SlidersHorizontal,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon; soon?: boolean };

const NAV: NavItem[] = [
  { href: "/hr", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/hr/natijalar", label: "Nomzodlar", icon: UserCheck },
  { href: "/hr/xodimlar", label: "Xodimlar", icon: Users },
  { href: "/hr/lavozimlar", label: "Lavozim kartalari", icon: ClipboardList },
  { href: "/hr/savollar", label: "Savollar banki", icon: BookOpenCheck },
  { href: "/hr/takliflar", label: "Takliflar", icon: Plus },
  { href: "/hr/konstruktor", label: "Test konstruktori", icon: SlidersHorizontal, soon: true },
  { href: "/hr/analitika", label: "Analitika", icon: BarChart3, soon: true },
  { href: "/hr/sozlamalar", label: "Sozlamalar", icon: Settings, soon: true },
];

const TITLES: [string, string][] = [
  ["/hr/natijalar/", "Nomzod natijasi"],
  ["/hr/natijalar", "Nomzodlar"],
  ["/hr/taqqoslash", "Taqqoslash"],
  ["/hr/xodimlar", "Xodimlar baholashi"],
  ["/hr/lavozimlar", "Lavozim kartalari"],
  ["/hr/savollar", "Savollar banki"],
  ["/hr/takliflar", "Takliflar"],
  ["/hr", "Bosh sahifa"],
];

function isActive(pathname: string, href: string) {
  if (href === "/hr") return pathname === "/hr";
  return pathname === href || pathname.startsWith(href + "/");
}

export function HrShell({
  user,
  logoutAction,
  children,
}: {
  user: { name: string; email: string };
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Holat <html> atributlarida (data-sidebar, data-theme) saqlanadi: React state kerak emas,
  // no-flash skripti sahifa chizilishidan oldin o'rnatadi.
  const toggleSide = () => {
    const el = document.documentElement;
    const next = el.dataset.sidebar === "collapsed" ? "open" : "collapsed";
    el.dataset.sidebar = next;
    try {
      localStorage.setItem("baholash_sidebar", next);
    } catch {}
  };

  const toggleTheme = () => {
    const el = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const current = el.dataset.theme ?? (systemDark ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    el.dataset.theme = next;
    try {
      localStorage.setItem("baholash_theme", next);
    } catch {}
  };

  const title = TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? "Baholash";
  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const phoneItems = [NAV[0], NAV[1], null, NAV[2], NAV[3]] as (NavItem | null)[];

  return (
    <div className="mesh-bg min-h-screen md:flex">
      {/* Sidebar (planshet va desktop) */}
      <aside
        className="glass sticky top-0 hidden h-screen w-[72px] shrink-0 flex-col gap-1 border-y-0 border-l-0 p-3 md:flex lg:w-60 [:root[data-sidebar=collapsed]_&]:lg:w-[72px]"
        aria-label="Asosiy navigatsiya"
      >
        <div className="mb-4 flex items-center gap-2 px-1.5 pt-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-br font-display text-lg font-bold text-[#1a0c02]">
            B
          </div>
          <span className="hidden font-display text-xl font-bold text-navy lg:inline [:root[data-sidebar=collapsed]_&]:lg:hidden">Baholash</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Bo'limlar">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = isActive(pathname, n.href);
            const label = (
              <>
                <Icon size={20} aria-hidden className="shrink-0" />
                <span className="hidden whitespace-nowrap lg:inline [:root[data-sidebar=collapsed]_&]:lg:hidden">{n.label}</span>
                {n.soon && (
                  <span className="ml-auto hidden rounded-full bg-soft px-2 py-0.5 text-[10px] font-bold text-tx2 lg:inline [:root[data-sidebar=collapsed]_&]:lg:hidden">
                    tez kunda
                  </span>
                )}
              </>
            );
            const cls = `flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold ${
              active ? "bg-tint text-brd" : "text-tx hover:bg-soft"
            } ${n.soon ? "cursor-not-allowed opacity-50" : ""}`;
            return n.soon ? (
              <div key={n.href} className={cls} title={`${n.label} — tez kunda`} aria-disabled="true">
                {label}
              </div>
            ) : (
              <Link key={n.href} href={n.href} className={cls} title={n.label} aria-current={active ? "page" : undefined}>
                {label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={toggleSide}
          className="hidden h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-tx2 hover:bg-soft lg:flex"
          aria-label="Sidebarni yig'ish yoki ochish"
        >
          <PanelLeftClose size={20} className="[:root[data-sidebar=collapsed]_&]:hidden" />
          <PanelLeftOpen size={20} className="hidden [:root[data-sidebar=collapsed]_&]:block" />
          <span className="[:root[data-sidebar=collapsed]_&]:hidden">Yig'ish</span>
        </button>

        <div className="flex items-center gap-2 border-t border-line px-1.5 pt-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-soft text-xs font-bold">{initials}</div>
          <div className="hidden min-w-0 flex-1 lg:block [:root[data-sidebar=collapsed]_&]:lg:hidden">
            <div className="truncate text-sm font-bold">{user.name}</div>
            <div className="truncate text-xs text-tx2">HR menejer</div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Yuqori panel */}
        <header className="glass sticky top-0 z-20 flex h-16 items-center gap-3 border-x-0 border-t-0 px-4 md:px-8">
          <h1 className="min-w-0 flex-1 truncate font-display text-xl font-bold text-navy md:text-2xl">{title}</h1>
          <button
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-full text-tx2 hover:bg-soft"
            aria-label="Mavzuni almashtirish"
          >
            <Sun size={18} className="hidden [:root[data-theme=dark]_&]:block" />
            <Moon size={18} className="block [:root[data-theme=dark]_&]:hidden" />
          </button>
          <Link
            href="/hr/takliflar"
            className="hidden min-h-10 items-center gap-1.5 rounded-full bg-br px-4 text-sm font-bold text-[#1a0c02] sm:inline-flex"
          >
            <Plus size={16} aria-hidden /> Yangi baholash
          </Link>
          <form action={logoutAction}>
            <button className="flex h-10 w-10 items-center justify-center rounded-full text-tx2 hover:bg-soft" aria-label="Chiqish" title={user.email}>
              <LogOut size={18} />
            </button>
          </form>
        </header>

        <main className="px-4 pb-28 pt-6 md:px-8 md:pb-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Telefon: suzuvchi shisha tab bar */}
      <nav
        className="glass fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-full px-2 py-1.5 shadow-soft md:hidden"
        style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
        aria-label="Telefon navigatsiyasi"
      >
        {phoneItems.map((n, i) => {
          if (!n) {
            return (
              <Link
                key="center"
                href="/hr/takliflar"
                className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-br text-[#1a0c02] shadow-soft"
                aria-label="Yangi baholash"
              >
                <Plus size={26} />
              </Link>
            );
          }
          const Icon = n.icon;
          const active = isActive(pathname, n.href);
          return (
            <Link
              key={n.href + i}
              href={n.href}
              className={`flex min-w-14 flex-col items-center gap-0.5 rounded-2xl px-2 py-1 text-[10px] font-bold ${
                active ? "text-brd" : "text-tx2"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={20} aria-hidden />
              {n.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

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
  Scale,
  Plus,
  Settings,
  SlidersHorizontal,
  Sun,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; short: string; icon: LucideIcon; soon?: boolean };

const NAV: NavItem[] = [
  { href: "/hr", label: "Bosh sahifa", short: "Bosh", icon: LayoutDashboard },
  { href: "/hr/natijalar", label: "Nomzodlar", short: "Nomzodlar", icon: UserCheck },
  { href: "/hr/xodimlar", label: "Xodimlar", short: "Xodimlar", icon: Users },
  { href: "/hr/lavozimlar", label: "Lavozim kartalari", short: "Lavozimlar", icon: ClipboardList },
  { href: "/hr/savollar", label: "Savollar banki", short: "Savollar", icon: BookOpenCheck },
  { href: "/hr/takliflar", label: "Takliflar", short: "Takliflar", icon: Plus },
  { href: "/hr/kalibrlash", label: "Kalibrlash", short: "Kalibrlash", icon: Scale },
  { href: "/hr/konstruktor", label: "Test konstruktori", short: "Konstruktor", icon: SlidersHorizontal, soon: true },
  { href: "/hr/analitika", label: "Analitika", short: "Analitika", icon: BarChart3, soon: true },
  { href: "/hr/sozlamalar", label: "Sozlamalar", short: "Sozlamalar", icon: Settings },
];

const PHONE_TABS = [NAV[0], NAV[1], NAV[2], NAV[4], NAV[5]];

const TITLES: [string, string][] = [
  ["/hr/natijalar/", "Nomzod natijasi"],
  ["/hr/natijalar", "Nomzodlar"],
  ["/hr/taqqoslash", "Taqqoslash"],
  ["/hr/xodimlar", "Xodimlar"],
  ["/hr/lavozimlar", "Lavozim kartalari"],
  ["/hr/savollar", "Savollar banki"],
  ["/hr/takliflar", "Takliflar"],
  ["/hr/kalibrlash", "Kalibrlash"],
  ["/hr/sozlamalar", "Sozlamalar"],
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

  // Holat <html> atributlarida (data-sidebar, data-theme) saqlanadi: no-flash skripti
  // sahifa chizilishidan oldin o'rnatadi, React state kerak emas.
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

  return (
    <div className="mesh-bg min-h-screen md:flex">
      {/* iPadOS uslubidagi sidebar */}
      <aside
        className="glass sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col gap-1 border-y-0 border-l-0 px-3 pb-4 pt-5 md:flex lg:w-64 [:root[data-sidebar=collapsed]_&]:lg:w-[76px]"
        aria-label="Asosiy navigatsiya"
      >
        <div className="mb-4 flex items-center gap-3 px-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-b from-[#ff8a3d] to-[#e5530a] text-lg font-bold text-white">
            B
          </div>
          <span className="hidden text-[20px] font-bold tracking-tight lg:inline [:root[data-sidebar=collapsed]_&]:lg:hidden">
            Baholash
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Bo'limlar">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = isActive(pathname, n.href);
            const inner = (
              <>
                <Icon size={21} strokeWidth={active ? 2.4 : 1.9} aria-hidden className="shrink-0" />
                <span className="hidden whitespace-nowrap text-[15px] lg:inline [:root[data-sidebar=collapsed]_&]:lg:hidden">
                  {n.label}
                </span>
                {n.soon && (
                  <span className="ml-auto hidden text-[11px] font-medium text-tx2 lg:inline [:root[data-sidebar=collapsed]_&]:lg:hidden">
                    tez kunda
                  </span>
                )}
              </>
            );
            const cls = `flex h-11 items-center gap-3 rounded-xl px-3 font-medium ${
              active ? "bg-tint text-brd" : "text-tx hover:bg-soft"
            } ${n.soon ? "cursor-not-allowed opacity-45" : ""}`;
            return n.soon ? (
              <div key={n.href} className={cls} title={`${n.label} — tez kunda`} aria-disabled="true">
                {inner}
              </div>
            ) : (
              <Link key={n.href} href={n.href} className={cls} title={n.label} aria-current={active ? "page" : undefined}>
                {inner}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={toggleSide}
          className="hidden h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-tx2 hover:bg-soft lg:flex"
          aria-label="Sidebarni yig'ish yoki ochish"
        >
          <PanelLeftClose size={21} className="[:root[data-sidebar=collapsed]_&]:hidden" />
          <PanelLeftOpen size={21} className="hidden [:root[data-sidebar=collapsed]_&]:block" />
          <span className="[:root[data-sidebar=collapsed]_&]:hidden">Yig'ish</span>
        </button>

        <div className="flex items-center gap-3 border-t border-line px-1 pt-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-soft text-xs font-semibold">
            {initials}
          </div>
          <div className="hidden min-w-0 flex-1 lg:block [:root[data-sidebar=collapsed]_&]:lg:hidden">
            <div className="truncate text-[15px] font-semibold">{user.name}</div>
            <div className="truncate text-xs text-tx2">HR menejer</div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Navigatsiya paneli: iOS "inline title" */}
        <header className="glass sticky top-0 z-20 grid h-12 grid-cols-[1fr_auto_1fr] items-center border-x-0 border-t-0 px-3 md:h-14 md:px-6">
          <span className="hidden md:block" />
          <h1 className="col-start-2 truncate text-[17px] font-semibold md:col-start-1 md:row-start-1 md:text-left">{title}</h1>
          <div className="col-start-3 flex items-center justify-end gap-1 md:col-start-3">
            <button
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-full text-brd hover:bg-soft"
              aria-label="Mavzuni almashtirish"
            >
              <Sun size={20} className="hidden [:root[data-theme=dark]_&]:block" />
              <Moon size={20} className="block [:root[data-theme=dark]_&]:hidden" />
            </button>
            <Link
              href="/hr/takliflar"
              className="hidden min-h-9 items-center gap-1 rounded-full bg-brf px-4 text-[15px] font-semibold text-onbr sm:inline-flex"
            >
              <Plus size={16} aria-hidden /> Yangi baholash
            </Link>
            <form action={logoutAction}>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full text-brd hover:bg-soft"
                aria-label="Chiqish"
                title={user.email}
              >
                <LogOut size={20} />
              </button>
            </form>
          </div>
        </header>

        <main className="px-4 pb-28 pt-5 md:px-8 md:pb-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Telefon: iOS tab bar (to'liq kenglik, material, hairline) */}
      <nav
        className="glass fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-x-0 border-b-0 md:hidden"
        style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
        aria-label="Telefon navigatsiyasi"
      >
        {PHONE_TABS.map((n) => {
          const Icon = n.icon;
          const active = isActive(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-col items-center gap-0.5 pb-0.5 pt-1.5 text-[10px] font-medium ${active ? "text-brd" : "text-tx2"}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={24} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
              {n.short}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

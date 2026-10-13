import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, Pill, SectionTitle } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { PasswordForm, UserForm } from "./forms";

export const metadata: Metadata = { title: "Sozlamalar" };

const ROLE: Record<string, string> = { ADMIN: "Admin", HR: "HR", MANAGER: "Menejer" };

export default async function SettingsPage() {
  const me = await requireUser();
  const users = me.role === "ADMIN" ? await db.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, role: true, createdAt: true } }) : [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-7">
      <header className="px-1">
        <h2 className="text-[34px] font-bold leading-tight">Sozlamalar</h2>
        <p className="mt-1 text-[15px] text-tx2">{me.name} · {me.email}</p>
      </header>

      <section>
        <SectionTitle>Parolni almashtirish</SectionTitle>
        <PasswordForm />
      </section>

      {me.role === "ADMIN" && (
        <>
          <section>
            <SectionTitle>Jamoa</SectionTitle>
            <Card>
              <ul>
                {users.map((u, i) => (
                  <li key={u.id} className={`flex items-center gap-3 px-4 py-3 ${i < users.length - 1 ? "border-b border-line" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[17px] font-semibold">{u.name}</div>
                      <div className="truncate text-[13px] text-tx2">{u.email} · {shortDate(u.createdAt)}</div>
                    </div>
                    <Pill tone={u.role === "ADMIN" ? "brand" : "soft"}>{ROLE[u.role]}</Pill>
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          <section>
            <SectionTitle>Yangi foydalanuvchi</SectionTitle>
            <UserForm />
          </section>
        </>
      )}
    </div>
  );
}

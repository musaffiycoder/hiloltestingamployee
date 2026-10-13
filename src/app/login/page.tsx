import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Kirish" };

export default async function LoginPage() {
  if (await getUser()) redirect("/hr");
  return (
    <main className="mesh-bg flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-sm rounded-[24px] p-7 shadow-soft">
        <div className="mb-6">
          <div className="font-display text-2xl font-bold text-navy">Baholash</div>
          <p className="mt-1 text-sm text-tx2">HR panelga kirish</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

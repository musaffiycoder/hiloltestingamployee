import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Kirish" };

export default async function LoginPage() {
  if (await getUser()) redirect("/hr");
  return (
    <main className="mesh-bg flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-[18px] bg-gradient-to-b from-[#ff8a3d] to-[#e5530a] text-4xl font-bold text-white">
            B
          </div>
          <h1 className="text-[34px] font-bold leading-tight">Baholash</h1>
          <p className="mt-1 text-[17px] text-tx2">HR panelga kirish</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const field =
    "h-12 w-full rounded-2xl border border-line bg-card px-4 text-[15px] outline-none focus:border-br focus:ring-2 focus:ring-br/30";
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wide text-tx2">
        Email
        <input name="email" type="email" autoComplete="username" required className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wide text-tx2">
        Parol
        <input name="password" type="password" autoComplete="current-password" required className={field} />
      </label>
      {state.error && (
        <p role="alert" className="rounded-xl bg-bad-t px-3 py-2 text-sm font-semibold text-bad">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="h-12 rounded-full bg-br text-sm font-bold text-[#1a0c02] disabled:opacity-60"
      >
        {pending ? "Kirilmoqda…" : "Kirish"}
      </button>
    </form>
  );
}

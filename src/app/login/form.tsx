"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      {/* iOS inset grouped: bitta konteyner, hairline ajratgich */}
      <div className="overflow-hidden rounded-2xl bg-card">
        <label className="flex items-center gap-3 px-4">
          <span className="w-16 shrink-0 text-[17px]">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="hr@kompaniya.uz"
            className="h-12 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-tx2/60"
          />
        </label>
        <div className="ml-4 h-px bg-line" />
        <label className="flex items-center gap-3 px-4">
          <span className="w-16 shrink-0 text-[17px]">Parol</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Majburiy"
            className="h-12 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-tx2/60"
          />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="px-4 text-[13px] font-medium text-bad">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="h-[50px] rounded-full bg-brf text-[17px] font-semibold text-onbr disabled:opacity-50"
      >
        {pending ? "Kirilmoqda…" : "Kirish"}
      </button>
    </form>
  );
}

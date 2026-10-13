"use client";

import { useActionState, useRef } from "react";
import { changePassword, createUser, type FormState } from "./actions";

const row = "flex min-h-[48px] items-center gap-3 px-4";
const lbl = "w-32 shrink-0 text-[17px]";
const ctl = "min-w-0 flex-1 bg-transparent text-right text-[17px] outline-none placeholder:text-tx2/60";

function Result({ s }: { s: FormState }) {
  if (s.error) return <p role="alert" className="px-4 text-[13px] font-medium text-bad">{s.error}</p>;
  if (s.ok) return <p role="status" className="px-4 text-[13px] font-medium text-ok">✓ {s.message}</p>;
  return null;
}

export function PasswordForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(async (p, f) => {
    const r = await changePassword(p, f);
    if (r.ok) ref.current?.reset();
    return r;
  }, {});
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl bg-card">
        <label className={row}>
          <span className={lbl}>Joriy parol</span>
          <input name="current" type="password" autoComplete="current-password" required className={ctl} />
        </label>
        <div className="ml-4 h-px bg-line" />
        <label className={row}>
          <span className={lbl}>Yangi parol</span>
          <input name="next" type="password" autoComplete="new-password" required minLength={10} placeholder="Kamida 10 belgi" className={ctl} />
        </label>
        <div className="ml-4 h-px bg-line" />
        <label className={row}>
          <span className={lbl}>Tasdiqlash</span>
          <input name="confirm" type="password" autoComplete="new-password" required className={ctl} />
        </label>
      </div>
      <Result s={state} />
      <button disabled={pending} className="h-[50px] rounded-full bg-brf text-[17px] font-semibold text-onbr disabled:opacity-50">
        {pending ? "Saqlanmoqda…" : "Parolni yangilash"}
      </button>
    </form>
  );
}

export function UserForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(async (p, f) => {
    const r = await createUser(p, f);
    if (r.ok) ref.current?.reset();
    return r;
  }, {});
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl bg-card">
        <label className={row}>
          <span className={lbl}>Ism</span>
          <input name="name" required className={ctl} placeholder="Familiya Ism" />
        </label>
        <div className="ml-4 h-px bg-line" />
        <label className={row}>
          <span className={lbl}>Email</span>
          <input name="email" type="email" required className={ctl} placeholder="ism@kompaniya.uz" />
        </label>
        <div className="ml-4 h-px bg-line" />
        <label className={row}>
          <span className={lbl}>Rol</span>
          <select name="role" defaultValue="HR" className={`${ctl} text-brd`}>
            <option value="HR">HR (to'liq)</option>
            <option value="MANAGER">Menejer (ko'rish)</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        <div className="ml-4 h-px bg-line" />
        <label className={row}>
          <span className={lbl}>Vaqtinchalik parol</span>
          <input name="password" type="text" autoComplete="off" required minLength={10} className={ctl} placeholder="Kamida 10 belgi" />
        </label>
      </div>
      <Result s={state} />
      <button disabled={pending} className="h-[50px] rounded-full bg-tint text-[17px] font-semibold text-brd disabled:opacity-50">
        {pending ? "Qo'shilmoqda…" : "Foydalanuvchi qo'shish"}
      </button>
    </form>
  );
}

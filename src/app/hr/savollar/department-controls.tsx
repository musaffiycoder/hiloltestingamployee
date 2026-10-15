"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FolderPlus, Pencil, Trash2, X } from "lucide-react";
import { createDepartment, deleteDepartment, renameDepartment, type ActionState } from "./test-actions";

const input = "h-9 min-w-0 flex-1 rounded-[10px] bg-soft px-3 text-[15px] outline-none focus:ring-2 focus:ring-br/40";
const iconBtn = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brd hover:bg-soft disabled:opacity-40";

function Status({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-[13px] font-medium ${state.ok ? "text-ok" : "text-bad"}`}>
      {state.message}
    </p>
  );
}

/** «+ Bo'lim» tugmasi va qo'shish formasi. */
export function AddDepartment() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const submit = () =>
    start(async () => {
      const r = await createDepartment(name);
      setState(r);
      if (r?.ok) {
        setName("");
        setOpen(false);
        router.refresh();
      }
    });

  if (!open)
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-tint px-4 text-[15px] font-semibold text-brd"
        >
          <FolderPlus size={17} aria-hidden /> Bo&apos;lim
        </button>
        {state?.ok && <Status state={state} />}
      </div>
    );
  return (
    <form
      className="flex w-full flex-col gap-1 sm:w-auto"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-1.5">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Sotuv bo'limi" aria-label="Yangi bo'lim nomi" className={`${input} sm:w-64`} />
        <button type="submit" disabled={pending || name.trim().length < 2} className="h-9 rounded-full bg-brf px-4 text-[15px] font-semibold text-onbr disabled:opacity-40">
          Qo&apos;shish
        </button>
        <button type="button" onClick={() => setOpen(false)} className={iconBtn} aria-label="Bekor qilish">
          <X size={18} aria-hidden />
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}

/** Bo'lim sarlavhasi yonidagi nomini o'zgartirish / o'chirish. */
export function DepartmentActions({ id, name, tests }: { id: string; name: string; tests: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      const r = await fn();
      setState(r);
      if (r?.ok) {
        setEditing(false);
        router.refresh();
      }
    });

  if (editing)
    return (
      <form
        className="flex flex-1 items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => renameDepartment(id, value));
        }}
      >
        <input autoFocus onFocus={(e) => e.target.select()} value={value} onChange={(e) => setValue(e.target.value)} aria-label="Bo'lim nomi" className={input} />
        <button type="submit" disabled={pending} className={iconBtn} aria-label="Saqlash">
          <Check size={18} aria-hidden />
        </button>
        <button type="button" onClick={() => setEditing(false)} className={iconBtn} aria-label="Bekor qilish">
          <X size={18} aria-hidden />
        </button>
        <Status state={state} />
      </form>
    );
  return (
    <span className="flex items-center">
      {state && !state.ok && <Status state={state} />}
      <button type="button" onClick={() => setEditing(true)} className={iconBtn} aria-label={`«${name}» nomini o'zgartirish`} title="Nomini o'zgartirish">
        <Pencil size={15} aria-hidden />
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const note = tests ? `\n\nUndagi ${tests} ta test o'chmaydi — «Bo'limsiz» guruhiga o'tadi.` : "";
          if (confirm(`«${name}» bo'limini o'chirasizmi?${note}`)) run(() => deleteDepartment(id));
        }}
        className={`${iconBtn} text-bad`}
        aria-label={`«${name}» bo'limini o'chirish`}
        title="O'chirish"
      >
        <Trash2 size={15} aria-hidden />
      </button>
    </span>
  );
}

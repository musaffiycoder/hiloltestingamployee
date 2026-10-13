"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="min-h-11 rounded-full bg-soft px-5 text-sm font-bold hover:brightness-95 print:hidden"
    >
      PDF
    </button>
  );
}

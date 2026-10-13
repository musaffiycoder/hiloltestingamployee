"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="h-11 w-full rounded-full bg-tint text-[17px] font-semibold text-brd print:hidden"
    >
      PDF
    </button>
  );
}

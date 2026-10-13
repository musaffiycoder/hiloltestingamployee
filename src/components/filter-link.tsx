"use client";

import Link, { useLinkStatus } from "next/link";

function Pending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span
      aria-hidden
      className="ml-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent align-[-1px]"
    />
  ) : null;
}

/** Link + «yuklanmoqda» belgisi: server tomonidagi filtrlarda bosganda darhol fikr-mulohaza beradi. */
export function FilterLink({ children, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <Pending />
    </Link>
  );
}

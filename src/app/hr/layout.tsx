import { requireUser } from "@/lib/auth";
import { HrShell } from "@/components/hr-shell";
import { logout } from "../login/actions";

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <HrShell user={{ name: user.name, email: user.email }} logoutAction={logout}>
      {children}
    </HrShell>
  );
}

import { AdminHeader } from "@/components/admin-header";
import { AdminShell } from "@/components/admin-shell";

export default function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell>
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 pb-28">{children}</main>
    </AdminShell>
  );
}

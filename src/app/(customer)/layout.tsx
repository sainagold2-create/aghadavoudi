import { CustomerHeader } from "@/components/customer-header";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomerHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}

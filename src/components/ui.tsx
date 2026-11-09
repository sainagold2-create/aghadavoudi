import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-black/5 bg-white/90 p-5 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const styles = {
    primary: "bg-[#03613C] text-white hover:bg-[#024d30]",
    secondary: "bg-[#7F4700] text-white hover:bg-[#663900]",
    danger: "bg-red-700 text-white hover:bg-red-800",
    ghost: "bg-transparent text-[#03613C] border border-[#03613C]/30 hover:bg-emerald-50",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        styles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#03613C]",
        props.className
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#03613C]",
        props.className
      )}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-slate-700">{children}</label>;
}

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

export function CustomBadge() {
  return (
    <Badge className="bg-[#7F4700]/[0.06] text-[#7F4700]/55 ring-1 ring-[#7F4700]/15">
      سفارشی
    </Badge>
  );
}

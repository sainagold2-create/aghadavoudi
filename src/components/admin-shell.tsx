"use client";

import type { ReactNode } from "react";
import { UndoActionProvider } from "@/components/undo-toast";

export function AdminShell({ children }: { children: ReactNode }) {
  return <UndoActionProvider>{children}</UndoActionProvider>;
}

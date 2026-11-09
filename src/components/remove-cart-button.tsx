"use client";

import { useTransition } from "react";
import { removeCartItemAction } from "@/lib/actions/customer";
import { Button } from "./ui";

export function RemoveCartButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() => start(async () => {
        await removeCartItemAction(id);
      })}
    >
      حذف از سبد
    </Button>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  advanceOrderFromCard,
  revertOrderCardUndo,
  type OrderCardUndo,
} from "@/lib/actions/admin";
import { useRouter } from "next/navigation";
import { toFaDigits } from "@/lib/utils";

type Pending = {
  label: string;
  undo: OrderCardUndo;
};

type UndoCtx = {
  schedule: (label: string, payload: Record<string, string>) => void;
  busy: boolean;
};

const Ctx = createContext<UndoCtx | null>(null);

export function useUndoAction() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUndoAction outside provider");
  return ctx;
}

const SECONDS = 5;

export function UndoActionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [left, setLeft] = useState(SECONDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const clearTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const dismiss = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
    setPending(null);
    setLeft(SECONDS);
    setError(null);
  }, []);

  const undo = useCallback(async () => {
    const current = pendingRef.current;
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await revertOrderCardUndo(current.undo);
      if (res && res.ok === false) {
        setError(res.error || "خطا در بازگردانی");
        setBusy(false);
        return;
      }
      dismiss();
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [dismiss, router]);

  const schedule = useCallback(
    async (label: string, payload: Record<string, string>) => {
      // اقدام قبلی دیگر قابل لغو نیست (اعمال‌شده مانده)
      clearTimer();
      pendingRef.current = null;
      setPending(null);
      setBusy(true);
      setError(null);

      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => fd.set(k, v));

      try {
        const res = (await advanceOrderFromCard(fd)) as {
          ok?: boolean;
          error?: string;
          undo?: OrderCardUndo;
        };
        if (!res?.ok) {
          setError(res?.error || "خطا در ثبت");
          setBusy(false);
          return;
        }

        router.refresh();

        if (res.undo?.historyId) {
          const next = { label, undo: res.undo };
          pendingRef.current = next;
          setPending(next);
          setLeft(SECONDS);
          let s = SECONDS;
          timer.current = setInterval(() => {
            s -= 1;
            setLeft(s);
            if (s <= 0) {
              // مهلت تمام — تغییر قطعی می‌ماند
              clearTimer();
              pendingRef.current = null;
              setPending(null);
              setLeft(SECONDS);
            }
          }, 1000);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  useEffect(() => () => clearTimer(), []);

  const value = useMemo(() => ({ schedule, busy }), [schedule, busy]);

  const progress = left / SECONDS;
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - progress);

  return (
    <Ctx.Provider value={value}>
      {children}

      {pending && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void undo()}
            title={`لغو «${pending.label}»`}
            aria-label={`لغو تغییر — ${toFaDigits(left)} ثانیه`}
            className="pointer-events-auto relative flex h-[5.5rem] w-[5.5rem] flex-col items-center justify-center rounded-full bg-white shadow-[0_8px_30px_rgba(0,0,0,0.18)] ring-2 ring-red-200 transition hover:bg-red-50 hover:ring-red-300 disabled:opacity-60"
          >
            <svg
              className="absolute inset-0 h-full w-full -rotate-90 p-1"
              viewBox="0 0 88 88"
              aria-hidden
            >
              <circle cx="44" cy="44" r={r} fill="none" stroke="#fecaca" strokeWidth="5" />
              <circle
                cx="44"
                cy="44"
                r={r}
                fill="none"
                stroke="#dc2626"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-[stroke-dashoffset] duration-1000 linear"
              />
            </svg>
            <span className="relative text-2xl font-bold leading-none text-red-700">
              {toFaDigits(left)}
            </span>
            <span className="relative mt-0.5 text-[11px] font-medium text-red-600">لغو</span>
          </button>
        </div>
      )}

      {error && !pending && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <button
            type="button"
            onClick={dismiss}
            title={error}
            className="max-w-sm rounded-full bg-red-600 px-4 py-2.5 text-xs text-white shadow-lg"
          >
            {error}
          </button>
        </div>
      )}
    </Ctx.Provider>
  );
}

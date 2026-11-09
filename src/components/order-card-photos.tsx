"use client";

import { useEffect, useState } from "react";

type Photo = { id: string; originalName: string; mimeType?: string };

export function OrderCardPhotos({
  photos,
  size = "sm",
}: {
  photos: Photo[];
  size?: "sm" | "md";
}) {
  const [active, setActive] = useState<Photo | null>(null);
  const box = size === "md" ? "h-24 w-24" : "h-12 w-12";

  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActive(null);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [active]);

  if (photos.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(p)}
            className={`${box} overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-[#03613C]/40`}
            title={p.originalName}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/files/${p.id}`}
              alt={p.originalName}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActive(null);
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={active.originalName}
            className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
              <p className="truncate text-xs text-slate-600">{active.originalName}</p>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              >
                بستن
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/files/${active.id}`}
              alt={active.originalName}
              className="max-h-[80vh] w-auto max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}

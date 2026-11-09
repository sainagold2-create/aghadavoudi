"use client";

import { useId, useRef, useState } from "react";
import { toFaDigits } from "@/lib/utils";

export function PersianFileInput({
  name,
  accept = "image/*",
  multiple = true,
  required,
  label = "عکس طرح",
  hint = "می‌توانید چند عکس انتخاب کنید",
}: {
  name: string;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  label?: string;
  hint?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-slate-600">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        required={required && files.length === 0}
        className="sr-only"
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          setFiles(list);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-[#03613C] px-3 py-1.5 text-xs text-white hover:bg-[#024d30]"
        >
          {multiple ? "انتخاب عکس‌ها" : "انتخاب فایل"}
        </button>
        <span className="text-[11px] text-slate-500">
          {files.length === 0
            ? hint
            : files.length === 1
              ? files[0].name
              : `${toFaDigits(files.length)} فایل انتخاب شد`}
        </span>
      </div>
      {files.length > 1 && (
        <ul className="mt-1.5 max-h-20 space-y-0.5 overflow-auto text-[11px] text-slate-500">
          {files.map((f) => (
            <li key={`${f.name}-${f.size}-${f.lastModified}`} className="truncate">
              {f.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

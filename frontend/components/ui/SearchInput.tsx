"use client";

import { SearchIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/** Barra de búsqueda redonda estilo app (Rappi/Morfi). */
export default function SearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  onSubmit,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full bg-white px-4 shadow-[var(--shadow-soft)] ring-1 ring-zinc-100",
        className
      )}
    >
      <SearchIcon size={18} className="shrink-0 text-zinc-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
        placeholder={placeholder}
        className="min-h-[48px] w-full bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400"
      />
    </div>
  );
}

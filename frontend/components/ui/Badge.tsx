import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "primary" | "secondary" | "danger" | "neutral" | "info";

const TONES: Record<Tone, string> = {
  primary: "bg-orange-50 text-primary",
  secondary: "bg-green-50 text-green-700",
  danger: "bg-red-50 text-danger",
  neutral: "bg-zinc-100 text-zinc-700",
  info: "bg-blue-50 text-blue-700",
};

/** Badge / etiqueta de estado, pequeña y redonda. */
export default function Badge({
  children,
  tone = "neutral",
  icon,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
        TONES[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

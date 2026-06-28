import { cn } from "@/lib/cn";

/** Spinner circular simple, hereda color con currentColor. */
export default function Spinner({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      style={{ width: size, height: size }}
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
    />
  );
}

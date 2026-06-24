"use client";

import { StarIcon } from "@/components/icons";

export default function StarRating({
  value,
  onChange,
  size = 20,
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
}) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-1">
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(star)}
          aria-label={`${star} estrella${star === 1 ? "" : "s"}`}
          className={onChange ? "cursor-pointer" : "cursor-default"}
        >
          <StarIcon
            size={size}
            filled={star <= value}
            className={star <= value ? "text-amber-400" : "text-zinc-300"}
          />
        </button>
      ))}
    </div>
  );
}

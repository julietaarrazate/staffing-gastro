"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { Review } from "@/lib/types";
import StarRating from "@/components/StarRating";
import { Skeleton } from "@/components/ui";
import { formatShiftDate } from "@/lib/datetime";

/**
 * Reseñas públicas de un trabajador, para que el comercio lo vetee antes de
 * asignar (inspiración: "Reseñas recientes" de Clickie). Consume
 * `GET /reviews/workers/{id}` (reseñas recibidas, más nuevas primero).
 */
function ReviewSkeleton() {
  return (
    <div className="rounded-xl bg-surface px-3 py-2.5" aria-hidden>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-2 h-3.5 w-full" />
      <Skeleton className="mt-1.5 h-3.5 w-2/3" />
    </div>
  );
}

export default function WorkerReviews({ workerProfileId }: { workerProfileId: string }) {
  const { token } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    api
      .get<Review[]>(`/reviews/workers/${workerProfileId}`, token)
      .then(setReviews)
      .catch((err) => setError(getErrorMessage(err, "No pudimos cargar las reseñas")))
      .finally(() => setLoading(false));
  }, [token, workerProfileId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <ReviewSkeleton />
        <ReviewSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-danger-text">
        {error}{" "}
        <button
          type="button"
          onClick={load}
          className="font-semibold underline decoration-danger/40 underline-offset-2 hover:opacity-80"
        >
          Reintentar
        </button>
      </p>
    );
  }

  if (reviews.length === 0) {
    return <p className="text-sm text-ink/50">Todavía no tiene reseñas.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-xl bg-surface px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <StarRating value={review.rating} size={16} />
            <span className="text-xs text-ink/40">{formatShiftDate(review.created_at)}</span>
          </div>
          {review.comment && <p className="mt-1 text-sm text-ink/60">{review.comment}</p>}
        </div>
      ))}
    </div>
  );
}

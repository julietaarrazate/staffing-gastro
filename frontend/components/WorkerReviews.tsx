"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { Review } from "@/lib/types";
import StarRating from "@/components/StarRating";
import { Skeleton } from "@/components/ui";
import { formatReviewDate, formatShiftDate } from "@/lib/datetime";
import { Estrellas } from "@/components/profile/ProfileParts";

/**
 * Reseñas públicas de un trabajador, para que el comercio lo vetee antes de
 * asignar. Consume
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

/**
 * Con `suave` (la ficha con la dirección suave, ADR-0028): las mismas reseñas
 * sobre la hoja, cada una en una caja con el relleno del campo, con estrellas
 * azules (el ámbar de `StarRating` sumaba otro a la pantalla).
 */
export default function WorkerReviews({
  workerProfileId,
  suave = false,
}: {
  workerProfileId: string;
  suave?: boolean;
}) {
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

  if (loading && suave) return <Skeleton className="h-24 w-full rounded-[20px]" />;
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
    return suave ? (
      <p className="text-sm text-ink-soft">Todavía no tiene reseñas.</p>
    ) : (
      <p className="text-sm text-ink/50">Todavía no tiene reseñas.</p>
    );
  }

  if (suave) {
    return (
      <ul className="flex flex-col gap-3">
        {reviews.map((review) => (
          <li key={review.id} className="caja-suave p-4">
            {review.comment && (
              <p className="mb-2 break-words text-sm font-semibold leading-snug text-ink">«{review.comment}»</p>
            )}
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-soft">
              <Estrellas valor={review.rating} size={14} />
              {formatReviewDate(review.created_at)}
            </p>
          </li>
        ))}
      </ul>
    );
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

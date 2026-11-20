"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { Review } from "@/lib/types";
import StarRating from "@/components/StarRating";
import { Skeleton } from "@/components/ui";
import { formatReviewDate, formatShiftDate } from "@/lib/datetime";
import { Estrellas, SectionLabel } from "@/components/profile/ProfileParts";

function ReviewSkeleton() {
  return (
    <div className="rounded-xl bg-surface px-3 py-2.5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-2 h-3.5 w-full" />
      <Skeleton className="mt-1.5 h-3.5 w-2/3" />
    </div>
  );
}

/**
 * Sección "Reseñas recibidas" del perfil, con su rótulo y su tarjeta. Sin
 * reseñas no dibuja nada (sobrecarga visual, 2026-09-30): "Todavía no tenés
 * reseñas" era una sección más diciéndole a la persona nueva lo que no tiene.
 */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <section>
      <SectionLabel>Reseñas recibidas</SectionLabel>
      <div className="mt-2 rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-soft)] ring-1 ring-line">
        {children}
      </div>
    </section>
  );
}

/** La nota y el día de una reseña, en un renglón. */
function Pie({ review }: { review: Review }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-soft">
      <Estrellas valor={review.rating} size={14} />
      {formatReviewDate(review.created_at)}
    </p>
  );
}

/**
 * Las mismas reseñas con la dirección suave (ADR-0028, maqueta `T-Perfil`):
 * una sola a la vista, con relleno de campo, y las demás detrás de «Ver las N
 * reseñas», que las despliega acá mismo (no hay pantalla de reseñas).
 */
function ReviewsSuaves({ reviews }: { reviews: Review[] }) {
  const [abiertas, setAbiertas] = useState(false);
  const listaId = useId();
  // La destacada es la más nueva que dice algo; si ninguna tiene comentario,
  // la más nueva.
  const destacada = reviews.find((r) => r.comment) ?? reviews[0];
  const resto = reviews.filter((r) => r.id !== destacada.id);
  return (
    <section aria-label="Reseñas recibidas">
      <div className="caja-suave p-4">
        {destacada.comment && (
          <p className="mb-2 break-words text-base font-semibold leading-snug text-ink">
            «{destacada.comment}»
          </p>
        )}
        <Pie review={destacada} />
      </div>
      {resto.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={abiertas}
            aria-controls={listaId}
            onClick={() => setAbiertas((v) => !v)}
            className="flex min-h-11 items-center text-sm font-semibold text-primary-text"
          >
            {abiertas ? "Ver menos reseñas" : `Ver las ${reviews.length} reseñas`}
          </button>
          <ul id={listaId} hidden={!abiertas} className="divide-y divide-line">
            {resto.map((review) => (
              <li key={review.id} className="py-3 first:pt-1">
                {review.comment && (
                  <p className="mb-1.5 break-words text-sm text-ink">«{review.comment}»</p>
                )}
                <Pie review={review} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default function ReceivedReviews({ suave = false }: { suave?: boolean } = {}) {
  const { token } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    api
      .get<Review[]>("/reviews/received", token)
      .then(setReviews)
      .catch((err) => setError(getErrorMessage(err, "No pudimos cargar tus reseñas")))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (suave) {
    if (loading) return <Skeleton className="h-24 w-full rounded-[20px]" />;
    if (error) {
      return (
        <p className="text-sm text-danger-text">
          {error}{" "}
          <button type="button" onClick={load} className="font-semibold underline underline-offset-2">
            Reintentar
          </button>
        </p>
      );
    }
    if (reviews.length === 0) return null;
    return <ReviewsSuaves reviews={reviews} />;
  }

  if (loading) {
    return (
      <Frame>
        <div className="flex flex-col gap-3" aria-hidden>
          <ReviewSkeleton />
          <ReviewSkeleton />
        </div>
      </Frame>
    );
  }

  // Distinguimos el error de red del estado vacío legítimo: antes cualquier
  // falla se interpretaba como "no hay reseñas".
  if (error) {
    return (
      <Frame>
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
      </Frame>
    );
  }

  if (reviews.length === 0) return null;

  return (
    <Frame>
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
    </Frame>
  );
}

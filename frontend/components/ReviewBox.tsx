"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { Review } from "@/lib/types";
import StarRating from "@/components/StarRating";
import { Button } from "@/components/ui";

export default function ReviewBox({ shiftId }: { shiftId: string }) {
  const { token, user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Idempotencia (product/IDEMPOTENCIA_SPEC.md): una key por intento de
  // calificar. Se reusa mientras el pedido (rating+comment) sea el mismo
  // que el último intento (reintento manual tras un error de red); si el
  // trabajador cambia la calificación antes de reintentar, es un pedido
  // distinto y se genera una key nueva (si no, el backend respondería 422
  // "misma clave, pedido distinto").
  const lastAttemptRef = useRef<{ rating: number; comment: string; key: string } | null>(null);
  function idempotencyKeyForCurrentInput(): string {
    const last = lastAttemptRef.current;
    if (last && last.rating === rating && last.comment === comment) {
      return last.key;
    }
    const key = crypto.randomUUID();
    lastAttemptRef.current = { rating, comment, key };
    return key;
  }

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    api
      .get<Review[]>(`/reviews/shifts/${shiftId}`, token)
      .then(setReviews)
      .catch((err) => setLoadError(getErrorMessage(err, "No pudimos cargar las reseñas")))
      .finally(() => setLoading(false));
  }, [token, shiftId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !user) return null;

  // Distinguimos el error de red del estado vacío legítimo (antes cualquier
  // falla se enmascaraba como "todavía no hay reseñas").
  if (loadError) {
    return (
      <p className="text-sm text-danger">
        {loadError}{" "}
        <button
          type="button"
          onClick={load}
          className="font-semibold underline decoration-red-300 underline-offset-2 hover:text-red-800"
        >
          Reintentar
        </button>
      </p>
    );
  }

  const myReview = reviews.find((r) => r.reviewer_user_id === user.id);

  if (myReview) {
    return (
      <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
        <p className="text-xs font-semibold text-zinc-500">Tu calificación</p>
        <div className="mt-1 flex items-center gap-2">
          <StarRating value={myReview.rating} size={16} />
        </div>
        {myReview.comment && (
          // Comentario de reseña ya escrito: contenido de lectura genuino
          // (como los mensajes de chat), seleccionable aunque la tarjeta que
          // lo envuelve (ShiftCard) sea `.no-select` (bug C0 #2 / fix 2).
          <p className="mt-1 select-text text-sm text-zinc-600">{myReview.comment}</p>
        )}
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0 || !token) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<Review>(
        `/reviews/shifts/${shiftId}`,
        { rating, comment: comment || null },
        token,
        undefined,
        idempotencyKeyForCurrentInput()
      );
      setReviews((prev) => [...prev, created]);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo enviar la calificación"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-zinc-50 px-3 py-3">
      <p className="text-xs font-semibold text-zinc-500">Calificar este turno</p>
      <div className="mt-1.5">
        <StarRating value={rating} onChange={setRating} />
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comentario (opcional)"
        maxLength={1000}
        rows={2}
        className="mt-2 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm"
      />
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      <div className="mt-2">
        <Button type="submit" size="sm" loading={submitting} disabled={rating === 0 || submitting}>
          Enviar calificación
        </Button>
      </div>
    </form>
  );
}

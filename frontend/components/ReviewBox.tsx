"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Review } from "@/lib/types";
import StarRating from "@/components/StarRating";

export default function ReviewBox({ shiftId }: { shiftId: string }) {
  const { token, user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .get<Review[]>(`/reviews/shifts/${shiftId}`, token)
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, [token, shiftId]);

  if (loading || !user) return null;

  const myReview = reviews.find((r) => r.reviewer_user_id === user.id);

  if (myReview) {
    return (
      <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
        <p className="text-xs font-semibold text-zinc-500">Tu calificación</p>
        <div className="mt-1 flex items-center gap-2">
          <StarRating value={myReview.rating} size={16} />
        </div>
        {myReview.comment && (
          <p className="mt-1 text-sm text-zinc-600">{myReview.comment}</p>
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
        token
      );
      setReviews((prev) => [...prev, created]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar la calificación");
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
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={rating === 0 || submitting}
        className="mt-2 rounded-full bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {submitting ? "Enviando..." : "Enviar calificación"}
      </button>
    </form>
  );
}

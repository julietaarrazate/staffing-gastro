"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Review } from "@/lib/types";
import StarRating from "@/components/StarRating";

export default function ReceivedReviews() {
  const { token } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api
      .get<Review[]>("/reviews/received", token)
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="text-sm text-zinc-500">Cargando...</p>;

  if (reviews.length === 0) {
    return <p className="text-sm text-zinc-500">Todavía no tenés reseñas.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-xl bg-zinc-50 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <StarRating value={review.rating} size={16} />
            <span className="text-xs text-zinc-400">
              {new Date(review.created_at).toLocaleDateString("es-AR")}
            </span>
          </div>
          {review.comment && <p className="mt-1 text-sm text-zinc-600">{review.comment}</p>}
        </div>
      ))}
    </div>
  );
}

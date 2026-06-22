"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SKILL_LABELS, WORKER_SKILLS, WorkerSkill } from "@/lib/types";
import { localInputToArgentinaISO } from "@/lib/datetime";
import LocationPicker, { LocationSelection } from "@/components/LocationPicker";

export default function NewShiftPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [position, setPosition] = useState<WorkerSkill>(WORKER_SKILLS[0]);
  const [quantity, setQuantity] = useState(1);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [tips, setTips] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [dressCode, setDressCode] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    const payload = {
      position,
      quantity,
      start_at: localInputToArgentinaISO(startAt),
      end_at: localInputToArgentinaISO(endAt),
      pay_amount: payAmount,
      currency,
      tips,
      urgent,
      dress_code: dressCode || null,
      address: address || null,
      city: city || null,
      latitude,
      longitude,
      title: title || null,
      description: description || null,
    };
    try {
      await api.post("/shifts", payload, token);
      router.push("/shifts");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el turno");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Publicar turno</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Título</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">Puesto</label>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as WorkerSkill)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          >
            {WORKER_SKILLS.map((skill) => (
              <option key={skill} value={skill}>
                {SKILL_LABELS[skill]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Cantidad de personas</label>
            <input
              type="number"
              min={1}
              max={100}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Moneda</label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Inicio</label>
            <input
              required
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Fin</label>
            <input
              required
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">Pago</label>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input type="checkbox" checked={tips} onChange={(e) => setTips(e.target.checked)} />
            Acepta propinas
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
            Urgente
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">Dress code</label>
          <input
            value={dressCode}
            onChange={(e) => setDressCode(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">Ubicación</label>
          <p className="mt-0.5 text-xs text-zinc-500">
            Elegí provincia y barrio/ciudad: completamos las coordenadas solas para
            recomendarte a la gente más cercana.
          </p>
          <div className="mt-2">
            <LocationPicker
              onSelect={(loc: LocationSelection) => {
                setCity(loc.city);
                setLatitude(loc.latitude);
                setLongitude(loc.longitude);
              }}
            />
          </div>
          {city && (
            <p className="mt-2 text-sm font-medium text-zinc-700">
              Ubicación seleccionada: <span className="text-orange-600">{city}</span>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Dirección <span className="font-normal text-zinc-400">(opcional)</span>
          </label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Calle y número, piso, referencia…"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {submitting ? "Publicando..." : "Publicar turno"}
        </button>
      </form>
    </div>
  );
}

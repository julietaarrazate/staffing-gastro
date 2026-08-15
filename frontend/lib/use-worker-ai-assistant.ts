"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { PROVINCES, type Locality } from "@/lib/locations";
import { SKILL_LABELS, WorkerAssistantQueryResponse } from "@/lib/types";
import { useVoiceDictation } from "@/lib/use-voice-dictation";
import type { AssistantHistoryEntry, InlineResult } from "@/lib/use-ai-assistant";

/** Busca una localidad por nombre entre TODAS las provincias (no sólo CABA)
 * — comparación case-insensitive y sin acentos, para que "palermo" (como lo
 * escribe/dicta el trabajador) matchee "Palermo" tal cual está en la tabla. */
function findLocality(name: string): Locality | null {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const province of PROVINCES) {
    const match = province.localities.find(
      (l) =>
        l.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") === normalized
    );
    if (match) return match;
  }
  return null;
}

function buildFeedSearchUrl(result: WorkerAssistantQueryResponse): string {
  const params = new URLSearchParams();
  for (const position of result.positions ?? []) params.append("positions", position);
  const locality = result.zone_name ? findLocality(result.zone_name) : null;
  if (locality) {
    params.set("zoneLat", String(locality.lat));
    params.set("zoneLng", String(locality.lng));
    params.set("zoneName", locality.name);
  }
  if (result.radius_km != null) params.set("radiusKm", String(result.radius_km));
  if (result.date_filter === "hoy") params.set("today", "1");
  return `/feed?${params.toString()}`;
}

/** Resumen en español de lo que el asistente entendió, para mostrar antes de
 * llevar al trabajador al feed filtrado — mismo gesto que `consultar_turnos`
 * del comercio (mensaje + botón de acción), no una navegación muda. */
function describeSearch(result: WorkerAssistantQueryResponse): string {
  const parts: string[] = [];
  const positions = result.positions ?? [];
  if (positions.length > 0) {
    parts.push(positions.map((p) => SKILL_LABELS[p]).join(", "));
  } else {
    parts.push("Turnos");
  }
  if (result.zone_name) parts.push(`en ${result.zone_name}`);
  if (result.radius_km != null) parts.push(`a menos de ${result.radius_km} km`);
  if (result.date_filter === "hoy") parts.push("para hoy");
  return `Buscando ${parts.join(" ")}.`;
}

/**
 * Lógica del asistente de IA del TRABAJADOR (pedido de Julieta: "el
 * asistente de ia falta para el trabajador, por ejemplo búscame un turno en
 * palermo a menos de 2 kilómetros para hoy tanto para mozo barista y
 * cajero"). Mismo principio que el asistente del comercio: interpreta
 * intención vía `POST /assistant/worker-query`, nunca ejecuta la búsqueda
 * por su cuenta — el feed (`/feed`, ya sabe rankear/filtrar por distancia)
 * es quien de verdad resuelve resultados. La resolución de "Palermo" a
 * coordenadas pasa por acá (no por el backend) porque el frontend ya tiene
 * la tabla de barrios/ciudades (`lib/locations.ts`) que alimenta el
 * onboarding — no había razón para duplicarla en Python.
 */
export function useWorkerAIAssistant() {
  const { token } = useAuth();
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AssistantHistoryEntry[]>([]);
  const { listening, supported: speechSupported, toggle: toggleDictation } = useVoiceDictation(
    (transcript) => setText((prev) => (prev ? `${prev} ${transcript}` : transcript).slice(0, 500))
  );

  function showInline(question: string, result: InlineResult) {
    setHistory((prev) => [...prev, { id: crypto.randomUUID(), question, result }]);
    setText("");
  }

  async function handleSubmit() {
    const question = text.trim();
    if (!token || !question) return;
    setError(null);
    setLoading(true);
    try {
      const result = await api.post<WorkerAssistantQueryResponse>(
        "/assistant/worker-query",
        { text: question },
        token
      );
      if (result.intent === "buscar_turnos") {
        showInline(question, {
          message: describeSearch(result),
          actionLabel: "Ver turnos",
          onAction: () => router.push(buildFeedSearchUrl(result)),
        });
      } else {
        showInline(question, {
          message: result.message ?? "No entendí bien qué turno buscás. ¿Podés reformularlo?",
        });
      }
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos interpretar el texto. Probá describirlo distinto."));
    } finally {
      setLoading(false);
    }
  }

  return {
    text,
    setText,
    loading,
    error,
    history,
    listening,
    speechSupported,
    toggleDictation,
    handleSubmit,
  };
}

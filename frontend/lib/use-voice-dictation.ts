"use client";

import { useEffect, useRef, useState } from "react";

// Web Speech API: no tiene tipos oficiales en el DOM lib de TypeScript.
// Sólo lo mínimo que usamos, para no traer @types/dom-speech-recognition
// por un par de pantallas.
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal?: boolean;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorLike {
  error?: string;
}

/** Por qué no se pudo dictar, para decírselo a la persona en vez de que el
 *  micrófono se apague sin explicación. */
export type VoiceError = "permiso" | "sin_voz" | "otro";
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event?: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
interface SpeechRecognitionWindow {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

/**
 * Dictado por voz reusable (pedido de Julieta: "es donde más se aprovecha"
 * un asistente de IA — más rápido hablar el turno que tipearlo). Web Speech
 * API nativa del navegador: sin costo, sin backend, sin SDK. Sólo Chrome/
 * Edge/Android la soportan hoy (no Safari/iOS) — `supported` gatea si
 * mostrar el botón de micrófono donde falta.
 */
export function useVoiceDictation(onTranscript: (transcript: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  // Lo que se va entendiendo mientras la persona habla, todavía sin
  // confirmar: se muestra en vivo para que un error del dictado se note en el
  // momento y no recién en el turno armado (Julieta, 2026-11-27: «por voz no
  // lo toma bien»).
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<VoiceError | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Evita re-crear `toggle` (y por lo tanto el efecto que la usa en algún
  // consumidor) cada vez que cambia la referencia de `onTranscript`.
  const onTranscriptRef = useRef(onTranscript);
  // F5 (auditoría 2026-08-15): escribir una ref durante el render es
  // inseguro con render concurrente/StrictMode (un render descartado podía
  // dejarla apuntando a un callback que no corresponde al commit final) —
  // se mueve a un efecto sin deps, que corre después de cada render.
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  useEffect(() => {
    const w = window as unknown as SpeechRecognitionWindow;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => recognitionRef.current?.stop();
  }, []);

  function toggle() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const w = window as unknown as SpeechRecognitionWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "es-AR";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    // Cada aviso trae TODOS los tramos de esta escucha: los ya confirmados y
    // el que se está diciendo. Se entrega cada tramo confirmado una sola vez.
    let entregados = 0;
    recognition.onresult = (event) => {
      const tramos = Array.from(event.results);
      // Un navegador que no marca `isFinal` (los primeros Web Speech) manda
      // sólo resultados cerrados: se toman como confirmados.
      const confirmados = tramos.filter((t) => t.isFinal !== false);
      const nuevos = confirmados.slice(entregados).map((t) => t[0].transcript.trim());
      entregados = confirmados.length;
      const texto = nuevos.filter(Boolean).join(" ");
      if (texto) onTranscriptRef.current(texto);
      setInterim(
        tramos
          .filter((t) => t.isFinal === false)
          .map((t) => t[0].transcript)
          .join(" ")
          .trim()
      );
    };
    recognition.onerror = (event) => {
      const motivo = event?.error;
      // `aborted` es la propia persona tocando el micrófono para cortar.
      if (motivo !== "aborted") {
        setError(
          motivo === "not-allowed" || motivo === "service-not-allowed"
            ? "permiso"
            : motivo === "no-speech"
              ? "sin_voz"
              : "otro"
        );
      }
      setInterim("");
      setListening(false);
    };
    recognition.onend = () => {
      setInterim("");
      setListening(false);
    };
    recognitionRef.current = recognition;
    setError(null);
    setInterim("");
    recognition.start();
    setListening(true);
  }

  return { listening, supported, toggle, interim, error };
}

"use client";

import { useEffect, useRef, useState } from "react";

// Web Speech API: no tiene tipos oficiales en el DOM lib de TypeScript.
// Sólo lo mínimo que usamos, para no traer @types/dom-speech-recognition
// por un par de pantallas.
interface SpeechRecognitionResultLike {
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
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
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Evita re-crear `toggle` (y por lo tanto el efecto que la usa en algún
  // consumidor) cada vez que cambia la referencia de `onTranscript`.
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

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
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ");
      onTranscriptRef.current(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return { listening, supported, toggle };
}

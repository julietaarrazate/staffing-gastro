"use client";

import { useSearchParams } from "next/navigation";
import EncuestaForm from "./EncuestaForm";

/** Lee el `?ref=` del link (qué grupo de WhatsApp la trajo) y arma la encuesta. */
export default function EncuestaGate() {
  const params = useSearchParams();
  return <EncuestaForm refParam={params.get("ref")} />;
}

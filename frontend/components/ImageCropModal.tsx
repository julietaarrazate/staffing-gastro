"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";

// Tamaño del visor (px en pantalla) y de la imagen final que se sube: 640 es
// de sobra para un avatar (nunca se pinta a más de ~170px, ver OpportunityCard),
// sin subir el archivo original de la cámara (puede pesar varios MB).
const VIEWPORT = 260;
const OUTPUT_SIZE = 640;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

/**
 * Modal de encuadre de foto de perfil: antes se subía la foto tal cual y
 * `object-cover` recortaba al centro sin que la persona pudiera elegir qué
 * parte de la imagen quedaba visible (una cara corrida del centro se recortaba
 * mal) — ahora se puede arrastrar y hacer zoom antes de subir (Julieta,
 * 2026-07-30). Sin librería externa: un `<canvas>` alcanza para este recorte.
 */
export default function ImageCropModal({
  file,
  shape = "circle",
  onCancel,
  onConfirm,
}: {
  file: File | null;
  shape?: "circle" | "square";
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!file || !imgUrl) return null;

  // Escala "cover" a zoom=1: el lado más chico de la imagen llena el visor.
  const baseScale =
    natural.width > 0 ? VIEWPORT / Math.min(natural.width, natural.height) : 0;
  const scale = baseScale * zoom;
  const displayWidth = natural.width * scale;
  const displayHeight = natural.height * scale;
  // Cuánto se puede mover sin dejar un borde vacío dentro del visor.
  const maxOffsetX = Math.max(0, (displayWidth - VIEWPORT) / 2);
  const maxOffsetY = Math.max(0, (displayHeight - VIEWPORT) / 2);

  function clamp(value: number, max: number) {
    return Math.min(max, Math.max(-max, value));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, offsetX: offset.x, offsetY: offset.y };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset({
      x: clamp(dragRef.current.offsetX + dx, maxOffsetX),
      y: clamp(dragRef.current.offsetY + dy, maxOffsetY),
    });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  async function confirm() {
    if (!file || !imgUrl) return;
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas no soportado");

      const img = new Image();
      img.src = imgUrl;
      await img.decode();

      const outScale = (OUTPUT_SIZE / VIEWPORT) * scale;
      const cx = OUTPUT_SIZE / 2 - offset.x * (OUTPUT_SIZE / VIEWPORT);
      const cy = OUTPUT_SIZE / 2 - offset.y * (OUTPUT_SIZE / VIEWPORT);
      ctx.drawImage(
        img,
        cx - (natural.width * outScale) / 2,
        cy - (natural.height * outScale) / 2,
        natural.width * outScale,
        natural.height * outScale
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92)
      );
      if (!blob) throw new Error("no se pudo generar la imagen");
      onConfirm(new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="Encuadrá tu foto" onClose={onCancel}>
      <div className="flex flex-col items-center gap-4">
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ width: VIEWPORT, height: VIEWPORT }}
          className={`relative touch-none overflow-hidden bg-surface ring-1 ring-line ${
            shape === "circle" ? "rounded-full" : "rounded-2xl"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- preview de recorte, no next/image */}
          <img
            src={imgUrl}
            alt="Foto a encuadrar"
            draggable={false}
            onLoad={(e) => {
              const el = e.currentTarget;
              setNatural({ width: el.naturalWidth, height: el.naturalHeight });
            }}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: natural.width * scale || undefined,
              height: natural.height * scale || undefined,
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
            }}
            className="pointer-events-none max-w-none select-none"
          />
        </div>

        <div className="flex w-full items-center gap-3 px-1">
          <span className="text-xs font-semibold text-ink/50">Zoom</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-primary"
          />
        </div>

        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-full border border-line py-2.5 text-sm font-semibold text-ink/70 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={saving || natural.width === 0}
            className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Usar esta foto"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";

// Tamaño del visor (px en pantalla) y de la imagen final que se sube, por
// forma. 640 es de sobra para un avatar (nunca se pinta a más de ~170px, ver
// OpportunityCard). "wide" es la foto del local: 16:9, y 1280 de ancho porque
// es la imagen grande del feed y del detalle (se pinta hasta ~800px, 2x en
// pantallas retina). Nunca se sube el archivo original de la cámara (puede
// pesar varios MB).
type Shape = "circle" | "square" | "wide";
const FRAMES: Record<Shape, { vw: number; vh: number; ow: number; oh: number }> = {
  circle: { vw: 260, vh: 260, ow: 640, oh: 640 },
  square: { vw: 260, vh: 260, ow: 640, oh: 640 },
  wide: { vw: 320, vh: 180, ow: 1280, oh: 720 },
};
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

/**
 * Dónde dibujar la imagen en el lienzo de salida para que lo que se sube sea
 * EXACTAMENTE lo que se veía en el visor. En el visor la imagen se corre
 * `offset` px desde el centro (`translate(offset)`), así que en la salida su
 * centro va en `centro + offset·k` — con el mismo signo.
 *
 * Hasta 2026-09-23 el signo estaba invertido: el recorte subido era el espejo
 * del encuadre (arrastrar la foto a la derecha subía la parte derecha, no la
 * izquierda que se veía). Medido con una imagen mitad roja/mitad azul: 43,8%
 * de rojo con el signo viejo contra 56,3% con el correcto (lo esperado: 56%).
 */
export function cropDrawRect({
  natural,
  scale,
  offset,
  viewportWidth,
  outputWidth,
  outputHeight,
}: {
  natural: { width: number; height: number };
  scale: number;
  offset: { x: number; y: number };
  viewportWidth: number;
  outputWidth: number;
  outputHeight: number;
}) {
  // Mismo factor en los dos ejes: el visor y la salida tienen la misma
  // proporción.
  const k = outputWidth / viewportWidth;
  const width = natural.width * scale * k;
  const height = natural.height * scale * k;
  const cx = outputWidth / 2 + offset.x * k;
  const cy = outputHeight / 2 + offset.y * k;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

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
  shape?: Shape;
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

  const { vw, vh, ow, oh } = FRAMES[shape];
  // Escala "cover" a zoom=1: la imagen llena el visor sin dejar bordes.
  const baseScale =
    natural.width > 0 ? Math.max(vw / natural.width, vh / natural.height) : 0;
  const scale = baseScale * zoom;
  const displayWidth = natural.width * scale;
  const displayHeight = natural.height * scale;
  // Cuánto se puede mover sin dejar un borde vacío dentro del visor.
  const maxOffsetX = Math.max(0, (displayWidth - vw) / 2);
  const maxOffsetY = Math.max(0, (displayHeight - vh) / 2);

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
      canvas.width = ow;
      canvas.height = oh;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas no soportado");

      const img = new Image();
      img.src = imgUrl;
      await img.decode();

      const r = cropDrawRect({ natural, scale, offset, viewportWidth: vw, outputWidth: ow, outputHeight: oh });
      ctx.drawImage(img, r.x, r.y, r.width, r.height);

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
    <Modal open title={shape === "wide" ? "Encuadrá la foto del local" : "Encuadrá tu foto"} onClose={onCancel}>
      <div className="flex flex-col items-center gap-4">
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ width: vw, height: vh }}
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
            className="flex-1 rounded-[var(--radius-btn)] border border-line py-2.5 text-sm font-semibold text-ink/70 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={saving || natural.width === 0}
            className="flex-1 rounded-[var(--radius-btn)] bg-primary py-2.5 text-sm font-semibold text-night disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Usar esta foto"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

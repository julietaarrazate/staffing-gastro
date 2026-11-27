import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShiftPublic } from "@/lib/types";
import type { TurnoPublico } from "@/lib/turno-publico";
import TurnoLayout from "./layout";
import PublicShiftPage, { generateMetadata } from "./page";

/**
 * Quién corta qué en `/turno/[id]`. Son dos pantallas distintas y cada una
 * sale de un `notFound()` distinto:
 *
 * - el **layout** corta lo que no existe → sube a `app/not-found.tsx`
 *   («No encontramos esa página»);
 * - la **página** corta lo que fue público y ya no está abierto → cae en
 *   `app/turno/[id]/not-found.tsx` («Este turno ya no está disponible»).
 *
 * Si alguien junta los dos cortes en la página, las dos pantallas pasan a ser
 * la misma; este test lo frena.
 */

const turno = vi.hoisted(() => ({ value: { estado: "no_encontrado" } as TurnoPublico }));
vi.mock("@/lib/turno-publico", () => ({ getTurnoPublico: async () => turno.value }));
vi.mock("@/components/ShiftDetail", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const ID = "3f2b8c1e-5a47-4d09-9c1b-7e6a2d4f8b10";
const params = Promise.resolve({ id: ID });

const SHIFT: ShiftPublic = {
  id: ID,
  position: "mozo",
  start_at: "2026-11-14T23:00:00Z",
  end_at: "2026-11-15T05:00:00Z",
  city: "Palermo",
  pay_amount: "42000.00",
  currency: "ARS",
  company_name: "Tinto",
  tips: false,
  meal: false,
  dress_code: null,
  urgent: false,
};

beforeEach(() => {
  turno.value = { estado: "no_encontrado" };
});

describe("/turno/[id]", () => {
  it("un turno que no existe lo corta el layout (pantalla global de «no encontrada»)", async () => {
    await expect(TurnoLayout({ children: "hijos", params })).rejects.toThrow("NOT_FOUND");
    const meta = await generateMetadata({ params });
    expect(meta.title).toBe("Página no encontrada");
  });

  it("un turno que ya no está disponible pasa el layout y lo corta la página", async () => {
    turno.value = { estado: "no_disponible" };
    expect(await TurnoLayout({ children: "hijos", params })).toBe("hijos");
    await expect(PublicShiftPage({ params })).rejects.toThrow("NOT_FOUND");
    const meta = await generateMetadata({ params });
    expect(meta.title).toBe("Este turno ya no está disponible");
    // Ni el puesto ni el comercio: del turno no se dice nada.
    expect(JSON.stringify(meta)).not.toMatch(/Tinto|Mozo/i);
  });

  it("un turno abierto se muestra, con su título para compartir", async () => {
    turno.value = { estado: "abierto", shift: SHIFT };
    expect(await TurnoLayout({ children: "hijos", params })).toBe("hijos");
    const page = await PublicShiftPage({ params });
    // La página devuelve la oferta para buscadores (si hay) y el detalle.
    const [oferta, detalle] = page.props.children;
    expect(detalle.props.publicShift).toEqual(SHIFT);
    // Sin fecha de publicación no se marca como oferta de trabajo.
    expect(oferta).toBeFalsy();
    const meta = await generateMetadata({ params });
    expect(meta.title).toEqual({ absolute: "Buscamos Mozo/a en Tinto — Oído" });
  });

  it("un turno abierto con fecha de publicación sale como oferta de trabajo para buscadores", async () => {
    const publicado = { ...SHIFT, published_at: "2026-11-10T12:00:00Z" };
    turno.value = { estado: "abierto", shift: publicado };
    const page = await PublicShiftPage({ params });
    const [oferta] = page.props.children;
    expect(oferta.props.type).toBe("application/ld+json");
    const datos = JSON.parse(oferta.props.dangerouslySetInnerHTML.__html);
    expect(datos["@type"]).toBe("JobPosting");
    expect(datos.hiringOrganization.name).toBe("Tinto");
    const meta = await generateMetadata({ params });
    expect(meta.alternates?.canonical).toBe(datos.url);
  });
});

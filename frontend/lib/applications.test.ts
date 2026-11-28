import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { ApplicationStatus } from "@/lib/types";
import { appliedShiftIds, enviarPostulacion, esPuedoIrYaRequerido, unassignedShiftIds } from "./applications";

const post = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { post: (...a: unknown[]) => post(...a) },
}));

function application(shift_id: string, status: ApplicationStatus) {
  return { shift_id, status };
}

describe("appliedShiftIds", () => {
  it("cuenta como postulado mientras la postulación está pendiente o aceptada", () => {
    const ids = appliedShiftIds([application("turno-1", "pendiente"), application("turno-2", "aceptada")]);
    expect([...ids].sort()).toEqual(["turno-1", "turno-2"]);
  });

  it("una postulación retirada ya no cuenta: el turno vuelve a ofrecerse", () => {
    const ids = appliedShiftIds([application("turno-1", "retirada"), application("turno-2", "pendiente")]);
    expect(ids.has("turno-1")).toBe(false);
    expect(ids.has("turno-2")).toBe(true);
  });

  it("una postulación rechazada tampoco cuenta como estar postulado", () => {
    expect(appliedShiftIds([application("turno-1", "rechazada")]).has("turno-1")).toBe(false);
  });

  it("quien tuvo el turno y lo dejó no puede postularse otra vez: el turno no se le ofrece", () => {
    const apps = [application("turno-1", "desasignada"), application("turno-2", "pendiente")];
    expect(appliedShiftIds(apps).has("turno-1")).toBe(true);
    expect([...unassignedShiftIds(apps)]).toEqual(["turno-1"]);
  });

  it("sin postulaciones no hay turnos postulados", () => {
    expect(appliedShiftIds([]).size).toBe(0);
  });
});

describe("enviarPostulacion (carril urgente, ADR-0032)", () => {
  const requerido = () => new ApiError(409, "Este turno empieza pronto: confirmá que podés ir.", "puedo_ir_ya_requerido");
  const turno = { id: "t1", start_at: "2026-11-27T20:00:00-03:00" };
  beforeEach(() => post.mockReset());

  it("con apply_commits manda el reconocimiento; sin él, sin cuerpo", async () => {
    post.mockResolvedValue({ se_ofrecio_para_ya: true });
    const confirmar = vi.fn();
    const r = await enviarPostulacion({ token: "tok", shift: { ...turno, apply_commits: true }, key: "k", confirmar });
    expect(r).toEqual({ ofrecido: true });
    expect(post).toHaveBeenLastCalledWith("/applications/shifts/t1", { puedo_ir_ya: true }, "tok", undefined, "k");
    await enviarPostulacion({ token: "tok", shift: { ...turno, apply_commits: false }, key: "k", confirmar });
    expect(post).toHaveBeenLastCalledWith("/applications/shifts/t1", undefined, "tok", undefined, "k");
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("pantalla vieja: el 409 con código abre la pregunta y reintenta con el reconocimiento", async () => {
    post.mockRejectedValueOnce(requerido()).mockResolvedValueOnce({ se_ofrecio_para_ya: true });
    const confirmar = vi.fn().mockResolvedValue(true);
    const ok = await enviarPostulacion({ token: "tok", shift: { ...turno, apply_commits: false }, key: "k", confirmar });
    expect(ok).toEqual({ ofrecido: true });
    expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({ id: "t1", apply_commits: true }));
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith("/applications/shifts/t1", { puedo_ir_ya: true }, "tok", undefined, "k");
  });

  it("«Te ofreciste» es lo que guardó el servidor, no lo que mandó la pantalla", async () => {
    // Mandó el reconocimiento pero el servidor lo guardó en falso (el turno ya no estaba en la ventana).
    post.mockResolvedValue({ se_ofrecio_para_ya: false });
    const r = await enviarPostulacion({ token: "tok", shift: { ...turno, apply_commits: true }, key: "k", confirmar: vi.fn() });
    expect(r).toEqual({ ofrecido: false });
  });

  it("«Ahora no» después del 409 no reintenta", async () => {
    post.mockRejectedValueOnce(requerido());
    const ok = await enviarPostulacion({
      token: "tok",
      shift: { ...turno, apply_commits: false },
      key: "k",
      confirmar: vi.fn().mockResolvedValue(false),
    });
    expect(ok).toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("cualquier otro error se propaga, y un 409 común no es el del carril urgente", async () => {
    const otro = new ApiError(409, "Ya te postulaste a este turno");
    expect(esPuedoIrYaRequerido(otro)).toBe(false);
    expect(esPuedoIrYaRequerido(requerido())).toBe(true);
    post.mockRejectedValueOnce(otro);
    await expect(
      enviarPostulacion({ token: "tok", shift: { ...turno, apply_commits: false }, key: "k", confirmar: vi.fn() })
    ).rejects.toBe(otro);
  });
});

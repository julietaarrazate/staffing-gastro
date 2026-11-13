import { describe, expect, it } from "vitest";
import {
  cancelConfirmCopy,
  isLateCancellation,
  LATE_CANCELLATION_WARNING,
} from "@/lib/cancelar-turno";
import type { ShiftStatus } from "@/lib/types";

const CON_TRABAJADOR = "wp-1";

describe("isLateCancellation", () => {
  it.each<ShiftStatus>(["confirmado", "en_camino", "check_in", "trabajando", "check_out"])(
    "%s con trabajador asignado es cancelación tardía",
    (status) => {
      expect(isLateCancellation({ status, worker_profile_id: CON_TRABAJADOR })).toBe(true);
    }
  );

  it.each<ShiftStatus>(["borrador", "publicado", "buscando_personal"])(
    "%s (sin nadie asignado) no es cancelación tardía",
    (status) => {
      expect(isLateCancellation({ status, worker_profile_id: null })).toBe(false);
    }
  );

  it("asignado sin confirmar no es cancelación tardía", () => {
    expect(isLateCancellation({ status: "asignado", worker_profile_id: CON_TRABAJADOR })).toBe(
      false
    );
  });

  it("un estado comprometido sin trabajador no suma nada (misma cuenta que el backend)", () => {
    expect(isLateCancellation({ status: "confirmado", worker_profile_id: null })).toBe(false);
  });
});

describe("cancelConfirmCopy", () => {
  it("con el trabajador confirmado avisa la cancelación tardía", () => {
    const copy = cancelConfirmCopy({ status: "confirmado", worker_profile_id: CON_TRABAJADOR });
    expect(copy.lateCancellation).toBe(LATE_CANCELLATION_WARNING);
    expect(copy.body).toBe(
      "El trabajador ya confirmó: se le avisa que el turno se cancela y no vas a poder deshacerlo."
    );
  });

  it("asignado sin confirmar: se le avisa, pero no cuesta nada", () => {
    const copy = cancelConfirmCopy({ status: "asignado", worker_profile_id: CON_TRABAJADOR });
    expect(copy.lateCancellation).toBeNull();
    expect(copy.body).toContain("se le avisa que el turno se cancela");
  });

  it.each<ShiftStatus>(["publicado", "buscando_personal"])(
    "%s: dice que a quien se postuló se le avisa",
    (status) => {
      const copy = cancelConfirmCopy({ status, worker_profile_id: null });
      expect(copy.lateCancellation).toBeNull();
      expect(copy.body).toContain("Si alguien se postuló, se le avisa.");
    }
  );

  it("borrador: nadie lo vio, no promete avisos", () => {
    const copy = cancelConfirmCopy({ status: "borrador", worker_profile_id: null });
    expect(copy.lateCancellation).toBeNull();
    expect(copy.body).not.toContain("se le avisa");
  });

  it("sin turno (el diálogo cerrándose) no menciona la cancelación tardía", () => {
    expect(cancelConfirmCopy(undefined).lateCancellation).toBeNull();
  });
});

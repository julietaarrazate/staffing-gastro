import { describe, expect, it } from "vitest";
import {
  cancelConfirmCopy,
  isCancellable,
  isLateCancellation,
  LATE_CANCELLATION_WARNING,
  withFreshState,
} from "@/lib/cancelar-turno";
import type { Shift, ShiftStatus } from "@/lib/types";

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

describe("isCancellable", () => {
  it.each<ShiftStatus>(["finalizado", "pagado", "cancelado", "no_cubierto"])(
    "%s es terminal: ya no se cancela",
    (status) => {
      expect(isCancellable(status)).toBe(false);
    }
  );

  it.each<ShiftStatus>(["borrador", "publicado", "asignado", "confirmado", "check_out"])(
    "%s se puede cancelar",
    (status) => {
      expect(isCancellable(status)).toBe(true);
    }
  );
});

describe("withFreshState", () => {
  // Lo que el panel tiene (GET /shifts/me) y lo que trae el detalle (GET /shifts/{id}).
  const listed = {
    id: "s1",
    status: "asignado",
    worker_profile_id: "wp-1",
    worker_name: "Juan Pérez",
    company_name: null,
    company_logo_url: null,
  } as Shift;
  const detail = {
    id: "s1",
    status: "confirmado",
    worker_profile_id: "wp-1",
    company_name: "Bar Palermo",
    company_logo_url: "https://img/logo.png",
  } as Shift;

  it("toma el estado nuevo y con él cambia el texto de la confirmación", () => {
    const merged = withFreshState(listed, detail);
    expect(merged.status).toBe("confirmado");
    expect(cancelConfirmCopy(listed).lateCancellation).toBeNull();
    expect(cancelConfirmCopy(merged).lateCancellation).toBe(LATE_CANCELLATION_WARNING);
  });

  it("no le suma a la tarjeta propia el sello «Comercio verificado» que trae el detalle", () => {
    const verified = { ...detail, company_verified: true } as Shift;
    expect(withFreshState(listed, verified).company_verified).toBeUndefined();
    const listedUnverified = { ...listed, company_verified: false } as Shift;
    expect(withFreshState(listedUnverified, verified).company_verified).toBe(false);
  });

  it("conserva el nombre del trabajador y no suma los datos del comercio a la tarjeta", () => {
    const merged = withFreshState(listed, detail);
    expect(merged.worker_name).toBe("Juan Pérez");
    expect(merged.company_name).toBeNull();
    expect(merged.company_logo_url).toBeNull();
  });

  it("si el trabajador se bajó, no queda su nombre ni la cancelación tardía", () => {
    const confirmed = { ...listed, status: "confirmado" } as Shift;
    const reopened = { ...detail, status: "buscando_personal", worker_profile_id: null } as Shift;
    const merged = withFreshState(confirmed, reopened);
    expect(merged.worker_name).toBeNull();
    expect(cancelConfirmCopy(confirmed).lateCancellation).toBe(LATE_CANCELLATION_WARNING);
    expect(cancelConfirmCopy(merged).lateCancellation).toBeNull();
  });

  it("si ahora es otro trabajador, no se le pone el nombre del anterior", () => {
    const other = { ...detail, worker_profile_id: "wp-2" } as Shift;
    expect(withFreshState(listed, other).worker_name).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { notificationHref } from "@/lib/notification-link";
import type { Notification } from "@/lib/types";

function aviso(overrides: Partial<Notification>): Notification {
  return {
    id: "n1",
    type: "new_shift_nearby",
    title: "Turno cerca tuyo",
    message: "",
    read: false,
    link: null,
    created_at: null,
    ...overrides,
  };
}

describe("notificationHref", () => {
  it("usa el link que trae la notificación", () => {
    expect(notificationHref(aviso({ link: "/shifts/abc" }))).toBe("/shifts/abc");
  });

  it("el aviso de turno cerca abre la página del turno", () => {
    expect(notificationHref(aviso({ type: "new_shift_nearby", link: "/turno/abc" }))).toBe("/turno/abc");
    expect(notificationHref(aviso({ type: "urgent_shift_nearby", link: "/turno/abc" }))).toBe("/turno/abc");
  });

  it("un aviso viejo guardado con /feed sigue yendo al Inicio", () => {
    expect(notificationHref(aviso({ type: "new_shift_nearby", link: "/feed" }))).toBe("/feed");
  });

  it("sin link (avisos anteriores a `link`), el de turno cerca abre el Inicio", () => {
    expect(notificationHref(aviso({ type: "urgent_shift_nearby" }))).toBe("/feed");
  });

  it("el turno que el comercio canceló antes de confirmar abre «Mis turnos»", () => {
    expect(notificationHref(aviso({ type: "shift_cancelled" }))).toBe("/my-shifts");
  });

  it("el turno cancelado al que estaba postulado abre el Inicio", () => {
    expect(notificationHref(aviso({ type: "applied_shift_cancelled" }))).toBe("/feed");
  });

  it("el aviso de ausencia abre el perfil, con o sin link guardado", () => {
    expect(notificationHref(aviso({ type: "shift_no_show" }))).toBe("/profile");
    expect(notificationHref(aviso({ type: "shift_no_show", link: "/profile" }))).toBe("/profile");
  });
});

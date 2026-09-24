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

  it("sin link, el aviso de urgencia escalada abre el feed", () => {
    expect(notificationHref(aviso({ type: "urgent_shift_nearby" }))).toBe("/feed");
  });
});

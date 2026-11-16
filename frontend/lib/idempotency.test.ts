import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useIdempotencyKeys } from "./idempotency";

describe("useIdempotencyKeys con persistencia", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("tras una recarga el intento sigue siendo el mismo", () => {
    const a = renderHook(() => useIdempotencyKeys("k"));
    const key = a.result.current.keyFor("crear");
    a.unmount();
    const b = renderHook(() => useIdempotencyKeys("k"));
    expect(b.result.current.keyFor("crear")).toBe(key);
  });

  it("clear suelta la key también del almacenamiento", () => {
    const a = renderHook(() => useIdempotencyKeys("k"));
    const key = a.result.current.keyFor("crear");
    a.result.current.clear("crear");
    expect(window.sessionStorage.getItem("k")).toBeNull();
    const b = renderHook(() => useIdempotencyKeys("k"));
    expect(b.result.current.keyFor("crear")).not.toBe(key);
  });

  it("sin persistKey no toca el almacenamiento", () => {
    const a = renderHook(() => useIdempotencyKeys());
    a.result.current.keyFor("x");
    expect(window.sessionStorage.length).toBe(0);
  });
});

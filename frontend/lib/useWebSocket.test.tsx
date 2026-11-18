import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket, WS_STABLE_AFTER_MS } from "./useWebSocket";

vi.mock("@/lib/api", () => ({ resolveToken: (t: string) => t }));

class FakeSocket {
  static all: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  close() {}
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.all = [];
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useWebSocket: backoff", () => {
  it("si el servidor abre y cierra enseguida, el backoff crece (no vuelve a ~1 s)", () => {
    renderHook(() => useWebSocket("/x", "tok", () => {}));
    const delays: number[] = [];
    for (let i = 0; i < 5; i++) {
      const ws = FakeSocket.all[FakeSocket.all.length - 1];
      act(() => ws.onopen?.());
      act(() => ws.onclose?.());
      // Cuánto falta para la próxima conexión: se mide avanzando de a poco.
      const before = FakeSocket.all.length;
      let waited = 0;
      while (FakeSocket.all.length === before && waited < 20_000) {
        act(() => vi.advanceTimersByTime(100));
        waited += 100;
      }
      delays.push(waited);
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000, 15000]);
  });

  it("una conexión estable que se cae reintenta rápido (reconexión normal)", () => {
    renderHook(() => useWebSocket("/x", "tok", () => {}));
    // Primero fallos rápidos para subir el backoff...
    for (let i = 0; i < 3; i++) {
      const ws = FakeSocket.all[FakeSocket.all.length - 1];
      act(() => ws.onopen?.());
      act(() => ws.onclose?.());
      act(() => vi.advanceTimersByTime(20_000));
    }
    // ...y una conexión que vive más que el umbral reinicia el backoff.
    const ws = FakeSocket.all[FakeSocket.all.length - 1];
    act(() => ws.onopen?.());
    act(() => vi.advanceTimersByTime(WS_STABLE_AFTER_MS + 1));
    const before = FakeSocket.all.length;
    act(() => ws.onclose?.());
    act(() => vi.advanceTimersByTime(1000));
    expect(FakeSocket.all.length).toBe(before + 1);
  });
});

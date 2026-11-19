import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  emitLiveRefresh,
  LIVE_REFRESH_DEBOUNCE_MS,
  LIVE_REFRESH_MIN_GAP_MS,
  useLiveRefresh,
} from "./live-refresh";

function Probe({ load, paused }: { load: () => unknown; paused?: boolean }) {
  useLiveRefresh(load, { paused });
  return null;
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

const settle = () => act(() => vi.advanceTimersByTimeAsync(LIVE_REFRESH_DEBOUNCE_MS + 10));

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility("visible");
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useLiveRefresh", () => {
  it("(1)(4) un aviso emitido recarga en silencio", async () => {
    const load = vi.fn();
    render(<Probe load={load} />);
    expect(load).not.toHaveBeenCalled(); // no recarga solo al montar

    act(() => emitLiveRefresh());
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith({ silent: true });
  });

  it("(2) un aviso tocado (otra emisión, más tarde) vuelve a recargar", async () => {
    const load = vi.fn();
    render(<Probe load={load} />);
    act(() => emitLiveRefresh());
    await settle();
    act(() => emitLiveRefresh());
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("(3) volver a la pestaña recarga", async () => {
    const load = vi.fn();
    render(<Probe load={load} />);
    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("(3) volver la conexión recarga", async () => {
    const load = vi.fn();
    render(<Probe load={load} />);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("no recarga con la pestaña oculta: queda pendiente y recarga una vez al volver", async () => {
    const load = vi.fn();
    render(<Probe load={load} />);
    act(() => setVisibility("hidden"));
    act(() => emitLiveRefresh());
    act(() => emitLiveRefresh());
    await settle();
    expect(load).not.toHaveBeenCalled();

    act(() => setVisibility("visible"));
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("varios avisos juntos valen una sola recarga", async () => {
    const load = vi.fn();
    render(<Probe load={load} />);
    act(() => {
      emitLiveRefresh();
      emitLiveRefresh();
      emitLiveRefresh();
    });
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("volver a la pestaña justo después de una recarga no vuelve a pedir", async () => {
    const load = vi.fn();
    render(<Probe load={load} />);
    act(() => emitLiveRefresh());
    await settle();
    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    await settle();
    expect(load).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(LIVE_REFRESH_MIN_GAP_MS));
    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("en pausa no recarga; al soltarse recarga lo pendiente", async () => {
    const load = vi.fn();
    const { rerender } = render(<Probe load={load} paused />);
    act(() => emitLiveRefresh());
    await settle();
    expect(load).not.toHaveBeenCalled();

    rerender(<Probe load={load} paused={false} />);
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("un aviso que llega con una recarga en curso pide una más al terminar, no en paralelo", async () => {
    let finish: () => void = () => {};
    const load = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)))
      .mockResolvedValue(undefined);
    render(<Probe load={load} />);
    act(() => emitLiveRefresh());
    await settle();
    expect(load).toHaveBeenCalledTimes(1);

    act(() => emitLiveRefresh());
    await settle();
    expect(load).toHaveBeenCalledTimes(1); // la primera sigue en curso

    await act(async () => finish());
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("al desmontar deja de escuchar", async () => {
    const load = vi.fn();
    const { unmount } = render(<Probe load={load} />);
    unmount();
    act(() => emitLiveRefresh());
    await settle();
    expect(load).not.toHaveBeenCalled();
  });
});

import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TAP_SETTLE_MS, useTapGuard } from "./use-tap-guard";

/** Una acción que queda en curso hasta que el test la resuelve a mano. */
function pendingAction() {
  let finish!: () => void;
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const action = vi.fn(() => done);
  return { action, finish };
}

describe("useTapGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("corre la acción y queda trabada mientras está en curso", async () => {
    const { result } = renderHook(() => useTapGuard());
    const { action, finish } = pendingAction();
    expect(result.current.locked).toBe(false);

    let ran: Promise<boolean>;
    act(() => {
      ran = result.current.run(action);
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.locked).toBe(true);

    await act(async () => {
      finish();
      await ran;
    });
    await expect(ran!).resolves.toBe(true);
  });

  it("con una acción en curso, otro toque no arranca nada", async () => {
    const { result } = renderHook(() => useTapGuard());
    const first = pendingAction();
    const second = vi.fn();

    act(() => {
      void result.current.run(first.action);
    });
    let ranSecond = true;
    await act(async () => {
      ranSecond = await result.current.run(second);
    });

    expect(ranSecond).toBe(false);
    expect(second).not.toHaveBeenCalled();
  });

  it("cuando la acción termina, un toque durante el asentamiento no dispara otra acción", async () => {
    const { result } = renderHook(() => useTapGuard());
    const other = vi.fn();

    await act(async () => {
      await result.current.run(async () => {});
    });
    expect(result.current.locked).toBe(true);

    // Justo antes de que venza la ventana, todavía no pasa nada.
    await act(async () => {
      vi.advanceTimersByTime(TAP_SETTLE_MS - 1);
    });
    let ran = true;
    await act(async () => {
      ran = await result.current.run(other);
    });

    expect(ran).toBe(false);
    expect(other).not.toHaveBeenCalled();
    expect(result.current.locked).toBe(true);
  });

  it("pasado el asentamiento se libera y vuelve a aceptar acciones", async () => {
    const { result } = renderHook(() => useTapGuard());
    const other = vi.fn();

    await act(async () => {
      await result.current.run(async () => {});
    });
    await act(async () => {
      vi.advanceTimersByTime(TAP_SETTLE_MS);
    });
    expect(result.current.locked).toBe(false);

    let ran = false;
    await act(async () => {
      ran = await result.current.run(other);
    });
    expect(ran).toBe(true);
    expect(other).toHaveBeenCalledTimes(1);
  });

  it("el asentamiento se cuenta desde que la acción termina, no desde el toque", async () => {
    const { result } = renderHook(() => useTapGuard());
    const slow = pendingAction();

    act(() => {
      void result.current.run(slow.action);
    });
    // La acción tarda más que la ventana entera (conexión lenta)…
    await act(async () => {
      vi.advanceTimersByTime(TAP_SETTLE_MS * 3);
    });
    expect(result.current.locked).toBe(true);

    // …y recién cuando vuelve empieza a correr el asentamiento.
    await act(async () => {
      slow.finish();
    });
    await act(async () => {
      vi.advanceTimersByTime(TAP_SETTLE_MS - 1);
    });
    expect(result.current.locked).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.locked).toBe(false);
  });

  it("una acción inmediata (abrir un diálogo) también deja la pantalla asentándose", async () => {
    const { result } = renderHook(() => useTapGuard());
    const open = vi.fn();

    await act(async () => {
      await result.current.run(open);
    });

    expect(open).toHaveBeenCalledTimes(1);
    expect(result.current.locked).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(TAP_SETTLE_MS);
    });
    expect(result.current.locked).toBe(false);
  });

  it("si la acción falla, el error llega a quien la llamó y la guarda igual se libera", async () => {
    const { result } = renderHook(() => useTapGuard());
    const boom = new Error("sin red");

    let failure: unknown;
    await act(async () => {
      failure = await result.current
        .run(async () => {
          throw boom;
        })
        .catch((err: unknown) => err);
    });
    expect(failure).toBe(boom);
    expect(result.current.locked).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(TAP_SETTLE_MS);
    });
    expect(result.current.locked).toBe(false);
  });

  it("acepta una ventana propia", async () => {
    const { result } = renderHook(() => useTapGuard(200));

    await act(async () => {
      await result.current.run(() => {});
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.locked).toBe(false);
  });

  it("al desmontar no deja un timer pendiente", async () => {
    const { result, unmount } = renderHook(() => useTapGuard());

    await act(async () => {
      await result.current.run(() => {});
    });
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

/**
 * El caso que la guarda existe para cubrir, en chico: una lista donde cada
 * fila tiene su botón en el mismo lugar. Al cerrar la primera, la fila sale
 * de la lista y la siguiente sube a ocupar su sitio.
 */
function Lista() {
  const [abiertos, setAbiertos] = useState(["a", "b"]);
  const [cerrados, setCerrados] = useState<string[]>([]);
  const guard = useTapGuard();

  function cerrar(id: string) {
    void guard.run(async () => {
      await Promise.resolve();
      setAbiertos((prev) => prev.filter((x) => x !== id));
      setCerrados((prev) => [...prev, id]);
    });
  }

  return (
    <div>
      {abiertos.map((id) => (
        <button key={id} disabled={guard.locked} onClick={() => cerrar(id)}>
          Cerrar
        </button>
      ))}
      <p data-testid="cerrados">{cerrados.join(",")}</p>
    </div>
  );
}

describe("useTapGuard en una lista que se redibuja", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("el botón que sube al lugar del anterior no recibe el segundo toque", async () => {
    render(<Lista />);

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Cerrar" })[0]);
    });
    expect(screen.getByTestId("cerrados")).toHaveTextContent("a");

    // La fila "b" ahora es la primera: está donde estaba el botón tocado.
    const subio = screen.getAllByRole("button", { name: "Cerrar" })[0];
    expect(subio).toBeDisabled();
    await act(async () => {
      fireEvent.click(subio);
    });
    expect(screen.getByTestId("cerrados")).toHaveTextContent(/^a$/);

    // Pasado el asentamiento, un toque a propósito sí la cierra.
    await act(async () => {
      vi.advanceTimersByTime(TAP_SETTLE_MS);
    });
    expect(subio).toBeEnabled();
    await act(async () => {
      fireEvent.click(subio);
    });
    expect(screen.getByTestId("cerrados")).toHaveTextContent("a,b");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, NetworkError, TIMEOUT_MESSAGE } from "@/lib/api";
import { CANDADO_RENOVACION, conCandadoDeRenovacion } from "@/lib/candado-renovacion";
import { instalarCandadoDeMentira, type CandadoDeMentira } from "@/lib/testing/candado-de-mentira";

// CON-02: dos pestañas que renuevan casi a la vez. Con el candado, la segunda
// sale después de que la primera recibió su respuesta (y su cookie nueva).

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let candado: CandadoDeMentira | null = null;

afterEach(() => {
  candado?.quitar();
  candado = null;
  vi.useRealTimers();
});

describe("conCandadoDeRenovacion", () => {
  it("sin navigator.locks renueva directo, como antes", async () => {
    expect("locks" in navigator).toBe(false);
    const renovar = vi.fn(async () => "token-nuevo");

    await expect(conCandadoDeRenovacion(renovar, 1_000)).resolves.toBe("token-nuevo");
    expect(renovar).toHaveBeenCalledTimes(1);
  });

  it("dos pestañas renuevan de a una, con el candado de la renovación", async () => {
    candado = instalarCandadoDeMentira();
    const primera = deferred<string>();
    const segunda = vi.fn(async () => "token-de-la-segunda");

    const pestana1 = conCandadoDeRenovacion(() => primera.promise, 1_000);
    const pestana2 = conCandadoDeRenovacion(segunda, 1_000);
    await new Promise((r) => setTimeout(r, 0));
    // La primera todavía no recibió su respuesta: la segunda no salió.
    expect(segunda).not.toHaveBeenCalled();

    primera.resolve("token-de-la-primera");
    await expect(pestana1).resolves.toBe("token-de-la-primera");
    await expect(pestana2).resolves.toBe("token-de-la-segunda");
    expect(segunda).toHaveBeenCalledTimes(1);
    expect(candado.pedidos).toEqual([CANDADO_RENOVACION, CANDADO_RENOVACION]);
    expect(CANDADO_RENOVACION).toBe("oido-renovar-sesion");
  });

  it("la que espera sale aunque la primera haya fallado, y el error no repite la renovación", async () => {
    candado = instalarCandadoDeMentira();
    const rechazo = new ApiError(401, "Tu sesión venció.");
    const primera = vi.fn(() => Promise.reject(rechazo));
    const segunda = vi.fn(async () => "token-de-la-segunda");

    const pestana1 = conCandadoDeRenovacion(primera, 1_000);
    const pestana2 = conCandadoDeRenovacion(segunda, 1_000);

    await expect(pestana1).rejects.toBe(rechazo);
    await expect(pestana2).resolves.toBe("token-de-la-segunda");
    expect(primera).toHaveBeenCalledTimes(1);
  });

  it("si el pedido del candado falla por otra cosa, renueva sin candado", async () => {
    const renovar = vi.fn(async () => "token-nuevo");
    for (const request of [
      () => Promise.reject(new DOMException("No disponible.", "SecurityError")),
      () => {
        throw new DOMException("No disponible.", "SecurityError");
      },
    ]) {
      Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
      await expect(conCandadoDeRenovacion(renovar, 1_000)).resolves.toBe("token-nuevo");
    }
    delete (navigator as { locks?: unknown }).locks;
    expect(renovar).toHaveBeenCalledTimes(2);
  });

  it("si otra pestaña no suelta el candado, no renueva y contesta como servidor que no respondió", async () => {
    vi.useFakeTimers();
    candado = instalarCandadoDeMentira();
    const otra = candado.tomarComoOtraPestana(CANDADO_RENOVACION);
    const renovar = vi.fn(async () => "token-nuevo");

    const esperando = conCandadoDeRenovacion(renovar, 90_000);
    const resultado = expect(esperando).rejects.toSatisfy(
      (err) => err instanceof NetworkError && err.message === TIMEOUT_MESSAGE
    );
    await vi.advanceTimersByTimeAsync(89_000);
    expect(renovar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    await resultado;
    expect(renovar).not.toHaveBeenCalled();

    // Cuando la otra suelta, una renovación nueva sale sin esperar.
    otra.soltar();
    await expect(conCandadoDeRenovacion(renovar, 90_000)).resolves.toBe("token-nuevo");
  });
});

/**
 * `navigator.locks` de mentira para los tests (jsdom no lo trae): candados
 * exclusivos por nombre, que se otorgan en orden de pedido, y una espera que
 * se corta con `signal` como en el navegador. Sólo lo que usa
 * `lib/candado-renovacion.ts`.
 */
export type CandadoDeMentira = {
  /** Nombres pedidos, en orden. */
  pedidos: string[];
  /** Toma el candado como lo haría otra pestaña, hasta llamar a `soltar`. */
  tomarComoOtraPestana: (nombre: string) => { soltar: () => void };
  /** Saca el candado de `navigator`. */
  quitar: () => void;
};

type Pedido = (lock: { name: string; mode: "exclusive" }) => unknown;

export function instalarCandadoDeMentira(): CandadoDeMentira {
  const colas = new Map<string, Promise<void>>();
  const pedidos: string[] = [];

  function request(
    name: string,
    options: { signal?: AbortSignal } | Pedido,
    callback?: Pedido
  ): Promise<unknown> {
    const cb = (typeof options === "function" ? options : callback) as Pedido;
    const signal = typeof options === "function" ? undefined : options.signal;
    pedidos.push(name);
    const anterior = colas.get(name) ?? Promise.resolve();
    let liberar: () => void = () => {};
    const mio = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    colas.set(
      name,
      anterior.then(() => mio)
    );
    return new Promise((resolve, reject) => {
      let cortada = false;
      signal?.addEventListener("abort", () => {
        if (cortada) return;
        cortada = true;
        liberar();
        reject(new DOMException("Se cortó la espera del candado.", "AbortError"));
      });
      void anterior.then(async () => {
        if (cortada) return;
        cortada = true; // ya lo tiene: el corte de la espera no aplica
        try {
          resolve(await cb({ name, mode: "exclusive" }));
        } catch (err) {
          reject(err);
        } finally {
          liberar();
        }
      });
    });
  }

  Object.defineProperty(navigator, "locks", {
    value: { request },
    configurable: true,
  });

  return {
    pedidos,
    tomarComoOtraPestana(nombre) {
      let soltar: () => void = () => {};
      const suelta = new Promise<void>((resolve) => {
        soltar = resolve;
      });
      void request(nombre, () => suelta);
      return { soltar };
    },
    quitar() {
      delete (navigator as { locks?: unknown }).locks;
    },
  };
}

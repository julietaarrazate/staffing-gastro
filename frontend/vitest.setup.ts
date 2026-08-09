import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// RTL no trae auto-cleanup para Vitest en esta versión (sí lo hace para
// Jest, vía detección de `afterEach` global) — sin esto, el DOM de un test
// de componente queda montado para el siguiente y `getByRole` empieza a
// encontrar duplicados.
afterEach(() => {
  cleanup();
});

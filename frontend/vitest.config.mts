import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// TECH_DEBT.md T2: tests unitarios de lógica/componentes aislados
// (Vitest + Testing Library) — complementan el E2E (Playwright, flujos
// completos con API mockeada, frontend/e2e/) sin duplicarlo: acá se testean
// funciones puras y componentes en aislamiento, no pantallas enteras.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});

import { defineConfig } from "@playwright/test";

// Specs E2E (R1.5b): corren contra un `next start` local (puerto 3100) con
// toda la API mockeada vía page.route — no hay backend real en CI. El propio
// workflow de CI corre `npm run build` antes de levantar el server; acá no
// se buildea para no duplicar el paso en runs locales.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 390, height: 844 },
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

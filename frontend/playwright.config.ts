import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// En las sesiones cloud de Claude el Chromium preinstalado
// (`/opt/pw-browsers/chromium`) es de otra revisión que la que pide esta
// versión de Playwright, y sin esto todo E2E falla con "Executable doesn't
// exist". Cada sesión lo resolvía a mano con un config temporal. En CI no
// aplica: ahí Playwright baja su propio navegador. `PW_EXECUTABLE_PATH`
// permite apuntar a otro binario.
const LOCAL_CHROMIUM = process.env.PW_EXECUTABLE_PATH ?? "/opt/pw-browsers/chromium";
const executablePath =
  !process.env.CI && existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined;

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
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: "npm run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

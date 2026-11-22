// Chromium: el de Playwright de la sesión si está (nube de Claude), si no Remotion baja el suyo.
// También se puede elegir con REMOTION_CHROME=/ruta/al/chrome.
import { Config } from "@remotion/cli/config";
import { existsSync } from "node:fs";

const candidatos = [
  process.env.REMOTION_CHROME,
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
].filter(Boolean) as string[];
const chrome = candidatos.find((c) => existsSync(c));
if (chrome) Config.setBrowserExecutable(chrome);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setPixelFormat("yuv420p");

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // TECH_DEBT.md T5: la regla marca como error el patrón de
      // fetch-on-mount usado en ~20 pantallas/componentes de toda la app
      // (`const load = useCallback(...); useEffect(() => { load(); },
      // [load])`) — es el idiom establecido para "traer datos al montar",
      // no un bug real (no hay cascada de renders: el setState ocurre una
      // vez, tras la respuesta async, no en el cuerpo síncrono del efecto
      // que la regla asume). Desactivada acá en vez de reescribir ~20
      // archivos a un patrón distinto sin necesidad real.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;

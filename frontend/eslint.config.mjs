import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // TECH_DEBT.md F4: `eslint-config-next` sólo activa 6 reglas de jsx-a11y
  // (alt-text, aria-props/proptypes, aria-unsupported-elements,
  // role-has-required-aria-props, role-supports-aria-props) — ninguna cubre
  // lo que de verdad importa acá (botones icon-only sin `aria-label`,
  // controles clickeables sin soporte de teclado, inputs sin label). El set
  // `recommended` completo sí las cubre; sólo se toman las reglas (no todo
  // `flatConfigs.recommended`) porque el plugin `jsx-a11y` ya lo registra
  // `eslint-config-next` — registrarlo de nuevo con el mismo nombre rompe
  // ESLint flat config ("Cannot redefine plugin").
  { rules: jsxA11y.flatConfigs.recommended.rules },
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

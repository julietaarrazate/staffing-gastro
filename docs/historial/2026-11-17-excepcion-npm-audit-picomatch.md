# Control de dependencias: excepción con vencimiento para picomatch

**Pedido:** el 17/11 el control «Frontend dependency audit» empezó a fallar en
`main` y en todos los PRs, sin cambios nuestros, por un aviso nuevo de
picomatch (GHSA-fc5q-39xc-vjpf, ReDoS). Julieta eligió exceptuarlo «sólo esta
vez», con fecha de revisión.

**Qué cambió:** el paso `npm audit` del workflow Security corre
`.github/scripts/npm-audit.mjs`. El script falla con los avisos de severidad
alta o crítica, como antes, salvo los de su lista de excepciones. La única
excepción es la de picomatch, que vence el 2026-12-17. Detalle y motivo en
[`../reference/SECURITY.md`](../reference/SECURITY.md), «Excepciones del
control de dependencias».

**Por qué así:** no hay versión corregida de picomatch (la última, 4.0.7, está
afectada), y vite, vitest, tinyglobby, el lint de Next y los plugins de Sentry
siguen pidiendo `^4` en sus últimas versiones. Se verificó en el registro de
npm el 17/11. Migrar herramientas no lo resolvía y esperar frenaba todos los
merges. La excepción ignora un solo aviso y vence sola: se probó que pasa
mientras está vigente y que falla al vencer.

**Queda abierto:** cuando salga un picomatch corregido, Dependabot lo propone.
Al actualizarlo hay que sacar la excepción, y el log del control avisa cuando
sobra. Los avisos moderados de minimatch y glob no bloquean el control y siguen
esperando versiones compatibles.

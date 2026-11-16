# Sacar la config de Vercel del repo (#587)

**Pedido:** limpieza tras el retiro de Vercel (2026-10-19): el frontend ya no se despliega ahí, así que la config del repo para Vercel sobra.

**Qué cambió:** se borraron `frontend/vercel.json` (Ignored Build Step) y `frontend/scripts/vercel-ignore-build.sh`. `docs/reference/DEPLOY.md` deja de describir esos archivos como vigentes (sección de Vercel, nota del Redeploy y fila de topología, que ahora apunta a Cloudflare Workers). Se corrigieron comentarios vivos que daban por hecho el deploy a Vercel: `.github/workflows/ci.yml`, `.github/actions/corrida-duplicada/action.yml` y el bloque de infra de `README.md`. Ningún script, test ni `package.json` referenciaba los archivos.

**Por qué así:** Vercel está retirado, y una config que nadie usa confunde a quien llega después. Lo que hacía el script (saltear el build si no cambió `frontend/`) no tiene equivalente hoy. Quedó en el historial de git por si hubiera que volver.

**Queda abierto:** referencias históricas o de otra naturaleza que no se tocaron: `frontend/next.config.ts` y `lib/site.ts` (lógica de `VERCEL_ENV`/`www.` para el build de Vercel), `frontend/README.md` (texto de plantilla de create-next-app), `frontend/.gitignore` (entrada `.vercel`), y los docs de `docs/audits/`, `docs/TECH_DEBT.md` y `docs/STATUS.md`, que hablan de Vercel en contexto histórico.

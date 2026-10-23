# Vistas previas por PR en Cloudflare (#PR)

**Pedido:** Julieta, 2026-10-23: "antes yo podía ver vista previa del trabajo
antes de mergear, ¿podemos hacer eso con Cloudflare?".

**Qué pasaba:** desde que la web pasó a Cloudflare (2026-10-19) Vercel no
arma más vistas previas (pedir una a mano devuelve `BLOCKED`), y en
Cloudflare los builds de otras ramas estaban apagados.

**Qué cambia:** con un ajuste de Julieta en el panel de Cloudflare (Workers &
Pages → `oido-frontend` → Settings → Build, builds de ramas que no son de
producción con `npx wrangler preview`), cada PR que toque la web tiene su
link de prueba en `<rama>-oido-frontend.julietaarrazate.workers.dev`, y
Cloudflare lo comenta en el PR. En esos links el login no anda (no están en
CORS, Turnstile ni Google); la landing y lo visual, sí. Son públicos.

**Qué cambió (técnico):** sólo documentación. `DEPLOY.md` suma la sección
"Vistas previas por PR en Cloudflare" (cómo se prenden, límites, qué no
anda, la trampa del `WORKER_SELF_REFERENCE`); `wrangler.jsonc` aclara en un
comentario que `preview_urls` (direcciones por versión) sigue en `false` y
no tiene que ver con las Previews; `STATUS.md` suma el paso pendiente de
Julieta. Se eligieron las Previews de Workers y no las direcciones por
versión porque Cloudflare desaconseja estas últimas para probar PRs.

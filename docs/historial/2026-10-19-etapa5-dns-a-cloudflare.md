# Etapa 5: www.oido.com.ar pasa de Vercel a Cloudflare Workers

**Pedido:** Julieta, 2026-10-19 ("sí a la etapa 5"), después de pasar la
cuenta de Cloudflare a Workers Paid.

**Qué cambió (paneles de Cloudflare, con Claude in Chrome):**

1. **Preparación:**
   - Métricas del Worker: 0 errores en 136 invocaciones, pero CPU P90
     234 ms y P99 906 ms. El plan gratis (10 ms) no alcanzaba, así que se
     pasó a Workers Paid antes del cambio.
   - Se anotaron los registros DNS para volver atrás.
   - Se creó la Redirect Rule "oido.com.ar a www": 301, conserva ruta y
     consulta.
2. **`www`:** se borró el CNAME a Vercel y se agregó `www.oido.com.ar` como
   dominio personalizado del Worker `oido-frontend`. Probado antes de seguir.
3. **Raíz:** lo mismo con `oido.com.ar`. Con el proxy, la regla de
   redirección quedó activa.
4. **"Always Use HTTPS"** activado. Sin eso, `http://www.oido.com.ar`
   respondía 200 sin pasar a https; Vercel lo hacía solo.

**Cómo se verificó:**

- Las 29 rutas en `www.oido.com.ar` responden 200, con `server: cloudflare`.
- `/turno/[id]` arma bien sus datos y su `og:*`.
- `/privacidad` ya nombra a Cloudflare (#452).
- La API acepta el CORS desde `www.oido.com.ar`.
- `oido.com.ar/...` devuelve 301 a `https://www.oido.com.ar/...`, conservando
  ruta y consulta.
- `http://` de `www` y de `api` devuelve 301 a `https://`.

**Por qué así:**

- Primero `www` y después la raíz: así la redirección de la raíz nunca
  apunta a algo que todavía no anda.
- Con dominios personalizados del Worker, en lugar de rutas, Cloudflare crea
  el DNS y el certificado solo.

**Queda abierto:**

- La prueba de Julieta: login con Google, navegación y subir una foto.
- Vercel unos días de respaldo, y después pausarlo con su "sí".
- Sacar Vercel de `/privacidad` (subiendo `LEGAL_TERMS_VERSION`), de
  `CORS_ORIGINS` (`render.yaml`) y de los orígenes de Google.
- Decidir qué hacer con el comodín `*` del DNS, que todavía apunta a Vercel.
- HSTS de la zona (paso 7 de la etapa 3), en unas semanas.

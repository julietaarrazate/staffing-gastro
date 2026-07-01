# PRINCIPLES.md — Principios permanentes de Staffya

> Principios de diseño y trabajo que **no cambian** sin un ADR (Fase 10). Son la
> vara para revisar cualquier cambio. Complementan [ARCHITECTURE.md](./ARCHITECTURE.md)
> (el cómo) y guían a [../CLAUDE.md](../CLAUDE.md) (cómo trabaja el asistente).

## Producto

1. **La meta manda: cubrir un turno en < 10 minutos.** Toda decisión de UX o de
   negocio se evalúa contra la velocidad de cobertura. Si algo agrega fricción sin
   servir a esa meta, sobra.
2. **Mobile-first, sensación nativa.** El producto se siente una app premium, no
   una web ni un CRM. Nada de look de dashboard administrativo.
3. **Confianza por reputación.** El rating y el historial son la moneda del
   marketplace; se protegen y se mantienen honestos.
4. **Español, siempre.** Producto, mensajes de usuario y contenido de cara al
   usuario en español (AR/LATAM).

## Dominio y arquitectura

5. **Respetar el dominio.** El negocio vive en `domain/`, puro y sin frameworks.
   Las dependencias apuntan al dominio, nunca al revés.
6. **Módulos desacoplados.** Un módulo no importa las entrañas de otro. Lo que se
   comparte entre módulos se hace por **puertos/repositorios inyectados** (en el
   servicio o en la capa `api/`), no acoplando dominios. Ver
   [ARCHITECTURE.md](./ARCHITECTURE.md#reglas-de-dependencia).
7. **Una sola fuente de verdad por concepto.** No duplicar lógica ni entidades.
   Si dos lugares necesitan lo mismo, se extrae y se reutiliza.
8. **Reutilizar antes de crear.** Antes de un componente/servicio/utilidad nuevo,
   buscar si ya existe (Design System en `components/ui/`, servicios de dominio,
   helpers). Evitar duplicados.
9. **No-disclosure.** "Existe pero no es tuyo" se responde **404, nunca 403**.
10. **Simplicidad primero.** La solución más simple que cumple gana. No se
    introduce infraestructura (colas, brokers, caches, microservicios) sin una
    necesidad real y un ADR.

## Datos, seguridad y auditoría

11. **Perfil y permiso antes de actuar.** Se valida rol y pertenencia (comercio
    dueño, trabajador asignado) en cada acción sensible.
12. **Toda acción importante deja rastro.** Los hitos del turno (asignación,
    confirmación, rechazo, check-in/out, pago) y las reseñas **notifican** y
    quedan reflejados en el estado. El patrón de efectos se documenta en
    [EVENTS.md](./EVENTS.md); la auditoría formal, en `BUSINESS_RULES.md` (fase de
    reglas operativas).
13. **Credenciales fuera del código y del chat.** Se configuran como variables de
    entorno en Render/Vercel. Si se filtran, se revocan de inmediato.
14. **Sin `localhost` en configuración.** El frontend apunta al backend remoto por
    env vars; CORS sólo con el dominio de producción.

## Calidad y evolución

15. **La documentación es la fuente de verdad.** Si el código contradice la doc,
    es un bug de una de las dos: se identifica la inconsistencia y se corrige (o
    se actualiza la doc) antes de seguir. No se deja divergir en silencio.
16. **Cambiar una decisión importante = nuevo ADR.** Las decisiones
    arquitectónicas se registran y no se reescriben; se supersede con un ADR nuevo
    (Fase 10).
17. **No romper lo que funciona.** Los cambios de presentación no tocan la lógica
    de backend salvo necesidad; se preservan las funcionalidades existentes.
18. **Verificar antes de dar por hecho.** Backend `pytest -q`; frontend
    `npx tsc --noEmit` + `npm run build` antes de commitear. Se reporta el
    resultado real, no el esperado.

## Git y trabajo

19. **Feature branch + PR en draft, merge con squash.** Commits descriptivos;
    stagear archivos puntuales (no `git add -A`).
20. **Un PR, un propósito.** Cambios acotados y revisables; nada de PRs gigantes
    que mezclan concerns.

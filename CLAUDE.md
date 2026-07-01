# CLAUDE.md — Cómo trabajar en Staffya

Guía operativa para cualquier sesión (humana o IA) que modifique este repo. La
**fuente de verdad del producto, el dominio y la arquitectura** vive en `docs/`.
Este archivo dice **cómo** trabajar acá; los `docs/` dicen **qué** es Staffya.

## Contexto en 30 segundos

**Staffya** es un marketplace de **staffing gastronómico en tiempo real**
(estilo Uber + Tinder): conecta comercios con trabajadores eventuales para
cubrir turnos. **Misión: cubrir una posición eventual en menos de 10 minutos.**
Roles: `worker`, `employer`, `admin`. Producto en **español (AR/LATAM)**.

- **Backend:** FastAPI · SQLAlchemy async · monolito modular DDD/hexagonal ·
  deploy en Render (auto desde `main`).
- **Frontend:** Next.js · TypeScript · Tailwind · PWA · deploy en Vercel (auto
  desde `main`).

## Mapa de la documentación (`docs/`)

Antes de tocar algo, leé lo relevante. No dupliques info: referenciá.

- **Fundación** — [PRODUCT.md](docs/PRODUCT.md) · [DOMAIN.md](docs/DOMAIN.md) ·
  [ARCHITECTURE.md](docs/ARCHITECTURE.md) · [PRINCIPLES.md](docs/PRINCIPLES.md)
- Fases siguientes (a construir): negocio por módulo, reglas operativas,
  arquitectura técnica, desarrollo, diseño, IA, integraciones, producto y ADRs.

Arranque técnico y pasos de DB: `backend/README.md` y `frontend/README.md`.

## Antes de modificar código — checklist

1. **Entender el dominio afectado.** Leé el/los `docs/` del área (empezando por
   [DOMAIN.md](docs/DOMAIN.md)) y el módulo real (`backend/app/modules/<x>/`).
2. **Buscar antes de crear.** ¿Ya existe el componente/servicio/utilidad?
   Reutilizá (Design System en `frontend/components/ui/`, servicios de dominio,
   helpers). No dupliques lógica ni entidades.
3. **Respetar las capas.** Ubicá el cambio en la capa correcta
   (`domain`/`application`/`infrastructure`/`api`). Las dependencias apuntan al
   dominio. Cruces entre módulos: por puerto/repositorio inyectado, nunca
   acoplando dominios. Ver [PRINCIPLES.md](docs/PRINCIPLES.md).
4. **Chequear coherencia doc↔código.** Si el código contradice la doc, frená:
   identificá la inconsistencia y corregí (código o doc) antes de seguir.
5. **Definir el alcance.** Un cambio, un propósito. PR acotado y revisable.

## Implementar una funcionalidad nueva

1. Modelar en `domain/` (entidades, value objects, **puerto** de repo,
   excepciones) sin frameworks.
2. Caso de uso en `application/` sobre los puertos (repos por constructor).
3. Adaptadores en `infrastructure/` (modelo ORM + repo) y **migración Alembic**
   si hay tabla nueva; registrar el modelo en `tests/conftest.py`.
4. Exponer en `api/` (rutas, schemas Pydantic, dependencias) mapeando
   excepciones a HTTP; **no-disclosure** (ajeno/inexistente = 404).
5. Frontend con el **Design System** existente; sin `localhost` (usar
   `NEXT_PUBLIC_API_URL`).
6. **Tests** del caso de uso (SQLite en memoria).
7. Actualizar los `docs/` afectados (la doc es fuente de verdad).

## Calidad — antes de commitear

- Backend: `pytest -q` (verde).
- Frontend: `npx tsc --noEmit` **y** `npm run build`.
- Reportá el resultado **real**, no el esperado. Si algo falla, se dice.

## Convenciones de git

- Desarrollar en **rama de feature**; commits descriptivos.
- Abrir PR en **draft**; mergear con **squash**.
- **No `git add -A`**: stagear archivos puntuales.
- Cambios de presentación no tocan la lógica de backend salvo necesidad.

## No hacer

- Duplicar componentes/lógica/entidades.
- Acoplar módulos por dentro (importar entrañas de otro dominio).
- Poner credenciales en el código o en el chat (van como env vars en
  Render/Vercel; si se filtran, revocar).
- Usar `localhost` en configuración de producto.
- Introducir infraestructura pesada (colas, brokers, microservicios) sin
  necesidad real y sin ADR.
- Cambiar una decisión arquitectónica sin crear un **ADR nuevo**.

## Convenciones de producto/diseño

- Todo en **español**, incluido el texto de cara al usuario.
- Identidad **monocromática** (blanco + ink `#111` + acento `#FF6B00`),
  iconografía **Lucide**, sensación de app nativa. Detalle en la doc de diseño
  (Fase 6).

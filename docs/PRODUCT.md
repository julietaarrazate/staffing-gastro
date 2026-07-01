# PRODUCT.md — Qué es Staffya

> Fuente de verdad del **producto**. Para el dominio ver [DOMAIN.md](./DOMAIN.md);
> para la arquitectura [ARCHITECTURE.md](./ARCHITECTURE.md); para las reglas de
> trabajo [PRINCIPLES.md](./PRINCIPLES.md) y [../CLAUDE.md](../CLAUDE.md).

## Qué es Staffya

Staffya es un **marketplace de staffing gastronómico en tiempo real**. Conecta
comercios gastronómicos y organizadores de eventos (**comercios / employers**)
con trabajadores eventuales (**trabajadores / workers**) para cubrir turnos de
trabajo puntuales.

La experiencia es **mobile-first** (PWA instalable) y combina patrones de:
- **Uber** — oportunidades cerca tuyo, en tiempo real.
- **Tinder** — el trabajador desliza turnos; el comercio elige entre postulantes (match).
- **WhatsApp** — chat simple trabajador↔comercio por turno.
- **Airbnb** — tarjetas grandes con foto real del local.
- **PedidosYa / Uber Driver** — seguimiento del estado del turno.

## Qué problema resuelve

El staffing gastronómico eventual hoy se resuelve por WhatsApp, contactos y
azar: es **lento, informal y sin reputación**. Cuando falta un mozo/bachero/
bartender para el turno de esta noche, el comercio no tiene forma rápida y
confiable de cubrirlo; y el trabajador no tiene un canal para conseguir un turno
para **hoy**.

Staffya reemplaza ese proceso por un flujo estructurado, geolocalizado y con
reputación, con una única meta operativa:

> **Misión: cubrir una posición eventual en menos de 10 minutos.**

## Usuarios

| Rol | Quién es | Qué busca |
|-----|----------|-----------|
| **Trabajador** (`worker`) | Personal gastronómico eventual (mozo, bartender, barista, cocinero, runner, cajero, etc.). | Conseguir turnos cerca, cobrar bien, construir reputación. |
| **Comercio** (`employer`) | Bar, restaurante, cafetería, salón de eventos, catering, empresa gastronómica. | Cubrir un puesto rápido con gente confiable y cercana. |
| **Administrador** (`admin`) | Equipo de Staffya. | Moderar usuarios y ver métricas de la plataforma. |

Idioma del producto y de la comunicación: **español (Argentina / LATAM)**.

> **Nota de dominio:** el producto habla de "comercio" pero el código lo modela
> como **PerfilComercio** (`company`). No existe una entidad `Organization`
> separada: el employer *es* el comercio. Ver [DOMAIN.md](./DOMAIN.md).

## Misión

Cubrir una posición eventual (o conseguir un turno de trabajo) en **menos de 10
minutos**, con confianza y reputación de por medio.

## Visión

Ser la capa de staffing en tiempo real de la gastronomía en LATAM: el lugar
donde cualquier comercio arma su equipo por turno y cualquier trabajador
gastronómico consigue trabajo hoy.

## Objetivos del producto

1. **Velocidad de cobertura** — minimizar el tiempo entre "necesito personal" y
   "turno confirmado".
2. **Confianza** — reputación bidireccional (rating, puntualidad, historial) que
   haga que elegir/ser elegido sea seguro.
3. **Cercanía** — priorizar match por distancia (geolocalización).
4. **Experiencia nativa** — que se sienta una app premium, no una web/CRM.

## Propuesta de valor

- **Para el comercio:** publicás un turno en segundos, recibís postulantes y
  candidatos recomendados por cercanía/reputación, asignás y coordinás por chat;
  asistencia con check-in/out geolocalizado.
- **Para el trabajador:** ves oportunidades cerca en un feed tipo Tinder o en un
  mapa, te postulás con un swipe, y construís reputación turno a turno.

## Fuera de alcance (hoy)

Estas cosas **no** son parte del producto en su estado actual (ver estado real
en [ARCHITECTURE.md](./ARCHITECTURE.md#estado-de-los-módulos)):

- **Cobro/pago real de dinero.** El módulo `payment` es un placeholder: la
  acción "marcar como pagado" sólo registra que el comercio pagó por fuera, no
  procesa un cobro. Integración con **MercadoPago** pendiente.
- **Asistente de IA por voz.** No implementado (roadmap).
- **Push nativo** más allá del WebSocket in-app; **app nativa** (React Native).
- **Relaciones laborales / facturación / impuestos.** Staffya conecta oferta y
  demanda; no es empleador ni gestiona la relación laboral formal.
- **Afinidad histórica local↔trabajador en el matching** (Fase futura; requiere
  historial de asignaciones).

## Ciclo de vida del turno (resumen)

El corazón del producto es el turno y su ciclo ("Modo Uber"):

```
BORRADOR → PUBLICADO → BUSCANDO_PERSONAL → ASIGNADO → CONFIRMADO →
EN_CAMINO → CHECK_IN → TRABAJANDO → CHECK_OUT → FINALIZADO → PAGADO
(CANCELADO alcanzable desde cualquier estado no terminal)
```

El detalle vive en [SHIFT.md](./SHIFT.md) (Fase 2) y en el futuro
`SHIFT_LIFECYCLE.md` / `STATE_MACHINE.md` (Fase 3).

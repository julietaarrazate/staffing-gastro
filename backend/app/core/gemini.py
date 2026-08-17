"""Interpretación de texto libre para turnos vía Gemini (P2, auditoría de
producto 2026-08-10): "necesito 2 mozos el sábado a la noche" -> campos
estructurados que PRECARGAN el wizard de publicar turno — el comercio sigue
revisando y confirmando cada paso a mano, la IA nunca publica nada directo
(regla no negociable: la IA interpreta intención, el motor de turnos/
matching decide resultados).

Llamada HTTP directa a la API de Gemini (`generateContent` con
`responseSchema` para forzar JSON estructurado) — sin SDK, mismo criterio
que `ResendEmailSender` (un único endpoint simple no amerita una
dependencia nueva). Modelo fijo (no el alias `-latest`): Google documenta
que `-latest` puede pasar a apuntar a una release preview/experimental —
un hot-swap sin deploy propio que un endpoint que depende de
`responseSchema` estructurado no puede permitirse (aviso previo de sólo 2
semanas por mail, que nadie del equipo monitorea). Se fija a
`gemini-3.5-flash` (GA estable vigente a 2026-08). Cuando Google la dé de
baja para cuentas nuevas —como pasó con `gemini-2.5-flash`, ver
docs/STATUS.md 2026-08-11— hay que revisar `GET /v1beta/models` y
actualizar esta constante a mano; no es automático a propósito.
"""

import json
import logging
from dataclasses import dataclass, field

import httpx

from app.core.config import settings
from app.core.tz import now_art
from app.modules.worker.domain.value_objects import WorkerSkill

logger = logging.getLogger(__name__)

_GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-3.5-flash:generateContent"
)

_POSITIONS = [skill.value for skill in WorkerSkill]

# Tope de salida para las 4 llamadas de este archivo: todas devuelven JSON
# estructurado chico (campos de un turno, intención+filtros, resumen de
# ticket) — nunca deberían necesitar más. Sin esto, el rate limit de cada
# endpoint acota la CANTIDAD de llamadas pero no lo que Google factura por
# CADA una (auditoría 2026-08-15, F4).
_MAX_OUTPUT_TOKENS = 1024

_SYSTEM_INSTRUCTION = """Extraés datos de un turno gastronómico eventual a partir de una descripción \
en español informal de Argentina. Hoy es {today} (hora de Argentina). Reglas:
- `position`: el puesto más parecido de esta lista: {positions}. Si no podés
  inferirlo, usá "desconocido".
- `start_at`/`end_at`: horario ISO-8601 CON offset -03:00 (ej: "2026-08-15T20:00:00-03:00").
  Resolvé días relativos ("mañana", "el sábado", "hoy") contra la fecha de hoy de arriba.
  Si no podés inferir un horario, dejalo en null.
- **DEDUCÍ el horario de fin cuando el texto da inicio + duración.** Es el caso más
  común: la gente dice cuándo arranca y cuánto dura, no cuándo termina.
  Ejemplos, todos con "hoy" = {today}:
  · "7 horas de 10 a.m" -> start 10:00, end 17:00 del mismo día.
  · "de 20 a 2" -> start 20:00 de hoy, end 02:00 del día SIGUIENTE (cruza medianoche).
  · "turno de 6 horas arrancando 18hs" -> start 18:00, end 00:00 del día siguiente.
  Si el fin cae después de medianoche, la fecha de `end_at` es la del día siguiente.
  Si el texto SÓLO da la duración y ninguna hora de inicio, dejá los dos en null:
  no inventes a qué hora arranca.
- Interpretá la hora como la diría alguien en Argentina: "10 a.m"/"10 am"/"10 de la
  mañana" = 10:00; "10 de la noche"/"22hs"/"10 pm" = 22:00. Si sólo dice "a las 8" y
  el puesto es de gastronomía nocturna (bartender), asumí 20:00; si es de mañana
  (barista), 08:00.
- `pay_amount`: el monto en pesos argentinos que se menciona (sólo el número, sin
  puntos ni comas ni signo: "$50,000" y "50.000" y "50 lucas" -> 50000). Si no se
  menciona, null.
- `urgent`: true si el texto sugiere que es para cubrir ya/hoy/urgente. "para hoy"
  cuenta como urgente.
- `meal`: true si menciona que incluye comida/vianda.
- `tips`: true salvo que el texto diga explícitamente que NO hay propinas.
- `dress_code`: si se menciona un código de vestimenta, transcribilo corto
  ("camisa negra", "todo de negro", "uniforme del local"). Si no, null.
No inventes datos que el texto no sugiere, pero SÍ deducí lo que se sigue \
aritméticamente de lo que dice (sobre todo el horario de fin)."""

_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "position": {"type": "STRING", "enum": [*_POSITIONS, "desconocido"]},
        "start_at": {"type": "STRING", "nullable": True},
        "end_at": {"type": "STRING", "nullable": True},
        "pay_amount": {"type": "NUMBER", "nullable": True},
        "urgent": {"type": "BOOLEAN"},
        "meal": {"type": "BOOLEAN"},
        "tips": {"type": "BOOLEAN"},
        "dress_code": {"type": "STRING", "nullable": True},
    },
    "required": ["position", "urgent", "meal", "tips"],
}


class GeminiNotConfiguredError(Exception):
    """`GEMINI_API_KEY` no está seteada."""


class GeminiRequestError(Exception):
    """La llamada a Gemini falló (red, cuota agotada, respuesta inválida)."""


async def _call_gemini(payload: dict) -> dict:
    """POST común a `generateContent`, compartido por las 3 llamadas de este
    archivo. Antes cada una hacía `response.raise_for_status()` sin loguear
    el cuerpo del error — Google manda un JSON con el motivo real (ej.
    `PERMISSION_DENIED` con el detalle de qué falta), y se perdía: sólo
    quedaba "404 Not Found" en Sentry, sin explicar el porqué."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            _GEMINI_URL,
            params={"key": settings.gemini_api_key},
            json=payload,
        )
        if response.status_code >= 400:
            logger.error("Gemini respondió %s: %s", response.status_code, response.text)
        response.raise_for_status()
        body = response.json()
    raw = body["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(raw)


@dataclass(frozen=True)
class ParsedShiftDraft:
    """Campos parciales de `ShiftData` inferidos del texto — cualquiera
    puede venir en `None`/default cuando Gemini no pudo inferirlo; el
    frontend precarga lo que hay y deja el resto para completar a mano."""

    position: str | None
    start_at: str | None
    end_at: str | None
    pay_amount: float | None
    urgent: bool
    meal: bool
    tips: bool
    dress_code: str | None
    # Qué le falta al borrador para poder publicarse, en palabras, para que la
    # UI pueda PREGUNTAR en vez de dejar al comercio adivinar por qué el
    # wizard frenó donde frenó (Julieta, 2026-08-17: "si algo no se dijo, que
    # pregunte qué falta para poder completar"). Se calcula acá, en código, a
    # partir del borrador ya parseado — NO se le pide a Gemini: es una regla
    # fija (los 4 campos que el wizard exige), determinística y testeable, y
    # pedírsela al modelo sería pagar tokens para que invente una lista que
    # ya sabemos.
    missing: list[str] = field(default_factory=list)


# Campos que el wizard de publicar turno exige sí o sí, en el orden en que los
# pide. El texto es el que se le muestra al comercio.
_REQUIRED_DRAFT_FIELDS: list[tuple[str, str]] = [
    ("position", "qué puesto necesitás"),
    ("start_at", "a qué hora arranca"),
    ("end_at", "a qué hora termina"),
    ("pay_amount", "cuánto pagás"),
]


def _missing_draft_fields(data: dict) -> list[str]:
    """Los campos obligatorios que el texto no alcanzó a definir."""
    return [label for key, label in _REQUIRED_DRAFT_FIELDS if not data.get(key)]


_SUPPORT_SYSTEM_INSTRUCTION = """Sos un asistente interno para el equipo de soporte de Oído \
(marketplace de staffing gastronómico eventual en Argentina). Te paso el asunto, la categoría \
y la conversación completa de un ticket de soporte. Tu respuesta es SIEMPRE una sugerencia \
interna que una persona del equipo revisa y edita antes de mandar — nunca le llega directo al \
usuario. Devolvé:
- `summary`: 1-2 frases, en español, de qué necesita el usuario (para que la persona de soporte
  entienda el ticket de un vistazo sin releer todo).
- `suggested_reply`: una respuesta propuesta, tono cordial y directo, coherente con el resto de
  la conversación. No inventes políticas, plazos ni montos que no estén en la conversación (ej.
  reembolsos, tiempos de resolución exactos) — si hace falta algo así, sugerí pedir más info o
  escalar en vez de prometerlo. No te identifiques como IA en el texto de `suggested_reply` (lo
  firma la persona de soporte)."""

_SUPPORT_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "summary": {"type": "STRING"},
        "suggested_reply": {"type": "STRING"},
    },
    "required": ["summary", "suggested_reply"],
}


@dataclass(frozen=True)
class TicketSuggestion:
    """Sugerencia interna para el admin — nunca se le manda directo al
    usuario (ver `_SUPPORT_SYSTEM_INSTRUCTION`)."""

    summary: str
    suggested_reply: str


async def suggest_ticket_reply(subject: str, category: str, transcript: str) -> TicketSuggestion:
    if not settings.gemini_api_key:
        raise GeminiNotConfiguredError()

    payload = {
        "systemInstruction": {"parts": [{"text": _SUPPORT_SYSTEM_INSTRUCTION}]},
        "contents": [
            {
                "parts": [
                    {"text": f"Asunto: {subject}\nCategoría: {category}\n\n{transcript}"}
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": _SUPPORT_RESPONSE_SCHEMA,
            "maxOutputTokens": _MAX_OUTPUT_TOKENS,
        },
    }
    try:
        data = await _call_gemini(payload)
    except Exception as exc:
        logger.exception("suggest_ticket_reply: falló la llamada a Gemini")
        raise GeminiRequestError() from exc

    return TicketSuggestion(
        summary=str(data.get("summary", "")).strip(),
        suggested_reply=str(data.get("suggested_reply", "")).strip(),
    )


async def parse_shift_text(text: str) -> ParsedShiftDraft:
    if not settings.gemini_api_key:
        raise GeminiNotConfiguredError()

    payload = {
        "systemInstruction": {
            "parts": [
                {
                    "text": _SYSTEM_INSTRUCTION.format(
                        today=now_art().date().isoformat(),
                        positions=", ".join(_POSITIONS),
                    )
                }
            ]
        },
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": _RESPONSE_SCHEMA,
            "maxOutputTokens": _MAX_OUTPUT_TOKENS,
        },
    }
    try:
        data = await _call_gemini(payload)
    except Exception as exc:
        logger.exception("parse_shift_text: falló la llamada a Gemini")
        raise GeminiRequestError() from exc

    position = data.get("position")
    if position not in _POSITIONS:
        position = None

    return ParsedShiftDraft(
        position=position,
        start_at=data.get("start_at"),
        end_at=data.get("end_at"),
        pay_amount=data.get("pay_amount"),
        urgent=bool(data.get("urgent", False)),
        meal=bool(data.get("meal", False)),
        tips=bool(data.get("tips", True)),
        dress_code=data.get("dress_code"),
        # Ojo: se calcula sobre `position` YA normalizado (un puesto que
        # Gemini no supo inferir llega como "desconocido", que no está en
        # `_POSITIONS` y acá arriba quedó en `None`) — si se calculara sobre
        # el dict crudo, "desconocido" contaría como puesto definido.
        missing=_missing_draft_fields({**data, "position": position}),
    )


# Asistente general del panel del comercio (pedido de Julieta: "que entienda
# si es un evento, si es un turno, y toda la app, no sólo lo básico"). Una
# sola llamada clasifica la intención Y extrae los campos que esa intención
# necesita — evita un segundo round-trip a Gemini. Mismo principio no
# negociable que el resto de este archivo: la IA sólo interpreta intención,
# nunca ejecuta ni publica nada por su cuenta.
_ASSISTANT_INTENTS = [
    "crear_turno",
    "crear_evento",
    "consultar_turnos",
    "buscar_candidatos",
    "ver_postulantes",
    "consultar_verificacion",
    "desconocido",
]

_ASSISTANT_QUERY_FILTERS = ["hoy", "urgentes", "sin_cubrir", "todos"]

_ASSISTANT_SYSTEM_INSTRUCTION = """Sos el asistente del panel de un comercio en Oído (marketplace \
de staffing gastronómico eventual, Argentina). Interpretás lo que el comercio escribe o dicta y \
decidís qué quiere hacer. Hoy es {today} (hora de Argentina). Intents posibles:

- `crear_turno`: publicar UN turno para UN solo puesto (ej: "necesito un mozo el sábado").
- `crear_evento`: cubrir VARIOS puestos a la vez para el mismo evento (ej: "necesito 1 bachero, 1 \
bartender y 2 mozos para el sábado"). Si el texto menciona más de un puesto, o más de una cantidad \
de personas para puestos distintos, es `crear_evento`, no `crear_turno`.
- `consultar_turnos`: ver el estado de SUS turnos ya publicados (ej: "¿qué tengo urgente hoy?", \
"¿cuántos turnos sin cubrir tengo?").
- `buscar_candidatos`: buscar trabajadores disponibles para un puesto (ej: "buscame mozos \
disponibles").
- `ver_postulantes`: ver quién se postuló a un turno puntual ya publicado (ej: "¿quién se postuló \
al turno de mozo del sábado?").
- `consultar_verificacion`: preguntar si UNA persona puntual (postulante o candidato, nombrada por \
su nombre) tiene la identidad verificada (ej: "¿Juan Pérez está verificado?", "¿le verificaron el \
DNI a Camila?"). Sólo cuando se menciona un nombre de persona — una pregunta general sobre \
verificación sin nombre es `desconocido`.
- `desconocido`: no se puede inferir ninguno de los anteriores con confianza.

Reglas de extracción según el intent (dejá en null/"desconocido" lo que no puedas inferir con \
confianza, no inventes datos que el texto no sugiere):
- `crear_turno`: `position` (de esta lista: {positions}; si no podés inferirlo, "desconocido"), \
`start_at`/`end_at` (ISO-8601 con offset -03:00, resolviendo días relativos contra hoy), \
`pay_amount` (sólo el número), `urgent`, `meal`, `tips` (true salvo que diga explícitamente que no \
hay), `dress_code`.
- `crear_evento`: `event_positions` (lista de {{position, quantity}}, una entrada por puesto \
mencionado, `position` de la misma lista de arriba), y los mismos `start_at`/`end_at`/`pay_amount`/\
`urgent`/`meal`/`tips`/`dress_code` de arriba, compartidos por todos los roles del evento.
- `consultar_turnos`: `query_filter`, uno de "hoy"/"urgentes"/"sin_cubrir"/"todos" (el que mejor \
represente la pregunta; "todos" si no se puede inferir algo más específico).
- `buscar_candidatos`: `search_position` (de la lista de arriba, o "desconocido").
- `ver_postulantes`: `applicants_position` (de la lista de arriba, o "desconocido") y \
`applicants_date_hint` (fecha ISO YYYY-MM-DD si se puede inferir del texto, null si no).
- `consultar_verificacion`: `verification_name`, el nombre (o parte del nombre) de la persona \
mencionada, tal cual aparece en el texto (ej. "Juan Pérez", "Camila"). Si no se menciona ningún \
nombre, el intent es `desconocido`, no `consultar_verificacion`."""

# P2 (auditoría de producto, elegido por Julieta entre las opciones
# propuestas): "la IA tiene que aprender cosas de cada persona, está muy
# genérica, no hace nada". Se le suma como una SEGUNDA parte de
# `systemInstruction` (Gemini acepta varias, no hace falta tocar el prompt
# base) sólo cuando `AssistantService.build_context_summary` encuentra
# suficiente historial — nunca reemplaza lo que el texto dice, sólo completa
# lo que no dice.
_ASSISTANT_CONTEXT_INSTRUCTION = """Contexto de turnos anteriores de este comercio (usalo SÓLO para \
completar campos de `crear_turno`/`crear_evento` que el texto no menciona explícitamente — nunca \
para contradecir algo que el texto sí dice): {context}"""

_ASSISTANT_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "intent": {"type": "STRING", "enum": _ASSISTANT_INTENTS},
        "position": {"type": "STRING", "enum": [*_POSITIONS, "desconocido"], "nullable": True},
        "start_at": {"type": "STRING", "nullable": True},
        "end_at": {"type": "STRING", "nullable": True},
        "pay_amount": {"type": "NUMBER", "nullable": True},
        "urgent": {"type": "BOOLEAN", "nullable": True},
        "meal": {"type": "BOOLEAN", "nullable": True},
        "tips": {"type": "BOOLEAN", "nullable": True},
        "dress_code": {"type": "STRING", "nullable": True},
        "event_positions": {
            "type": "ARRAY",
            "nullable": True,
            "items": {
                "type": "OBJECT",
                "properties": {
                    "position": {"type": "STRING", "enum": [*_POSITIONS, "desconocido"]},
                    "quantity": {"type": "INTEGER"},
                },
                "required": ["position", "quantity"],
            },
        },
        "query_filter": {"type": "STRING", "enum": _ASSISTANT_QUERY_FILTERS, "nullable": True},
        "search_position": {"type": "STRING", "enum": [*_POSITIONS, "desconocido"], "nullable": True},
        "applicants_position": {
            "type": "STRING",
            "enum": [*_POSITIONS, "desconocido"],
            "nullable": True,
        },
        "applicants_date_hint": {"type": "STRING", "nullable": True},
        "verification_name": {"type": "STRING", "nullable": True},
    },
    "required": ["intent"],
}


@dataclass(frozen=True)
class AssistantEventRole:
    position: str
    quantity: int


@dataclass(frozen=True)
class AssistantQueryResult:
    intent: str
    # `crear_turno`, y campos compartidos de `crear_evento` (todo menos `position`).
    position: str | None = None
    start_at: str | None = None
    end_at: str | None = None
    pay_amount: float | None = None
    urgent: bool = False
    meal: bool = False
    tips: bool = True
    dress_code: str | None = None
    # `crear_evento`
    event_positions: list[AssistantEventRole] = field(default_factory=list)
    # `consultar_turnos`
    query_filter: str | None = None
    # `buscar_candidatos`
    search_position: str | None = None
    # `ver_postulantes`
    applicants_position: str | None = None
    applicants_date_hint: str | None = None
    # `consultar_verificacion`
    verification_name: str | None = None


async def interpret_assistant_query(
    text: str, company_context: str | None = None
) -> AssistantQueryResult:
    if not settings.gemini_api_key:
        raise GeminiNotConfiguredError()

    system_parts = [
        {
            "text": _ASSISTANT_SYSTEM_INSTRUCTION.format(
                today=now_art().date().isoformat(),
                positions=", ".join(_POSITIONS),
            )
        }
    ]
    if company_context:
        system_parts.append({"text": _ASSISTANT_CONTEXT_INSTRUCTION.format(context=company_context)})

    payload = {
        "systemInstruction": {"parts": system_parts},
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": _ASSISTANT_RESPONSE_SCHEMA,
            "maxOutputTokens": _MAX_OUTPUT_TOKENS,
        },
    }
    try:
        data = await _call_gemini(payload)
    except Exception as exc:
        logger.exception("interpret_assistant_query: falló la llamada a Gemini")
        raise GeminiRequestError() from exc

    intent = data.get("intent")
    if intent not in _ASSISTANT_INTENTS:
        intent = "desconocido"

    position = data.get("position")
    if position not in _POSITIONS:
        position = None

    event_positions: list[AssistantEventRole] = []
    for role in data.get("event_positions") or []:
        if not isinstance(role, dict):
            continue
        role_position = role.get("position")
        quantity = role.get("quantity")
        if role_position not in _POSITIONS or not isinstance(quantity, int) or quantity < 1:
            continue
        event_positions.append(AssistantEventRole(position=role_position, quantity=quantity))
    # Sin roles válidos, no hay evento que armar — degrada a "desconocido" en
    # vez de mandar al comercio a un wizard de evento vacío.
    if intent == "crear_evento" and not event_positions:
        intent = "desconocido"

    query_filter = data.get("query_filter")
    if query_filter not in _ASSISTANT_QUERY_FILTERS:
        query_filter = "todos"

    search_position = data.get("search_position")
    if search_position not in _POSITIONS:
        search_position = None

    applicants_position = data.get("applicants_position")
    if applicants_position not in _POSITIONS:
        applicants_position = None

    verification_name = data.get("verification_name")
    if not isinstance(verification_name, str) or not verification_name.strip():
        verification_name = None
    # Sin nombre no hay a quién buscar — degrada a "desconocido" en vez de
    # mandar una búsqueda vacía al repositorio (mismo criterio que
    # `crear_evento` sin roles, arriba).
    if intent == "consultar_verificacion" and verification_name is None:
        intent = "desconocido"

    return AssistantQueryResult(
        intent=intent,
        position=position,
        start_at=data.get("start_at"),
        end_at=data.get("end_at"),
        pay_amount=data.get("pay_amount"),
        urgent=bool(data.get("urgent", False)),
        meal=bool(data.get("meal", False)),
        tips=bool(data.get("tips", True)),
        dress_code=data.get("dress_code"),
        event_positions=event_positions,
        query_filter=query_filter,
        search_position=search_position,
        applicants_position=applicants_position,
        applicants_date_hint=data.get("applicants_date_hint"),
        verification_name=verification_name,
    )


# Asistente del TRABAJADOR (pedido de Julieta: "el asistente de ia falta para
# el trabajador, por ejemplo búscame un turno en palermo a menos de 2
# kilómetros para hoy tanto para mozo barista y cajero, así comienza algo más
# de evaluar opciones que convengan"). Endpoint separado del asistente del
# comercio (`interpret_assistant_query`), no una rama más ahí: el trabajador
# tiene un solo intent real hoy (buscar turnos) contra 7 del comercio, y
# `/assistant/query` fuerza rol EMPLOYER en su propia dependencia — mezclar
# los dos hubiera significado reescribir esa inyección para algo que todavía
# no lo necesita. Mismo principio no negociable que el resto de este archivo:
# esto sólo interpreta texto a filtros estructurados, nunca ejecuta la
# búsqueda — eso lo resuelve el feed ya existente (`GET /shifts/feed`,
# filtrado por posiciones acá y por zona/radio/fecha en el frontend, que ya
# tiene la tabla de barrios y el cálculo de distancia para el propio feed).
_WORKER_QUERY_INTENTS = ["buscar_turnos", "desconocido"]

_WORKER_QUERY_DATE_FILTERS = ["hoy", "todos"]

_WORKER_QUERY_SYSTEM_INSTRUCTION = """Sos el asistente de un trabajador en Oído (marketplace de \
staffing gastronómico eventual, Argentina). El trabajador te describe qué turno busca, en texto \
libre o dictado. Hoy es {today} (hora de Argentina). Extraé:

- `intent`: `buscar_turnos` si el texto describe una búsqueda de turnos (puesto, zona, radio y/o \
fecha). `desconocido` si no se puede inferir ninguna búsqueda con confianza.
- `positions`: lista de puestos mencionados, cada uno de esta lista: {positions}. Si menciona más \
de uno (ej. "mozo, barista y cajero"), incluí todos. Si no menciona ningún puesto, dejá la lista \
vacía (no inventes uno).
- `zone_name`: el nombre del barrio/zona/ciudad mencionado tal cual aparece en el texto (ej. \
"Palermo", "Belgrano"). Null si no se menciona ninguna zona.
- `radius_km`: el radio en kilómetros si se menciona ("a menos de 2 kilómetros" -> 2). Null si no \
se menciona.
- `date_filter`: "hoy" si el texto pide turnos para hoy/ahora/ya, "todos" si no se menciona ninguna \
restricción de fecha o pide "cualquier día"."""

_WORKER_QUERY_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "intent": {"type": "STRING", "enum": _WORKER_QUERY_INTENTS},
        "positions": {"type": "ARRAY", "items": {"type": "STRING", "enum": _POSITIONS}},
        "zone_name": {"type": "STRING", "nullable": True},
        "radius_km": {"type": "NUMBER", "nullable": True},
        "date_filter": {"type": "STRING", "enum": _WORKER_QUERY_DATE_FILTERS},
    },
    "required": ["intent", "positions", "date_filter"],
}


@dataclass(frozen=True)
class WorkerQueryResult:
    intent: str
    positions: list[str] = field(default_factory=list)
    zone_name: str | None = None
    radius_km: float | None = None
    date_filter: str = "todos"


async def interpret_worker_shift_query(text: str) -> WorkerQueryResult:
    if not settings.gemini_api_key:
        raise GeminiNotConfiguredError()

    payload = {
        "systemInstruction": {
            "parts": [
                {
                    "text": _WORKER_QUERY_SYSTEM_INSTRUCTION.format(
                        today=now_art().date().isoformat(),
                        positions=", ".join(_POSITIONS),
                    )
                }
            ]
        },
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": _WORKER_QUERY_RESPONSE_SCHEMA,
            "maxOutputTokens": _MAX_OUTPUT_TOKENS,
        },
    }
    try:
        data = await _call_gemini(payload)
    except Exception as exc:
        logger.exception("interpret_worker_shift_query: falló la llamada a Gemini")
        raise GeminiRequestError() from exc

    intent = data.get("intent")
    if intent not in _WORKER_QUERY_INTENTS:
        intent = "desconocido"

    positions = [p for p in (data.get("positions") or []) if p in _POSITIONS]

    zone_name = data.get("zone_name")
    if not isinstance(zone_name, str) or not zone_name.strip():
        zone_name = None

    radius_km = data.get("radius_km")
    if not isinstance(radius_km, (int, float)) or radius_km <= 0:
        radius_km = None

    date_filter = data.get("date_filter")
    if date_filter not in _WORKER_QUERY_DATE_FILTERS:
        date_filter = "todos"

    # Sin puesto y sin zona no hay nada que buscar — degrada a "desconocido"
    # en vez de mandar al feed un filtro vacío que en la práctica es "todos
    # los turnos", que ya es lo que el feed muestra sin pasar por acá.
    if intent == "buscar_turnos" and not positions and zone_name is None:
        intent = "desconocido"

    return WorkerQueryResult(
        intent=intent,
        positions=positions,
        zone_name=zone_name,
        radius_km=radius_km,
        date_filter=date_filter,
    )

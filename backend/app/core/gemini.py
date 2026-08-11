"""Interpretación de texto libre para turnos vía Gemini (P2, auditoría de
producto 2026-08-10): "necesito 2 mozos el sábado a la noche" -> campos
estructurados que PRECARGAN el wizard de publicar turno — el comercio sigue
revisando y confirmando cada paso a mano, la IA nunca publica nada directo
(regla no negociable: la IA interpreta intención, el motor de turnos/
matching decide resultados).

Llamada HTTP directa a la API de Gemini (`generateContent` con
`responseSchema` para forzar JSON estructurado) — sin SDK, mismo criterio
que `ResendEmailSender` (un único endpoint simple no amerita una
dependencia nueva). Modelo `gemini-flash-latest` — alias que Google
mantiene apuntando al Flash vigente (plan free: de sobra para esta beta),
en vez de fijar una versión puntual que Google puede dar de baja para
cuentas nuevas sin avisar (pasó con `gemini-2.5-flash`: "no longer
available to new users", ver docs/STATUS.md 2026-08-11).
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
    "gemini-flash-latest:generateContent"
)

_POSITIONS = [skill.value for skill in WorkerSkill]

_SYSTEM_INSTRUCTION = """Extraés datos de un turno gastronómico eventual a partir de una descripción \
en español informal de Argentina. Hoy es {today} (hora de Argentina). Reglas:
- `position`: el puesto más parecido de esta lista: {positions}. Si no podés
  inferirlo, usá "desconocido".
- `start_at`/`end_at`: horario ISO-8601 CON offset -03:00 (ej: "2026-08-15T20:00:00-03:00").
  Resolvé días relativos ("mañana", "el sábado", "hoy") contra la fecha de hoy de arriba.
  Si no podés inferir un horario, dejalo en null.
- `pay_amount`: el monto en pesos argentinos que se menciona (sólo el número). Si no se
  menciona, null.
- `urgent`: true si el texto sugiere que es para cubrir ya/hoy/urgente.
- `meal`: true si menciona que incluye comida/vianda.
- `tips`: true salvo que el texto diga explícitamente que NO hay propinas.
- `dress_code`: si se menciona un código de vestimenta, transcribilo corto. Si no, null.
No inventes datos que el texto no sugiere."""

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
`applicants_date_hint` (fecha ISO YYYY-MM-DD si se puede inferir del texto, null si no)."""

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


async def interpret_assistant_query(text: str) -> AssistantQueryResult:
    if not settings.gemini_api_key:
        raise GeminiNotConfiguredError()

    payload = {
        "systemInstruction": {
            "parts": [
                {
                    "text": _ASSISTANT_SYSTEM_INSTRUCTION.format(
                        today=now_art().date().isoformat(),
                        positions=", ".join(_POSITIONS),
                    )
                }
            ]
        },
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": _ASSISTANT_RESPONSE_SCHEMA,
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
    )

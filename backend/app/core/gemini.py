"""Interpretación de texto libre para turnos vía Gemini (P2, auditoría de
producto 2026-08-10): "necesito 2 mozos el sábado a la noche" -> campos
estructurados que PRECARGAN el wizard de publicar turno — el comercio sigue
revisando y confirmando cada paso a mano, la IA nunca publica nada directo
(regla no negociable: la IA interpreta intención, el motor de turnos/
matching decide resultados).

Llamada HTTP directa a la API de Gemini (`generateContent` con
`responseSchema` para forzar JSON estructurado) — sin SDK, mismo criterio
que `ResendEmailSender` (un único endpoint simple no amerita una
dependencia nueva). Modelo `gemini-2.5-flash` (plan free de Google: 10
requests/minuto, 250/día — de sobra para esta beta).
"""

import json
import logging
from dataclasses import dataclass

import httpx

from app.core.config import settings
from app.core.tz import now_art
from app.modules.worker.domain.value_objects import WorkerSkill

logger = logging.getLogger(__name__)

_GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
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
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                _GEMINI_URL,
                params={"key": settings.gemini_api_key},
                json=payload,
            )
            response.raise_for_status()
            body = response.json()
        raw = body["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(raw)
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
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                _GEMINI_URL,
                params={"key": settings.gemini_api_key},
                json=payload,
            )
            response.raise_for_status()
            body = response.json()
        raw = body["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(raw)
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

"""Vigencia (TTL) y urgencia de cada push, según el tipo de aviso.

Con TTL 0 (el default de la librería) el servicio push descarta el aviso si
el celular no está conectado en ese instante (sin señal, subte, ahorro de
batería) y la persona nunca se entera. Estos tests fijan la política y que el
sender real la mande en la llamada a `pywebpush.webpush`.
"""

from datetime import timedelta
from typing import Any

import pytest

from app.core.config import get_settings
from app.modules.notification.domain.entities import PushSubscription
from app.modules.notification.domain.push_policy import (
    DEFAULT_POLICY_TYPES,
    DEFAULT_PUSH_POLICY,
    PushUrgency,
    push_policy_for,
    types_with_explicit_rule,
)
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.notification.infrastructure.webpush_sender import WebPushSender

_N = NotificationType


def test_todo_tipo_tiene_regla_o_cae_al_default_a_proposito():
    """Un NotificationType nuevo obliga a decidir: o se le da regla, o se lo
    anota en DEFAULT_POLICY_TYPES. Las dos listas no se pisan."""
    explicitos = types_with_explicit_rule()
    assert not (explicitos & DEFAULT_POLICY_TYPES)
    assert explicitos | DEFAULT_POLICY_TYPES == set(NotificationType)


def test_default_es_24_horas_urgencia_normal():
    assert DEFAULT_PUSH_POLICY.ttl_seconds == 24 * 3600
    assert DEFAULT_PUSH_POLICY.urgency is PushUrgency.NORMAL
    for t in DEFAULT_POLICY_TYPES:
        assert push_policy_for(t) == DEFAULT_PUSH_POLICY


@pytest.mark.parametrize("tipo", [_N.NEW_SHIFT_NEARBY, _N.URGENT_SHIFT_NEARBY])
def test_turno_cerca_vence_a_los_30_minutos_con_urgencia_alta(tipo: NotificationType):
    politica = push_policy_for(tipo)
    assert politica.ttl_seconds == int(timedelta(minutes=30).total_seconds())
    assert politica.urgency is PushUrgency.HIGH


@pytest.mark.parametrize(
    "tipo",
    [
        _N.NEW_APPLICANT,
        _N.SHIFT_ASSIGNED,
        _N.SHIFT_CONFIRMED,
        _N.SHIFT_REJECTED,
        _N.SHIFT_CANCELLED_LATE,
        _N.SHIFT_NO_SHOW,
        _N.SHIFT_CHECKED_OUT,
        _N.WORKER_EN_ROUTE,
        _N.CHAT_MESSAGE,
    ],
)
def test_aviso_sobre_un_turno_vence_a_las_12_horas_con_urgencia_alta(tipo: NotificationType):
    politica = push_policy_for(tipo)
    assert politica.ttl_seconds == 12 * 3600
    assert politica.urgency is PushUrgency.HIGH


@pytest.mark.parametrize(
    "tipo",
    [
        _N.SHIFT_PAID,
        _N.REVIEW_RECEIVED,
        _N.VERIFICATION_DECIDED,
        _N.SUPPORT_REPLY,
        _N.SUBSCRIPTION_PAID,
        _N.SUBSCRIPTION_EXPIRING,
        _N.SUBSCRIPTION_EXPIRED,
        _N.SUBSCRIPTION_REFUNDED,
    ],
)
def test_pagos_resenas_y_novedades_usan_el_default(tipo: NotificationType):
    assert push_policy_for(tipo) == DEFAULT_PUSH_POLICY


# --- El sender real manda la vigencia y la urgencia a la librería -----------


def _suscripcion() -> PushSubscription:
    return PushSubscription(
        user_id=None,  # type: ignore[arg-type]
        endpoint="https://fcm.googleapis.com/fcm/send/abc",
        p256dh_key="p",
        auth_key="a",
    )


async def _enviar(monkeypatch: pytest.MonkeyPatch, **kwargs: Any) -> dict[str, Any]:
    llamadas: list[dict[str, Any]] = []
    monkeypatch.setattr("pywebpush.webpush", lambda **kw: llamadas.append(kw))
    await WebPushSender(get_settings()).send(
        _suscripcion(), title="t", body="b", url="/x", **kwargs
    )
    assert len(llamadas) == 1
    return llamadas[0]


@pytest.mark.parametrize(
    ("tipo", "ttl", "urgencia"),
    [
        (_N.NEW_SHIFT_NEARBY, 1800, "high"),
        (_N.URGENT_SHIFT_NEARBY, 1800, "high"),
        (_N.SHIFT_ASSIGNED, 43200, "high"),
        (_N.CHAT_MESSAGE, 43200, "high"),
        (_N.SHIFT_PAID, 86400, "normal"),
        (_N.SUBSCRIPTION_EXPIRING, 86400, "normal"),
    ],
)
async def test_sender_llama_a_la_libreria_con_ttl_y_urgencia_del_tipo(
    monkeypatch: pytest.MonkeyPatch, tipo: NotificationType, ttl: int, urgencia: str
):
    llamada = await _enviar(monkeypatch, policy=push_policy_for(tipo))
    assert llamada["ttl"] == ttl
    assert llamada["headers"] == {"Urgency": urgencia}


async def test_sender_sin_politica_explicita_usa_el_default_nunca_ttl_0(
    monkeypatch: pytest.MonkeyPatch,
):
    llamada = await _enviar(monkeypatch)
    assert llamada["ttl"] == 24 * 3600
    assert llamada["headers"] == {"Urgency": "normal"}

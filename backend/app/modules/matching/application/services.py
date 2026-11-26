"""Caso de uso del motor de matching: top de candidatos para un turno."""

from dataclasses import dataclass, replace
from datetime import datetime, timezone
from uuid import UUID

from app.core.geo import fuzz_point, haversine_km
from app.modules.application.domain.entities import EnrichedApplicant
from app.modules.application.domain.repositories import ShiftApplicationRepository
from app.modules.application.domain.value_objects import ApplicationStatus
from app.modules.matching.domain.entities import (
    CandidateProfile,
    MatchResult,
    ShiftRequirement,
    WorkerMapResult,
)
from app.modules.favorite.domain.repositories import FavoriteRepository
from app.modules.matching.domain.orden_postulantes import (
    SenalesPostulante,
    es_carril_urgente,
    es_nuevo_verificado,
    ordenar_postulantes,
)
from app.modules.matching.domain.repositories import CandidateRepository
from app.modules.matching.domain.scoring import rank_candidates
from app.modules.matching.domain.value_objects import (
    DEFAULT_MAX_RADIUS_KM,
    DEFAULT_WEIGHTS,
    PROGRAMADO_WEIGHTS,
    MatchWeights,
)
from app.modules.company.domain.repositories import CompanyProfileRepository
from app.modules.shift.application.zones import measuring_zone
from app.modules.shift.domain.exceptions import ShiftNotFoundError
from app.modules.shift.domain.nearby import zone_of
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.worker.domain.value_objects import WorkerSkill


def _ahora() -> datetime:
    """El instante contra el que se decide el carril del turno (urgente o
    programado). Aparte, para que los tests lo puedan fijar."""
    return datetime.now(timezone.utc)


def _public_distance_km(
    lat: float | None,
    lng: float | None,
    seed: str,
    from_lat: float | None,
    from_lng: float | None,
) -> float | None:
    """Distancia que ve el comercio (ADR-0014 §3: "qué tan lejos, no dónde").

    Se mide desde el MISMO punto desplazado que muestra el mapa, nunca desde el
    domicilio o la posición en vivo exactos: con la distancia real, tres
    búsquedas desde puntos distintos alcanzaban para triangular la casa del
    trabajador (revisión de seguridad 2026-10-20). Así la distancia no dice
    nada que el pin no diga ya. Redondeada a 0,1 km, que es lo que muestra la
    UI."""
    fuzzed_lat, fuzzed_lng = fuzz_point(lat, lng, seed)
    distance = haversine_km(fuzzed_lat, fuzzed_lng, from_lat, from_lng)
    return None if distance is None else round(distance, 1)


@dataclass(frozen=True)
class PostulanteOrdenado:
    """Un postulante en su lugar de la lista, con lo que explica por qué está
    ahí (ADR-0031). Son datos del comercio (sus favoritos, sus turnos) o que
    ya ve en la ficha de la persona."""

    postulante: EnrichedApplicant
    es_favorito: bool
    trabajo_aca: bool
    turnos_en_el_puesto: int
    identidad_verificada: bool
    # Sello «Nuevo en Oído · identidad verificada».
    nuevo_verificado: bool


class MatchingService:
    """Servicio de aplicación para calcular el top de candidatos de un turno."""

    def __init__(
        self,
        shifts: ShiftRepository,
        candidates: CandidateRepository,
        companies: CompanyProfileRepository | None = None,
        applications: ShiftApplicationRepository | None = None,
        favorites: FavoriteRepository | None = None,
    ) -> None:
        self._shifts = shifts
        self._candidates = candidates
        # Para medir desde el local un turno que no dice dónde es.
        self._companies = companies
        # Para no recomendar a quien ya tuvo este turno y lo dejó (G4).
        self._applications = applications
        # Para el orden de los postulantes: los favoritos del comercio.
        self._favorites = favorites

    async def get_top_candidates(
        self,
        shift_id: UUID,
        company_id: UUID,
        *,
        limit: int = 10,
        weights: MatchWeights | None = None,
        max_radius_km: float = DEFAULT_MAX_RADIUS_KM,
    ) -> list[MatchResult]:
        """Calcula el top de candidatos recomendados para un turno propio.

        Sin `weights`, los del carril del turno (ADR-0031): en el programado
        la distancia sólo filtra y pesa la experiencia comprobada en el
        puesto; en el urgente, los de siempre."""
        shift = await self._shifts.get_by_id(shift_id)
        # No revelamos turnos de otros comercios: se tratan como inexistentes.
        if shift is None or shift.company_id != company_id:
            raise ShiftNotFoundError(str(shift_id))

        # El turno se mide desde el mismo lugar que en el aviso y en el feed:
        # su zona o, si no tiene ninguna, el local del comercio.
        zone = (
            await measuring_zone(shift, self._companies)
            if self._companies is not None
            else zone_of(shift)
        )
        requirement = ShiftRequirement(
            position=shift.position,
            latitude=zone.latitude,
            longitude=zone.longitude,
            city=zone.city,
        )
        candidates = await self._candidates.list_available(shift.position)
        # Quien ya tuvo este turno y lo rechazó, canceló o faltó no vuelve como
        # «Recomendado»: está al final de los postulantes, con su marca, y
        # desde ahí se le puede volver a asignar (G4).
        if self._applications is not None:
            unassigned = {
                a.worker_profile_id
                for a in await self._applications.list_by_shift(shift_id)
                if a.status == ApplicationStatus.DESASIGNADA
            }
            candidates = [c for c in candidates if c.profile_id not in unassigned]
        if weights is None:
            urgente = es_carril_urgente(
                shift.urgent, shift.start_at, _ahora()
            )
            weights = DEFAULT_WEIGHTS if urgente else PROGRAMADO_WEIGHTS
        if weights.proven_experience > 0 and candidates:
            terminados = await self._shifts.count_finished_by_workers(
                [c.profile_id for c in candidates],
                position=shift.position,
                company_id=company_id,
            )
            candidates = [
                replace(
                    c,
                    turnos_en_el_puesto=terminados[c.profile_id].en_el_puesto,
                )
                if c.profile_id in terminados
                else c
                for c in candidates
            ]
        # Fuera del radio no se sugiere a nadie (`rank_candidates` lo corta).
        # El puntaje (y su tope por radio) usa la MISMA distancia pública que
        # se muestra: con la real, el `score` la filtraba igual — tres turnos
        # con lat/lng elegidas y Δdist = Δscore·radio/peso triangulaban el
        # domicilio (revisión de seguridad 2026-10-21). Así el score no dice
        # nada que `distance_km` no diga ya.
        def public_distance(
            candidate: CandidateProfile, req: ShiftRequirement
        ) -> float | None:
            return _public_distance_km(
                candidate.latitude,
                candidate.longitude,
                str(candidate.profile_id),
                req.latitude,
                req.longitude,
            )

        ranked = rank_candidates(
            candidates,
            requirement,
            weights,
            max_radius_km,
            distance_fn=public_distance,
        )
        return ranked[:limit]

    async def ordenar_postulantes(
        self,
        shift_id: UUID,
        company_id: UUID,
        postulantes: list[EnrichedApplicant],
        verificados: set[UUID],
    ) -> list[PostulanteOrdenado]:
        """Los postulantes de un turno propio en el orden en que el comercio
        los tiene que mirar (ADR-0031): un solo lugar para la lista y para el
        «Mejor candidato». `verificados` son los usuarios con la identidad
        verificada (lo resuelve quien llama, por el puerto de Identity)."""
        shift = await self._shifts.get_by_id(shift_id)
        if shift is None or shift.company_id != company_id:
            raise ShiftNotFoundError(str(shift_id))
        if not postulantes:
            return []
        favoritos = (
            await self._favorites.list_worker_ids_by_company(company_id)
            if self._favorites is not None
            else set()
        )
        terminados = await self._shifts.count_finished_by_workers(
            [p.worker_profile_id for p in postulantes],
            position=shift.position,
            company_id=company_id,
        )

        senales: dict[UUID, SenalesPostulante] = {}
        for p in postulantes:
            hechos = terminados.get(p.worker_profile_id)
            senales[p.application_id] = SenalesPostulante(
                desasignada=p.status == ApplicationStatus.DESASIGNADA,
                es_favorito=p.worker_profile_id in favoritos,
                trabajo_aca=hechos is not None and hechos.en_el_comercio > 0,
                ausencias=p.no_shows,
                turnos_en_el_puesto=hechos.en_el_puesto if hechos else 0,
                turnos_hechos=p.events_completed,
                cancelaciones=p.cancellations,
                puntualidad=p.punctuality_rate,
                calificacion=p.rating,
                identidad_verificada=p.user_id in verificados,
                postulado_en=p.created_at,
            )

        urgente = es_carril_urgente(
            shift.urgent, shift.start_at, _ahora()
        )
        ordenados = ordenar_postulantes(
            postulantes, lambda p: senales[p.application_id], urgente=urgente
        )
        return [
            PostulanteOrdenado(
                postulante=p,
                es_favorito=senales[p.application_id].es_favorito,
                trabajo_aca=senales[p.application_id].trabajo_aca,
                turnos_en_el_puesto=senales[p.application_id].turnos_en_el_puesto,
                identidad_verificada=senales[p.application_id].identidad_verificada,
                nuevo_verificado=es_nuevo_verificado(senales[p.application_id]),
            )
            for p in ordenados
        ]

    async def search_workers(
        self,
        *,
        skill: WorkerSkill | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        radius_km: float | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[WorkerMapResult]:
        """Busca trabajadores disponibles para mostrar en el mapa, por rol y distancia."""
        # `list_available` ya filtra is_available+skill en SQL (P3/P4 de
        # PERFORMANCE_REPORT.md); el orden final por distancia es Haversine en
        # Python (no hay PostGIS todavía), así que el límite/offset (R2.1) se
        # aplica DESPUÉS de ordenar, no como LIMIT/OFFSET de SQL: paginar antes
        # de ordenar por distancia devolvería una página con los trabajadores
        # equivocados. Ver decisión documentada en docs/reference/API.md#paginación.
        candidates = await self._candidates.list_available(skill)
        results = []
        for candidate in candidates:
            # TECH_DEBT.md S4 / ADR-0014 §3: ni el pin ni la distancia que ve el
            # comercio (y el admin, mismo endpoint) salen del domicilio exacto.
            # El filtro por radio y el orden usan la misma distancia pública:
            # si filtraran con la real, achicar el radio de a poco la
            # revelaría igual.
            distance_km = _public_distance_km(
                candidate.latitude,
                candidate.longitude,
                str(candidate.profile_id),
                latitude,
                longitude,
            )
            if radius_km is not None and (distance_km is None or distance_km > radius_km):
                continue
            fuzzed_lat, fuzzed_lng = fuzz_point(
                candidate.latitude, candidate.longitude, str(candidate.profile_id)
            )
            results.append(
                WorkerMapResult(
                    profile_id=candidate.profile_id,
                    user_id=candidate.user_id,
                    full_name=candidate.full_name,
                    photo_url=candidate.photo_url,
                    rating=candidate.rating,
                    skills=candidate.skills,
                    latitude=fuzzed_lat,
                    longitude=fuzzed_lng,
                    distance_km=distance_km,
                    is_live=candidate.is_live_position,
                    position_updated_at=candidate.position_updated_at,
                )
            )
        ordered = sorted(
            results, key=lambda r: (r.distance_km is None, r.distance_km or 0.0)
        )
        return ordered[offset : offset + limit]

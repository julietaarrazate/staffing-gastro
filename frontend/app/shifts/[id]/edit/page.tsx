"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { getErrorMessage } from "@/lib/errors";
import { argentinaISOToLocalInput, localInputToArgentinaISO } from "@/lib/datetime";
import { pesosDesdeApi } from "@/lib/pesos";
import { plural } from "@/lib/format";
import { SKILL_LABELS, type Shift } from "@/lib/types";
import { Button, CardSkeletons, ErrorBanner, useToast } from "@/components/ui";
import PesosInput from "@/components/ui/PesosInput";
import { SubpaginaSuave } from "@/components/profile/ProfileParts";

const VOLVER_AL_PANEL = { href: "/shifts", label: "Volver al panel" };
const CAMPO = "campo min-h-[48px] rounded-[var(--radius-input)] px-4 text-body text-ink";

/**
 * Corregir un turno propio mientras nadie esté asignado (decisión de Julieta,
 * 2026-11-26): el horario, el pago y la vestimenta. El puesto y el lugar no
 * se tocan acá: cambiarlos es otro turno. Si ya hay postulantes y cambia el
 * horario o baja el pago, el backend les avisa; la pantalla lo anticipa.
 */
export default function EditarTurnoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useRequireAuth({ roles: ["employer"] });
  const toast = useToast();
  const [shift, setShift] = useState<Shift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [pago, setPago] = useState("");
  const [vestimenta, setVestimenta] = useState("");
  const [guardando, setGuardando] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await api.get<Shift>(`/shifts/${id}`, token);
      setShift(data);
      setInicio(argentinaISOToLocalInput(data.start_at));
      setFin(argentinaISOToLocalInput(data.end_at));
      setPago(pesosDesdeApi(data.pay_amount));
      setVestimenta(data.dress_code ?? "");
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos cargar el turno"));
    }
  }, [id, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const original = useMemo(
    () =>
      shift
        ? {
            inicio: argentinaISOToLocalInput(shift.start_at),
            fin: argentinaISOToLocalInput(shift.end_at),
            pago: pesosDesdeApi(shift.pay_amount),
            vestimenta: shift.dress_code ?? "",
          }
        : null,
    [shift],
  );
  const errorHorario = inicio && fin && fin <= inicio ? "El fin tiene que ser después del inicio." : null;
  const errorPago = pago === "" || Number(pago) <= 0 ? "Poné cuánto pagás por la jornada." : null;
  const cambio =
    original !== null &&
    (inicio !== original.inicio || fin !== original.fin || pago !== original.pago || vestimenta !== original.vestimenta);
  // Lo mismo que decide el backend (`Shift.cambio_importante`): el horario, o
  // el pago hacia abajo.
  const cambioImportante =
    original !== null &&
    (inicio !== original.inicio || fin !== original.fin || Number(pago) < Number(original.pago));
  const postulados = shift?.pending_applicants_count ?? 0;

  async function guardar() {
    if (!token || !shift || errorHorario || errorPago) return;
    setGuardando(true);
    try {
      await api.put(
        `/shifts/${shift.id}`,
        {
          position: shift.position,
          quantity: shift.quantity,
          start_at: localInputToArgentinaISO(inicio),
          end_at: localInputToArgentinaISO(fin),
          pay_amount: pago,
          currency: shift.currency,
          tips: shift.tips,
          meal: shift.meal ?? false,
          urgent: shift.urgent,
          dress_code: vestimenta.trim() || null,
          address: shift.address,
          city: shift.city,
          latitude: shift.latitude,
          longitude: shift.longitude,
          title: shift.title,
          description: shift.description,
        },
        token,
      );
      toast("Turno actualizado", "success");
      router.push("/shifts");
    } catch (err) {
      toast(getErrorMessage(err, "No se pudo guardar el turno"), "error");
      // El turno pudo cambiar mientras se editaba (alguien fue asignado).
      void load();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <SubpaginaSuave
      title="Editar turno"
      bajada={shift ? `${SKILL_LABELS[shift.position] ?? shift.position} · corregí el horario, el pago o la vestimenta.` : undefined}
      formulario
      volver={VOLVER_AL_PANEL}
    >
      {error && <ErrorBanner message={error} onRetry={load} />}
      {!error && !shift && <CardSkeletons />}
      {shift && !shift.is_editable && (
        <div data-no-editable className="rounded-[18px] bg-surface p-4">
          <p className="text-fila font-bold text-ink">Este turno ya no se puede editar</p>
          <p className="mt-1 text-sm text-ink-soft">
            Ya hay una persona asignada, que organizó su día con estos datos. Si necesitás cambiar algo, escribile por
            el chat del turno.
          </p>
        </div>
      )}
      {shift && shift.is_editable && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">Inicio</span>
            <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className={CAMPO} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">Fin</span>
            <input
              type="datetime-local"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              aria-invalid={errorHorario ? true : undefined}
              aria-describedby={errorHorario ? "error-horario" : undefined}
              className={CAMPO}
            />
            {errorHorario && (
              <p id="error-horario" role="alert" className="text-sm font-semibold text-danger-text">
                {errorHorario}
              </p>
            )}
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">Pago por la jornada</span>
            <div className="foco-contenedor campo flex items-center gap-2 rounded-[var(--radius-input)] px-4">
              <span className="text-lg font-bold text-ink-soft">$</span>
              <PesosInput
                aria-label="Pago por la jornada, en pesos"
                value={pago}
                onChange={setPago}
                focoContenedor
                className="min-h-[48px] w-full bg-transparent text-lg font-bold text-ink outline-none"
              />
            </div>
            {errorPago && (
              <p role="alert" className="text-sm font-semibold text-danger-text">
                {errorPago}
              </p>
            )}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">Vestimenta</span>
            <input
              type="text"
              value={vestimenta}
              maxLength={200}
              onChange={(e) => setVestimenta(e.target.value)}
              placeholder="Camisa negra, zapatos cerrados…"
              className={CAMPO}
            />
          </label>

          {postulados > 0 && cambioImportante && (
            <p data-aviso-postulantes className="rounded-[14px] bg-surface p-3 text-sm text-ink">
              {postulados === 1
                ? "Ya se postuló 1 persona. Le vamos a avisar del cambio para que vea si le sigue sirviendo."
                : `Ya se postularon ${plural(postulados, "persona", "personas")}. Les vamos a avisar del cambio para que vean si les sigue sirviendo.`}
            </p>
          )}
          <p className="text-caption text-ink-soft">
            El puesto y el lugar no se cambian acá: para eso, cancelá este turno y publicá uno nuevo.
          </p>
          <Button type="submit" size="lg" fullWidth loading={guardando} disabled={!cambio || Boolean(errorHorario || errorPago)}>
            Guardar cambios
          </Button>
        </form>
      )}
    </SubpaginaSuave>
  );
}

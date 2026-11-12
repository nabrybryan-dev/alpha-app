import { useEffect, useId, useState } from 'react'
import { cambiarReglaVentana, leerReglaVentana, type EstadoRegla } from '../../../data/consola/reglaVentana'
import { FalloBandeja, Tarjeta } from './piezas'

/**
 * El interruptor de la regla de ventana del primer plan (0170), para quien tiene la capacidad
 * `encender_regla_ventana`. Quien monta este componente decide si se ve; aquí no se comprueba
 * el permiso porque la base lo vuelve a exigir en cada cambio.
 *
 * El texto dice lo que la regla HACE en la base (`activar_por_regla_ventana`): riesgo bajo y
 * medio, con condiciones; riesgo alto nunca. Encender pide una confirmación explícita; apagar
 * no, porque apagar solo devuelve los planes a la firma de una persona.
 */

const CONDICIONES = [
  'Riesgo bajo o medio. El riesgo alto nunca pasa solo: espera a Bryan.',
  'Clasificado por el sistema y sin dudas pendientes ni «requiere revisión».',
  'El plan no cambió después de clasificarlo.',
] as const

type Vista = { tipo: 'cargando' } | { tipo: 'error'; error: string } | { tipo: 'listo'; estado: EstadoRegla }

function fecha(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' })
}

function UltimoCambio({ estado }: { estado: EstadoRegla }) {
  const c = estado.ultimoCambio
  if (!c) return <p className="text-[12px] text-tenue">Nunca se ha cambiado desde la consola.</p>
  const quien = c.porNombre ?? (c.por ? 'alguien del equipo' : 'sin sesión (SQL Editor o servicio)')
  return (
    <p className="text-[12px] text-tenue">
      {c.encendida ? 'La encendió' : 'La apagó'} {quien} el {fecha(c.en)}.
      {c.nota && <span className="block text-texto/90">Nota: {c.nota}</span>}
    </p>
  )
}

export function InterruptorReglaVentana() {
  const [vista, setVista] = useState<Vista>({ tipo: 'cargando' })
  const [intento, setIntento] = useState(0)
  const [confirmando, setConfirmando] = useState(false)
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorCambio, setErrorCambio] = useState<string | null>(null)
  const idNota = useId()

  useEffect(() => {
    let vivo = true
    leerReglaVentana().then((r) => {
      if (vivo) setVista(r.ok ? { tipo: 'listo', estado: r.estado } : { tipo: 'error', error: r.error })
    })
    return () => {
      vivo = false
    }
  }, [intento])

  const cambiar = async (encender: boolean) => {
    setGuardando(true)
    setErrorCambio(null)
    const r = await cambiarReglaVentana(encender, nota)
    setGuardando(false)
    if (!r.ok) {
      setErrorCambio(r.error)
      return
    }
    setConfirmando(false)
    setNota('')
    setIntento((n) => n + 1)
  }

  const encendida = vista.tipo === 'listo' && vista.estado.encendida

  return (
    <Tarjeta
      titulo="Aprobar solos los primeros planes (salvo riesgo alto)"
      extra={
        vista.tipo === 'listo' && (
          <span className={`text-xs font-bold ${encendida ? 'text-verde' : 'text-tenue'}`} role="status">
            {encendida ? 'Encendida' : 'Apagada'}
          </span>
        )
      }
    >
      <p className="mb-1.5 text-[12.5px] text-tenue">
        Encendida, un primer plan cuyo plazo vence sin firma se publica solo si cumple todo esto:
      </p>
      <ul className="mb-2.5 list-disc pl-5 text-[12.5px] text-texto/90">
        {CONDICIONES.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p className="mb-2.5 text-[12.5px] text-tenue">Apagada, todo plan vencido espera a Bryan.</p>

      {vista.tipo === 'cargando' && <p className="text-[12px] text-tenue">Leyendo el estado…</p>}
      {vista.tipo === 'error' && <FalloBandeja error={vista.error} onReintentar={() => setIntento((n) => n + 1)} />}
      {vista.tipo === 'listo' && (
        <>
          <UltimoCambio estado={vista.estado} />
          {!confirmando ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {encendida ? (
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => cambiar(false)}
                  className="tecla-3d rounded-lg border border-rojo/50 bg-rojo/10 px-3 py-1.5 text-xs font-bold text-rojo disabled:opacity-50"
                >
                  {guardando ? 'Apagando…' : 'Apagar'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmando(true)}
                  className="tecla-3d rounded-lg border border-linea bg-surface-2 px-3 py-1.5 text-xs font-bold text-texto"
                >
                  Encender…
                </button>
              )}
            </div>
          ) : (
            <div className="consola-confirmacion mt-2 rounded-lg border border-dashed border-linea bg-surface-1 p-2.5">
              <p className="text-[12.5px] text-texto">
                Desde ahora, los primeros planes de riesgo bajo o medio que cumplan las condiciones se publicarán a
                la persona sin que nadie los firme. Cada uno queda anotado con su motivo. ¿Seguro?
              </p>
              <label className="mt-2 block text-[11px] font-bold uppercase tracking-wide text-tenue" htmlFor={idNota}>
                Nota (opcional)
              </label>
              <input
                id={idNota}
                value={nota}
                maxLength={500}
                onChange={(e) => setNota(e.target.value)}
                className="mt-1 w-full rounded-lg border border-linea bg-surface-1 p-2 text-sm text-texto"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => cambiar(true)}
                  className="tecla-3d rounded-lg bg-verde px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {guardando ? 'Encendiendo…' : 'Sí, encender'}
                </button>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => setConfirmando(false)}
                  className="rounded-lg border border-linea px-3 py-1.5 text-xs font-bold text-tenue"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {errorCambio && <p className="mt-1 text-xs text-rojo">{errorCambio}</p>}
        </>
      )}
    </Tarjeta>
  )
}

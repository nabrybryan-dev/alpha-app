import { useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { db, hoyIso } from '../../data/dbInstance'
import type { Microciclo } from '../../domain/types'
import { microcicloPropuesto, proponerMicrociclo } from './propuestaMicrociclo'
import { datosRutaDe } from '../../data/ruta/datosRuta'
import { peldanoAlcanzado, peldanoTrasMicrociclo } from '../../domain/nivelesAlfa'

interface GenerarMicrocicloSheetProps {
  abierto: boolean
  nombreAsesorado: string
  /** Microciclo del que se parte. Sin él no hay nada de donde ondular. */
  microciclo?: Microciclo
  onCerrar: () => void
}

const FLECHA = { subir: '▲', bajar: '▼', estable: '=', 'sin-datos': '·' } as const

export function GenerarMicrocicloSheet({
  abierto,
  nombreAsesorado,
  microciclo,
  onCerrar,
}: GenerarMicrocicloSheetProps) {
  const propuesta = microciclo ? proponerMicrociclo(microciclo) : undefined
  const [guardada, setGuardada] = useState(false)

  const guardar = () => {
    if (!microciclo) return
    // `hoy` evita que la propuesta nazca con la fecha del microciclo de origen, es
    // decir vencida. Ver el encabezado de `microcicloPropuesto`.
    db.microciclos.guardarPropuesta(microcicloPropuesto(microciclo, { hoy: hoyIso() }))
    recalcularNivel(microciclo)
    setGuardada(true)
  }

  /**
   * El nivel se recalcula AQUÍ, al cerrar un microciclo, y no en el teléfono del
   * asesorado. Dos razones, y las dos importan:
   *
   * 1. **Permisos.** El trigger `proteger_perfil` (migración 0008) impide que el
   *    asesorado escriba en su propio perfil nada que no sean sus medidas. Esa
   *    migración existe porque una política mal escrita dejó que alguien se
   *    auto-promoviera a coach; no se ensancha por comodidad.
   * 2. **Que no oscile.** El cálculo mira la consistencia del microciclo, que al
   *    empezar la semana es 0%. Calculado al vuelo en cada render, todo el mundo
   *    caería al nivel 01 cada lunes y volvería a subir al registrar sesiones. Un
   *    nivel que sube y baja cada semana no mide dominio, mide qué día es hoy.
   *
   * Aquí el microciclo ya está cerrado: sus datos están completos.
   */
  const recalcularNivel = (cerrado: typeof microciclo) => {
    if (!cerrado) return
    const perfil = db.perfiles.byUsuario(cerrado.usuarioId)
    const actual = perfil?.peldanoAlfa ?? peldanoAlcanzado(datosRutaDe(cerrado.usuarioId, cerrado))
    const siguiente = peldanoTrasMicrociclo(actual, datosRutaDe(cerrado.usuarioId, cerrado))
    if (siguiente === perfil?.peldanoAlfa) return
    db.perfiles.guardarPeldano(cerrado.usuarioId, siguiente, hoyIso())
  }

  return (
    <Sheet abierto={abierto} titulo="Propuesta del siguiente microciclo" onCerrar={onCerrar}>
      {!propuesta || propuesta.filas.length === 0 ? (
        <p className="text-sm text-tenue">
          {nombreAsesorado} todavía no tiene un microciclo con ejercicios de fuerza del que partir.
        </p>
      ) : (
        <div className="flex flex-col gap-3 text-sm text-texto/90">
          <p>
            Propuesta de <strong>M{propuesta.numero}</strong> para {nombreAsesorado}, calculada con
            el motor Heracles sobre lo que registró de verdad.{' '}
            {propuesta.reparto.suben} suben · {propuesta.reparto.sostienen} sostienen ·{' '}
            {propuesta.reparto.bajan} bajan.
            {propuesta.prs !== undefined && (
              <>
                {' '}
                Último PRS: <strong>{propuesta.prs}</strong>.
              </>
            )}
          </p>

          {propuesta.revision.auto ? (
            <p className="rounded-xl border border-logrado/40 bg-logrado/10 p-3 text-xs text-logrado">
              <strong>Dato fiable.</strong> Cumple las cinco señales, así que podría activarse sola
              cuando llegue su fecha.
            </p>
          ) : (
            <div className="rounded-xl border border-ambar/40 bg-ambar/10 p-3 text-xs text-ambar">
              <p>
                <strong>Esta hay que mirarla.</strong> No se activaría sola porque:
              </p>
              <ul className="mt-1 list-disc pl-4">
                {propuesta.revision.motivos.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {propuesta.filas.map((f, i) => (
              <li
                key={`${f.sesionId}-${f.ejercicio}-${i}`}
                className="rounded-tarjeta border border-linea bg-surface-2 p-3"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
                  {f.sesionNombre} · {f.categoria}
                </p>
                <p className="mt-0.5 text-sm font-bold text-texto">
                  <span aria-hidden="true" className="mr-1.5 text-rojo">
                    {FLECHA[f.direccion]}
                  </span>
                  {f.ejercicio}
                </p>
                <p className="cifras mt-1.5 text-[12.5px] font-semibold leading-relaxed text-texto">
                  {f.prescripcion || 'Sin datos suficientes para proponer carga.'}
                </p>
                <p className="mt-1 text-xs leading-snug text-tenue">{f.motivo}</p>
              </li>
            ))}
          </ul>

          {propuesta.sinDatos > 0 && (
            <p className="rounded-xl border border-linea bg-surface-2 p-3 text-xs text-tenue">
              {propuesta.sinDatos} ejercicio(s) sin series registradas ni carga pautada: el motor no
              tiene de dónde partir y los deja como están.
            </p>
          )}

          <p className="rounded-xl border border-ambar/40 bg-ambar/10 p-3 text-xs text-ambar">
            No aplica descarga automática: su disparador (semana 4 de cada mesociclo) no coincide
            con lo que muestran tus plantillas.
          </p>

          {guardada ? (
            <p className="rounded-xl border border-logrado/40 bg-logrado/10 p-3 text-xs text-logrado">
              Guardada como <strong>propuesta</strong>. {nombreAsesorado} todavía no la ve: sus
              pantallas solo muestran el microciclo activo. Queda ahí hasta que decidas activarla.
            </p>
          ) : (
            <button
              type="button"
              onClick={guardar}
              className="press w-full rounded-boton bg-accion py-3.5 font-display text-sm uppercase tracking-wide text-white"
            >
              Guardar como propuesta
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}

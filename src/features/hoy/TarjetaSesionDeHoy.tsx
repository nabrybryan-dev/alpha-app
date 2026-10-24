import { Link } from 'react-router-dom'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { ejercicioCompleto } from '../../domain/cumplimiento'
import { duracionTotalSeg, formatoDuracion } from '../../domain/ritmoSesion'
import type { Sesion } from '../../domain/types'
import { CheckDibujado } from '../entrenar/CheckDibujado'
import monogramaA from '../../assets/brand/monograma-a.png'

interface TarjetaSesionDeHoyProps {
  sesion: Sesion
  /** «Sesión de hoy · M11», «Pendiente del lunes · M11» o «Tu siguiente sesión · M11». */
  etiqueta: string
  totalSeries: number
  hecha: boolean
  /** Lo que el coach marcó como foco del bloque (`prioridadDeVolumen`). */
  prioridad: ReadonlyArray<{ grupo: string; nivel: string }>
}

/**
 * La sesión de hoy en UNA tarjeta con su estado (04 §3.2, banda 1): sin empezar, en curso
 * («Continuar sesión», con cuántos ejercicios van) o registrada. El texto de la etiqueta lo
 * decide quien la llama: no está atado al día de la semana (cadencia del microciclo).
 */
export function TarjetaSesionDeHoy({ sesion, etiqueta, totalSeries, hecha, prioridad }: TarjetaSesionDeHoyProps) {
  const total = sesion.ejercicios.length
  const hechos = sesion.ejercicios.filter(ejercicioCompleto).length
  const enCurso = !hecha && sesion.ejercicios.some((e) => e.series.length > 0)
  const pct = total > 0 ? (hechos / total) * 100 : 0

  return (
    <div className="entrada entrada-3 relative overflow-hidden rounded-bloque border border-ink-500 bg-ink-900 p-5 shadow-md">
      <span className="absolute bottom-3.5 left-0 top-3.5 w-[3px] rounded-r bg-accion" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accion">{etiqueta}</p>
          <h3 className="mt-2 font-display text-2xl leading-tight text-silver-100">{sesion.nombre}</h3>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-silver-400">
            <span className="cifras">
              {total} ejercicios · {totalSeries} series
            </span>
            <span className="cifras">≈ {formatoDuracion(duracionTotalSeg(sesion))}</span>
          </div>
        </div>
        <img
          src={monogramaA}
          alt=""
          aria-hidden="true"
          className="h-12 w-12 shrink-0 rounded-xl bg-ink-900 object-contain p-1.5 opacity-90"
        />
      </div>
      {prioridad.length > 0 && (
        <ul aria-label="Prioridad del bloque" className="mt-3 flex flex-wrap gap-1.5">
          {prioridad.map((g) => (
            <li
              key={g.grupo}
              className="rounded-full border border-ink-500 bg-ink-700 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.1em] text-silver-300"
            >
              {g.grupo} <span className="text-silver-500">{g.nivel}</span>
            </li>
          ))}
        </ul>
      )}
      {enCurso && (
        <div className="mt-3.5 flex flex-col gap-1.5">
          <p className="cifras text-xs text-silver-300">
            {hechos} de {total} ejercicios hechos
          </p>
          <ProgressBar pct={pct} etiqueta="Avance de la sesión" />
        </div>
      )}
      {hecha ? (
        <div className="mt-4 flex items-center gap-2.5 rounded-boton border border-ink-500 bg-ink-700 px-3.5 py-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-logrado text-ink-900">
            <CheckDibujado className="h-4 w-4" />
          </span>
          <span className="flex-1 text-sm font-bold text-silver-100">Sesión registrada</span>
        </div>
      ) : (
        <Link
          to={`/entrenar/sesion/${sesion.id}`}
          className="press cta-pulso mt-4 flex items-center justify-center gap-2 rounded-boton bg-accion py-3 font-display text-sm uppercase tracking-wide text-white"
          style={{ boxShadow: 'var(--glow-accion)' }}
        >
          {enCurso ? 'Continuar sesión →' : 'Empezar sesión →'}
        </Link>
      )}
    </div>
  )
}

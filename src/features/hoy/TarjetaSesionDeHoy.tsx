import { Boton3D } from '../../components/ui/Boton3D'
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
    <div className="entrada entrada-3 hoy-hero">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="hoy-hero-kicker">{etiqueta}</p>
          <h3 className="hoy-hero-titulo">{sesion.nombre}</h3>
          <p className="hoy-hero-meta cifras">
            {total} ejercicios · {totalSeries} series · ≈ {formatoDuracion(duracionTotalSeg(sesion))}
          </p>
        </div>
        <img
          src={monogramaA}
          alt=""
          aria-hidden="true"
          className="h-12 w-12 shrink-0 rounded-xl object-contain p-1.5 opacity-90"
        />
      </div>
      {prioridad.length > 0 && (
        <ul aria-label="Prioridad del bloque" className="mb-3.5 flex flex-wrap gap-1.5">
          {prioridad.map((g) => (
            <li key={g.grupo} className="hoy-hero-chip uppercase tracking-[0.1em]">
              {g.grupo} <span className="opacity-70">{g.nivel}</span>
            </li>
          ))}
        </ul>
      )}
      {enCurso && (
        <div className="hoy-hero-avance">
          <span className="hoy-hero-chip">En curso</span>
          <span className="cifras">
            {hechos} de {total} ejercicios hechos
          </span>
          <span
            className="hoy-hero-pista"
            role="progressbar"
            aria-label="Avance de la sesión"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.max(0, Math.min(100, Math.round(pct)))}
          >
            <i style={{ transform: `scaleX(${Math.max(0, Math.min(100, pct)) / 100})` }} />
          </span>
        </div>
      )}
      {hecha ? (
        <div className="hoy-hero-avance !mb-0">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-logrado text-ink-900">
            <CheckDibujado className="h-4 w-4" />
          </span>
          <span className="flex-1 text-sm font-bold" style={{ color: 'var(--hero-texto)' }}>
            Sesión registrada
          </span>
        </div>
      ) : (
        <Boton3D to={`/entrenar/sesion/${sesion.id}`} bloque className="cta-pulso">
          {enCurso ? 'Continuar sesión' : 'Empezar sesión'}
        </Boton3D>
      )}
    </div>
  )
}

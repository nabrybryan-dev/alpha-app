import { Link } from 'react-router-dom'
import type { DiaRuta } from '../../domain/rutaEntrenamiento'
import type { Microciclo } from '../../domain/types'

/** Mismo tipo que `CalculosDeLaRuta['sesionCta']` — no es `SesionDestacada`: el pegamento de
 * `calculosDeLaRuta.ts` ya le cambió los nombres (`sesionId`→`id`, `titulo`→`nombre`) y le
 * sumó `empezada`. Repetido aquí en vez de importado para no acoplar esta pantalla a esa capa
 * de pegamento por un solo tipo. */
interface SesionCta {
  id: string
  nombre: string
  esDeHoy: boolean
  empezada: boolean
}

/**
 * La versión sin salón: una lista plana de la semana y un botón grande para
 * entrar a la sesión de hoy.
 *
 * Mismos datos que `SalonEntrenar` (`calculosDeLaRuta`, `armarSemana`,
 * `sesionDestacada`) — no se vuelve a calcular nada aquí, solo se pinta
 * distinto. Así una corrección en qué día le toca a quién corrige las dos
 * pantallas a la vez, nunca una sola.
 *
 * Pedida por Bryan el 8-oct-2026 para Karin Better: el cuarto 3D con mando le
 * costaba, y lo que necesitaba de verdad era «qué me toca hoy» sin pasos de
 * más en el medio.
 */

const ETIQUETA_ESTADO: Record<DiaRuta['estado'], string> = {
  completada: 'Hecho',
  hoy: 'Hoy',
  programada: 'Por hacer',
  descanso: 'Descanso',
}

export function RutaSimple({
  microciclo,
  semana,
  sesionCta,
}: {
  microciclo: Microciclo
  semana: readonly DiaRuta[]
  sesionCta?: SesionCta
}) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex flex-col gap-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
          Tu semana
        </p>
        <h1 className="font-display text-xl text-texto">Semana {microciclo.numero}</h1>
      </header>

      {sesionCta && (
        <Link
          to={`/entrenar/sesion/${sesionCta.id}`}
          className="press flex items-center justify-between gap-3 rounded-2xl border border-accion/50 bg-accion/15 p-4"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-accion">
              {sesionCta.esDeHoy ? (sesionCta.empezada ? 'Vas a mitad' : 'Para hoy') : 'Lo que sigue'}
            </span>
            <span className="font-display text-base text-texto">{sesionCta.nombre}</span>
          </span>
          <span aria-hidden="true" className="font-display text-2xl text-accion">
            →
          </span>
        </Link>
      )}

      <div className="flex flex-col gap-2">
        {semana.map((dia) => (
          <DiaDeLaSemana key={dia.fechaIso} dia={dia} />
        ))}
      </div>
    </div>
  )
}

function DiaDeLaSemana({ dia }: { dia: DiaRuta }) {
  const contenido = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="cifras text-[11px] text-tenue">
          {NOMBRE_DIA[dia.dia]} {dia.numero}
        </span>
        <span className="truncate text-sm font-semibold text-texto">{dia.titulo}</span>
      </span>
      <EtiquetaEstado estado={dia.estado} esHoy={dia.esHoy} />
    </>
  )

  const clase =
    'flex items-center gap-3 rounded-2xl border p-3 ' +
    (dia.esHoy
      ? 'border-accion/40 bg-accion/10'
      : 'border-linea bg-surface-1')

  if (dia.sesionId) {
    return (
      <Link to={`/entrenar/sesion/${dia.sesionId}`} className={`press ${clase}`}>
        {contenido}
      </Link>
    )
  }

  return <div className={`${clase} opacity-70`}>{contenido}</div>
}

function EtiquetaEstado({ estado, esHoy }: { estado: DiaRuta['estado']; esHoy: boolean }) {
  return (
    <span
      className={
        'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ' +
        (esHoy
          ? 'bg-accion text-texto'
          : estado === 'completada'
            ? 'bg-placa/20 text-placa'
            : estado === 'descanso'
              ? 'bg-surface-2 text-tenue'
              : 'border border-linea text-tenue')
      }
    >
      {ETIQUETA_ESTADO[estado]}
    </span>
  )
}

/** Nombre corto en español de cada día, para no depender de que `dia` venga en mayúsculas. */
const NOMBRE_DIA: Record<DiaRuta['dia'], string> = {
  DOMINGO: 'Domingo',
  LUNES: 'Lunes',
  MARTES: 'Martes',
  MIÉRCOLES: 'Miércoles',
  JUEVES: 'Jueves',
  VIERNES: 'Viernes',
  SÁBADO: 'Sábado',
}

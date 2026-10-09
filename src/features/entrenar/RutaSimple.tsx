import { Link } from 'react-router-dom'
import type { DiaRuta } from '../../domain/rutaEntrenamiento'
import type { ItemMarcable, Microciclo } from '../../domain/types'
import { avisoDeSemana } from './avisoDeSemana'
import { NotasDeLaSemana } from './NotasDeLaSemana'

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
 *
 * Simplificar no es callar lo que el salón sí dice. Bajo el título, por este
 * orden, van:
 * - el aviso de semana vencida o adelantada (`avisoDeSemana`, el mismo texto del
 *   pie del salón): sin él, con el plan vencido la semana vieja se ve como una
 *   nueva, y a un asesorado le pasó trece días seguidos;
 * - las notas que el coach dejó para la semana (`NotasDeLaSemana`, el mismo
 *   componente del panel del salón), solo si las hay.
 * Y de cada día, además del título, su detalle (ejercicios, series, duración);
 * al final, las sesiones del microciclo que la rejilla de siete días no pudo
 * colocar, para que ninguna quede sin enlace.
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
  notas,
  hoy,
  sesionesFueraDeSemana = [],
}: {
  microciclo: Microciclo
  semana: readonly DiaRuta[]
  sesionCta?: SesionCta
  /** Las notas del coach para la semana (`notasDelMicrociclo`). Sin ninguna, no se pinta nada. */
  notas: ItemMarcable[]
  /** El día de hoy, `AAAA-MM-DD`: con él se sabe si el microciclo está vencido o sin empezar. */
  hoy: string
  /** Las sesiones que `armarSemana` no consiguió colocar en la rejilla (`sesionesFueraDeLaSemana`). */
  sesionesFueraDeSemana?: readonly { id: string; nombre: string }[]
}) {
  const aviso = avisoDeSemana(microciclo, hoy)

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-tenue">
          Tu semana
        </p>
        <h1 className="font-display text-xl text-texto">Semana {microciclo.numero}</h1>
      </header>

      {aviso && (
        <p className="rounded-2xl border border-accion/40 bg-accion/10 p-3 text-xs font-semibold leading-snug text-texto">
          {aviso.texto}
        </p>
      )}

      {/* Devuelve null sin notas: en la lista sencilla no hace falta decir que no hay. */}
      <NotasDeLaSemana notas={notas} />

      {sesionCta && (
        <Link
          to={`/entrenar/sesion/${sesionCta.id}`}
          className="press flex items-center justify-between gap-3 rounded-2xl border border-accion/50 bg-accion/15 p-4"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-accion">
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

      {sesionesFueraDeSemana.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-tenue">
            También de esta semana
          </h2>
          {sesionesFueraDeSemana.map((sesion) => (
            <Link
              key={sesion.id}
              to={`/entrenar/sesion/${sesion.id}`}
              className="press flex min-h-[44px] items-center rounded-2xl border border-linea bg-surface-1 p-3 text-sm font-semibold text-texto"
            >
              {sesion.nombre}
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}

function DiaDeLaSemana({ dia }: { dia: DiaRuta }) {
  const contenido = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="cifras text-xs text-tenue">
          {NOMBRE_DIA[dia.dia]} {dia.numero}
        </span>
        {/* Dos líneas y no una: «UPPER A · empuje y tracción…» cortado en «UPPER A · em…» no
            dice qué sesión es. */}
        <span
          className={`line-clamp-2 text-sm font-semibold ${dia.sesionId ? 'text-texto' : 'text-tenue'}`}
        >
          {dia.titulo}
        </span>
        <span className="text-xs leading-snug text-tenue">{dia.detalle}</span>
      </span>
      <EtiquetaEstado estado={dia.estado} esHoy={dia.esHoy} />
    </>
  )

  const clase = 'flex items-center gap-3 rounded-2xl border p-3 '
  const claseHoy = 'border-accion/40 bg-accion/10'

  if (dia.sesionId) {
    return (
      <Link
        to={`/entrenar/sesion/${dia.sesionId}`}
        className={`press ${clase}${dia.esHoy ? claseHoy : 'border-linea bg-surface-1'}`}
      >
        {contenido}
      </Link>
    )
  }

  // Sin sesión no es un enlace, y se distingue por otro fondo y por el color del título —no
  // por `opacity-70`, que apaga también el texto y lo deja por debajo del contraste mínimo.
  return (
    <div className={`${clase}${dia.esHoy ? claseHoy : 'border-linea bg-surface-2'}`}>{contenido}</div>
  )
}

function EtiquetaEstado({ estado, esHoy }: { estado: DiaRuta['estado']; esHoy: boolean }) {
  return (
    <span
      className={
        'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.06em] ' +
        (esHoy
          ? 'bg-accion text-texto'
          : estado === 'completada'
            ? 'bg-placa/20 text-placa'
            : estado === 'descanso'
              ? // Con borde: la fila de descanso ya es `surface-2`, y sin él la pastilla se
                // funde con su fila y deja de leerse como pastilla.
                'border border-linea bg-surface-1 text-tenue'
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

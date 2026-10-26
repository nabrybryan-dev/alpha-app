import type { DiaRuta } from '../../../../domain/rutaEntrenamiento'
import type { Sesion } from '../../../../domain/types'
import { diaEnPantalla } from './diaEnPantalla'

/**
 * LA BANDA DE ARRIBA: de quién es el día y qué sesión toca.
 *
 * ## Por qué está fuera del muro
 *
 * Todo lo demás de este salón cuelga de una pared y gira con ella. Esto no, y es
 * deliberado: el día y el nombre de la sesión no son del ejercicio ni de la serie, son de
 * DÓNDE estás en la semana. Colgados de un muro se irían de cuadro al orbitar, y la
 * pregunta que contestan —«¿esto es lo de hoy?»— tiene que poder contestarse mirando la
 * pantalla, no buscando la pared correcta.
 *
 * Es la única capa del salón que no vive en el espacio, y por eso es también la más fina:
 * dos líneas de texto sin caja, sin fondo y sin borde, pegadas al borde de arriba.
 *
 * ## El día es un mando, y la sesión no
 *
 * Tocar el día despliega la semana debajo (Bryan, 25-oct: antes era un tambor que solo
 * enseñaba tres días a la vez); el nombre de la sesión no hace nada porque no hay nada que
 * hacer con él. Un rótulo que parece pulsable y no lo es enseña que en esta pantalla los
 * rótulos mienten, y a partir de ahí nadie prueba a tocar nada.
 */

export interface BarraDeSesionProps {
  sesion: Sesion | undefined
  /** La semana ya armada por el dominio. De aquí sale qué día es hoy. */
  semana: readonly DiaRuta[]
  /** Abrir la semana. Sin esto el día no se pinta como mando. */
  onAbrirSemana?: () => void
  /**
   * El día que se está mirando, cuando se eligió en la semana.
   *
   * La banda tiene que decirlo. Sin esto, mirar el jueves desde el lunes se ve exactamente
   * igual que estar en el jueves, y el asesorado empezaría a anotar series en la sesión
   * equivocada creyendo que es la suya de hoy.
   */
  diaElegido?: number | null
  /** Si la semana está desplegada: el botón lo dice (`aria-expanded`) y gira su punta. */
  semanaAbierta?: boolean
}

/** Qué es el día en pantalla respecto a hoy, en una palabra. */
function relacionConHoy(dia: DiaRuta, elegido: boolean): string {
  if (dia.esHoy) return 'hoy'
  return elegido ? 'viendo' : 'próxima'
}

export function BarraDeSesion({
  sesion,
  semana,
  onAbrirSemana,
  diaElegido = null,
  semanaAbierta = false,
}: BarraDeSesionProps) {
  // El día de la SESIÓN QUE SE VE, no el de hoy: con la de hoy hecha el salón abre la
  // próxima, y decir «domingo» encima de la sesión del lunes es decir dos cosas a la vez.
  const mirando = semana[diaEnPantalla(semana, sesion?.id, diaElegido)]
  const relacion = mirando ? relacionConHoy(mirando, diaElegido !== null) : ''

  return (
    <div
      data-hueco="rumbo"
      data-barra="sesion"
      className="pointer-events-none flex items-center justify-between gap-2.5"
    >
      {/* UNA LÍNEA, SIEMPRE. Un nombre de sesión largo («PIERNA · PESO MUERTO Y SENTADILLA»)
          partía la banda en dos y la segunda línea caía sobre el tablón del muro. Se
          recorta con puntos: la banda dice dónde estás, no es para leerla entera. */}
      <p className="min-w-0 truncate font-display text-[15px] font-black uppercase leading-none tracking-[0.04em] text-texto">
        Sesión{' '}
        <span className="text-silver-300">{sesion?.nombre ?? 'Sin sesión'}</span>
      </p>
      {mirando && (
        <button
          type="button"
          onClick={onAbrirSemana}
          disabled={!onAbrirSemana}
          aria-haspopup="dialog"
          aria-expanded={semanaAbierta}
          aria-label={`Cambiar de día: ${mirando.dia.toLowerCase()}, ${relacion}`}
          className="press pointer-events-auto -my-2 -mr-2 flex min-h-[44px] items-center gap-2 rounded-boton border border-ink-500 bg-ink-900/70 py-1 pl-3 pr-2 text-left disabled:pointer-events-none"
        >
          <span className="flex flex-col leading-none">
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-accion">{mirando.dia}</span>
            <span className="mt-1 text-[10.5px] text-tenue">
              {relacion} · ver la semana
            </span>
          </span>
          {/* Una punta hacia abajo: la semana se DESPLIEGA debajo del botón. Abierta, gira. */}
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-accion transition-transform duration-200"
            style={{ transform: semanaAbierta ? 'rotate(180deg)' : undefined }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
    </div>
  )
}

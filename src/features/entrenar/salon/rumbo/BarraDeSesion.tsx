import type { DiaRuta } from '../../../../domain/rutaEntrenamiento'
import type { Sesion } from '../../../../domain/types'

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
 * Tocar el día abre la semana; el nombre de la sesión no hace nada porque no hay nada que
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
   * El día que se está mirando, cuando NO es hoy.
   *
   * La banda tiene que decirlo. Sin esto, mirar el jueves desde el lunes se ve exactamente
   * igual que estar en el jueves, y el asesorado empezaría a anotar series en la sesión
   * equivocada creyendo que es la suya de hoy.
   */
  diaElegido?: number | null
}

export function BarraDeSesion({
  sesion,
  semana,
  onAbrirSemana,
  diaElegido = null,
}: BarraDeSesionProps) {
  const mirando = diaElegido === null ? semana.find((d) => d.esHoy) : semana[diaElegido]
  const hoy = mirando
  // El nombre del día en su forma larga: la rejilla del calendario usa abreviaturas de
  // tres letras porque tiene siete columnas de 40 px; aquí hay sitio y se lee mejor.
  const dia = hoy?.dia

  return (
    <div
      data-hueco="rumbo"
      data-barra="sesion"
      className="pointer-events-none flex items-center justify-between gap-2.5"
    >
      <p className="font-display text-[15px] font-black uppercase leading-none tracking-[0.04em] text-texto">
        Sesión{' '}
        <span className="text-silver-300">{sesion?.nombre ?? 'Sin sesión'}</span>
      </p>
      {dia && (
        <button
          type="button"
          onClick={onAbrirSemana}
          disabled={!onAbrirSemana}
          className="press pointer-events-auto -my-3 -mr-3 flex min-h-[44px] items-center gap-2 px-3 font-mono text-[11px] uppercase tracking-[0.16em] text-accion disabled:pointer-events-none"
        >
          {dia}
          {/* La doble punta dice que ESTO SE CAMBIA, y en qué eje: la semana se recorre
              arriba y abajo. Una sola punta hacia abajo diría «se despliega», que es otra
              cosa — un desplegable cae, un tambor gira. */}
          <svg
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 9l5-5 5 5M7 15l5 5 5-5" />
          </svg>
        </button>
      )}
    </div>
  )
}

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type {
  Competencia,
  DiaRuta,
  MiniEstadistica,
  RequisitoNivel,
  RutaAsesorado,
} from '../../../../domain/rutaEntrenamiento'
import type { Recuperacion } from '../../../../domain/readiness'
import type { ItemMarcable, Microciclo } from '../../../../domain/types'
import type { TextoDePanel } from '../paredes/contenidoPared'
import { CabeceraNivel } from '../../ruta/CabeceraNivel'
import { TarjetaProgresoNivel } from '../../ruta/TarjetaProgresoNivel'
import { ComoLlegas } from '../../ruta/ComoLlegas'
import { BloqueEnCurso } from '../../ruta/BloqueEnCurso'
import { CalendarioSemana } from '../../ruta/CalendarioSemana'
import { CompetenciasEvaluadas } from '../../ruta/CompetenciasEvaluadas'
import { RequisitosNivel } from '../../ruta/RequisitosNivel'
import { EscalaAlfa } from '../../ruta/EscalaAlfa'
import { NotasDeLaSemana } from '../../NotasDeLaSemana'
import { Recuadro, SinDatos } from './recuadros/Recuadro'
import { RecuadroMicrociclo } from './recuadros/RecuadroMicrociclo'
import { RecuadroEncoder } from './recuadros/RecuadroEncoder'
import { RecuadroEjercicio } from './recuadros/RecuadroEjercicio'

/**
 * EL PANEL DE ABAJO: lo largo, íntegro, a un dedo de distancia.
 *
 * Es el hueco `panelInferior` de `huecos.ts`, el único con `topeDeTexto: 0`, y la pieza
 * que hace HONESTO el recorte de las paredes. Sin él, dejar un campo en 42 caracteres
 * sería perder texto; con él, es solo moverlo.
 *
 * Dentro bajan los **doce bloques** que la pantalla `/entrenar` pintaba en una columna
 * con scroll —ninguno se queda por el camino— más los textos completos que
 * `contenidoPared()` mandó abajo. Cada uno en su recuadro, cada recuadro marcado con
 * `data-recuadro` para poder contarlos desde fuera.
 *
 * ## Los doce bloques, y de dónde viene cada uno
 *
 * | `data-recuadro`  | Venía de                                    |
 * | ---------------- | ------------------------------------------- |
 * | `microciclo`     | `PortadaMicrociclo`                         |
 * | `notas`          | `NotasDeLaSemana`                           |
 * | `nivel`          | `ruta/CabeceraNivel`                        |
 * | `progreso-nivel` | `ruta/TarjetaProgresoNivel`                 |
 * | `como-llegas`    | `ruta/ComoLlegas`                           |
 * | `bloque-en-curso`| `ruta/BloqueEnCurso`                        |
 * | `calendario`     | `ruta/CalendarioSemana`                     |
 * | `competencias`   | `ruta/CompetenciasEvaluadas`                |
 * | `requisitos`     | `ruta/RequisitosNivel`                      |
 * | `escala-alfa`    | `ruta/EscalaAlfa`                           |
 * | `encoder`        | el enlace suelto al encoder de `RutaPage`   |
 * | `ejercicio`      | `alPanel` de `contenidoPared()`             |
 *
 * Ocho de los doce montan EL MISMO COMPONENTE que pintaba la Ruta, sin copiar su
 * maquetación ni reescribir sus textos. No es pereza: es la única forma de poder afirmar
 * que no se perdió nada. Una versión «adaptada al panel» de `CalendarioSemana` sería una
 * segunda maqueta que se separa de la primera al primer arreglo, y la información que se
 * pierde en esa deriva no la ve nadie.
 *
 * ## El estado cerrado no tiene texto
 *
 * Con el panel bajado, aquí solo vive el tirador, y el tirador es una barra sin una sola
 * letra: su nombre accesible va en `aria-label`, que es un atributo y no un nodo de
 * texto. Es lo que permite cumplir la regla dura de la vista inicial —ningún texto por
 * encima del canvas fuera de los huecos declarados— sin dejar el gesto sin manija ni a
 * quien navega con lector sin saber qué hay ahí abajo.
 */

/** Lo que se necesita para pintar el panel entero. Sale tal cual de `RutaPage`. */
export interface PanelInferiorProps {
  microciclo: Microciclo
  ruta: RutaAsesorado
  recuperacion: Recuperacion
  /** Porcentaje de progreso al siguiente nivel, ya calculado por el dominio. */
  progresoPct: number
  estadisticas: readonly MiniEstadistica[]
  competencias: readonly Competencia[]
  requisitos: readonly RequisitoNivel[]
  semana: readonly DiaRuta[]
  sesionCta?: { id: string; nombre: string; empezada: boolean; esDeHoy: boolean }
  notas: ItemMarcable[]
  /** Los textos completos del ejercicio que las paredes no pudieron llevar. */
  alPanel: readonly TextoDePanel[]
  /** Los bloques de cardio, cuando la sesión es metabólica. */
  bloquesCardio?: readonly ItemMarcable[]
  /** El nombre del ejercicio del que se está ampliando el detalle. */
  nombreEjercicio?: string
}

/** Cuánto hay que arrastrar hacia arriba para que el panel suba. */
const UMBRAL_ABRIR = 40
/** Cuánto hay que arrastrar hacia abajo para que se vuelva a guardar. */
const UMBRAL_CERRAR = 60
/** Por debajo de esto el gesto fue un toque, no un arrastre. */
const TOQUE = 6

export function PanelInferior(props: PanelInferiorProps) {
  const {
    microciclo,
    ruta,
    recuperacion,
    progresoPct,
    estadisticas,
    competencias,
    requisitos,
    semana,
    sesionCta,
    notas,
    alPanel,
    bloquesCardio,
    nombreEjercicio,
  } = props

  const [abierto, setAbierto] = useState(false)
  /** Píxeles que el dedo lleva recorridos EN ESTE arrastre. Negativo es hacia arriba. */
  const [recorrido, setRecorrido] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)
  const origen = useRef(0)

  const alBajarDedo = (e: ReactPointerEvent<HTMLButtonElement>) => {
    origen.current = e.clientY
    setArrastrando(true)
    setRecorrido(0)
    // `setPointerCapture` no existe en jsdom, y aquí no es opcional en un navegador: sin
    // captura, sacar el dedo del tirador durante el arrastre corta el gesto a media
    // subida. La guarda es para el entorno de prueba, no para el navegador.
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const alMoverDedo = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!arrastrando) return
    setRecorrido(e.clientY - origen.current)
  }

  const alLevantarDedo = () => {
    if (!arrastrando) return
    setArrastrando(false)
    const dy = recorrido
    setRecorrido(0)
    // Un toque limpio alterna, que es lo que espera cualquiera que no sepa que hay un
    // gesto — y lo que permite llegar aquí con teclado, donde no hay dedo que arrastrar.
    if (Math.abs(dy) < TOQUE) {
      setAbierto((v) => !v)
      return
    }
    if (!abierto && dy <= -UMBRAL_ABRIR) setAbierto(true)
    if (abierto && dy >= UMBRAL_CERRAR) setAbierto(false)
  }

  /**
   * El acuse del arrastre, y por qué está topado.
   *
   * Mientras el dedo sube, el panel lo sigue: sin eso el gesto es una apuesta a ciegas
   * —arrastras y no pasa nada hasta que sueltas—. Pero solo lo sigue hasta el umbral, y
   * a partir de ahí se planta: el panel abierto se maqueta con `max-height`, así que
   * dejarlo subir sin tope movería la hoja por encima de su propio borde superior.
   */
  const seguimiento = arrastrando
    ? Math.max(-UMBRAL_ABRIR, Math.min(UMBRAL_CERRAR, abierto ? Math.max(0, recorrido) : recorrido))
    : 0

  return (
    <div
      data-hueco="panelInferior"
      className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end"
      style={{ zIndex: 'var(--z-elevado)' }}
    >
      <div
        // La hoja es una superficie FIJA —vive pegada al borde de abajo del salón, que
        // es `fixed inset-0`, y no se desplaza con ningún scroll—, así que el desenfoque
        // se pide por `.glass-blur`, que es la vía sancionada de `tokens.css` y la que
        // `[data-camara-abierta]` sabe apagar mientras el encoder mide. La utilidad
        // suelta `backdrop-blur-sm` se saltaba las dos cosas.
        className="glass-blur pointer-events-auto flex flex-col overflow-hidden rounded-t-[20px] border-t border-white/10 bg-ink-900/95"
        style={{
          maxHeight: abierto ? '84dvh' : undefined,
          transform: `translateY(${seguimiento}px)`,
          transition: arrastrando ? 'none' : 'transform var(--dur-base) var(--ease-salida)',
          boxShadow: '0 -18px 40px -24px rgba(0,0,0,.95)',
        }}
      >
        {/* EL TIRADOR. Sin una letra: el nombre va en `aria-label`, que no es un nodo de
            texto y por tanto no rompe la regla de la vista inicial. Es a la vez la manija
            del arrastre y el botón que abre con un toque o con el teclado. */}
        <button
          type="button"
          aria-expanded={abierto}
          aria-label={abierto ? 'Cerrar el panel de detalle' : 'Abrir el panel con todo el detalle'}
          onPointerDown={alBajarDedo}
          onPointerMove={alMoverDedo}
          onPointerUp={alLevantarDedo}
          onPointerCancel={alLevantarDedo}
          className="flex w-full shrink-0 touch-none items-center justify-center py-3"
        >
          <span
            aria-hidden="true"
            className="h-1 w-11 rounded-full bg-silver-500/60 transition-colors duration-base"
          />
        </button>

        {abierto && (
          <div
            className="flex flex-col gap-2.5 overflow-y-auto px-3"
            style={{ paddingBottom: 'calc(var(--tope-nav) + 1rem)' }}
          >
            <Recuadro clave="microciclo" titulo="Empieza tu microciclo">
              <RecuadroMicrociclo microciclo={microciclo} />
            </Recuadro>

            <Recuadro clave="notas" titulo="Notas de la semana">
              {notas.length > 0 ? (
                <NotasDeLaSemana notas={notas} />
              ) : (
                <SinDatos motivo="Esta semana el coach no ha dejado ninguna nota antes de empezar." />
              )}
            </Recuadro>

            <Recuadro clave="nivel" titulo="Tu ruta de entrenamiento">
              <CabeceraNivel nivel={ruta.nivelActual} />
            </Recuadro>

            <Recuadro
              clave="progreso-nivel"
              titulo={
                ruta.siguienteNivel
                  ? `Progreso al nivel ${ruta.siguienteNivel.numero}`
                  : 'Nivel máximo alcanzado'
              }
            >
              <TarjetaProgresoNivel
                pct={progresoPct}
                nivelActual={ruta.nivelActual}
                siguienteNivel={ruta.siguienteNivel}
                estadisticas={estadisticas}
              />
            </Recuadro>

            <Recuadro clave="como-llegas" titulo="Cómo llegas esta semana">
              {recuperacion.indice === undefined ? (
                <SinDatos motivo="Aún no hay check-ins de bienestar en la ventana: sin ellos el índice de recuperación no se puede calcular, y una cifra inventada no es contexto." />
              ) : (
                <ComoLlegas recuperacion={recuperacion} />
              )}
            </Recuadro>

            <Recuadro clave="bloque-en-curso" titulo="Bloque en curso">
              <BloqueEnCurso bloque={ruta.bloque} sesion={sesionCta} />
            </Recuadro>

            <Recuadro clave="calendario" titulo="La semana">
              <CalendarioSemana
                dias={semana}
                titulo={`Semana ${ruta.bloque.semana} · Microciclo ${microciclo.numero}`}
              />
            </Recuadro>

            <Recuadro clave="competencias" titulo="Competencias evaluadas">
              {competencias.length > 0 ? (
                <CompetenciasEvaluadas competencias={competencias} />
              ) : (
                <SinDatos motivo="Todavía no hay series registradas ni valoraciones del coach con las que valorar ninguna competencia." />
              )}
            </Recuadro>

            <Recuadro
              clave="requisitos"
              titulo={
                ruta.siguienteNivel
                  ? `Para subir a nivel ${ruta.siguienteNivel.numero}`
                  : 'Requisitos de nivel'
              }
            >
              {ruta.siguienteNivel ? (
                <RequisitosNivel requisitos={requisitos} siguienteNivel={ruta.siguienteNivel} />
              ) : (
                <SinDatos motivo="Estás en el último peldaño de la escala: no hay un nivel siguiente al que subir." />
              )}
            </Recuadro>

            <Recuadro clave="escala-alfa" titulo="Escala Alfa">
              <EscalaAlfa niveles={ruta.escala} />
            </Recuadro>

            <Recuadro clave="encoder" titulo="Encoder" pie="La tanda entera, los criterios y el CSV.">
              <RecuadroEncoder />
            </Recuadro>

            <Recuadro
              clave="ejercicio"
              titulo="El ejercicio, entero"
              pie={nombreEjercicio}
            >
              <RecuadroEjercicio alPanel={alPanel} bloquesCardio={bloquesCardio} />
            </Recuadro>
          </div>
        )}
      </div>
    </div>
  )
}

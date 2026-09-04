import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  resumenSemana,
  type DiaRuta,
  type MiniEstadistica,
  type RequisitoNivel,
  type RutaAsesorado,
} from '../../../../domain/rutaEntrenamiento'
import type { Recuperacion } from '../../../../domain/readiness'
import type { EjercicioPrescrito, ItemMarcable, Microciclo, Sesion } from '../../../../domain/types'
import type { Patron } from '../../../../domain/patrones/catalogo'
import type { TextoDePanel } from '../paredes/contenidoPared'
import { CabeceraNivel } from '../../ruta/CabeceraNivel'
import { TarjetaProgresoNivel } from '../../ruta/TarjetaProgresoNivel'
import { ComoLlegas } from '../../ruta/ComoLlegas'
import { tonoDeRecuperacion } from '../../ruta/tonoDeRecuperacion'
import { BloqueEnCurso } from '../../ruta/BloqueEnCurso'
import { CalendarioSemana } from '../../ruta/CalendarioSemana'
import { RequisitosNivel } from '../../ruta/RequisitosNivel'
import { NotasDeLaSemana } from '../../NotasDeLaSemana'
import { Recuadro, SinDatos } from './recuadros/Recuadro'
import { RecuadroMicrociclo } from './recuadros/RecuadroMicrociclo'
import { RecuadroEncoder } from './recuadros/RecuadroEncoder'
import { RecuadroEjercicio } from './recuadros/RecuadroEjercicio'
import { RecuadroAntes } from './recuadros/RecuadroAntes'
import { RecuadroPatron } from './recuadros/RecuadroPatron'
import { ImplementosDelSalon } from '../implementos/ImplementosDelSalon'
import type { ImplementosDeSesion } from '../implementos/implementosDeSesion'
import { MuroDeCampos } from '../paredes/PanelPared'
import { MURO_DERECHO } from '../paredes/muros'
import type { ContenidoDePared } from '../paredes/contenidoPared'

/**
 * EL PANEL DE ABAJO: lo largo, íntegro, a un dedo de distancia.
 *
 * Es el hueco `panelInferior` de `huecos.ts`, el único con `topeDeTexto: 0`, y la pieza
 * que hace HONESTO el recorte de las paredes. Sin él, dejar un campo en 42 caracteres
 * sería perder texto; con él, es solo moverlo.
 *
 * Dentro bajan **doce recuadros**. Los cuatro primeros son los que Bryan marcó en verde
 * —lo que solo aparece al deslizar hacia abajo—; los ocho de después son los bloques de la
 * Ruta que ya vivían aquí. Cada uno con su marca `data-recuadro`, para poder contarlos
 * desde fuera sin leer un solo texto.
 *
 * ## Los doce, y qué trae cada uno
 *
 * | `data-recuadro`  | Qué trae                                                     |
 * | ---------------- | ------------------------------------------------------------ |
 * | `antes`          | Calentamiento, movilidad y activación (`PreparacionSesion`)   |
 * | `notas`          | Notas de la semana del coach (`NotasDeLaSemana`)              |
 * | `ejercicio`      | La prescripción entera: `alPanel` de `contenidoPared()`       |
 * | `patron`         | Notas de ejecución: qué mueve y qué sujeta cada articulación  |
 * | `microciclo`     | `recuadros/RecuadroMicrociclo`                                |
 * | `nivel`          | `ruta/CabeceraNivel`                                          |
 * | `progreso-nivel` | `ruta/TarjetaProgresoNivel`                                   |
 * | `como-llegas`    | `ruta/ComoLlegas`                                             |
 * | `bloque-en-curso`| `ruta/BloqueEnCurso`                                          |
 * | `calendario`     | `ruta/CalendarioSemana`                                       |
 * | `requisitos`     | `ruta/RequisitosNivel`                                        |
 * | `encoder`        | el enlace suelto al encoder de `RutaPage`                     |
 *
 * ## Los dos que se han ido, y adónde
 *
 * `competencias` y `escala-alfa` ya no están aquí: se han mudado a la pestaña **Progreso**,
 * por decisión de Bryan del 29-ago. No se han borrado y no se ha perdido una línea —los
 * mismos dos componentes, `ruta/CompetenciasEvaluadas` y `ruta/EscalaAlfa`, se montan allí
 * con los mismos datos—. El motivo es de sitio, no de contenido: valorar cómo vas es una
 * pregunta que se hace entre sesiones, no con el cronómetro corriendo, y el panel del salón
 * es lo que se abre EN mitad del entrenamiento.
 *
 * Siete de los doce montan EL MISMO COMPONENTE que pintaba la Ruta o la sesión, sin copiar
 * su maquetación ni reescribir sus textos. No es pereza: es la única forma de poder afirmar
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
  /**
   * El ejercicio en curso, entero. De él sale la lectura larga de las cuatro
   * prescripciones: qué es cada número, por qué importa y qué señal mirar.
   */
  ejercicio?: EjercicioPrescrito
  /** La sesión de hoy: de ella sale el bloque de antes de entrenar. */
  sesion?: Sesion
  /** El patrón del ejercicio en curso: de él salen las notas de ejecución. */
  patron?: Patron
  /**
   * Los campos del encuadre, que antes vivían pegados al trípode en la pared.
   *
   * Bajaron el 2026-09-02: no están en la lista amarilla del §1 de `SEMANA-2.md` —ahí solo
   * entra «medir con la cámara»— y en la pared costaban medio ancho de pantalla a la altura
   * de las piernas del sujeto.
   */
  contenido?: ContenidoDePared
  /** El material escrito de la sesión. El hierro de verdad lo dibuja el motor. */
  material?: ImplementosDeSesion
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
    requisitos,
    semana,
    sesionCta,
    notas,
    alPanel,
    bloquesCardio,
    nombreEjercicio,
    ejercicio,
    sesion,
    patron,
    contenido,
    material,
  } = props

  /** Las sesiones hechas de las programadas. Sube al rótulo del tramo de «La semana». */
  const sesionesDeLaSemana = resumenSemana(semana)

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
      className="pointer-events-none absolute inset-x-0 flex flex-col justify-end"
      // El borde de abajo del panel es el borde de arriba de la barra de navegación, no
      // el de la pantalla. Con `bottom: 0` el tirador quedaba DEBAJO de la barra —tapado
      // por ella, imposible de agarrar—, y no se veía en los tests porque en jsdom no hay
      // maquetación: la comprobación de que el panel abre pulsa el botón por su nombre
      // accesible, y un botón tapado se pulsa igual.
      style={{ zIndex: 'var(--z-elevado)', bottom: 'var(--tope-nav)' }}
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
            // `hoja-del-salon`: enciende el contador que numera los tramos y las juntas
            // de luz que los separan (`tokens.css`, LA HOJA DEL SALÓN). El aire sube de
            // `gap-2.5` a `gap-5` porque sin marcos hace falta más espacio entre bloques:
            // el borde ya no dice dónde acaba uno, lo dice el aire.
            className="hoja-del-salon flex flex-col gap-5 overflow-y-auto px-5"
            // Un dedo de aire al final de la lista. La barra de navegación ya no se
            // descuenta aquí: ahora la descuenta el propio panel, que empieza encima de
            // ella. Sumarla dos veces dejaba un hueco muerto al final del panel.
            style={{ paddingBottom: '1rem' }}
          >
            {/* LOS CUATRO VERDES PRIMERO. Son los que el encargo pone tras el gesto de
                bajar, y van arriba del todo porque son los que se buscan: lo que hay que
                hacer antes de empezar, lo que el coach dejó dicho, la prescripción entera
                y cómo se ejecuta el gesto. */}
            <Recuadro clave="antes" titulo="Antes de entrenar" pie="Calentamiento, movilidad y activación.">
              <RecuadroAntes microciclo={microciclo} sesion={sesion} />
            </Recuadro>

            <Recuadro clave="notas" titulo="Notas de la semana">
              {notas.length > 0 ? (
                <NotasDeLaSemana notas={notas} />
              ) : (
                <SinDatos motivo="Esta semana el coach no ha dejado ninguna nota antes de empezar." />
              )}
            </Recuadro>

            <Recuadro clave="ejercicio" titulo="La prescripción del coach" pie={nombreEjercicio}>
              <RecuadroEjercicio ejercicio={ejercicio} alPanel={alPanel} bloquesCardio={bloquesCardio} />
            </Recuadro>

            {contenido && (
              <Recuadro
                clave="encuadre"
                titulo="El encuadre de hoy"
                pie="Dónde va el móvil, a qué distancia, qué palanca y qué velocidad."
              >
                <MuroDeCampos contenido={contenido} campos={MURO_DERECHO} lado="izquierda" />
              </Recuadro>
            )}

            {material && (
              <Recuadro
                clave="material"
                titulo="Material de la sesión"
                pie="Lo que hay que tener a mano. El hierro, alrededor del sujeto, lo dibuja la sala."
              >
                <ImplementosDelSalon material={material} />
              </Recuadro>
            )}

            <Recuadro clave="patron" titulo="Notas de ejecución y técnica" pie="Qué mueve y qué sujeta cada articulación.">
              <RecuadroPatron patron={patron} />
            </Recuadro>

            <Recuadro clave="microciclo" titulo="Empieza tu microciclo">
              <RecuadroMicrociclo microciclo={microciclo} />
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
              cifra={<span className="text-accion">{Math.max(0, Math.min(100, Math.round(progresoPct)))}%</span>}
            >
              <TarjetaProgresoNivel
                pct={progresoPct}
                nivelActual={ruta.nivelActual}
                siguienteNivel={ruta.siguienteNivel}
                estadisticas={estadisticas}
              />
            </Recuadro>

            <Recuadro
              clave="como-llegas"
              titulo="Cómo llegas esta semana"
              cifra={
                recuperacion.indice === undefined ? undefined : (
                  <span className={tonoDeRecuperacion(recuperacion.indice).clase}>
                    {recuperacion.indice}
                  </span>
                )
              }
            >
              {recuperacion.indice === undefined ? (
                <SinDatos motivo="Aún no hay check-ins de bienestar en la ventana: sin ellos el índice de recuperación no se puede calcular, y una cifra inventada no es contexto." />
              ) : (
                <ComoLlegas recuperacion={recuperacion} />
              )}
            </Recuadro>

            <Recuadro
              clave="bloque-en-curso"
              titulo="Bloque en curso"
              cifra={
                <span className="text-silver-300">
                  {ruta.bloque.semana}/{ruta.bloque.semanasTotales}
                </span>
              }
            >
              <BloqueEnCurso bloque={ruta.bloque} sesion={sesionCta} />
            </Recuadro>

            <Recuadro
              clave="calendario"
              titulo="La semana"
              pie={`Semana ${ruta.bloque.semana} · Microciclo ${microciclo.numero}`}
              cifra={
                <span className="text-silver-400">
                  {sesionesDeLaSemana.completadas}/{sesionesDeLaSemana.programadas}
                </span>
              }
            >
              <CalendarioSemana dias={semana} />
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

            <Recuadro clave="encoder" titulo="Encoder" pie="La tanda entera, los criterios y el CSV.">
              <RecuadroEncoder />
            </Recuadro>

          </div>
        )}
      </div>
    </div>
  )
}

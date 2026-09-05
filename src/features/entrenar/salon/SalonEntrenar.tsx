import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ejercicioCompleto } from '../../../domain/cumplimiento'
import { patronDeCategoria } from '../../../domain/patrones/catalogo'
import type {
  Competencia,
  DiaRuta,
  MiniEstadistica,
  RequisitoNivel,
  RutaAsesorado,
} from '../../../domain/rutaEntrenamiento'
import type { Recuperacion } from '../../../domain/readiness'
import type {
  EjercicioPrescrito,
  ItemMarcable,
  Microciclo,
  SerieRegistrada,
  Sesion,
} from '../../../domain/types'
import { useMovimiento } from '../../../app/movimientoContexto'
import { VisorPatron } from '../visor/VisorPatron'
import { ENCUADRE_SALA } from '../escena/sala'
import type { CamaraDelSalon as EstadoDeCamara } from './paredes/geometriaDeCuadro'
import { implementosDeSesion } from './implementos/implementosDeSesion'
import { capaTrasArrastre } from '../capas/gestoVertical'
import { capaTrasHundir, ESCALON_MS, ESPERA, siguePresionando } from '../capas/hundirEnElCuerpo'
import { SUELO_DEL_SALON, type NivelW } from './huecos'
import { contenidoPared } from './paredes/contenidoPared'
import { ParedesDelSalon } from './paredes/ParedesDelSalon'
import { useRitmoDelSalon } from './paredes/useRitmoDelSalon'
import { ArquitecturaSala } from './sala/ArquitecturaSala'
import { PanelInferior } from './panel/PanelInferior'
import { CajonDeSerie } from './registro/CajonDeSerie'
import { EstacionesDelSujeto } from './estaciones/EstacionesDelSujeto'
import { huellaDeReferencia } from './paredes/huellaDeReferencia'
import { leerHuellaArticular } from '../encoder/huellasArticulares'
import type { ClaveDeEstacion } from './estaciones/estacionesDeLaSerie'
import { LOGRO_MS, RELEVO_MS, loQuePasaAlGuardar } from './registro/despuesDeGuardar'
import { Joystick } from './mando/Joystick'
import { CamaraDelSalon } from './camara/CamaraDelSalon'
import { duracionDelModo, SEGUNDOS_DE_EXCENTRICO, type ModoDelReloj } from './mando/relojDelMuro'
import { PuntosDeEjercicio } from './rumbo/PuntosDeEjercicio'
import {
  duenoDelGesto,
  ejercicioTrasBarrido,
  ejerciciosQueAvanza,
  type DuenoDelGesto,
} from '../capas/gestoHorizontal'
import { BarraDeSesion } from './rumbo/BarraDeSesion'
import { TamborDeLaSemana } from './rumbo/TamborDeLaSemana'
import { frasePorSerie } from '../frasesMotivacionales'
import { sinEmoji } from './registro/sinEmoji'
import { SalaVacia } from './sinPatron/SalaVacia'
import { SalonSinSujeto, tienePatronDeMovimiento } from './sinPatron/SalonSinSujeto'

/**
 * EL SALÓN: la pantalla `/entrenar`, y la primera que se ve al tocar ENTRENAR.
 *
 * No hay pantalla de aterrizaje: tocar ENTRENAR abre esto, ya con el ejercicio de hoy, el
 * cronómetro corriendo y la serie en curso. Lo que antes era la vista macro —nivel, semana,
 * calendario— vive en el panel de abajo, a un dedo; las competencias y la Escala Alfa se han
 * ido a Progreso.
 *
 * ## Lo que se ve sin scroll y sin tocar nada
 *
 * Las cinco cosas del encargo, a la vez, y cada una marcada en el DOM para que se puedan
 * contar desde fuera con `data-testigo`:
 *
 * 1. **la sala con sus paredes** (`sala`) — `sala/ArquitecturaSala`, la habitación en
 *    perspectiva de un punto dibujada a pantalla completa sobre el lienzo. Los días sin
 *    sujeto, la habitación es `sinPatron/SalaVacia`, que ya existía.
 * 2. **las letras y los datos en 3D sobre esas paredes** (`letras3D`) — el hueco `paredes`
 *    entero, escorzado con los grados de `ESCORZO_DE_PARED`.
 * 3. **el sujeto en medio** (`sujeto`) — el lienzo del visor, a sangre y detrás de todo.
 * 4. **la cámara a un lado** (`camara`) — el módulo del encuadre, al pie del muro
 *    izquierdo; el trípode de verdad está dentro de la escena, que lo monta el visor.
 * 5. **los implementos alrededor** (`implementos`) — al pie del muro derecho.
 *
 * ## EL SUJETO VA A PANTALLA COMPLETA, y qué hubo que hacer para eso
 *
 * `VisorPatron` no es solo un lienzo: debajo del suyo pinta su columna de estudio —los
 * mandos de fase y órbita, el rótulo de la capa y la lista de qué mueve y qué sujeta cada
 * articulación—. Montado dentro del salón, esa columna era lo que Bryan vio: «debajo del
 * salón seguía habiendo una columna de texto», y el lienzo, encajonado entre ella y los
 * rótulos, quedaba en una franja de menos de la mitad de la pantalla.
 *
 * El visor no se toca: se monta, no se reescribe. Así que el envoltorio hace dos cosas, las
 * dos con variantes que alcanzan a sus hijos y ninguna dentro de su código:
 *
 * - estira el lienzo hasta ocupar el envoltorio entero, que es `inset-0` del salón;
 * - esconde lo que el visor pinta DEBAJO del lienzo.
 *
 * **Nada de eso se pierde**: la explicación de la articulación y la lista MUEVE/SUJETA
 * bajan al recuadro `patron` del panel, calculadas de las mismas funciones del dominio; y
 * el estudio con sus mandos —fase, órbita, capas— sigue abriéndose desde la tarjeta del
 * ejercicio en la pantalla de sesión. Lo que cambia es dónde está, no si existe.
 *
 * ## Los cinco huecos, y ni uno más
 *
 * El reparto lo declara `huecos.ts`, que es la frontera entre el motor y la interfaz. Aquí
 * solo se montan los cinco, cada uno con su marca `data-hueco`: `centro` (el sujeto y la
 * habitación), `paredes` (los rótulos, los campos, la cámara y el material), `registro` (la
 * serie en curso, colapsada a una barra), `panelInferior` (lo largo, íntegro) y `sinPatron`
 * (la misma sala con el centro vacío).
 *
 * ## La regla dura de la vista inicial
 *
 * Con el panel bajado, **no hay un solo nodo de texto por encima del canvas fuera de los
 * huecos declarados**. La comprobación es mecánica: quitar del árbol los subárboles
 * `[data-hueco]` tiene que dejar el salón sin texto.
 *
 * ## La cuarta dimensión, y qué hace de verdad
 *
 * A los tres ejes del espacio se le suma W, que ATRAVIESA el cuerpo en vez de rodearlo: el
 * dedo en horizontal orbita —ese gesto lo sirve el propio visor sobre su lienzo— y el dedo
 * en vertical sube y baja por las cinco capas, de la piel al hueso. Los dos gestos son
 * ortogonales a propósito: orbitar nunca cambia de capa y cambiar de capa nunca mueve la
 * cámara, porque un gesto que hiciera las dos cosas dejaría al asesorado sin saber si se ha
 * movido él o se ha movido el cuerpo.
 *
 * El escalón es estado de este salón y sale por cuatro sitios a la vez: `data-w`, la
 * escalera de peldaños, el velo que cierra la habitación según se entra, y —el que cuenta—
 * la prop `w` que viaja al `VisorPatron`, con la que el visor deja de dibujar siempre lo
 * mismo y obedece a `capas/nivelesAnatomicos.ts`.
 *
 * **Y sin sujeto no hay eje.** Las cuatro salidas cuelgan de `conEjeW`: sin cuerpo que
 * atravesar no se monta la escalera, no se pinta el velo y el gesto vertical ni se escucha.
 * W es la profundidad del cuerpo, no un ajuste de la pantalla.
 *
 * ## La aritmética del gesto no vive aquí
 *
 * Cuántos píxeles son un escalón, hacia dónde entra el dedo y dónde están los topes lo dice
 * `capas/gestoVertical.ts` con una función pura. Este archivo pone el origen del arrastre y
 * lo vuelve a poner cuando la capa cambia, pero no suma ni recorta. Un segundo umbral
 * escrito aquí sería un segundo eje W que se separaría del primero al primer ajuste.
 */

export interface SalonEntrenarProps {
  microciclo: Microciclo
  ruta: RutaAsesorado
  recuperacion: Recuperacion
  /** Progreso al siguiente nivel, ya calculado por el dominio. */
  progresoPct: number
  estadisticas: readonly MiniEstadistica[]
  /**
   * Las competencias evaluadas.
   *
   * Se siguen recibiendo aunque el salón ya no las pinte: desde el 29-ago viven en la
   * pestaña Progreso, que las calcula con las mismas funciones del dominio. La prop se
   * queda porque quien monta el salón las tiene a mano y quitarla obligaría a tocar a todos
   * los que lo montan por un cambio que es de sitio, no de datos.
   */
  competencias: readonly Competencia[]
  requisitos: readonly RequisitoNivel[]
  semana: readonly DiaRuta[]
  /**
   * El microciclo ANTERIOR, para que el muro pueda decir con cuánto se levantó la semana
   * pasada. Es un hecho del histórico, no un cálculo: sin él la línea no se pinta.
   */
  microcicloPrevio?: Microciclo
  sesionCta?: { id: string; nombre: string; empezada: boolean; esDeHoy: boolean }
  notas: ItemMarcable[]
  /**
   * La sesión que manda hoy: de ella salen el ejercicio, el cronómetro y el material.
   *
   * Opcional porque la semana puede no tener ninguna pendiente. Sin sesión el salón sigue
   * abriéndose —el panel es la Ruta entera y esa no depende de que haya sesión hoy—, pero
   * las paredes se quedan casi vacías: no hay ejercicio del que hablar.
   */
  sesion?: Sesion
}

/** El ejercicio del que habla el salón: el primero que queda por terminar. */
function ejercicioEnCurso(sesion: Sesion | undefined): EjercicioPrescrito | undefined {
  if (!sesion) return undefined
  return sesion.ejercicios.find((e) => !ejercicioCompleto(e)) ?? sesion.ejercicios[0]
}

/**
 * CÓMO SE ESTIRA EL VISOR HASTA LLENAR EL SALÓN, sin tocar el visor.
 *
 * Las variantes de hijo ganan por especificidad a las utilidades que el visor lleva
 * puestas: `.envoltorio canvas` son dos elementos y una clase, y `.h-\[46vh\]` es una clase
 * sola. Por eso no hace falta forzar nada.
 *
 * - `[&>div]` es la raíz del visor: se estira y se le quita la separación entre bloques.
 * - `[&>div>div:first-child]` es la caja del lienzo: se estira y pierde las esquinas
 *   redondeadas, que a pantalla completa no pintan nada.
 * - `[&_canvas]` es el lienzo: alto completo y sin los topes que lo dejaban en 420 px.
 * - `[&>div>*:not(:first-child)]` es todo lo que el visor pinta DEBAJO del lienzo: la
 *   columna de estudio. Se esconde aquí y baja íntegra al recuadro `patron` del panel.
 * - `[&_p.bottom-2]` son las dos leyendas que el visor apoya en las esquinas de abajo del
 *   lienzo. A pantalla completa caen justo donde está el mobiliario del suelo. El aviso de
 *   error del visor NO lleva esa clase, así que sigue viéndose: es el único texto de ahí
 *   dentro que no se puede esconder.
 */
const SUJETO_A_SANGRE = [
  'absolute inset-0',
  '[&>div]:h-full [&>div]:gap-0',
  '[&>div>div:first-child]:h-full [&>div>div:first-child]:rounded-none',
  '[&_canvas]:h-full [&_canvas]:max-h-none [&_canvas]:min-h-0',
  '[&>div>*:not(:first-child)]:hidden',
  '[&_p.bottom-2]:hidden',
].join(' ')

export function SalonEntrenar(props: SalonEntrenarProps) {
  const { microciclo, sesion: sesionProp } = props
  // La demo necesita una sesión con sujeto para poder inspeccionar el salón 3D.
  // En producción se conserva estrictamente la sesión calculada para el día.
  const sesion =
    import.meta.env.MODE === 'demo' && (!sesionProp || sesionProp.ejercicios.length === 0)
      ? microciclo.sesiones.find((s) => s.ejercicios.length > 0)
      : sesionProp
  /**
   * EL EJERCICIO QUE ENSEÑA EL SALÓN.
   *
   * Normalmente es el primero incompleto de la sesión, así que al guardar la última serie
   * la sala pasa sola al siguiente. Pero «sola» quería decir EN EL MISMO FOTOGRAMA: la
   * frase «Press de banca · completado» salía sobre un salón que ya estaba anunciando otro
   * ejercicio, y lo que se leía era el nombre de uno con el rótulo del otro.
   *
   * Por eso el que acaba de cerrarse se RETIENE 900 ms. No es una animación: es que lo que
   * se celebra es el ejercicio, no la pantalla, y hay que poder verlo mientras se dice.
   */
  const [retenido, setRetenido] = useState<EjercicioPrescrito | null>(null)
  /**
   * EL DÍA QUE SE ESTÁ MIRANDO, cuando no es hoy.
   *
   * `null` = hoy, que es como se abre siempre. Elegir otro día en el tambor no navega a
   * otra pantalla ni cambia nada en la base: cambia QUÉ SALA se está viendo. Es la
   * diferencia entre consultar la semana y empezar la sesión de otro día por error.
   */
  /**
   * EL SUJETO, ARMADO.
   *
   * Mantener el dedo dos segundos sobre el cuerpo lo levanta, lo agranda un pelo y le pone
   * un halo. A partir de ahí, tirar a un lado pasa al ejercicio siguiente o al anterior.
   *
   * ## Por qué hay que armarlo y no basta con tirar
   *
   * Porque el arrastre horizontal sobre el sujeto YA está cogido: es la órbita. Un gesto
   * que hiciera las dos cosas dejaría al asesorado sin saber si se ha movido él o ha
   * cambiado de ejercicio, que es exactamente el problema que este salón resolvió
   * separando la órbita del eje W. Los dos segundos son la frontera: mientras no se cruzan
   * el gesto es de la cámara, y en cuanto se cruzan el cuerpo lo dice —se levanta— y pasa
   * a ser del ejercicio.
   */
  const [hundiendo, setHundiendo] = useState(false)
  /** El reloj de la espera: lo que separa tocar de hundir. */
  const reloj = useRef(0)
  /** El que va bajando de capa mientras el dedo aguanta. */
  const bomba = useRef(0)
  /**
   * El ejercicio al que el asesorado navegó a mano. `null` = el que toca.
   *
   * Se guarda el ÍNDICE y no el ejercicio: guardando el objeto, registrar una serie lo
   * dejaría obsoleto —la base devuelve otro— y el salón seguiría enseñando el de antes.
   */
  const [ejercicioManual, setEjercicioManual] = useState<number | null>(null)

  const [diaElegido, setDiaElegido] = useState<number | null>(null)
  const [semanaAbierta, setSemanaAbierta] = useState(false)
  /**
   * La sesión del día elegido, si hay uno.
   *
   * Sale del MISMO reparto que pinta la semana —`armarSemana`, ya calculado por el
   * dominio— y no de un segundo cruce por nombre de día: dos formas de repartir sesiones
   * en días se separan, y entonces el tambor abriría una sesión y el calendario diría otra.
   */
  const sesionDelDiaElegido =
    diaElegido === null
      ? undefined
      : microciclo.sesiones.find((s) => s.id === props.semana[diaElegido]?.sesionId)
  const sesionEnPantalla = sesionDelDiaElegido ?? sesion
  const ejercicio =
    retenido ??
    (ejercicioManual !== null
      ? (sesionEnPantalla?.ejercicios[ejercicioManual] ?? ejercicioEnCurso(sesionEnPantalla))
      : ejercicioEnCurso(sesionEnPantalla))

  /*
   * MIENTRAS QUEDA TRABAJO POR HACER, LA APP BAJA EL RUIDO.
   *
   * Es el §15 de la petición de Bryan: reducir estímulos durante una serie
   * pesada. La señal es que esta pantalla está montada Y el ejercicio en curso
   * aún tiene series pendientes — o sea, el asesorado está entrenando ahora
   * mismo, no repasando lo que hizo. En ese rato se apagan el pulso de las
   * llamadas a la acción, el halo y el relieve 3D de los botones; lo que informa
   * se queda.
   *
   * Se apaga al desmontar y no solo al terminar el ejercicio, porque salir de
   * `/entrenar` a media sesión es lo normal —mirar la receta, contestar un
   * mensaje— y dejar la app en modo sobrio por haber estado entrenando hace
   * media hora sería un fallo silencioso de los que no se reportan.
   */
  const { declararSerie } = useMovimiento()
  const entrenando = ejercicio !== undefined && !ejercicioCompleto(ejercicio)
  useEffect(() => {
    declararSerie(entrenando)
    return () => declararSerie(false)
  }, [declararSerie, entrenando])

  /**
   * Con sujeto o sin él, y quién lo decide.
   *
   * `tienePatronDeMovimiento` delega entera en `patronDeCategoria()` del dominio, que es
   * donde vive la regla —alias de categoría, búsqueda por nombre y el apartado que deja
   * fuera el cardio y los cribados—. Aquí no hay ninguna lista de términos que se pueda
   * separar de la del catálogo.
   */
  const conSujeto = tienePatronDeMovimiento(ejercicio)
  const patron = useMemo(
    () => (ejercicio ? patronDeCategoria(ejercicio.categoria, ejercicio.nombre) : undefined),
    [ejercicio],
  )
  const contenido = useMemo(() => (ejercicio ? contenidoPared(ejercicio) : undefined), [ejercicio])
  // El ritmo lleva dentro el tiempo del cronómetro, leído de donde lo guarda el propio
  // cronómetro: un segundo reloj daría dos duraciones de la misma sesión.
  const ritmo = useRitmoDelSalon(sesion)

  /**
   * EL EJE W SOLO EXISTE SI HAY CUERPO QUE ATRAVESAR.
   *
   * Bryan lo vio en el iPhone: los cinco peldaños encendidos a la derecha de una pantalla
   * sin sujeto. Atravesar la nada. W no es un ajuste de la pantalla —no cambia el brillo,
   * ni el detalle, ni la cámara—: es la profundidad DEL CUERPO, de la piel al hueso. Sin
   * cuerpo no hay piel ni hay hueso, así que no hay escalón que subir, y una escalera que
   * responde al dedo sin cambiar nada de lo que se ve es peor que no tener escalera.
   *
   * `data-w` se queda puesto en las dos ramas: es la capa en la que ESTÁ el salón, y sin
   * sujeto es la piel —el escalón 0—, que es justo lo que `huecos.ts` declara para este
   * hueco (`sinPatron.visibleEnW: [0]`).
   */
  const conEjeW = conSujeto && !!patron

  const [w, setW] = useState<NivelW>(0)
  /**
   * Si la ficha de la serie está fuera.
   *
   * Vive aquí y no dentro del cajón porque hay DOS sitios que la abren —el mando de la
   * pared y el propio asidero del borde— y uno que la cierra sola: guardar. Con el estado
   * dentro del cajón, el mando de la pared no podría sacarlo.
   */
  const [fichaAbierta, setFichaAbierta] = useState(false)
  /**
   * La estación que el asesorado dejó fija, si dejó alguna.
   *
   * Las cuatro cifras se retiran solas a los 3,7 s —es lo que mantiene el salón
   * despejado—, así que tocar una es la única forma de volver a mirar un dato sin esperar
   * al siguiente ciclo. Tocarla otra vez la suelta.
   */
  const [estacionFija, setEstacionFija] = useState<ClaveDeEstacion | undefined>(undefined)
  /** La frase que sale sobre la sala al guardar. `null` = no hay nada que celebrar ahora. */
  const [logro, setLogro] = useState<{ rotulo: string; frase: string } | null>(null)
  /**
   * QUÉ CUENTA EL RELOJ DE LA PARED, y desde cuándo.
   *
   * Un solo reloj y un ancla, no tres cronómetros. El modo lo pone el mando —o lo pone
   * guardar una serie, que arranca el descanso— y la pared lo enseña. Es la regla del
   * salón: todo lo que cambia se lee en la pared, nunca sobre el mando.
   */
  const [modoReloj, setModoReloj] = useState<ModoDelReloj>('sesion')
  const [cuenta, setCuenta] = useState<{ desde: number; duracion: number } | null>(null)
  /**
   * Cuándo se abrió el salón. De aquí cuenta hacia arriba el modo sesión.
   *
   * Va en `useState` con inicializador y no en `useRef(Date.now())`: llamar a `Date.now()`
   * como argumento de `useRef` es una llamada impura EN CADA render —se evalúa siempre,
   * aunque el ref ya tenga valor— y `react-hooks/purity` es error en este repo. El
   * inicializador perezoso solo corre en el primer montaje, que es lo que se quiere.
   */
  const [abierto] = useState(() => Date.now())
  /**
   * Si la carga está ocupando el hueco del reloj.
   *
   * Es un dato que se CONSULTA, no un modo en el que se esté: se pide, se lee y se va
   * sola. Un cuarto modo del reloj para los kilos habría dejado la pared enseñando un
   * número que no cambia mientras el tiempo, que sí, no se ve.
   */
  const [cargaEnLaPared, setCargaEnLaPared] = useState(false)
  /**
   * CUÁNTO HA SUBIDO EL PANEL, de 0 a 1. Lo dice el propio panel.
   *
   * La sala se RETIRA mientras la lectura sube: es lo que convierte abrir el panel en
   * acercarse a lo que ya estaba —el salón sigue ahí, un poco más lejos— en vez de tapar
   * una pantalla con otra. Sin esto, la hoja se comía el salón de golpe y lo que quedaba
   * detrás era un fondo, no una sala.
   */
  const [avanceDelPanel, setAvanceDelPanel] = useState(0)
  /** Cuántas series se han guardado en esta visita. Solo sortea la frase. */
  const seriesDeLaVisita = useRef(0)

  // LA FRASE SE RETIRA SOLA. No lleva botón de cerrar y no lo va a llevar: es un acuse,
  // no un aviso — algo que se lee de reojo mientras se suelta la barra. Un mando para
  // quitarla convertiría celebrar una serie en una tarea más.
  // LA CARGA SE RETIRA SOLA. Cuatro segundos y pico: lo que se tarda en leer dos cifras y
  // volver a la barra. Sin esto, pedir la carga apagaría el reloj para el resto de la
  // sesión y habría que acordarse de devolverlo.
  useEffect(() => {
    if (!cargaEnLaPared) return
    const id = window.setTimeout(() => setCargaEnLaPared(false), 4200)
    return () => window.clearTimeout(id)
  }, [cargaEnLaPared])

  // Los dos relojes del gesto se paran al salir del salón. Un intervalo vivo después de
  // desmontar sigue llamando a `setW` sobre un componente que ya no está.
  useEffect(
    () => () => {
      window.clearTimeout(reloj.current)
      window.clearInterval(bomba.current)
    },
    [],
  )

  useEffect(() => {
    if (!logro) return
    const id = window.setTimeout(() => setLogro(null), LOGRO_MS)
    return () => window.clearTimeout(id)
  }, [logro])

  // Y el ejercicio retenido suelta el sitio antes que la frase: la sala cambia mientras se
  // sigue leyendo lo que se cerró, que es el relevo y no un corte.
  useEffect(() => {
    if (!retenido) return
    const id = window.setTimeout(() => setRetenido(null), RELEVO_MS)
    return () => window.clearTimeout(id)
  }, [retenido])

  /**
   * DÓNDE MIRA LA CÁMARA, para que las paredes puedan colgar sus cuadros.
   *
   * Arranca en el ángulo del patrón —el mismo con el que el visor monta la órbita— para
   * que en el primer fotograma los cuadros ya estén donde van. Sin ese valor de partida
   * saldrían todos amontonados en el centro y saltarían a su sitio al primer aviso, que
   * es exactamente el parpadeo que delata que la interfaz no está en la escena.
   */
  const [camara, setCamara] = useState<EstadoDeCamara>(() => ({
    azimut: patron?.camara.azimut ?? 0,
    elevacion: patron?.camara.elevacion ?? 6,
    distancia: ENCUADRE_SALA.distancia,
  }))
  const [lienzo, setLienzo] = useState({ ancho: 414, alto: 736 })
  const marcoRef = useRef<HTMLDivElement>(null)

  // El lienzo se mide del DOM y no se supone: la distancia focal sale de su alto, y con
  // un alto supuesto los cuadros caerían en un sitio y la sala se dibujaría en otro.
  useEffect(() => {
    const el = marcoRef.current
    if (!el) return
    const medir = () => setLienzo({ ancho: el.clientWidth, alto: el.clientHeight })
    medir()
    // LA GUARDA NO SOBRA. `ResizeObserver` no existe en jsdom, y sin esto los tests del
    // salón se caían con «ResizeObserver is not defined» — diez a la vez. Es la misma
    // lección que ya está escrita para `matchMedia` en `movimientoReducido`: lo que el
    // navegador de verdad trae, el de las pruebas puede no traerlo, y una medida es
    // exactamente lo que se puede tomar una vez si no hay con qué observar.
    if (typeof ResizeObserver !== 'function') {
      window.addEventListener('resize', medir)
      return () => window.removeEventListener('resize', medir)
    }
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [])
  /**
   * El arrastre en curso sobre el centro. Vive en un ref: no repinta hasta que decide.
   *
   * `x` e `y` son el ORIGEN del arrastre, que es lo que `capaTrasArrastre` mide, y
   * `capaAlOrigen` la capa que había en ese punto. Guardar la capa aquí en vez de leerla
   * del estado deja el manejador fuera del ciclo de repintado.
   */
  const gesto = useRef({
    vivo: false,
    x: 0,
    y: 0,
    capaAlOrigen: 0 as NivelW,
    /** De quién es este contacto. Se decide en los primeros píxeles y ya no cambia. */
    dueno: 'sin-decidir' as DuenoDelGesto,
    /** El origen del BARRIDO, que se muda a cada salto para no atropellar tres ejercicios. */
    xBarrido: 0,
  })


  const alBajarDedo = (e: ReactPointerEvent<HTMLDivElement>) => {
    gesto.current = {
      vivo: true,
      x: e.clientX,
      y: e.clientY,
      capaAlOrigen: w,
      dueno: 'sin-decidir',
      xBarrido: e.clientX,
    }
    // HUNDIRSE: aguantar el dedo sobre el cuerpo lo va atravesando capa a capa. El primer
    // escalón tarda `ESPERA` —eso es lo que separa tocar de hundir, y lo que impide que
    // empezar a orbitar cambie de capa— y a partir de ahí cae uno cada `ESCALON_MS`.
    window.clearTimeout(reloj.current)
    window.clearInterval(bomba.current)
    const desde = w
    const t0 = Date.now()
    reloj.current = window.setTimeout(() => {
      setHundiendo(true)
      const entrar = () => {
        const capa = capaTrasHundir(Date.now() - t0, desde)
        setW(capa)
        // Al fondo se para: hundir solo entra. Para salir se arrastra hacia arriba.
        if (capa >= 4) window.clearInterval(bomba.current)
      }
      entrar()
      bomba.current = window.setInterval(entrar, ESCALON_MS)
    }, ESPERA)
  }

  /**
   * El eje W, sin robarle el gesto a la órbita.
   *
   * Este manejador está en el ENVOLTORIO del visor y no en su lienzo: los eventos del
   * lienzo burbujean hasta aquí, así que se pueden leer sin interceptarlos. No se llama ni
   * a `preventDefault` ni a `stopPropagation` — el visor sigue recibiendo su arrastre
   * intacto y sigue orbitando. Si el gesto se declara horizontal, este lado se retira del
   * todo hasta que se levante el dedo.
   */
  const alMoverDedo = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesto.current
    if (!g.vivo) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y

    // DE QUIÉN ES ESTE CONTACTO. Se decide una vez, en los primeros píxeles, y no vuelve a
    // cambiar hasta que se levanta el dedo: sin ese bloqueo, un mismo arrastre cambiaría de
    // capa un poco, saltaría de ejercicio, y volvería a cambiar de capa.
    if (g.dueno === 'sin-decidir') {
      g.dueno = duenoDelGesto(dx, dy)
      if (g.dueno === 'sin-decidir') return
      // En cuanto se sabe que es un gesto y no una presión, hundirse se cancela.
      window.clearTimeout(reloj.current)
      window.clearInterval(bomba.current)
    }

    // DESLIZAR DE LADO PASA DE EJERCICIO, sin tener que hundir el dedo antes. Hasta el
    // 2026-09-05 había que apoyarlo 320 ms y solo entonces tirar, y por eso Bryan no podía
    // moverse por la app. La cámara ya no compite por este gesto: se orbita con dos dedos.
    if (g.dueno === 'barrido') {
      if (!sesionEnPantalla) return
      const total = sesionEnPantalla.ejercicios.length
      if (total < 2) return
      const avance = ejerciciosQueAvanza(e.clientX - g.xBarrido)
      if (avance === 0) return
      const actual =
        ejercicioManual ??
        Math.max(0, sesionEnPantalla.ejercicios.findIndex((x) => x.id === ejercicio?.id))
      setEjercicioManual(ejercicioTrasBarrido(actual, avance, total))
      // El origen se muda al punto donde saltó: cada ejercicio cuesta un barrido entero.
      g.xBarrido = e.clientX
      return
    }

    // Si el dedo se mueve, deja de ser una presión y pasa a ser un arrastre: hundirse se
    // cancela y el gesto pasa a ser del eje W.
    if (!siguePresionando(dx, dy)) {
      window.clearTimeout(reloj.current)
      window.clearInterval(bomba.current)
    }
    // El umbral, el sentido del dedo y los topes 0 y 4 los pone `gestoVertical.ts`.
    const siguiente = capaTrasArrastre(dy, g.capaAlOrigen)
    if (siguiente === g.capaAlOrigen) return
    // El origen se muda al punto donde cambió la capa: cada escalón vuelve a costar un
    // arrastre entero, así que un resbalón largo no atropella tres capas de una vez.
    g.x = e.clientX
    g.y = e.clientY
    g.capaAlOrigen = siguiente
    setW(siguiente)
  }

  const alSoltarDedo = () => {
    gesto.current.vivo = false
    gesto.current.dueno = 'sin-decidir'
    window.clearTimeout(reloj.current)
    window.clearInterval(bomba.current)
    setHundiendo(false)
  }

  /**
   * LO QUE SALE AL GUARDAR UNA SERIE.
   *
   * Tres cosas y en este orden: la ficha se cierra, sale la frase sobre la sala, y arranca
   * el descanso pautado —salvo que la serie fuera la última, porque el descanso es el que
   * va ENTRE series del mismo ejercicio—. Pasar al siguiente ejercicio no se programa
   * aquí: `ejercicioEnCurso` es el primero incompleto de la sesión, así que la sala cambia
   * sola en cuanto la base se actualiza.
   *
   * QUÉ SE LE PASA A LA DECISIÓN, y por qué no es el ejercicio de las props. El de las
   * props es el de ANTES de guardar: preguntarle si el ejercicio quedó completo diría que
   * no justo en la última serie. Se compone con la serie que `RegistroSerieSalon` acaba de
   * escribir —que la devuelve precisamente por esto— y así la cuenta sale de series
   * escritas y no de sumarle uno a un contador propio.
   */
  /**
   * CUANDO LA CUENTA CRUZA EL CERO.
   *
   * El reloj vuelve a contar la sesión y, si lo que terminó era el descanso, salta el
   * aviso sobre la sala: «a la barra». No se avisa al terminar el excéntrico —ese número
   * es una referencia de cómo bajar, no una cuenta que haya que respetar— y avisar de él
   * enseñaría que esta pantalla interrumpe por cualquier cosa.
   */
  const alTerminarLaCuenta = () => {
    const eraDescanso = modoReloj === 'descanso'
    setModoReloj('sesion')
    setCuenta(null)
    if (!eraDescanso || !ejercicio) return
    setLogro({
      rotulo: 'Descanso terminado',
      frase: `A la barra. Toca la serie ${ejercicio.series.length + 1}`,
    })
  }

  const alGuardarSerie = (serie: SerieRegistrada) => {
    setFichaAbierta(false)
    if (!ejercicio) return
    seriesDeLaVisita.current += 1
    const yaEscrito = { ...ejercicio, series: [...ejercicio.series, serie] }
    // SIN EMOJI: la frase sale a 32 px sobre el muro, y un pictograma ahí es un dibujo de
    // otro sistema pegado en una pared de hormigón. La pantalla de sesión las sigue
    // usando enteras; lo que cambia es la superficie sobre la que se escriben.
    const pasa = loQuePasaAlGuardar(yaEscrito, sinEmoji(frasePorSerie(seriesDeLaVisita.current)))
    setLogro({ rotulo: pasa.rotulo, frase: pasa.frase })
    // EL DESCANSO SE LEE EN LA PARED, no en una barra flotante. Era un cronómetro propio
    // pegado al borde de abajo con sus mandos de pausa y +15 s; ahora es un MODO del reloj
    // del muro, que es donde el diseño de la sala pone el tiempo. Lo que se pierde: pausar
    // y añadir quince segundos. Lo que se gana: una barra menos tapando el salón, y un
    // solo sitio donde mirar el tiempo en vez de dos.
    if (pasa.descansoSeg > 0) {
      setCuenta({ desde: Date.now(), duracion: pasa.descansoSeg })
      setModoReloj('descanso')
    }
    // El ejercicio que se acaba de cerrar se queda en la sala mientras se lee que se
    // cerró. `ejercicioEnCurso` ya habría pasado al siguiente sin esto.
    if (pasa.cierraElEjercicio) setRetenido(yaEscrito)
  }
  return (
    // `fixed inset-0`: el salón ES la pantalla. Va a `--z-elevado` (20) y no más arriba a
    // propósito — la barra de navegación vive en `--z-nav` (40) y tiene que seguir por
    // encima: una pantalla que se come la navegación deja al asesorado sin salida.
    <div
      data-salon="entrenar"
      data-w={w}
      ref={marcoRef}
      className="fixed inset-0 overflow-hidden bg-ink-1000"
      style={{ zIndex: 'var(--z-elevado)' }}
    >
      {/* ------------------------------------------------------------------ centro */}
      <div
        data-hueco="centro"
        className="absolute inset-0"
        // LA SALA SE ALEJA MIENTRAS SUBE LA LECTURA. Un 12 % es lo que basta: más y el
        // salón se lee como una miniatura, menos y no se nota que se ha retirado. Solo
        // `transform` —nada de `top` ni de `width`— para que sea una capa compuesta y no
        // una remaquetación por fotograma mientras el dedo arrastra.
        style={{
          transform: `scale(${(1 - avanceDelPanel * 0.12).toFixed(4)})`,
          transition: 'transform var(--dur-base) var(--ease-salida)',
        }}
        onPointerDown={conEjeW ? alBajarDedo : undefined}
        onPointerMove={conEjeW ? alMoverDedo : undefined}
        onPointerUp={conEjeW ? alSoltarDedo : undefined}
        onPointerCancel={conEjeW ? alSoltarDedo : undefined}
      >
        {conSujeto && patron ? (
          <>
            {/* EL SUJETO, A SANGRE Y POR DEBAJO DE TODA LA INTERFAZ. El visor se monta, no se reescribe:
                los números de la serie van al marcador de la pared de la sala 3D, que es
                la misma constante con la que se construye la estación de grabación, y `w`
                es la cuarta dimensión llegando al modelo. */}
            {/* EL CUERPO ACUSA QUE ESTÁ ARMADO: se levanta 22 px, crece un 6 % y se le
                enciende un halo. Sin eso, mantener el dedo dos segundos no tendría ninguna
                consecuencia visible y el gesto sería invisible — nadie descubre lo que no
                se ve, y peor: quien lo armara sin querer no sabría por qué el siguiente
                arrastre cambió de ejercicio en vez de orbitar. */}
            <div
              data-testigo="sujeto"
              data-hundiendo={hundiendo ? '' : undefined}
              className={SUJETO_A_SANGRE}
              style={{
                transition: 'transform var(--dur-informativo) var(--muelle-informativo), filter var(--dur-informativo)',
                // Mientras el dedo está dentro, el cuerpo lo dice: crece un pelo y se le
                // enciende un halo. Un gesto de presión sin acuse es invisible — y peor,
                // quien lo dispare sin querer no sabrá por qué cambió la capa.
                transform: hundiendo ? 'scale(1.04)' : undefined,
                filter: hundiendo ? 'drop-shadow(0 0 22px rgb(var(--accion-rgb) / 0.55))' : undefined,
              }}
            >
              <VisorPatron
                patron={patron}
                w={w}
                // EN EL SALÓN EL DEDO SUELTO ES DE NAVEGAR, no de la cámara: deslizar de
                // lado pasa de ejercicio, y se orbita con dos dedos, donde ya vivía el
                // pellizco. En el estudio del patrón sigue orbitando con uno.
                orbitaConUnDedo={false}
                nombreEjercicio={ejercicio?.nombre}
                alMirar={(c) =>
                  // Se compara antes de guardar: el bucle avisa en cada fotograma que
                  // cambia algo, y guardar un objeto nuevo cada vez re-renderizaría las
                  // paredes sesenta veces por segundo aunque la cámara esté quieta.
                  setCamara((v) =>
                    v.azimut === c.azimut && v.elevacion === c.elevacion && v.distancia === c.distancia
                      ? v
                      : c,
                  )
                }
                datos={
                  ejercicio
                    ? {
                        series: ejercicio.sets,
                        reps: ejercicio.repsDiana,
                        rir: ejercicio.rirObjetivo,
                      }
                    : undefined
                }
                // EL SUJETO BAJA EN LO QUE CUENTA LA PARED. El mando del reloj pone la
                // pared a contar el excéntrico a `SEGUNDOS_DE_EXCENTRICO` por repetición;
                // si el sujeto bajara en otro tiempo, el salón enseñaría dos tempos.
                tempo={{ excentricaSeg: SEGUNDOS_DE_EXCENTRICO }}
                // EL FANTASMA: lo que se hizo, sobre lo que hay que hacer. Hoy si hay medida
                // de hoy; la semana pasada si no; nada si no hay ninguna. No se inventa.
                fantasma={huellaDeReferencia(ejercicio, props.microcicloPrevio, leerHuellaArticular(ejercicio?.nombre))?.huella}
                // EL FANTASMA: lo que se hizo, sobre lo que hay que hacer. Hoy si hay medida
                // de hoy; la semana pasada si no; nada si no hay ninguna. No se inventa.
              />
            </div>

            {/* LA HABITACIÓN, por encima del lienzo y por debajo de los rótulos. Trazo y
                degradado: no tapa al sujeto, lo enmarca. */}
            <ArquitecturaSala />
          </>
        ) : (
          // El hueco `sinPatron` de `huecos.ts`: MISMO SALÓN, con su sala y sus paredes, y
          // sin sujeto en el centro. `SalaVacia` pone la habitación —muro, riel, suelo con
          // retícula y bordillo— y `SalonSinSujeto` cuelga de los muros la prescripción de
          // cardio, DENTRO de ella y no como hermana tendida por encima.
          //
          // Arriba se le deja libre la banda de los rótulos del muro: el día, el
          // cronómetro y la marquesina cuelgan ahí también los días sin sujeto, y la sala
          // empieza justo debajo en vez de pasarles por detrás.
          <>
            <div
              data-hueco="sinPatron"
              data-testigo="sala"
              className="absolute inset-x-0 top-[9rem]"
              // Las dos medidas de `SUELO_DEL_SALON`, y ahora por un motivo algo distinto
              // del que están escritas: lo que ocupa el suelo con ejercicio ya no es la
              // tarjeta del registro —que es una barra— sino la barra MÁS la cámara MÁS la
              // tira de «a continuación», que suman parecido. Sin ejercicio abajo solo
              // queda el material, y la sala se estira casi hasta el borde. Comprobado en
              // el navegador a 430 px: con la medida larga quedaba una franja negra entre
              // el suelo de la sala y el material.
              style={{
                bottom: ejercicio ? SUELO_DEL_SALON.conRegistro : SUELO_DEL_SALON.sinRegistro,
              }}
            >
              <SalaVacia>
                <SalonSinSujeto ejercicio={ejercicio} bloques={sesion?.bloquesCardio} />
              </SalaVacia>
            </div>

            {/* EL AMBIENTE, TAMBIÉN LOS DÍAS SIN SUJETO. El acabado del salón no puede
                depender de si hoy toca cardio: el contraluz rojo, las dos luces, la bruma
                y el grano se pintan igual. Lo que no se pinta es la habitación en trazo
                —`SalaVacia` ya trae la suya— ni el claroscuro, que multiplicando sobre un
                muro casi negro no tendría nada que hundir. */}
            <ArquitecturaSala variante="salaVacia" />
          </>
        )}

        {/* LAS CUATRO ESTACIONES, alrededor del cuerpo y sobre el suelo de la sala.
            El suelo se sitúa al 78 % del alto: es donde se apoyan los pies del sujeto en
            el encuadre del salón, y de ahí para arriba crecen el poste y su cartel. */}
        {conSujeto && (
          <EstacionesDelSujeto
            ejercicio={ejercicio}
            azimut={camara.azimut - (patron?.camara.azimut ?? 0)}
            suelo={Math.round(lienzo.alto * 0.78)}
            foco={estacionFija}
            onEnfocar={(clave) => setEstacionFija((v) => (v === clave ? undefined : clave))}
          />
        )}

        {/* EL VELO Y LA ESCALERA, las dos señales de dónde estás en el eje W. Van juntas
            bajo la MISMA condición que la prop que viaja al visor: si no hay cuerpo que
            atravesar, no se pintan. */}
        {conEjeW && (
          <>
            {/* EL VELO DE W. Cuanto más adentro, más se cierra la habitación alrededor del
                centro: apagar el entorno mientras se entra deja el cuerpo solo en el
                cuadro. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 transition-opacity duration-base ease-salida"
              style={{
                opacity: w * 0.1,
                background: 'radial-gradient(90% 70% at 50% 45%, transparent 0%, #05060700 40%, #050607 100%)',
              }}
            />

            {/* LA ESCALERA DEL EJE W SE HA IDO, y el gesto se queda.
                =========================================================================

                Eran cinco botones pegados al borde derecho: un mando de aplicación sobre
                la sala, y el último que quedaba. Bryan lo marcó el 2026-09-04 —«esos
                botones de la derecha, quítalos»— con el criterio de fondo de toda esta
                tanda: la interacción del entrenamiento se hace TOCANDO el salón, no
                pulsando controles puestos encima de él.

                Atravesar el cuerpo ya se hacía con el dedo —arrastre vertical sobre el
                sujeto— y ahora se hace además HUNDIENDO: mantener el dedo sobre el cuerpo
                se va metiendo capa a capa, de la piel al hueso. La escalera no aportaba un
                camino que no existiera; aportaba cinco círculos tapando la sala.

                Lo que se pierde y hay que decirlo: con teclado ya no hay forma de cambiar
                de capa. El velo sigue diciendo en cuál estás y `data-w` sigue saliendo al
                DOM, pero un gesto de presión no tiene equivalente de teclado.
                // DECISIÓN PENDIENTE: si hace falta, el sitio no es devolver la escalera
                // —es que las capas se puedan recorrer desde la ficha del ejercicio, que ya
                // es una superficie de controles con nombre. */}
          </>
        )}
      </div>

      {/* ----------------------------------------------------------------- paredes */}
      <ParedesDelSalon
        sesion={sesionEnPantalla}
        ejercicio={ejercicio}
        contenido={contenido}
          microcicloPrevio={props.microcicloPrevio}
          modo={modoReloj}
          anclas={{ abierto, cuenta: cuenta?.desde, duracion: cuenta?.duracion }}
          alTerminarLaCuenta={alTerminarLaCuenta}
          cargaEnLaPared={cargaEnLaPared}
          camara={camara}
          lienzo={lienzo}
          azimutDeEntrada={patron?.camara.azimut ?? 0}
        />

      {/* EL SUELO Y EL BORDE DE ABAJO.
          Aquí había un marco con `padding-bottom` del alto de la barra de navegación, con
          la idea de que `bottom: 0` significara «justo encima de la nav». **No lo
          significa**: el bloque contenedor de un hijo absoluto es la caja de RELLENO, que
          incluye el relleno, así que el `padding` no descontaba nada y todo lo que se
          apoyaba en `bottom` aterrizaba DEBAJO de la barra. Se ve en el navegador y no en
          los tests, porque en jsdom no hay maquetación. Ahora la barra se suma donde toca,
          una vez por pieza. */}
      <div className="pointer-events-none absolute inset-0">
        {/* ---------------------------------------------------------------- registro */}
        {/* La serie en curso, colapsada a una barra: qué serie es, con cuánto, cuántas
            reps y qué RIR, más el botón de guardar. Los mandos para cambiarlo están a un
            toque, debajo. Antes esto era una tarjeta grande y permanente que se comía el
            tercio inferior del cuerpo. */}

        {/* ---------------------------------------------------------------- logro
            LA FRASE, SOBRE LA SALA Y SIN CAJA. Un resplandor rojo desde el centro y dos
            líneas: de qué serie se habla y la frase. No captura el dedo —`pointer-events`
            apagado— porque durante esos 2,4 s la persona está soltando la barra, no
            mirando la pantalla: si tapara el gesto, celebrar costaría un toque. */}
        {logro && (
          <div
            data-logro
            aria-live="polite"
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-9 text-center"
            style={{
              zIndex: 'var(--z-elevado)',
              background:
                'radial-gradient(circle at 50% 45%, rgb(var(--accion-rgb) / 0.16), rgb(var(--ink-1000-rgb) / 0.94) 62%)',
            }}
          >
            <p className="muro-rotulo text-[10.5px] text-accion">{logro.rotulo}</p>
            <p className="font-display text-[32px] font-black uppercase leading-tight text-texto">
              {logro.frase}
            </p>
          </div>
        )}

        {/* LA SEMANA, EN UN TAMBOR. Se abre tocando el día y se cierra al elegir uno o al
            tocar fuera. Elegir NO empieza esa sesión: cambia qué sala se está viendo. */}
        {semanaAbierta && (
          <div className="pointer-events-auto absolute inset-0" style={{ zIndex: 'var(--z-elevado)' }}>
            <TamborDeLaSemana
              semana={props.semana}
              diaActual={diaElegido ?? props.semana.findIndex((d) => d.esHoy)}
              onElegir={(i) => {
                // Volver a HOY no se guarda como «un día elegido»: si se guardara, el
                // salón dejaría de seguir a la sesión de hoy cuando la agenda cambiara.
                setDiaElegido(props.semana[i]?.esHoy ? null : i)
                setSemanaAbierta(false)
              }}
              onCerrar={() => setSemanaAbierta(false)}
            />
          </div>
        )}

        {/* ----------------------------------------------------------------- rumbo
            LAS DOS BANDAS QUE DICEN DÓNDE ESTÁS EN LA SEMANA Y EN LA SESIÓN. Arriba, de
            quién es el día y qué toca; abajo, un punto por ejercicio con el actual
            encendido. Son las únicas dos capas del salón que no viven en el espacio, y por
            eso son también las más finas: sin caja, sin fondo y sin borde. */}
        <div className="pointer-events-none absolute inset-x-5 top-[46px]">
          <BarraDeSesion
            sesion={sesionEnPantalla}
            semana={props.semana}
            diaElegido={diaElegido}
            onAbrirSemana={() => setSemanaAbierta(true)}
          />
        </div>

        <div
          className="pointer-events-none absolute inset-x-5"
          // POR ENCIMA DEL TIRADOR DEL PANEL. A 1,35rem los puntos existían, medían
          // 350x4 y estaban a y 740 — y `elementFromPoint` devolvía el botón del tirador:
          // se pintaban debajo de él. Un elemento que está en el DOM, tiene tamaño y no se
          // ve es el fallo más callado que hay, y solo lo dice preguntarle al navegador
          // quién manda en ese píxel.
          style={{ bottom: 'calc(var(--tope-nav) + 3.4rem)' }}
        >
          <PuntosDeEjercicio
            sesion={sesionEnPantalla}
            ejercicioId={ejercicio?.id}
            alIr={setEjercicioManual}
          />
        </div>

        {/* ----------------------------------------------------------------- mando
            EL MANDO DEL RELOJ. Va desnudo —sin aro, sin etiquetas y sin flechas— y en la
            esquina donde cae el pulgar. Se tira a la izquierda y la pared cuenta el
            descanso; a la derecha, el excéntrico; hacia arriba enseña la carga; abajo o al
            centro vuelve al tiempo de sesión.

            TODO LO QUE CAMBIA SE LEE EN LA PARED, y por eso el mando no dice nada: si
            rotulara sus cuatro salidas habría dos sitios donde mirar para una sola cosa, y
            la mano ya sabe dónde está sin verlo. */}
        {ejercicio && (
          // LOS DOS MANDOS, UNO SOBRE OTRO Y AL ALCANCE DEL PULGAR. El del reloj y el de
          // la cámara: los dos únicos aparatos que se OPERAN en este salón, con la misma
          // materia y el mismo tamaño. Todo lo demás se lee.
          <div className="absolute bottom-[calc(var(--tope-nav)+4.5rem)] right-3 flex flex-col items-center gap-2.5">
            <CamaraDelSalon ejercicio={ejercicio} microcicloId={props.microciclo.id} />
            <Joystick
              encendido={modoReloj !== 'sesion' || cargaEnLaPared}
              onSoltar={(rumbo) => {
                if (rumbo === 'arriba') {
                  // La carga ocupa el hueco del reloj un rato y se va sola: es un dato que
                  // se consulta, no un modo en el que se esté.
                  setCargaEnLaPared(true)
                  return
                }
                if (rumbo === 'izquierda' || rumbo === 'derecha') {
                  const modo: ModoDelReloj = rumbo === 'izquierda' ? 'descanso' : 'excentrico'
                  const duracion = duracionDelModo(modo, ejercicio)
                  // Sin duración no hay cuenta que arrancar —un ejercicio sin descanso
                  // pautado, por ejemplo—: el reloj se queda como está en vez de plantar
                  // un 0:00 que no cuenta nada.
                  if (duracion <= 0) return
                  setCuenta({ desde: Date.now(), duracion })
                  setModoReloj(modo)
                  return
                }
                setModoReloj('sesion')
                setCuenta(null)
              }}
            />
          </div>
        )}

        {/* --------------------------------------------------------------- ficha
            LA FICHA DE LA SERIE, que entra desde el borde izquierdo. Va aquí y no colgada
            de un muro a propósito: no es un cuadro de la sala, es algo que se saca DELANTE
            de ella y se guarda. Y va antes del panel de abajo en el árbol para que, si los
            dos estuvieran fuera, la ficha no tape la hoja: lo último que se abrió manda. */}
        {ejercicio && (
          <CajonDeSerie
            microcicloId={props.microciclo.id}
            ejercicio={ejercicio}
            abierto={fichaAbierta}
            onAbrir={() => setFichaAbierta(true)}
            onCerrar={() => setFichaAbierta(false)}
            onGuardado={alGuardarSerie}
          />
        )}

        {/* ----------------------------------------------------------- panelInferior */}
        <PanelInferior
          microciclo={props.microciclo}
          ruta={props.ruta}
          recuperacion={props.recuperacion}
          progresoPct={props.progresoPct}
          estadisticas={props.estadisticas}
          requisitos={props.requisitos}
          semana={props.semana}
          sesionCta={props.sesionCta}
          notas={props.notas}
          alPanel={contenido?.alPanel ?? []}
          contenido={contenido}
          material={implementosDeSesion(sesion)}
          bloquesCardio={sesion?.bloquesCardio}
          nombreEjercicio={ejercicio?.nombre}
          ejercicio={ejercicio}
          ritmo={ritmo}
          sesion={sesion}
          patron={patron}
          onAvance={setAvanceDelPanel}
        />
      </div>
    </div>
  )
}

export default SalonEntrenar

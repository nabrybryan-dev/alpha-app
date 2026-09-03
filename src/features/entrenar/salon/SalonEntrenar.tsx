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
import type { EjercicioPrescrito, ItemMarcable, Microciclo, Sesion } from '../../../domain/types'
import { useMovimiento } from '../../../app/movimientoContexto'
import { VisorPatron } from '../visor/VisorPatron'
import { ENCUADRE_SALA } from '../escena/sala'
import type { CamaraDelSalon as EstadoDeCamara } from './paredes/geometriaDeCuadro'
import { implementosDeSesion } from './implementos/implementosDeSesion'
import { capaTrasArrastre } from '../capas/gestoVertical'
import { CAPAS_W, SUELO_DEL_SALON, type NivelW } from './huecos'
import { contenidoPared } from './paredes/contenidoPared'
import { ParedesDelSalon } from './paredes/ParedesDelSalon'
import { useRitmoDelSalon } from './paredes/useRitmoDelSalon'
import { ArquitecturaSala } from './sala/ArquitecturaSala'
import { PanelInferior } from './panel/PanelInferior'
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
  const ejercicio = ejercicioEnCurso(sesion)

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
  const gesto = useRef({ vivo: false, x: 0, y: 0, capaAlOrigen: 0 as NivelW })

  const alBajarDedo = (e: ReactPointerEvent<HTMLDivElement>) => {
    gesto.current = { vivo: true, x: e.clientX, y: e.clientY, capaAlOrigen: w }
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
    // Horizontal: es una órbita y no es nuestra. Ortogonalidad, hecha código.
    if (Math.abs(dx) > Math.abs(dy)) {
      g.vivo = false
      return
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
            <div data-testigo="sujeto" className={SUJETO_A_SANGRE}>
              <VisorPatron
                patron={patron}
                w={w}
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

            {/* LA ESCALERA DEL EJE W. Cinco peldaños, sin una sola letra: el nombre de cada
                capa va en `aria-label`, que es un atributo y no un nodo de texto. Va al
                borde derecho y a la altura de la franja libre —entre la tabla de series y
                el material—, que es la única banda del cuadro donde no cruza nada. */}
            <div
              className="absolute right-1 top-[46%] flex -translate-y-1/2 flex-col gap-1.5"
              role="group"
              aria-label="Capa del cuerpo"
            >
              {CAPAS_W.map((capa) => (
                <button
                  key={capa.id}
                  type="button"
                  aria-label={capa.nombre}
                  aria-pressed={w === capa.w}
                  onClick={() => setW(capa.w)}
                  className={`press h-7 w-7 rounded-full border transition-colors duration-base ${
                    w === capa.w ? 'border-accion bg-accion/25' : 'border-white/15 bg-ink-900/60'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mx-auto block h-1.5 w-1.5 rounded-full ${
                      w >= capa.w ? 'bg-accion' : 'bg-silver-500/50'
                    }`}
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ----------------------------------------------------------------- paredes */}
      <ParedesDelSalon
        microciclo={microciclo}
        sesion={sesion}
        ejercicio={ejercicio}
        contenido={contenido}
        ritmo={ritmo}
        notas={props.notas}
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
          sesion={sesion}
          patron={patron}
        />
      </div>
    </div>
  )
}

export default SalonEntrenar

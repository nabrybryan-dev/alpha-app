import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
import { VisorPatron } from '../visor/VisorPatron'
import { capaTrasArrastre } from '../capas/gestoVertical'
import { CAPAS_W, SUELO_DEL_SALON, type NivelW } from './huecos'
import { contenidoPared } from './paredes/contenidoPared'
import { PanelPared } from './paredes/PanelPared'
import { PanelInferior } from './panel/PanelInferior'
import { RegistroSerieSalon } from './registro/RegistroSerieSalon'
import { SalaVacia } from './sinPatron/SalaVacia'
import { SalonSinSujeto, tienePatronDeMovimiento } from './sinPatron/SalonSinSujeto'

/**
 * EL SALÓN: la pantalla `/entrenar`, con el sujeto en el centro.
 *
 * Antes esto era una columna con scroll —doce bloques, unos ciento veinte nodos de texto,
 * todos al mismo nivel y todos compitiendo—. Ahora es una habitación a pantalla completa:
 * el sujeto anatómico ocupa el centro, lo corto y esencial del ejercicio va colgado en
 * las paredes, la única acción del salón está en el suelo, y **todo lo largo sigue
 * estando**, a un dedo de distancia, en el panel que sube desde el borde de abajo.
 *
 * Nada de lo que la app decía ha dejado de decirse. Lo que ha cambiado es dónde está.
 *
 * ## Los cinco huecos, y ni uno más
 *
 * El reparto no lo decide este archivo: lo declara `huecos.ts`, que es la frontera entre
 * el motor y la interfaz. Aquí solo se montan los cinco, cada uno con su marca
 * `data-hueco` para que se pueda auditar desde fuera:
 *
 * - `centro` — el sujeto, o el aviso de que este ejercicio no tiene modelo;
 * - `paredes` — los ocho campos cortos de `contenidoPared()`;
 * - `registro` — carga, repeticiones y RIR, en el suelo;
 * - `panelInferior` — lo largo, íntegro, deslizando hacia arriba;
 * - `sinPatron` — la MISMA sala con el centro vacío, cuando no hay sujeto que enseñar.
 *
 * ## La regla dura de la vista inicial
 *
 * Con el panel bajado, **no hay un solo nodo de texto por encima del canvas fuera de los
 * huecos declarados**. Ni títulos sueltos, ni tarjetas, ni una barra de estado. Por eso
 * cada cosa que se pinta cuelga de un contenedor con `data-hueco`, el tirador del panel
 * lleva su nombre en `aria-label` en vez de escrito, y la escalera del eje W es una
 * columna de peldaños sin letras. La comprobación es mecánica: quitar del árbol los
 * subárboles `[data-hueco]` tiene que dejar el salón sin texto.
 *
 * ## La cuarta dimensión, y qué hace de verdad
 *
 * A los tres ejes del espacio se le suma W, que ATRAVIESA el cuerpo en vez de rodearlo:
 * el dedo en horizontal orbita —ese gesto lo sirve el propio visor sobre su canvas— y el
 * dedo en vertical sube y baja por las cinco capas, de la piel al hueso. Los dos gestos
 * son ortogonales a propósito: orbitar nunca cambia de capa y cambiar de capa nunca mueve
 * la cámara, porque un gesto que hiciera las dos cosas dejaría al asesorado sin saber si
 * se ha movido él o se ha movido el cuerpo.
 *
 * **Lo que W hace, dicho sin adornos:** el escalón es estado de este salón y sale por
 * cuatro sitios a la vez. Tres son señales de dónde estás —`data-w`, la escalera de
 * peldaños y el velo que cierra la habitación según se entra— y el cuarto es el que
 * cuenta: viaja al `VisorPatron` como prop `w`, y con él el visor deja de dibujar
 * siempre lo mismo. Quien manda entonces es `capas/nivelesAnatomicos.ts`, que declara
 * qué músculos, huesos y porciones pasivas se ven en cada nivel; el visor solo lo
 * obedece. Sin esa prop el modelo era el mismo en las cinco capas y el eje era un velo
 * con una escalera al lado.
 *
 * Las tres señales se quedan **además** del modelo, no en su lugar: el cuerpo cambiando
 * dice qué estás viendo, pero no cuánto queda por debajo ni cómo salir; eso lo dicen los
 * peldaños.
 *
 * **Y sin sujeto no hay eje.** Las cuatro salidas cuelgan de `conEjeW`: sin cuerpo que
 * atravesar no se monta la escalera, no se pinta el velo y el gesto vertical ni se
 * escucha. W es la profundidad del cuerpo, no un ajuste de la pantalla.
 *
 * ## La aritmética del gesto no vive aquí
 *
 * Cuántos píxeles son un escalón, hacia dónde entra el dedo y dónde están los topes lo
 * dice `capas/gestoVertical.ts` con una función pura. Este archivo pone el origen del
 * arrastre y lo vuelve a poner cuando la capa cambia —que es cómo el módulo prescribe
 * encadenar saltos en un mismo contacto— pero no suma ni recorta. Un segundo umbral
 * escrito aquí sería un segundo eje W que se separaría del primero al primer ajuste.
 */

export interface SalonEntrenarProps {
  microciclo: Microciclo
  ruta: RutaAsesorado
  recuperacion: Recuperacion
  /** Progreso al siguiente nivel, ya calculado por el dominio. */
  progresoPct: number
  estadisticas: readonly MiniEstadistica[]
  competencias: readonly Competencia[]
  requisitos: readonly RequisitoNivel[]
  semana: readonly DiaRuta[]
  sesionCta?: { id: string; nombre: string; empezada: boolean; esDeHoy: boolean }
  notas: ItemMarcable[]
  /**
   * La sesión que manda hoy: de ella salen el ejercicio de las paredes y el del registro.
   *
   * Opcional porque la semana puede no tener ninguna pendiente. Sin sesión el salón sigue
   * abriéndose —el panel es la Ruta entera y esa no depende de que haya sesión hoy—, pero
   * las paredes y el suelo se quedan vacíos: no hay ejercicio del que hablar.
   */
  sesion?: Sesion
}

/** El ejercicio del que habla el salón: el primero que queda por terminar. */
function ejercicioEnCurso(sesion: Sesion | undefined): EjercicioPrescrito | undefined {
  if (!sesion) return undefined
  return sesion.ejercicios.find((e) => !ejercicioCompleto(e)) ?? sesion.ejercicios[0]
}

export function SalonEntrenar(props: SalonEntrenarProps) {
  const { microciclo, sesion } = props
  const ejercicio = ejercicioEnCurso(sesion)

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

  /**
   * EL EJE W SOLO EXISTE SI HAY CUERPO QUE ATRAVESAR.
   *
   * Bryan lo vio en el iPhone: los cinco peldaños encendidos a la derecha de una
   * pantalla sin sujeto. Atravesar la nada. W no es un ajuste de la pantalla —no cambia
   * el brillo, ni el detalle, ni la cámara—: es la profundidad DEL CUERPO, de la piel al
   * hueso. Sin cuerpo no hay piel ni hay hueso, así que no hay escalón que subir, y una
   * escalera que responde al dedo sin cambiar nada de lo que se ve es peor que no tener
   * escalera: enseña un mando roto.
   *
   * De ahí que las cuatro salidas del eje —el gesto vertical, el velo, la escalera y la
   * prop que viaja al visor— cuelguen todas de esta condición, y no solo la escalera.
   * Dejar el gesto vivo con la escalera escondida sería mover un estado que ya no se ve.
   *
   * `data-w` se queda puesto en las dos ramas: es la capa en la que ESTÁ el salón, y sin
   * sujeto es la piel —el escalón 0—, que es justo lo que `huecos.ts` declara para este
   * hueco (`sinPatron.visibleEnW: [0]`).
   */
  const conEjeW = conSujeto && !!patron

  const [w, setW] = useState<NivelW>(0)
  /**
   * El arrastre en curso sobre el centro. Vive en un ref: no repinta hasta que decide.
   *
   * `x` e `y` son el ORIGEN del arrastre, que es lo que `capaTrasArrastre` mide, y
   * `capaAlOrigen` la capa que había en ese punto. Guardar la capa aquí en vez de leerla
   * del estado deja el manejador fuera del ciclo de repintado: entre dos `pointermove`
   * seguidos no ha tenido por qué correr un render, y una `w` de hace un cuadro haría
   * que el segundo escalón de un mismo dedo saliera del primero.
   */
  const gesto = useRef({ vivo: false, x: 0, y: 0, capaAlOrigen: 0 as NivelW })

  const alBajarDedo = (e: ReactPointerEvent<HTMLDivElement>) => {
    gesto.current = { vivo: true, x: e.clientX, y: e.clientY, capaAlOrigen: w }
  }

  /**
   * El eje W, sin robarle el gesto a la órbita.
   *
   * Este manejador está en el ENVOLTORIO del visor y no en su canvas: los eventos del
   * canvas burbujean hasta aquí, así que se pueden leer sin interceptarlos. No se llama
   * ni a `preventDefault` ni a `stopPropagation` — el visor sigue recibiendo su arrastre
   * intacto y sigue orbitando. Si en algún momento el gesto se declara horizontal, este
   * lado se retira del todo hasta que se levante el dedo.
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
    // El umbral, el sentido del dedo y los topes 0 y 4 los pone `gestoVertical.ts`. Aquí
    // no se compara contra ningún número: si la capa no ha cambiado, el arrastre todavía
    // no llega y no hay nada que hacer.
    const siguiente = capaTrasArrastre(dy, g.capaAlOrigen)
    if (siguiente === g.capaAlOrigen) return
    // El origen se muda al punto donde cambió la capa, que es lo que el módulo prescribe
    // para encadenar escalones sin levantar el dedo: cada escalón vuelve a costar un
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
      className="fixed inset-0 overflow-hidden bg-ink-900"
      style={{ zIndex: 'var(--z-elevado)' }}
    >
      {/* ------------------------------------------------------------------ centro */}
      <div
        data-hueco="centro"
        className="absolute inset-0 flex items-center justify-center"
        onPointerDown={conEjeW ? alBajarDedo : undefined}
        onPointerMove={conEjeW ? alMoverDedo : undefined}
        onPointerUp={conEjeW ? alSoltarDedo : undefined}
        onPointerCancel={conEjeW ? alSoltarDedo : undefined}
      >
        {conSujeto && patron ? (
          <div className="w-full px-2">
            {/* EL VISOR SE MONTA, NO SE REESCRIBE. Los números de la serie van al
                marcador de la pared de la sala 3D, que es la misma constante con la que
                se construye la estación de grabación: ninguna cifra escrita dos veces.

                Y `w` es la cuarta dimensión llegando al modelo: el visor la resuelve
                contra `nivelesAnatomicos.ts` y dibuja las piezas de ESE nivel. El patrón
                no cambia con ella —el sujeto sigue ejecutando su gesto capa a capa—
                porque el eje decide qué se ve, no qué se hace. */}
            <VisorPatron
              patron={patron}
              w={w}
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
        ) : (
          // El hueco `sinPatron` de `huecos.ts`: MISMO SALÓN, con su sala y sus paredes,
          // y sin sujeto en el centro. Dos piezas y ni una más: `SalaVacia` pone la
          // habitación —muro, riel del panel, suelo con retícula y bordillo, trazados
          // con los números de `SALA` y `BAHIA`— y `SalonSinSujeto` cuelga de los muros
          // la prescripción de cardio. Ninguna de las dos abre un contexto WebGL: sin
          // gesto que enseñar no hay nada que animar ni que orbitar.
          //
          // UNA DENTRO DE LA OTRA, Y NO UNA AL LADO DE LA OTRA. Aquí estaba el fallo que
          // Bryan fotografió: montadas como hermanas, las dos se tendían sobre la pantalla
          // entera, así que los cuatro datos se anclaban al borde de arriba del SALÓN
          // mientras la habitación empezaba un tercio más abajo. Salían cuatro tarjetas
          // planas sobre negro con una franja vacía debajo — el dashboard que este salón
          // vino a quitar, reubicado arriba. Anidadas, el `inset-0` de la prescripción es
          // el rectángulo de la sala, y colgar un dato del muro vuelve a ser meterlo en la
          // caja del muro.
          //
          // Y el hueco se estira de arriba abajo en vez de dejar que la sala se centre:
          // sin franja libre por encima del techo no queda sitio donde nada pueda flotar.
          // Cuánto se le deja al suelo lo dice `SUELO_DEL_SALON`, y son dos medidas porque
          // con ejercicio abajo está la tarjeta del registro y sin él no.
          <div
            data-hueco="sinPatron"
            className="absolute inset-x-0 top-0"
            style={{
              bottom: ejercicio ? SUELO_DEL_SALON.conRegistro : SUELO_DEL_SALON.sinRegistro,
            }}
          >
            <SalaVacia>
              <SalonSinSujeto ejercicio={ejercicio} bloques={sesion?.bloquesCardio} />
            </SalaVacia>
          </div>
        )}

        {/* EL VELO Y LA ESCALERA, las dos señales de dónde estás en el eje W. Van juntas
            bajo la MISMA condición que la prop que viaja al visor: si no hay cuerpo que
            atravesar, no se pintan. Un velo que se cierra sobre una habitación vacía y
            una escalera que no cambia nada de lo que se ve son dos mandos que mienten. */}
        {conEjeW && (
          <>
            {/* EL VELO DE W. Acusa el escalón: cuanto más adentro, más se cierra la
                habitación alrededor del centro. Ahora el modelo también cambia con `w`,
                así que el velo ya no es lo único que responde al gesto — se queda porque
                hace otra cosa: apagar el entorno mientras se entra deja el cuerpo solo
                en el cuadro. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 transition-opacity duration-base ease-salida"
              style={{
                opacity: w * 0.1,
                background: 'radial-gradient(90% 70% at 50% 45%, transparent 0%, #05060700 40%, #050607 100%)',
              }}
            />

            {/* LA ESCALERA DEL EJE W. Cinco peldaños, sin una sola letra: el nombre de
                cada capa va en `aria-label`, que es un atributo y no un nodo de texto,
                así que la regla de la vista inicial se cumple sin dejar a nadie sin
                saber qué es esto. Es la alternativa con el dedo quieto al arrastre
                vertical — y la única forma de recorrer el eje con teclado. */}
            <div
              className="absolute right-1.5 top-1/2 flex -translate-y-1/2 flex-col gap-1.5"
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
                  className={`h-7 w-7 rounded-full border transition-colors duration-base ${
                    w === capa.w
                      ? 'border-accion bg-accion/25'
                      : 'border-white/15 bg-ink-900/60'
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
      {contenido && (
        <div data-hueco="paredes" className="pointer-events-none absolute inset-0">
          <PanelPared contenido={contenido} />
        </div>
      )}

      {/* El suelo y el borde de abajo van dentro de un marco con hueco para la barra de
          navegación. Para un hijo absoluto el bloque contenedor es la CAJA DE RELLENO,
          así que `bottom: 0` aquí significa «justo encima de la nav» sin tener que
          repetir el `calc()` en cada pieza. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ paddingBottom: 'var(--tope-nav)' }}
      >
        {/* ---------------------------------------------------------------- registro */}
        {ejercicio && (
          <div
            data-hueco="registro"
            className="pointer-events-auto absolute inset-x-0 bottom-[52px] px-3"
          >
            <RegistroSerieSalon
              // La `key` remonta el registro cuando cambia la serie: el borrador arranca
              // en `useState`, que solo corre en el primer montaje, y sin remontar la
              // serie 2 saldría con lo que se tecleó en la 1.
              key={`${ejercicio.id}-${ejercicio.series.length + 1}`}
              microcicloId={microciclo.id}
              ejercicio={ejercicio}
            />
          </div>
        )}

        {/* ----------------------------------------------------------- panelInferior */}
        <PanelInferior
          microciclo={props.microciclo}
          ruta={props.ruta}
          recuperacion={props.recuperacion}
          progresoPct={props.progresoPct}
          estadisticas={props.estadisticas}
          competencias={props.competencias}
          requisitos={props.requisitos}
          semana={props.semana}
          sesionCta={props.sesionCta}
          notas={props.notas}
          alPanel={contenido?.alPanel ?? []}
          bloquesCardio={sesion?.bloquesCardio}
          nombreEjercicio={ejercicio?.nombre}
        />
      </div>
    </div>
  )
}

export default SalonEntrenar

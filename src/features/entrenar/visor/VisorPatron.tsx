import { useEffect, useRef, useState } from 'react'
import { M4 } from '../../../domain/patrones/algebra'
import type { Patron } from '../../../domain/patrones/catalogo'
import { accionesPrincipales, fraseDelPatron, NOMBRE_DE_ROL, segmentosDe } from '../../../domain/patrones/acciones'
import { NOMBRE_DE_PLANO, NOMBRE_DE_TIPO } from '../../../domain/patrones/articulaciones'
import {
  CAMPO_VISUAL,
  DURACION_CICLO,
  encuadrar,
  esqueletoEnFase,
  faseDeTiempo,
  guias,
  lineaDePeso,
  trazaDelPatron,
} from '../../../domain/patrones/escena'
import { construirHuesos } from '../../../domain/patrones/huesos'
import { BAHIA, construirLaboratorio } from '../../../domain/escenario/laboratorio'
import { construirSala, elevacionDelSalon, ENCUADRE_SALA, SALA, type DatosDeSerie } from '../escena/sala'
import { pasoDelVaiven } from './vaivenDeLaSala'
import { construirImplementos, implementosDeEscena, type EscenaDeImplementos } from '../escena/implementos'
import { construirTripode, type Colocacion } from '../escena/tripode'
import { Malla } from '../../../domain/patrones/malla'
import { resolver } from '../../../domain/patrones/esqueleto'
import {
  activacionDe,
  colorDeMusculo,
  construirMusculos,
  longitudesEnReposo,
  MUSCULOS,
} from '../../../domain/patrones/musculos'
import { useMovimientoReducido } from '../../../components/ui/movimientoReducido'
import { camaraAbierta } from '../camaraAbierta'
import type { NivelW } from '../salon/huecos'
import { NIVEL_POR_W } from '../capas/nivelesAnatomicos'
import { construirMusculosDeNivel, mallasDelSujeto } from '../capas/mallaDelNivel'
import { IconoPausa, IconoReproducir } from '../../../components/ui/Icono'
import { FONDO_ESTUDIO } from './motor'

type Capa = 'ambas' | 'musculo' | 'hueso'

/**
 * Se calculan una sola vez para toda la vida de la app: el esqueleto es
 * geometría fija —la mueve el shader— y las longitudes en reposo son la línea
 * base contra la que se mide cuánto se acorta cada músculo.
 */
let huesosCache: ReturnType<typeof construirHuesos> | null = null

/**
 * La bahía de medida: el suelo, la placa, el bordillo y el estadiómetro.
 *
 * Se cachea como los huesos y por el mismo motivo: es geometría fija que no depende
 * del patrón ni de la fase, así que reconstruirla en cada cambio de capa serían miles
 * de vértices recalculados para dibujar exactamente lo mismo.
 *
 * Va con hueso 0 —la identidad— así que entra en la misma malla que el sujeto y se
 * dibuja en la misma llamada. El motor no se entera de que existe.
 */
let laboratorioCache: Malla | null = null

function laboratorio(): Malla {
  if (!laboratorioCache) {
    laboratorioCache = new Malla()
    construirLaboratorio(laboratorioCache)
  }
  return laboratorioCache
}

/**
 * La sala se cachea POR SUS NÚMEROS, no a secas.
 *
 * Las paredes y la estación de grabación no cambian nunca, pero los marcadores llevan
 * cifras de siete segmentos hechas de geometría: cambiar un número es reconstruir esos
 * dígitos. Cachear por el trío evita rehacer la sala entera en cada fotograma y a la
 * vez deja que el marcador reaccione cuando la serie avanza — que es el único momento
 * en que TIENE que cambiar.
 */
let salaCache: { clave: string; malla: Malla } | null = null

function sala(datos: DatosDeSerie, azimutDeEntrada: number): Malla {
  // El ángulo entra en la clave: si no, cambiar de ejercicio dejaría el marcador del muro
  // de enfrente colgado donde lo puso el ejercicio anterior.
  const clave = `${datos.series}|${datos.reps}|${datos.rir}|${azimutDeEntrada}`
  if (!salaCache || salaCache.clave !== clave) {
    const malla = new Malla()
    construirSala(malla, datos, azimutDeEntrada)
    salaCache = { clave, malla }
  }
  return salaCache.malla
}

/**
 * Los implementos se cachean POR EL EJERCICIO, pero se CONSTRUYEN cada fotograma.
 *
 * La diferencia importa y es la razón de que aquí solo se guarde la escena y no la
 * malla: un implemento cuelga del esqueleto de la fase que se está dibujando —si el
 * sujeto baja, la barra baja con él—, así que su geometría cambia sesenta veces por
 * segundo. Lo que no cambia es QUÉ implementos hay, y eso es lo que se cachea.
 */
let escenaImplementosCache: { clave: string; escena: EscenaDeImplementos } | null = null

function escenaDeImplementos(categoria: string, nombre: string): EscenaDeImplementos {
  const clave = `${categoria}|${nombre}`
  if (!escenaImplementosCache || escenaImplementosCache.clave !== clave) {
    escenaImplementosCache = { clave, escena: implementosDeEscena(categoria, nombre) }
  }
  return escenaImplementosCache.escena
}

/**
 * El trípode se cachea POR SU COLOCACIÓN. Mientras no se mueva, es geometría fija; en
 * cuanto el asesorado toca un mando, hay que rehacerlo — y solo a él, no la sala entera.
 */
let tripodeCache: { clave: string; malla: Malla } | null = null

function tripode(c: Colocacion): Malla {
  const clave = `${c.anguloGrados.toFixed(1)}|${c.distancia.toFixed(2)}|${c.altura.toFixed(2)}`
  if (!tripodeCache || tripodeCache.clave !== clave) {
    const malla = new Malla()
    construirTripode(malla, c)
    tripodeCache = { clave, malla }
  }
  return tripodeCache.malla
}

/** La colocación de partida: la que la sala propone y la puerta de encuadre aprueba. */
const COLOCACION_INICIAL: Colocacion = {
  anguloGrados: SALA.estacion.anguloGrados,
  distancia: SALA.estacion.distancia,
  altura: SALA.estacion.altura,
}

let reposoCache: Record<string, number> | null = null
function precalculado() {
  huesosCache ??= construirHuesos()
  reposoCache ??= longitudesEnReposo(resolver({}, [0, 0.95, 0], [0, 0, 0]))
  return { huesos: huesosCache, reposo: reposoCache }
}

/**
 * QUÉ PARTES DE LA ESCENA SE DEJAN FUERA DE ESTE DIBUJO.
 *
 * Se lee del atributo `data-sin` del propio lienzo —una lista separada por comas— y
 * existe por un problema que no tiene otra salida: el testigo comprueba que un elemento
 * se ve APAGÁNDOLO y contando los píxeles que cambian, y eso funciona mientras cada
 * elemento sea un nodo del DOM. La sala, el hierro y la estación no lo son: son
 * geometría dentro de un único `<canvas>`, y no hay nodo que esconder.
 *
 * Hasta el 2026-09-02 el acta lo resolvía midiendo las capas SVG/HTML que se pintan
 * ENCIMA del lienzo, y por eso daba `sala` e `implementos` en verde mientras
 * `construirSala` y `construirImplementos` no tenían una sola llamada: certificaba el
 * cartel, no la sala.
 *
 * Con esto el testigo apaga una PARTE de la malla y vuelve a medir, que es la misma
 * resta de siempre aplicada donde hacía falta. No es un modo de depuración escondido:
 * sin el atributo no cambia nada, y el atributo solo lo pone quien levanta el acta.
 */
const PARTES_DE_ESCENA = ['sala', 'camara', 'implementos', 'sujeto', 'bahia'] as const

function partesOmitidas(lienzo: HTMLCanvasElement | null): Set<string> {
  const crudo = lienzo?.dataset.sin
  if (!crudo) return new Set()
  return new Set(
    crudo
      .split(',')
      .map((t) => t.trim())
      .filter((t) => (PARTES_DE_ESCENA as readonly string[]).includes(t)),
  )
}

interface VisorPatronProps {
  patron: Patron
  /**
   * Los números de la serie que se está haciendo, que son los que van al marcador de
   * la pared. Opcional a propósito: sin ellos no se construyen ni la sala ni el
   * trípode, y el visor se queda con la bahía — que es lo que hace falta cuando esto
   * se abre para estudiar el patrón y no para entrenar.
   */
  datos?: DatosDeSerie
  /**
   * Si se dibuja el escenario alrededor del sujeto: la bahía de medida y, cuando hay
   * `datos`, también la sala y el trípode.
   *
   * Se puede apagar para mirar solo el cuerpo. No es un modo de depuración: al
   * estudiar una articulación aislada el escenario es ruido, y en las
   * demostraciones el sujeto ni siquiera se apoya en el suelo.
   */
  conEscenario?: boolean
  /**
   * EL CUARTO EJE: en qué escalón de W está el sujeto, de la piel (0) al hueso (4).
   *
   * Opcional a propósito, y sin él NO PASA NADA: el visor dibuja lo mismo que dibujaba
   * antes de que W existiera —el cuerpo entero, con el selector de tres botones— porque
   * `SesionPage` y el explorador lo abren así y no tienen por qué enterarse del eje.
   *
   * Con él, quien manda es `nivelesAnatomicos.ts`: cada nivel enciende sus piezas y sus
   * porciones y apaga las demás. El selector de músculo/hueso desaparece entonces, y no
   * por ahorrar sitio: son dos mandos sobre lo mismo, y dejar los dos deja al asesorado
   * sin saber cuál gana —la capa 4 con el botón «Músculo» pulsado no tiene respuesta.
   */
  w?: NivelW
  /**
   * El nombre del ejercicio, para saber CON QUÉ se hace.
   *
   * Solo el nombre, y no su categoría, por algo que costó medirlo: la categoría que
   * trae el ejercicio es de la taxonomía vieja de la base —`DOMINANTE DE RODILLA`,
   * `AISLAMIENTO`— y la tabla de palancas habla la canónica —`SENTADILLA`,
   * `BISAGRA DE CADERA`—. Pasada en crudo, `implementosDeEscena` devolvía cero piezas
   * para la sentadilla y el peso muerto, o sea el sujeto con las manos vacías en los
   * dos ejercicios más frecuentes. La traducción ya existe y ya está hecha aquí: es
   * `patron.categoria`, que `patronDeCategoria` resolvió con sus alias.
   *
   * Va aparte de `datos` porque son dos cosas distintas: `datos` son los números del
   * marcador —cambian con cada serie— y esto es QUÉ implementos hay —cambia con el
   * ejercicio—. Mezclarlos reconstruiría la barra cada vez que avanza una serie.
   */
  nombreEjercicio?: string
  /**
   * Avisa de dónde está mirando la cámara, cada vez que se mueve.
   *
   * Existe para que los CUADROS DE LA PARED puedan colgarse del muro de verdad. Un panel
   * colocado con porcentajes está pegado a la pantalla; para estar pegado a la pared hay
   * que pasarlo por esta misma cámara —mismo azimut, misma elevación, misma distancia—, y
   * si los dos números no salen del mismo sitio el cuadro flota. Flotar medio grado ya se
   * nota, porque el ojo compara el cuadro con el suelo que tiene detrás.
   *
   * Se llama en el bucle, así que tiene que ser barato y estable: quien lo reciba guarda
   * el valor y NO provoca un render por cada grado —de eso se encarga el que escucha.
   */
  alMirar?: (camara: { azimut: number; elevacion: number; distancia: number }) => void
}

/**
 * Visor 3D de un patrón de movimiento.
 *
 * El asesorado lo gira con el dedo y ve qué músculo se acorta. Es el
 * complemento del vídeo de técnica: el vídeo enseña cómo se hace y esto enseña
 * qué pasa por dentro mientras se hace.
 */
export function VisorPatron({ patron, datos, conEscenario = true, w, nombreEjercicio, alMirar }: VisorPatronProps) {
  const lienzoRef = useRef<HTMLCanvasElement>(null)
  const [fase, setFase] = useState(0)
  const [reproduciendo, setReproduciendo] = useState(true)
  const [capa, setCapa] = useState<Capa>('ambas')
  const [girando, setGirando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reducido = useMovimientoReducido()
  /**
   * La sala y el trípode cuelgan de las dos cosas: sin escenario no hay dónde ponerlos
   * —el explorador mira una articulación sola, sin suelo— y sin los números de la serie
   * no hay marcador que enseñar.
   */
  const haySala = conEscenario && !!datos

  // Todo lo que cambia sesenta veces por segundo va por referencia y no por
  // estado: meterlo en `useState` volvería a renderizar el árbol en cada cuadro.
  const estado = useRef({
    fase: 0,
    sentido: 1,
    reloj: 0,
    reproduciendo: true,
    girando: false,
    capa: 'ambas' as Capa,
    // Los números del marcador viven aquí y no en las dependencias del efecto que monta
    // la escena: incluirlos ahí recrearía el contexto WebGL entero cada vez que avanza
    // una serie. Van por referencia y se repinta, como la capa.
    datos: undefined as DatosDeSerie | undefined,
    colocacion: COLOCACION_INICIAL,
    // El escalón de W va por referencia y NO en las dependencias del efecto que monta
    // la escena, por lo mismo que la capa y los números de la serie: recrear el
    // contexto WebGL al atravesar el cuerpo mataría la animación en cada capa, y el
    // encargo dice justo lo contrario —en las cinco el sujeto sigue ejecutando su
    // gesto—. Así, cambiar de capa es reconstruir la malla y seguir con el mismo bucle.
    w: undefined as NivelW | undefined,
    // El ejercicio va por referencia como los números y la capa: si entrara en las
    // dependencias del efecto que monta la escena, cambiar de ejercicio recrearía el
    // contexto WebGL en vez de reconstruir una malla.
    nombreEjercicio: undefined as string | undefined,
    alMirar: undefined as VisorPatronProps['alMirar'],
    /**
     * EL VAIVÉN: cuánto se ha desviado la cámara respirando, en grados.
     *
     * Sin tocar nada, la sala respira. No es un adorno: es lo que separa una escena 3D
     * VIVA de una foto en perspectiva. Un salón absolutamente quieto se lee como una
     * imagen fija, y entonces nadie prueba a girarlo — el movimiento ambiental es la
     * única pista de que esto se mueve antes de que alguien lo toque.
     *
     * Se guarda el desvío ACUMULADO y no el objetivo, porque el azimut es del dedo: cada
     * fotograma se le suma la diferencia entre el vaivén nuevo y el viejo, así que
     * arrastrar y respirar se suman sin pelearse y soltar no da un salto.
     */
    vaiven: 0,
    /** Cuándo tocó el dedo por última vez. De aquí sale si la sala está quieta. */
    ultimoDedo: 0,
    /** Si el sistema pide menos movimiento. Entonces el objetivo del vaivén es siempre 0. */
    reducido: false,
  })
  /** La rellena el efecto que monta la escena; sirve para repintar desde fuera. */
  const redibujar = useRef<(() => void) | null>(null)

  // Los controles se copian al ref en un efecto y no durante el render: tocar
  // `ref.current` mientras se renderiza es justo lo que prohíbe `react-hooks/refs`.
  // Y hay que repintar aquí, porque en pausa no corre el bucle: sin esto,
  // cambiar de capa con el modelo parado no se veía hasta volver a darle a play.
  useEffect(() => {
    estado.current.reproduciendo = reproduciendo && !reducido
    estado.current.girando = girando
    estado.current.capa = capa
    estado.current.datos = haySala ? datos : undefined
    estado.current.w = w
    estado.current.nombreEjercicio = nombreEjercicio
    estado.current.alMirar = alMirar
    estado.current.reducido = reducido
    // `redibujar` reconstruye ADEMÁS de pintar, y aquí hace falta que lo haga: los
    // dígitos del marcador son geometría, así que un número nuevo es una malla nueva.
    // Solo repintar dejaría en la pared las cifras de la serie anterior — el fallo mudo
    // de manual, porque la escena seguiría viéndose perfecta.
    redibujar.current?.()
  }, [reproduciendo, reducido, girando, capa, haySala, datos, w, nombreEjercicio, alMirar])

  useEffect(() => {
    const lienzo = lienzoRef.current
    if (!lienzo) return

    let motor: import('./motor').Motor
    let orbita: import('./motor').Orbita
    let vivo = true
    let cuadro = 0
    let cancelado = false
    let observador: MutationObserver | undefined
    let alPerderContexto: ((e: Event) => void) | undefined
    let alRecuperarContexto: (() => void) | undefined

    // El motor se carga aparte para no meter WebGL en el paquete inicial: la
    // mayoría de las sesiones no abren el visor ni una vez.
    void import('./motor')
      .then(({ Motor, Orbita }) => {
        if (cancelado) return
        try {
          motor = new Motor(lienzo)
        } catch {
          setError('Este navegador no puede mostrar el modelo 3D.')
          return
        }

        alPerderContexto = (e: Event) => {
          e.preventDefault()
          setError('El visor 3D se pausó por falta de memoria. Vuelve a intentarlo.')
        }
        alRecuperarContexto = () => {
          setError(null)
          try {
            construir()
            pintar()
          } catch {
            setError('Este navegador no pudo recuperar el modelo 3D.')
          }
        }
        // El atributo se pone desde fuera, así que nadie vuelve a renderizar por él:
        // sin este observador el testigo pediría apagar la sala, sacaría la foto, y la
        // sala seguiría ahí. Daría cero píxeles de diferencia y firmaría que no se ve.
        observador = new MutationObserver(() => {
          construir()
          pintar()
        })
        observador.observe(lienzo, { attributes: true, attributeFilter: ['data-sin'] })

        lienzo.addEventListener('webglcontextlost', alPerderContexto)
        lienzo.addEventListener('webglcontextrestored', alRecuperarContexto)

        const { huesos, reposo } = precalculado()
        // La malla del músculo se reutiliza cuadro a cuadro: la topología no
        // cambia y reservarla de nuevo cada vez costaba el doble de tiempo.
        const mallaMusculo = new Malla(16384)
        const traza = trazaDelPatron(patron)
        const encuadre = encuadrar(patron)
        let mostrarEsfera = false

        // Al arrastrar el dedo la órbita repinta por su cuenta, y ahí también hay que
        // avisar: si no, los cuadros de la pared se quedan clavados mientras la sala gira
        // debajo — que es exactamente lo contrario de estar colgados de ella.
        orbita = new Orbita(lienzo, () => {
          pintar()
          avisarDeLaCamara()
        })
        orbita.azimut = patron.camara.azimut
        // CON SALA, EL ENCUADRE ES OTRO. `encuadrar()` enmarca el cuerpo y hace bien
        // —para estudiar un patrón lo que importa es el cuerpo—, pero a esa distancia el
        // borde inferior del cuadro cae por encima del suelo y la sala entera queda
        // recortada: el sujeto parecería flotando en un vacío y el escenario, que está
        // construido y renderizado, no se vería.
        // Se lee del ref y no de la prop porque incluir `datos` en las dependencias de
        // este efecto recrearía el contexto WebGL cada vez que avanza una serie. El
        // efecto de sincronización se declara ANTES que éste, así que para cuando esto
        // corre el ref ya está puesto.
        const conSala = !!estado.current.datos
        orbita.distancia = conSala ? ENCUADRE_SALA.distancia : encuadre.distancia
        orbita.centro = conSala ? [...ENCUADRE_SALA.centro] : encuadre.centro
        // Y LA ELEVACIÓN SE ACOTA, pero solo con sala. El ángulo del patrón se eligió
        // para ver el MOVIMIENTO —lo tumbado se estudia desde arriba, y por eso el
        // catálogo llega a 56°— y ahí sigue mandando cuando el visor monta el patrón
        // solo. Dentro del salón manda otra cosa: a partir de 32° la cámara no ve ni un
        // punto del muro de 6,8 m, y los cuadros colgados quedaban fuera de la pantalla.
        // El tope vive en `ENCUADRE_SALA` con el motivo y el número medidos.
        orbita.elevacion = conSala
          ? elevacionDelSalon(patron.camara.elevacion)
          : patron.camara.elevacion

        let matrices = resolver({}, [0, 0.95, 0], [0, 0, 0]).matrices

        const construir = () => {
          const esq = esqueletoEnFase(patron, estado.current.fase, estado.current.sentido, estado.current.reloj)
          matrices = esq.matrices
          // El escenario va PRIMERO, y no da igual: los índices se concatenan en el
          // orden de las partes, así que ponerlo delante deja el sujeto al final del
          // búfer — que es donde conviene cuando lo que cambia en cada fotograma es él.
          const partes = conEscenario && !partesOmitidas(lienzo).has('bahia') ? [laboratorio()] : []
          // La plomada del peso: dónde cae la resultante. Con suelo, porque
          // tumbado no hay equilibrio que enseñar.
          if (conEscenario && patron.apoyo === 'suelo') partes.push(lineaDePeso(esq))
          // LA SALA Y EL TRÍPODE, que se quedan JUNTO a la plomada y no en su lugar.
          // En la rama del PR #183 estas dos llamadas sustituían a `lineaDePeso`, y esa
          // era una pérdida encubierta: la plomada dice dónde cae la resultante —el
          // equilibrio— y la sala dice dónde estás y desde dónde se graba. Son dos
          // datos distintos y ninguno responde por el otro, así que van los tres.
          // Cuelgan de la bahía: sin escenario no hay dónde ponerlos, y sin números no
          // hay marcador que enseñar.
          const sin = partesOmitidas(lienzo)
          const d = estado.current.datos
          if (d) {
            if (!sin.has('sala')) partes.push(sala(d, patron.camara.azimut))
            if (!sin.has('camara')) partes.push(tripode(estado.current.colocacion))
          }
          // EL HIERRO. Va después de la sala y antes del sujeto: cuelga del esqueleto
          // de ESTA fase, así que si el sujeto baja, la barra baja con él. Un implemento
          // que no siguiera al cuerpo sería una calcomanía, y se notaría al primer ciclo.
          if (conEscenario && !sin.has('implementos')) {
            const hierro = new Malla()
            construirImplementos(
              hierro,
              escenaDeImplementos(patron.categoria, estado.current.nombreEjercicio ?? ''),
              esq,
            )
            partes.push(hierro)
          }
          // EL SUJETO. Dos rutas, y la de arriba es la de siempre: sin `w` no se
          // consulta el eje ni se importa nada de `capas/`, y lo que se sube es
          // exactamente lo que se subía antes —el cuerpo entero, mandado por el
          // selector de tres botones—. Quien ya usa el visor no nota este cambio.
          const nivelW = estado.current.w
          if (sin.has('sujeto')) {
            // El cuerpo fuera: es la única parte cuyo apagado ya sabía hacer el testigo
            // escondiendo un nodo, pero se trata igual que las demás para que las cuatro
            // se midan por el mismo camino y una no pueda salir buena por otra razón.
          } else if (nivelW === undefined) {
            if (estado.current.capa !== 'musculo') partes.push(huesos)
            if (estado.current.capa !== 'hueso')
              partes.push(construirMusculos(esq, patron.activacion, reposo, mallaMusculo))
          } else {
            // Con `w`, la lista de mallas NO se decide aquí: se lee de
            // `mallasDelSujeto()`, que es la misma función pura que se puede examinar
            // sin pintar un píxel. Que la pantalla y la comprobación salgan del mismo
            // sitio es lo que impide que una diga una cosa y la otra otra.
            for (const m of mallasDelSujeto(nivelW, patron)) {
              if (m.pieza === 'huesos') partes.push(huesos)
              else partes.push(construirMusculosDeNivel(nivelW, esq, patron, reposo, mallaMusculo))
            }
          }
          partes.push(guias(traza, estado.current.fase, orbita.centro, mostrarEsfera))
          // QUE SE ACABA DE CONSTRUIR, dicho en el propio lienzo.
          //
          // Un vértice puede existir en la malla y no llegar nunca a la pantalla, y
          // desde fuera las dos cosas se ven igual: cero píxeles. Sin este dato, saber
          // cuál de las dos era pedía adivinar. Es una cuenta, no un mando: no cambia
          // nada de lo que se dibuja y se lee igual desde el inspector que desde el acta.
          if (lienzo) {
            lienzo.dataset.partes = partes.map((m) => m.vertices).join(',')
          }
          motor.subir(partes)
        }

        const pintar = () => {
          const aspecto = motor.ajustarTamano()
          motor.dibujar(
            matrices,
            orbita.vista(),
            M4.perspectiva(CAMPO_VISUAL, aspecto, 0.05, 40),
            orbita.ojo(),
            conEscenario && patron.apoyo !== 'ninguno',
          )
        }

        const mostrarEsferaAl = (v: boolean) => {
          mostrarEsfera = v
          construir()
          pintar()
        }
        // EL DEDO APAGA EL VAIVÉN. Se anota en los dos eventos y no solo al bajar: un
        // arrastre largo pasa de 1,5 s, y sin anotar el movimiento la sala empezaría a
        // respirar por debajo del dedo que la está girando.
        const anotarDedo = () => {
          estado.current.ultimoDedo = performance.now()
        }
        lienzo.addEventListener('pointerdown', anotarDedo)
        lienzo.addEventListener('pointermove', anotarDedo)
        lienzo.addEventListener('pointerdown', () => mostrarEsferaAl(true))
        lienzo.addEventListener('pointerup', () => mostrarEsferaAl(estado.current.girando))
        lienzo.addEventListener('pointercancel', () => mostrarEsferaAl(estado.current.girando))

        const arranque = performance.now() / 1000
        const bucle = () => {
          if (!vivo) return
          // Mientras el encoder captura, este bucle se aparta. No es cuestión de
          // que se vea peor: por debajo de 50 fps la toma se DESCARTA, y a 30 el
          // error de pérdida de velocidad se va cinco puntos. Un bucle WebGL al
          // lado de la captura hace que el asesorado repita la serie.
          if (camaraAbierta()) {
            cuadro = requestAnimationFrame(bucle)
            return
          }
          const ahora = performance.now() / 1000
          let cambia = false
          if (estado.current.reproduciendo) {
            const { fase: f, sentido } = faseDeTiempo(ahora - arranque, patron)
            estado.current.reloj = ahora - arranque
            estado.current.sentido = sentido
            if (Math.abs(f - estado.current.fase) > 0.0015) {
              estado.current.fase = f
              setFase(f)
            }
            cambia = true
          }
          if (estado.current.girando) {
            orbita.azimut = (orbita.azimut + 0.32) % 360
            mostrarEsfera = true
            cambia = true
          }
          // EL VAIVÉN SE APLICA ANTES DE PINTAR, y esto costó una medida.
          //
          // Estaba después, en una rama `if (!cambia && ...)`, y era CÓDIGO MUERTO: el
          // sujeto está ejecutando su gesto, así que `cambia` es cierto en todos los
          // fotogramas y esa rama no corría nunca. La sala salía perfectamente quieta y
          // nada se ponía en rojo — se cazó midiendo la transformación del cuadro del muro
          // seis veces seguidas y viendo que las seis eran idénticas.
          //
          // Sumado aquí, el desvío entra en el mismo pintado que ya se iba a hacer: no
          // cuesta un fotograma más. Y cuando el modelo está en pausa, `respiro` es lo
          // único que pide pintar — SIN reconstruir, porque la cámara no cambia ninguna
          // malla y reconstruir la sala para desviarla una centésima de grado es el mismo
          // error que costó 4,77 ms de fotograma en agosto.
          const respiro = aplicarVaiven()
          if (cambia) {
            construir()
            pintar()
            avisarDeLaCamara()
          } else if (respiro) {
            pintar()
            avisarDeLaCamara()
          }
          cuadro = requestAnimationFrame(bucle)
        }

        // Se avisa con el MISMO estado con el que se acaba de dibujar. Avisar antes dejaría
        // los cuadros de la pared un fotograma por detrás de la sala, y ese desfase se ve
        // como un temblor al arrastrar el dedo — el cuadro persiguiendo a su muro.
        /**
         * RESPIRAR: acerca el vaivén a su objetivo y devuelve si la cámara se movió.
         *
         * La aritmética vive en `vaivenDeLaSala.ts` y no aquí: dentro de este efecto solo
         * se podría probar montando WebGL, y en jsdom no hay WebGL. Aquí queda lo único
         * que es de este sitio — sumarle el desvío al azimut de la órbita.
         */
        const aplicarVaiven = () => {
          // LEE SU PROPIO RELOJ, Y EN MILISEGUNDOS. El `ahora` de este bucle es
          // `performance.now() / 1000` —SEGUNDOS, porque la fase del gesto se calcula
          // así— y pasárselo dejaba el vaivén con `ahora = 2`: nunca se cumplía «llevas
          // 1500 sin tocar», el objetivo era siempre cero y la sala salía perfectamente
          // quieta sin que nada se pusiera en rojo. Dos relojes en la misma función y en
          // unidades distintas es el fallo, no el número.
          const paso = pasoDelVaiven(estado.current, performance.now())
          if (paso.desvio === 0) return false
          estado.current.vaiven = paso.vaiven
          orbita.azimut += paso.desvio
          return true
        }

        const avisarDeLaCamara = () => {
          estado.current.alMirar?.({
            azimut: orbita.azimut,
            elevacion: orbita.elevacion,
            distancia: orbita.distancia,
          })
        }

        redibujar.current = () => {
          construir()
          pintar()
          avisarDeLaCamara()
        }
        try {
          construir()
          pintar()
          avisarDeLaCamara()
        } catch {
          setError('Este navegador no pudo dibujar el modelo 3D.')
        }
        cuadro = requestAnimationFrame(bucle)
      })
      .catch(() => setError('No se pudo cargar el modelo 3D.'))

    const alRedimensionar = () => {
      if (motor) {
        motor.ajustarTamano()
      }
    }
    window.addEventListener('resize', alRedimensionar)

    return () => {
      cancelado = true
      vivo = false
      cancelAnimationFrame(cuadro)
      window.removeEventListener('resize', alRedimensionar)
      observador?.disconnect()
      if (alPerderContexto) lienzo.removeEventListener('webglcontextlost', alPerderContexto)
      if (alRecuperarContexto) lienzo.removeEventListener('webglcontextrestored', alRecuperarContexto)
      redibujar.current = null
      orbita?.destruir()
    }
  }, [patron, conEscenario])

  // El deslizador manda sobre la reproducción: si alguien lo mueve es porque
  // quiere mirar un punto concreto del recorrido.
  const alMoverFase = (v: number) => {
    estado.current.fase = v
    estado.current.sentido = 1
    setFase(v)
    setReproduciendo(false)
    redibujar.current?.()
  }

  // La musculatura se agrupa por músculo y dentro por porción. Un músculo no es
  // un bloque: la cabeza larga del bíceps nace en la escápula y la corta en la
  // coracoides, y esa diferencia es la que explica por qué un ejercicio carga
  // una y no la otra.
  const musculos = MUSCULOS.map((musculo) => {
    const porciones = musculo.porciones
      .map((porcion) => ({
        porcion,
        valor: Math.max(
          activacionDe(patron.activacion, musculo.id, porcion.id, 'D'),
          activacionDe(patron.activacion, musculo.id, porcion.id, 'I'),
        ),
      }))
      .filter((p) => p.valor >= 0.2)
      .sort((a, b) => b.valor - a.valor)
    return { musculo, porciones, valor: porciones[0]?.valor ?? 0 }
  })
    .filter((m) => m.valor >= 0.25)
    .sort((a, b) => b.valor - a.valor)

  /** El nivel de W en el que se está, o `null` cuando el visor se abre sin eje. */
  const nivel = w === undefined ? null : NIVEL_POR_W[w]

  // Qué hace cada articulación: se calcula de las poses, no está escrito.
  const acciones = accionesPrincipales(patron)
  const frase = fraseDelPatron(patron)

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-xl"
        style={{ background: FONDO_ESTUDIO }}>
        <canvas
          ref={lienzoRef}
          className="block h-[46vh] max-h-[420px] min-h-[240px] w-full touch-none"
          aria-label={`Modelo tridimensional del patrón ${patron.titulo}`}
        />
        {error && (
          <p className="absolute inset-0 grid place-content-center px-6 text-center text-xs text-silver-300">
            {error}
          </p>
        )}
        {/* LA LEYENDA DE LA RETICULA. Sin ella el suelo es un fondo bonito; con ella
            es un instrumento: se puede LEER cuanto bajo la cadera contando cuadros en
            vez de intuirlo. Los numeros salen de la geometria —no estan escritos dos
            veces— asi que si el paso cambia, la leyenda cambia con el.
            En centimetros porque es la unidad con la que se habla de un recorrido. */}
        {!error && conEscenario && (
          <p className="pointer-events-none absolute bottom-2 right-3 text-right font-mono text-[9px] uppercase tracking-[0.1em] text-white/35">
            retícula {BAHIA.pasoMenor * 100} cm
            <span className="mx-1 text-white/20">·</span>
            {BAHIA.pasoMayor * 100} cm
          </p>
        )}
        {!error && (
          <p className="pointer-events-none absolute bottom-2 left-3 text-[9px] uppercase tracking-[0.12em] text-silver-400">
            Arrastra para girar
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setReproduciendo((v) => !v)}
          disabled={reducido}
          className="press flex items-center gap-1.5 rounded-lg border border-ink-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-silver-300 disabled:opacity-40"
        >
          {reproduciendo && !reducido ? (
            <>
              <IconoPausa className="h-[13px] w-[13px]" />
              Pausa
            </>
          ) : (
            <>
              <IconoReproducir className="h-[13px] w-[13px]" />
              Reproducir
            </>
          )}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(fase * 100)}
          onChange={(e) => alMoverFase(Number(e.target.value) / 100)}
          aria-label="Fase del movimiento"
          className="h-1 min-w-[110px] flex-1 cursor-pointer appearance-none rounded bg-ink-500 accent-ambar"
        />
        <button
          type="button"
          onClick={() => setGirando((v) => !v)}
          aria-pressed={girando}
          className="press rounded-lg border border-ink-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-silver-300"
        >
          Orbitar
        </button>
        {/* MÚSCULO/HUESO Y EL EJE W SON EL MISMO MANDO, así que no salen los dos: con
            `w` puesto lo que se ve del cuerpo lo decide la capa, y el selector se
            cambia por el rótulo de en qué capa se está —que es el dato que hace falta
            cuando el dedo ya ha atravesado dos veces y no se sabe dónde se ha parado. */}
        {nivel ? (
          <p className="rounded-lg border border-ink-500 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-silver-300">
            {nivel.nombre}
          </p>
        ) : (
          <div className="flex overflow-hidden rounded-lg border border-ink-500">
            {(['ambas', 'musculo', 'hueso'] as Capa[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCapa(c)}
                aria-pressed={capa === c}
                className={`press px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                  capa === c ? 'bg-white/10 text-silver-100' : 'text-silver-400'
                }`}
              >
                {c === 'ambas' ? 'Ambas' : c === 'musculo' ? 'Músculo' : 'Hueso'}
              </button>
            ))}
          </div>
        )}
      </div>

      {nivel && (
        <p className="text-[10px] leading-snug text-silver-400">{nivel.resumen}</p>
      )}

      {reducido && (
        <p className="text-[10px] leading-snug text-silver-400">
          Tu sistema pide menos movimiento, así que el modelo no se anima solo. Usa el
          deslizador para recorrer el gesto.
        </p>
      )}

      <p className="text-xs leading-snug text-silver-300">{patron.resumen}</p>

      <div>
        <h4 className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-silver-500">
          Qué hace cada articulación
        </h4>
        {/* La frase corta primero: es lo que hay que poder leer de un vistazo
            antes de entrar en el desglose. */}
        <p className="mb-2 text-xs leading-snug text-silver-200">{frase}.</p>
        <ul className="flex flex-col">
          {acciones.map((r) => (
            <li key={r.articulacion.id} className="border-b border-white/5">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-baseline gap-2 py-1.5 text-xs">
                  <span
                    className={`w-[52px] shrink-0 text-[9px] font-bold uppercase tracking-[0.08em] ${
                      r.rol === 'motor' ? 'text-ambar' : 'text-silver-500'
                    }`}
                  >
                    {NOMBRE_DE_ROL[r.rol]}
                  </span>
                  <span className="flex-1 text-silver-200">{r.articulacion.nombre}</span>
                  <span className="text-[10px] text-silver-500">
                    {r.acciones.length > 0
                      ? r.acciones.map((a) => a.accion.toLowerCase()).join(' · ')
                      : 'isometría'}
                  </span>
                </summary>
                <div className="pb-2 pl-[60px] pr-1">
                  {r.acciones.map((a) => (
                    <p key={a.eje.canal} className="text-[10px] leading-snug text-silver-400">
                      {a.accion} de {Math.round(a.desde)}° a {Math.round(a.hasta)}°, en el{' '}
                      {NOMBRE_DE_PLANO[a.eje.plano].toLowerCase()}.
                    </p>
                  ))}
                  {r.acciones.length === 0 && (
                    <p className="text-[10px] leading-snug text-silver-400">
                      No recorre nada: aguanta la posición contra la carga.
                    </p>
                  )}
                  {/* Qué se mueve sobre qué, EN ESTE ejercicio. En cadena
                      cerrada se invierte: en una sentadilla el pie está clavado
                      en el suelo, así que baja el fémur sobre la tibia y no al
                      revés. Con la relación de manual, la sentadilla se leía
                      como un curl femoral. */}
                  <p className="mt-1 text-[10px] leading-snug text-silver-500">
                    {NOMBRE_DE_TIPO[r.articulacion.tipo]}.{' '}
                    {segmentosDe(patron, r.articulacion.id).movil} sobre{' '}
                    {segmentosDe(patron, r.articulacion.id).fijo.toLowerCase()}.
                  </p>
                  {/* Lo que NO puede hacer es la mitad de entender una
                      articulación, y es lo que evita forzarla. */}
                  {r.articulacion.noPuede.map((n) => (
                    <p key={n} className="mt-1 text-[10px] leading-snug text-silver-500">
                      {n}
                    </p>
                  ))}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>

      {patron.claves.length > 0 && (
      <div>
        <h4 className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-silver-500">
          Claves de ejecución
        </h4>
        <ul className="flex flex-col gap-1">
          {patron.claves.map((c) => (
            <li key={c} className="pl-3 text-xs leading-snug text-silver-200 before:-ml-3 before:mr-1.5 before:text-ambar before:content-['•']">
              {c}
            </li>
          ))}
        </ul>
      </div>
      )}

      {patron.errores.length > 0 && (
      <div>
        <h4 className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-rojo">
          Errores frecuentes
        </h4>
        <ul className="flex flex-col gap-1">
          {patron.errores.map((c) => (
            <li key={c} className="pl-3 text-xs leading-snug text-silver-300 before:-ml-3 before:mr-1.5 before:text-rojo before:content-['–']">
              {c}
            </li>
          ))}
        </ul>
      </div>
      )}

      <div>
        <h4 className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-silver-500">
          Musculatura implicada
        </h4>
        <ul className="flex flex-col">
          {musculos.map(({ musculo, porciones, valor }) => {
            const color = (v: number) => {
              const [r, g, b] = colorDeMusculo(v).map((x) => Math.round(x * 255))
              return `rgb(${r},${g},${b})`
            }
            // Un solo vientre no necesita desplegable: la porción y el músculo
            // son la misma cosa y abrirlo repetiría el nombre.
            const desglosa = musculo.porciones.length > 1
            return (
              <li key={musculo.id} className="border-b border-white/5">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 py-1.5 text-xs text-silver-200">
                    {/* El cuadrado lleva el MISMO color que el modelo: el nombre
                        y lo que se ve en pantalla tienen que ser el mismo dato. */}
                    <i
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: color(valor) }}
                    />
                    <span className="flex-1">{musculo.nombre}</span>
                    {desglosa && (
                      <span className="text-[9px] uppercase tracking-[0.1em] text-silver-500 group-open:hidden">
                        {porciones.length} de {musculo.porciones.length}
                      </span>
                    )}
                    <b className="cifras text-[10px] font-semibold text-silver-400">
                      {Math.round(valor * 100)}%
                    </b>
                  </summary>

                  <div className="pb-2 pl-[18px] pr-1">
                    <ul className="mb-2 flex flex-col gap-0.5">
                      {musculo.acciones.map((a) => (
                        <li key={a} className="text-[11px] leading-snug text-silver-400">
                          {a}
                        </li>
                      ))}
                    </ul>
                    {porciones.map(({ porcion, valor: v }) => (
                      <div key={porcion.id} className="mb-1.5">
                        <p className="flex items-center gap-2 text-[11px] text-silver-200">
                          <i
                            aria-hidden
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: color(v) }}
                          />
                          <span className="flex-1">{porcion.nombre}</span>
                          {porcion.biarticular && (
                            <span className="text-[9px] uppercase tracking-[0.08em] text-ambar">
                              Cruza dos articulaciones
                            </span>
                          )}
                          <b className="cifras text-[10px] text-silver-500">
                            {Math.round(v * 100)}%
                          </b>
                        </p>
                        <p className="pl-[14px] text-[10px] leading-snug text-silver-500">
                          Desde {porcion.origen.toLowerCase()} hasta {porcion.insercion.toLowerCase()}.
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-[10px] leading-snug text-silver-500">
        {patron.ejemplos && <>Ejercicios de este patrón: {patron.ejemplos}. </>}
        Una repetición dura {DURACION_CICLO.toFixed(1).replace('.', ',')} s con el tempo
        correcto.
      </p>
    </div>
  )
}

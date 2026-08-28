import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type Ref } from 'react'
import { useMovimientoReducido } from '../../components/ui/movimientoReducido'
import { alAbrirseLaCamara, camaraAbierta } from './camaraAbierta'
import { cargarFuentesDelGabinete } from './fuentesDelGabinete'
import { SIMBOLOS, temaDeEjercicio, type ClaveSimbolo, type SlotTheme } from './slotThemes'

/**
 * La sala de máquinas: cinco gabinetes distintos, uno por ejercicio.
 *
 * El asesorado entra a la sesión y cada ejercicio le pone delante otra
 * máquina — otra tipografía, otra disposición, otros símbolos, otra palanca,
 * otra cadencia. `THEMES[index % 5]`, sin aleatorizar, para que pueda
 * reconocer «la del ejercicio 3».
 *
 * EL GABINETE ES UNA ISLA. Todo lo temático vive dentro del marco; la línea
 * superior y el resto de la sesión conservan la tipografía y los colores del
 * sistema.
 *
 * El movimiento es decorativo; la INFORMACIÓN nunca lo es. El nombre completo
 * está siempre en el árbol de accesibilidad, la parada visible se anuncia por
 * `aria-live`, y con `prefers-reduced-motion` el gabinete conserva toda su
 * estética: solo se apaga el movimiento.
 *
 * DECISIÓN PENDIENTE: el encargo cita el acento volt (#c8ff1e) para el
 * exterior. Este proyecto usa el rojo Alfa (`--accion`) y su `tokens.css` lo
 * declara así; tocar tokens globales está prohibido. La línea superior usa el
 * token existente. Dentro del gabinete manda el acento de cada tema, que sí es
 * volt en la máquina 3.
 */

/** Milisegundos que dura el destello de premio. */
const PREMIO_MS = 780
/**
 * Lo que dura el asiento del carrete central: los `.68s` de la transicion de
 * `Ventana`, escritos aqui en numero porque la Web Animations API no lee CSS.
 */
const ASIENTO_MS = 680
/**
 * La curva del asiento. Es la del propio archivo (`Carrete` y `Ventana`), la
 * unica del gabinete con un pelin de rebote — el `1.06`.
 */
const CURVA_ASIENTO = 'cubic-bezier(.14,1.06,.32,1)'
/**
 * Un carrete NO se desliza: da saltos de fila. `steps(1, jump-end)` sostiene el
 * fotograma durante todo su tramo y salta al final, que es exactamente lo que
 * hacia el `setTimeout` que habia aqui — con la diferencia de que ahora el salto
 * lo da el compositor y no un render de React.
 */
const SALTO_DE_FILA = 'steps(1, jump-end)'

/** Cada cuánto sube el bote de las marquesinas LED. */
const BOTE_MS = 2600
/** Créditos con los que arranca la máquina. */
const CREDITOS_INICIALES = 25

/**
 * Los fotogramas de un carrete que avanza `pasos` filas, de una en una y dando
 * la vuelta al llegar al final de la tira.
 *
 * La formula de la fila es la misma de siempre —`(desde + k) % filas`—, y eso es
 * lo que hace que el giro se vea IGUAL que antes: no se reinterpreta el
 * movimiento, se transcribe. Cada fotograma lleva su propia curva de salto, asi
 * que no hay interpolacion entre filas.
 */
function fotogramasDeCarrete(desde: number, pasos: number, filas: number, altoFila: number): Keyframe[] {
  const marcos: Keyframe[] = []
  for (let k = 0; k <= pasos; k += 1) {
    marcos.push({
      transform: `translateY(-${((desde + k) % filas) * altoFila}px)`,
      easing: SALTO_DE_FILA,
    })
  }
  return marcos
}

export interface ExerciseSlotMachineProps {
  index: number
  total: number
  nombre: string
  patron?: string
  clase?: string
  tecnica?: string
  refVisual?: string
  categoria: string
  rango: string
  /** Anulado a propósito: el giro por reloj competía con la lectura. */
  autoSpin?: boolean
  paused?: boolean
  onRefTap?: () => void
}

interface Parada {
  etiqueta: string
  valor: string
  simbolo: ClaveSimbolo
  accion?: boolean
}

function construirParadas(p: ExerciseSlotMachineProps, tema: SlotTheme): Parada[] {
  const s = tema.simbolos
  const paradas: Parada[] = [{ etiqueta: 'Ejercicio', valor: p.nombre, simbolo: s[0] }]
  // Los datos opcionales que no vengan no crean parada: con menos de cinco la
  // máquina gira igual y el layout no se rompe.
  if (p.patron) paradas.push({ etiqueta: 'Patrón', valor: p.patron, simbolo: s[1] })
  if (p.clase) paradas.push({ etiqueta: 'Categoría', valor: p.clase, simbolo: s[2] })
  if (p.tecnica) paradas.push({ etiqueta: 'Nota técnica', valor: p.tecnica, simbolo: s[3] })
  if (p.refVisual) paradas.push({ etiqueta: 'Referencia', valor: p.refVisual, simbolo: s[4], accion: true })
  return paradas
}

function Icono({ clave, tam }: { clave: ClaveSimbolo; tam: number }) {
  const s = SIMBOLOS[clave]
  return (
    <svg
      viewBox="0 0 24 24"
      width={tam}
      height={tam}
      fill={s.relleno ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={s.relleno ? 0 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={s.path} />
    </svg>
  )
}

export function ExerciseSlotMachine(props: ExerciseSlotMachineProps) {
  const { index, total, categoria, rango, autoSpin = false, paused = false, onRefTap } = props
  const { nombre, patron, clase, tecnica, refVisual } = props
  const tema = useMemo(() => temaDeEjercicio(index), [index])
  const paradas = useMemo(
    () => construirParadas({ ...props, nombre, patron, clase, tecnica, refVisual }, tema),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo los campos que crean paradas
    [nombre, patron, clase, tecnica, refVisual, tema],
  )
  const reducido = useMovimientoReducido()

  const [catIdx, setCatIdx] = useState(0)
  const [rOff, setROff] = useState(0)
  const [sideA, setSideA] = useState(0)
  const [sideB, setSideB] = useState(0)
  const [spinC, setSpinC] = useState(false)
  const [spinA, setSpinA] = useState(false)
  const [spinB, setSpinB] = useState(false)
  const [snap, setSnap] = useState(false)
  const [leverDown, setLeverDown] = useState(false)
  const [win, setWin] = useState(false)
  const [credits, setCredits] = useState(CREDITOS_INICIALES)
  const [jackTick, setJackTick] = useState(0)
  const relojes = useRef<number[]>([])
  // Hay una tirada EN MARCHA ahora mismo. No sirve mirar `relojes`: los
  // temporizadores que ya dispararon siguen en la lista, así que una tirada
  // terminada se vería igual que una viva.
  const enMarcha = useRef(false)
  // La parada a la que va la tirada. Se guarda porque hace falta fuera de
  // `girarA`: quien corta el giro a mitad tiene que enseñar el dato al que iba,
  // no el que hubiera quedado a medio camino.
  const paradaBuscada = useRef(0)
  /**
   * La fila que cada carrete tiene puesta AHORA. Va en un ref y no se lee del
   * estado por un motivo concreto: `girarA` es un `useCallback` cuyas
   * dependencias no incluyen las posiciones, asi que su cierre se quedaria
   * mirando para siempre los valores del primer render — cero — y la segunda
   * tirada arrancaria desde donde no esta.
   */
  const fila = useRef({ izquierdo: 0, derecho: 0, ventana: 0 })
  /** Los tres carretes. La animacion se escribe sobre el nodo que se mueve. */
  const carreteIzquierdo = useRef<HTMLDivElement>(null)
  const carreteDerecho = useRef<HTMLDivElement>(null)
  const ventana = useRef<HTMLDivElement>(null)
  const animaciones = useRef<Animation[]>([])

  /**
   * Se van los temporizadores Y las animaciones. Las dos cosas juntas, porque
   * `[data-camara-abierta] * { animation-play-state: paused }` de `tokens.css`
   * **no** para una animacion de la Web Animations API: esa regla es para
   * animaciones declaradas en CSS. Desde que el giro vive aqui, esta funcion es
   * lo unico que lo detiene.
   */
  const limpiar = useCallback(() => {
    relojes.current.forEach((r) => clearTimeout(r))
    relojes.current = []
    animaciones.current.forEach((a) => a.cancel())
    animaciones.current = []
  }, [])
  const programar = useCallback((fn: () => void, ms: number) => {
    relojes.current.push(window.setTimeout(fn, ms))
  }, [])

  /**
   * Los tres carretes arrancan a la vez y a velocidades distintas, y PARAN
   * ESCALONADOS: izquierdo al 50 % del frenado, derecho al 76 %, central al
   * 100 %. Ese orden es el que produce la tensión — parar los tres a la vez
   * se lee como un carrusel.
   */
  const girarA = useCallback(
    (destino: number) => {
      if (paradas.length < 2) return
      const objetivo = ((destino % paradas.length) + paradas.length) % paradas.length
      paradaBuscada.current = objetivo
      limpiar()
      setCredits((c) => (c <= 1 ? CREDITOS_INICIALES : c - 1))

      const filas = paradas.length * 2
      const simbolos = tema.simbolos.length
      const alto = tema.ventana.alto

      // El giro se salta entero en tres casos, y en los tres se va directo a la
      // parada, que es lo que de verdad hay que enseñar. Se pierde el giro, no el
      // argumento.
      //
      //  - Movimiento reducido, por respeto a la preferencia.
      //  - Camara capturando: la puerta de `tokens.css` NO cubre este giro
      //    —`animation-play-state` no para una animacion de la WAAPI igual que no
      //    paraba los temporizadores de antes—, asi que se pregunta aqui.
      //  - Sin Web Animations API en el elemento. No hay navegador de hoy que le
      //    falte; el caso real es `jsdom`, que no la implementa. La ventana llega
      //    igual a su parada, deslizandose con la transicion de CSS: se degrada a
      //    menos movimiento, nunca a un dato equivocado.
      if (reducido || camaraAbierta() || typeof ventana.current?.animate !== 'function') {
        setCatIdx(objetivo)
        // Y la ventana tambien se mueve. Antes solo se tocaba `catIdx`, asi que
        // con la camara abierta el paginador decia una parada y la ventana
        // enseñaba otra; no se veia porque la hoja de medicion tapa la palanca.
        fila.current = { ...fila.current, ventana: objetivo * 2 }
        setROff(objetivo * 2)
        return
      }

      // Cuantas filas avanza cada carrete. Es la misma cuenta que llevaba la
      // cadena de temporizadores (`round(hasta / paso)`), asi que el giro dura lo
      // mismo y para en el mismo sitio.
      const pasosDe = (paso: number, hasta: number) => Math.max(1, Math.round(hasta / paso))
      const pasoIzquierdo = tema.step * 0.72
      const pasoDerecho = tema.step * 0.88
      const pasosIzquierdo = pasosDe(pasoIzquierdo, tema.brake * 0.5)
      const pasosDerecho = pasosDe(pasoDerecho, tema.brake * 0.76)
      const pasosVentana = pasosDe(tema.step, tema.brake)

      const desde = fila.current
      const filaFinal = {
        izquierdo: (desde.izquierdo + pasosIzquierdo) % simbolos,
        derecho: (desde.derecho + pasosDerecho) % simbolos,
        ventana: objetivo * 2,
      }
      fila.current = filaFinal

      enMarcha.current = true
      setSnap(true)
      setSpinC(true)
      setSpinA(true)
      setSpinB(true)
      // EL ESTADO SALTA YA AL FINAL, y sin esto no se entiende el resto: React
      // pinta los tres carretes en su posicion de destino, y la animacion se
      // pone por encima recorriendo el camino (una animacion gana a un estilo en
      // linea). Cuando termina, con `fill` por defecto, el elemento cae en el
      // estilo de React — que ya es el mismo pixel donde acaba la animacion. Ni
      // salto al empezar ni salto al acabar, y CERO renders por el medio.
      //
      // El `snap` de esta misma tanda es el que impide que la transicion de CSS
      // intente deslizar ese salto por debajo.
      setSideA(filaFinal.izquierdo)
      setSideB(filaFinal.derecho)
      setROff(filaFinal.ventana)

      const animar = (nodo: HTMLDivElement | null, marcos: Keyframe[], opciones: KeyframeAnimationOptions) => {
        if (!nodo) return undefined
        const animacion = nodo.animate(marcos, opciones)
        animaciones.current.push(animacion)
        return animacion
      }

      // Los laterales: saltan sus filas y se quedan donde caigan. Cada uno se
      // desenfoca al terminar EL SUYO —al 50 % y al 76 % del frenado—, que es el
      // escalonado que produce la tension. Se cuelga de la animacion y no de un
      // temporizador aparte para que no puedan separarse ni un fotograma.
      const izquierdo = animar(
        carreteIzquierdo.current,
        fotogramasDeCarrete(desde.izquierdo, pasosIzquierdo, simbolos, alto / 2),
        { duration: pasosIzquierdo * pasoIzquierdo },
      )
      // Sin carrete (DIAMOND SALON y CASH BONANZA no los llevan) no hay nada que
      // desenfocar: se apaga ya, o se quedaria encendido para siempre.
      if (izquierdo) izquierdo.onfinish = () => setSpinA(false)
      else setSpinA(false)

      const derecho = animar(
        carreteDerecho.current,
        fotogramasDeCarrete(desde.derecho, pasosDerecho, simbolos, alto / 2),
        { duration: pasosDerecho * pasoDerecho },
      )
      if (derecho) derecho.onfinish = () => setSpinB(false)
      else setSpinB(false)

      // El central: primero los saltos y despues el asiento. Van en dos
      // animaciones encadenadas, no en una sola con dos tramos, porque el
      // instante en que acaban los saltos es tambien el del premio y el del
      // desenfoque, y colgarlo de un temporizador en paralelo lo dejaria a merced
      // del estrangulamiento de las pestañas de fondo.
      const saltos = animar(
        ventana.current,
        fotogramasDeCarrete(desde.ventana, pasosVentana, filas, alto),
        // `forwards` sostiene la ultima fila el fotograma que tarda en arrancar
        // el asiento; sin el, el carrete parpadearia a su destino y volveria.
        { duration: pasosVentana * tema.step, fill: 'forwards' },
      )
      if (!saltos) {
        enMarcha.current = false
        return
      }
      saltos.onfinish = () => {
        setSpinC(false)
        setSnap(false)
        setCatIdx(objetivo)
        setWin(true)
        programar(() => setWin(false), PREMIO_MS)

        const asiento = animar(
          ventana.current,
          [
            { transform: `translateY(-${((desde.ventana + pasosVentana) % filas) * alto}px)` },
            { transform: `translateY(-${filaFinal.ventana * alto}px)` },
          ],
          { duration: ASIENTO_MS, easing: CURVA_ASIENTO },
        )
        // El orden importa: primero se pone el asiento encima y despues se
        // retira el que sostenia la fila. Al reves habria un fotograma en el
        // destino antes de volver a salir hacia el.
        saltos.cancel()
        if (asiento) asiento.onfinish = () => { enMarcha.current = false }
        else enMarcha.current = false
      }
    },
    // El alto de la ventana y cuántos símbolos trae la máquina entran aquí desde
    // que el giro se escribe en píxeles: la WAAPI no entiende de filas.
    [limpiar, paradas.length, programar, reducido, tema.brake, tema.step, tema.simbolos.length, tema.ventana.alto],
  )

  /**
   * La puerta de arriba se pregunta UNA VEZ, al arrancar la tirada. Si la cámara
   * se abre con el giro ya en marcha, nada lo para solo: `animation-play-state`
   * no alcanza ni a un `setTimeout` ni a una animación de la Web Animations API,
   * así que el gabinete seguiría moviéndose hasta `brake` + el asiento —1,76 s en
   * LIBERTY BELL— encima de una captura que necesita 50 fps para que la toma no
   * se descarte.
   *
   * Y no es rebuscado: el giro se dispara a los 60 ms de montar CADA ejercicio,
   * y abrir la cámara es un toque que cae donde caiga.
   *
   * Se termina como termina el modo reducido: SE PIERDE EL GIRO, NO EL
   * ARGUMENTO. Y desde que el estado salta al destino en el primer render, aquí
   * no hay que colocar nada: al cancelar las animaciones, el estilo de React
   * —que ya es la parada de destino— queda a la vista de golpe.
   */
  const cortarTirada = useCallback(() => {
    if (!enMarcha.current) return
    enMarcha.current = false
    limpiar()
    setSpinA(false)
    setSpinB(false)
    setSpinC(false)
    // El apagado del premio es un temporizador, y acaba de cancelarse con los
    // demás. Puede estar encendido de la tirada anterior —`girarA` limpia el
    // apagado pendiente y no toca `win`—, y sin esta línea se quedaría así para
    // siempre.
    setWin(false)
    // `catIdx` SÍ hace falta: no se mueve hasta que acaban los saltos, así que
    // sin esto el paginador y el aviso hablado se quedarían en la parada
    // anterior mientras la ventana enseña la nueva.
    setCatIdx(paradaBuscada.current)
    // La ventana ya está en su fila desde el primer render. Se repite aquí para
    // que cortar siga colocándola aunque un día se deshaga ese adelanto.
    fila.current = { ...fila.current, ventana: paradaBuscada.current * 2 }
    setROff(paradaBuscada.current * 2)
  }, [limpiar])

  useEffect(() => alAbrirseLaCamara(cortarTirada), [cortarTirada])

  // Las tipografías del gabinete se piden aquí, no en la hoja de estilos: son
  // 314 KB que solo hacen falta en la pantalla de entrenar. Ver
  // `fuentesDelGabinete.ts` para por qué no van en un @import.
  useEffect(() => {
    cargarFuentesDelGabinete()
  }, [])

  // Al entrar al ejercicio: un giro que aterriza en el nombre. Se programa en
  // vez de lanzarse en el cuerpo del efecto — un setState síncrono ahí es un
  // error de lint en este repo y encadena renders.
  useEffect(() => {
    programar(() => girarA(0), 60)
    return limpiar
  }, [girarA, limpiar, programar])

  // El giro por reloj queda ANULADO por defecto. La prop sigue ahí para poder
  // reactivarlo sin tocar código.
  const catRef = useRef(0)
  useEffect(() => {
    catRef.current = catIdx
  }, [catIdx])
  useEffect(() => {
    if (!autoSpin || paused || reducido || paradas.length < 2) return
    const tic = window.setInterval(() => {
      if (document.visibilityState === 'visible') girarA(catRef.current + 1)
    }, 4200)
    return () => clearInterval(tic)
  }, [autoSpin, paused, reducido, paradas.length, girarA])

  // El bote de las marquesinas LED sube solo. Con `reduce`, se queda quieto.
  useEffect(() => {
    if (!tema.bote || reducido) return
    const tic = window.setInterval(() => setJackTick((t) => t + 1), BOTE_MS)
    return () => clearInterval(tic)
  }, [tema.bote, reducido])

  const tirar = () => {
    setLeverDown(true)
    window.setTimeout(() => setLeverDown(false), 300)
    girarA(catIdx + 1)
  }

  const visible = paradas[catIdx] ?? paradas[0]
  const filas = Math.max(1, paradas.length * 2)
  const pos = reducido ? catIdx : ((rOff % filas) + filas) % filas
  const bote = tema.bote ? tema.bote + jackTick * 7 : undefined

  return (
    <div
      style={{ backgroundImage: tema.marco.fondo, padding: tema.marco.padding, borderRadius: tema.marco.radius }}
    >
      {/* El gabinete es la escena. La profundidad se reparte como en una maquina
          de verdad —la marquesina sobresale, los carretes viven detras del
          cristal, la palanca es lo unico que se agarra— y NADA de aqui dentro
          cambia de vocabulario: las fuentes y las cinco familias de keyframes
          del gabinete siguen siendo suyas. Lo unico que entra es la escala de
          profundidad, que es geometria, no estilo. */}
      <div
        className="escena-prof"
        style={{
          background: tema.cuerpo.fondo,
          borderRadius: tema.cuerpo.radius,
          border: tema.cuerpo.borde,
          padding: tema.cuerpo.padding,
          fontFamily: tema.fuente,
        }}
      >
        <LineaSuperior index={index} total={total} categoria={categoria} rango={rango} acento={tema.acento} />

        {/* RELIEVE (+16): la corona y la marquesina van montadas SOBRE el frontal
            del mueble, que es donde estan en una maquina fisica. */}
        <div style={{ transform: 'translateZ(var(--prof-relieve))' }}>
          <Corona tema={tema} />
          <MarquesinaTema tema={tema} reducido={reducido} bote={bote} />
        </div>

        <div className="mt-2.5 flex items-stretch gap-2 [transform-style:preserve-3d]">
          {/* FONDO (-24): los carretes laterales viven detras del cristal. Son
              adorno y no llevan un solo glifo que leer, asi que hundirlos no
              cuesta nada — y es lo que convierte el frontal en un mueble con
              hondura en vez de una tarjeta con dibujos. */}
          {tema.carretes && (
            <div className="flex [transform:translateZ(var(--prof-fondo))]">
              <Carrete tema={tema} off={sideA} spin={spinA} blur={1.6} reducido={reducido} movil={carreteIzquierdo} />
            </div>
          )}

          <Ventana
            tema={tema}
            paradas={paradas}
            pos={pos}
            spin={spinC}
            snap={snap}
            reducido={reducido}
            win={win}
            catIdx={catIdx}
            onRefTap={onRefTap}
            movil={ventana}
          />

          {tema.carretes && (
            <div className="flex [transform:translateZ(var(--prof-fondo))]">
              <Carrete tema={tema} off={sideB} spin={spinB} blur={1.4} reducido={reducido} movil={carreteDerecho} />
            </div>
          )}

          {/* SUJETO (+40): la palanca, y es la unica cosa a este escalon en toda
              la escena. Se cumple la regla —uno por escena— y ademas cae en lo
              correcto: es lo unico del gabinete que se agarra. */}
          <div className="flex [transform:translateZ(var(--prof-sujeto))]">
            <Palanca tema={tema} abajo={leverDown} onTirar={tirar} />
          </div>
        </div>

        {/* La Ventana se queda en el PLANO a proposito, y es la decision que mas
            se piensa aqui. Fisicamente iria detras del cristal con los carretes,
            pero es lo unico que hay que LEER y ademas se toca. Hundirla a -24 la
            pintaria un 2,6 % mas pequena —a 9,5 px de rotulo eso se nota— y
            romperia la regla de que ninguna zona tocable baja del plano.
            La lupa de desbordamiento no se ve afectada por nada de esto: mide con
            `scrollHeight`/`clientHeight`, que son de maquetacion y no los cambia
            una transformada. El aviso de «ver completo» sigue apareciendo cuando
            el texto no cabe. */}
        <Paginador tema={tema} paradas={paradas} catIdx={catIdx} onIr={girarA} />

        {/* HUECO (-8): la bandeja es un hueco en el mueble, que es exactamente lo
            que es en una maquina. No lleva diana tactil, asi que el encogimiento
            no le quita a nadie los 44 px. */}
        <div style={{ transform: 'translateZ(var(--prof-hueco))' }}>
          <Bandeja tema={tema} credits={credits} win={win} reducido={reducido} />
        </div>
      </div>

      <span className="sr-only">{nombre}</span>
      <span className="sr-only" aria-live="polite">
        {visible ? `${visible.etiqueta}: ${visible.valor}` : ''}
      </span>
    </div>
  )
}

/** Fuera del tema: tipografía y colores del sistema. */
function LineaSuperior({
  index, total, categoria, rango, acento,
}: { index: number; total: number; categoria: string; rango: string; acento: string }) {
  const dos = (n: number) => String(n).padStart(2, '0')
  return (
    <div className="flex items-center justify-between gap-2 font-sans">
      <span className="flex min-w-0 items-center gap-2">
        <span className="cifras shrink-0 text-[9.5px] font-bold text-tenue">
          Ejercicio {dos(index + 1)} / {dos(total)}
        </span>
        <span className="h-2.5 w-px shrink-0 bg-linea" aria-hidden="true" />
        <span className="truncate text-[9.5px] font-bold uppercase tracking-[0.16em]" style={{ color: acento }}>
          {categoria}
        </span>
      </span>
      <span className="cifras shrink-0 text-[9.5px] font-bold text-tenue">
        Rango ({rango.replace(/[()]/g, '')})
      </span>
    </div>
  )
}

function Corona({ tema }: { tema: SlotTheme }) {
  const base: CSSProperties = { color: tema.acento, fontFamily: tema.fuente }
  if (tema.id === 'liberty') {
    return (
      <div className="mt-2 text-center" style={{ borderBottom: '2px double rgba(200,173,110,.45)', paddingBottom: 6 }}>
        <div style={{ ...base, fontWeight: 900, fontSize: 19, letterSpacing: '.16em', textShadow: '0 2px 0 rgba(0,0,0,.7)' }}>
          {tema.nombre}
        </div>
        <div style={{ ...base, fontStyle: 'italic', fontSize: 10, letterSpacing: '.3em', color: '#8a733f' }}>{tema.anio}</div>
      </div>
    )
  }
  if (tema.id === 'fruit') {
    return (
      <div className="mt-2 flex items-baseline justify-center gap-2">
        <span style={{ ...base, fontSize: 20, color: '#efe4cd', textShadow: '2px 2px 0 #a8261c, 4px 4px 0 rgba(0,0,0,.5)' }}>
          {tema.nombre}
        </span>
        <span style={{ ...base, fontSize: 10, color: '#a8261c' }}>{tema.anio}</span>
      </div>
    )
  }
  if (tema.id === 'sevens') {
    return (
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span style={{ ...base, fontSize: 21, color: '#dde3e7', textShadow: '0 0 18px rgba(200,255,30,.35)' }}>
          {tema.nombre}
        </span>
        <span className="cifras" style={{ fontSize: 10, letterSpacing: '.24em', color: tema.acento }}>{tema.anio}</span>
      </div>
    )
  }
  if (tema.id === 'diamond') {
    return (
      <div className="mt-2 text-center">
        <div style={{ ...base, fontWeight: 900, fontSize: 18, letterSpacing: '.4em', color: '#cfe9f6', textShadow: `0 0 14px ${tema.acento}55` }}>
          {tema.nombre}
        </div>
        <div style={{ ...base, fontWeight: 600, fontSize: 9, letterSpacing: '.42em', color: '#5d7f92' }}>{tema.anio}</div>
      </div>
    )
  }
  return (
    <div
      className="mt-2 flex items-baseline justify-center gap-2 py-1"
      style={{ borderTop: '2px solid rgba(216,180,95,.35)', borderBottom: '2px solid rgba(216,180,95,.35)' }}
    >
      <span style={{ ...base, fontSize: 17, color: '#d8b45f', textShadow: '0 2px 0 #4a3a14' }}>{tema.nombre}</span>
      <span style={{ ...base, fontSize: 9, color: tema.acento }}>{tema.anio}</span>
    </div>
  )
}

function MarquesinaTema({ tema, reducido, bote }: { tema: SlotTheme; reducido: boolean; bote?: number }) {
  if (tema.marquesina === 'bombillas') {
    return (
      <div className="mt-2 flex justify-between px-0.5" aria-hidden="true">
        {Array.from({ length: 13 }, (_, i) => (
          <span
            key={i}
            style={{
              width: 7, height: 7, borderRadius: 999, background: tema.acento,
              boxShadow: `0 0 9px ${tema.acento}`,
              animation: reducido ? undefined : `bulbPulse 1.4s ease-in-out ${i * 115}ms infinite`,
            }}
          />
        ))}
      </div>
    )
  }
  if (tema.marquesina === 'banderin') {
    return (
      <div className="mt-2 flex justify-center" aria-hidden="true">
        <span
          style={{
            background: 'linear-gradient(180deg,#e2564a,#a8261c)',
            boxShadow: '0 3px 0 #6d160f',
            borderRadius: 4, padding: '3px 14px',
            fontFamily: tema.fuente, fontSize: 11, color: '#ffeccf',
            animation: reducido ? undefined : 'ribbonSway 3.4s ease-in-out infinite',
          }}
        >
          BELL · FRUIT · GUM
        </span>
      </div>
    )
  }
  if (tema.marquesina === 'neon') {
    const tubo = (dur: string): CSSProperties => ({
      height: 9, flex: 1, borderRadius: 999,
      background: 'linear-gradient(90deg, rgba(200,255,30,.2), #c8ff1e 45%, rgba(200,255,30,.2))',
      boxShadow: '0 0 16px rgba(200,255,30,.6)',
      animation: reducido ? undefined : `neonFlicker ${dur} linear infinite`,
    })
    return (
      <div className="mt-2 flex items-center gap-2" aria-hidden="true">
        <span style={tubo('4.5s')} />
        <span style={{ fontFamily: tema.fuente, fontSize: 13, color: '#e2564a', animation: reducido ? undefined : 'neonFlicker 3.1s linear infinite' }}>777</span>
        <span style={tubo('5.3s')} />
      </div>
    )
  }
  // LED con bote
  return (
    <div
      className="mt-2 flex items-center gap-2 px-2 py-1"
      style={{ background: '#05080a', border: '1px solid rgba(255,255,255,.08)', borderRadius: 3 }}
      aria-hidden="true"
    >
      <span style={{ fontFamily: tema.fuente, fontWeight: 900, fontSize: 10, letterSpacing: '.3em', color: tema.acento }}>
        JACKPOT
      </span>
      {/* La tira de leds viaja con `transform` dentro de un contenedor recortado,
          no animando `background-position`: eso repintaba la tira en cada
          fotograma sin tocar el compositor, y corria mientras el encoder
          captura. El hijo se extiende 14 px por la izquierda —un periodo entero
          del degradado— para que al recorrerlos no aparezca un hueco. */}
      <span style={{ flex: 1, height: 5, position: 'relative', overflow: 'hidden' }}>
        <span
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: -14,
            right: 0,
            backgroundImage: `repeating-linear-gradient(90deg, ${tema.acento}e6 0 6px, transparent 6px 14px)`,
            animation: reducido ? undefined : 'ledScan .85s linear infinite',
          }}
        />
      </span>
      <span className="cifras" style={{ fontSize: 14, color: tema.acento, textShadow: `0 0 10px ${tema.acento}88` }}>
        {bote?.toLocaleString('es-CO')}
      </span>
    </div>
  )
}

function Carrete({ tema, off, spin, blur, reducido, movil }: {
  tema: SlotTheme
  off: number
  spin: boolean
  blur: number
  reducido: boolean
  /** El nodo que se mueve. Es donde se escribe la animacion del giro. */
  movil?: Ref<HTMLDivElement>
}) {
  const s = tema.simbolos
  return (
    <div
      className="shrink-0 overflow-hidden"
      style={{ width: 40, height: tema.ventana.alto, background: '#0b0907', border: '2px solid #5a4a2a', borderRadius: 3 }}
      aria-hidden="true"
    >
      <div
        ref={movil}
        style={{
          transform: reducido ? undefined : `translateY(-${(off % s.length) * (tema.ventana.alto / 2)}px)`,
          filter: spin && !reducido ? `blur(${blur}px)` : undefined,
          transition: spin ? 'none' : 'transform .5s cubic-bezier(.14,1.06,.32,1)',
        }}
      >
        {[...s, ...s].map((clave, i) => (
          <div key={i} className="grid place-items-center" style={{ height: tema.ventana.alto / 2, color: tema.acento, opacity: 0.75 }}>
            <Icono clave={clave} tam={20} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Ventana({
  tema, paradas, pos, spin, snap, reducido, win, catIdx, onRefTap, movil,
}: {
  tema: SlotTheme
  paradas: Parada[]
  pos: number
  spin: boolean
  snap: boolean
  reducido: boolean
  win: boolean
  catIdx: number
  onRefTap?: () => void
  /** El nodo que se mueve. Es donde se escribe la animacion del giro. */
  movil?: Ref<HTMLDivElement>
}) {
  const alto = tema.ventana.alto
  // Con reducido no hay transicion que valga: el salto es instantaneo. La rama
  // que habia aqui declaraba `opacity 160ms` sobre este contenedor, cuya opacidad
  // no cambia nunca —la que cambia es la del hijo—, asi que estaba muerta.
  const transicion = snap || reducido ? 'none' : 'transform .68s cubic-bezier(.14,1.06,.32,1)'
  const marca = (lado: 'left' | 'right') => (
    <span
      aria-hidden="true"
      className={`absolute top-1/2 flex -translate-y-1/2 flex-col gap-1.5 ${lado === 'left' ? 'left-0' : 'right-0'}`}
    >
      {[0, 1].map((i) => (
        <span key={i} style={{ width: 4, height: 18, background: tema.acento, opacity: 0.55 }} />
      ))}
    </span>
  )

  return (
    <div
      className="relative flex-1 overflow-hidden"
      style={{
        height: alto,
        borderRadius: tema.ventana.radius,
        background: tema.ventana.fondo,
        border: tema.ventana.borde,
        boxShadow: tema.ventana.sombra,
      }}
    >
      {marca('left')}
      {marca('right')}

      {/* El `transform` se escribe SIEMPRE, tambien con movimiento reducido.
          Hasta hoy se tiraba (`reducido ? undefined`), y como la ventana lleva
          `overflow: hidden` y alto fijo, solo se veia la parada 0 — que ademas
          va a opacidad 0 porque no es la elegida. Resultado: quien pide menos
          movimiento tiraba de la palanca y veia una ventana negra sin una sola
          letra, justo lo contrario de lo que promete el docblock de este archivo.
          `pos` ya vale `catIdx` cuando hay reducido, asi que el salto es
          instantaneo: SE PIERDE EL GIRO, NO EL ARGUMENTO. Es el mismo criterio
          que GraficaBrazo ya sigue con su modo reducido. */}
      <div
        ref={movil}
        style={{
          transform: `translateY(-${pos * alto}px)`,
          transition: transicion,
          filter: spin && !reducido ? 'blur(1.2px)' : undefined,
        }}
      >
        {paradas.map((parada, i) => (
          <div key={parada.etiqueta}>
            {/* `data-parada` es lo que mide la lupa: quien recorta es esta
                caja de alto fijo, no el `span` del texto, que crece libre. */}
            <div data-parada={i} style={{ height: alto }}>
              <Disposicion tema={tema} parada={parada} oculta={reducido && i !== catIdx} onRefTap={onRefTap} />
            </div>
            {!reducido && (
              <div className="flex items-center justify-center" style={{ height: alto, gap: 22, color: tema.acento, opacity: 0.62 }} aria-hidden="true">
                {tema.simbolos.slice(i % 3, (i % 3) + 3).map((clave, k) => (
                  <Icono key={k} clave={clave} tam={30} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(8,9,10,.86), transparent 32%, transparent 68%, rgba(8,9,10,.86))' }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(${tema.id === 'diamond' ? 118 : 74}deg, rgba(255,255,255,.07) 0 18%, transparent 46%)` }}
      />
      <LupaDeParada key={catIdx} tema={tema} parada={paradas[catIdx]} alto={alto} catIdx={catIdx} />

      {win && !reducido && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ boxShadow: `inset 0 0 34px ${tema.acento}66`, animation: 'winPulse .34s ease-in-out 2' }}
        />
      )}
    </div>
  )
}

/**
 * Un toque en la ventana enseña la parada entera, cuando no cabe.
 *
 * Encoger el texto resuelve casi todo, pero no todo: un nombre de 60 caracteres
 * acabaría ilegible antes que cabiendo. Aquí se corta a propósito —lo que
 * mantiene el gabinete con su tamaño y su forma— y el texto completo queda a un
 * toque de distancia.
 *
 * Solo aparece cuando de verdad se está cortando. Ofrecer «ver completo» en un
 * nombre que se lee entero es ruido, y enseña a ignorar el aviso el día que sí
 * importa. Se mide contra el DOM (`scrollHeight` vs `clientHeight`), no
 * adivinando por número de caracteres: lo que desborda depende de la fuente de
 * cada máquina y del ancho real del móvil.
 */
function LupaDeParada({
  tema,
  parada,
  alto,
  catIdx,
}: {
  tema: SlotTheme
  parada?: Parada
  alto: number
  catIdx: number
}) {
  const caja = useRef<HTMLDivElement>(null)
  const [desborda, setDesborda] = useState(false)
  const [abierta, setAbierta] = useState(false)

  const valor = parada?.valor ?? ''

  useEffect(() => {
    // Al cambiar de parada este componente se remonta por `key`, así que la
    // lupa se cierra sola: no hace falta reiniciar el estado a mano, que además
    // sería un `setState` síncrono en un efecto —error de lint en este repo—.
    //
    // Tras el giro el layout aún se está asentando; se mide en el fotograma
    // siguiente para no preguntar por una altura que todavía no es la final.
    const id = requestAnimationFrame(() => {
      // Se mide la CAJA de la parada, no el `span` del texto. El span no tiene
      // altura fija —crece todo lo que necesite— así que su `scrollHeight`
      // siempre iguala a su `clientHeight` y el aviso no aparecería jamás.
      // Quien recorta es esta caja, con el alto de la ventana.
      //
      // El margen de 8 px distingue un recorte de verdad de los 1-2 px de
      // redondeo que devuelve el navegador: una línea cortada pasa de 12.
      const el = caja.current?.parentElement?.querySelector(
        `[data-parada="${catIdx}"]`,
      ) as HTMLElement | null
      setDesborda(el ? el.scrollHeight > el.clientHeight + 8 : false)
    })
    return () => cancelAnimationFrame(id)
  }, [valor, alto, catIdx])

  if (!parada) return null

  return (
    <div ref={caja} className="contents">
      {desborda && !abierta && (
        <button
          type="button"
          onClick={() => setAbierta(true)}
          aria-label={`Ver completo: ${valor}`}
          className="press absolute bottom-1 right-1 z-10 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
          style={{ background: tema.acento, color: tema.ventana.fondo.startsWith('#') ? tema.ventana.fondo : '#0b0907' }}
        >
          Ver completo
        </button>
      )}

      {abierta && (
        <button
          type="button"
          onClick={() => setAbierta(false)}
          aria-label="Cerrar"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 overflow-y-auto px-3 py-2 text-center"
          style={{ background: 'rgba(6,7,8,.94)' }}
        >
          <span className="text-[8.5px] font-bold uppercase tracking-[0.28em]" style={{ color: tema.acento }}>
            {parada.etiqueta}
          </span>
          <span
            className="block"
            style={{ fontFamily: tema.fuente, fontWeight: 900, fontSize: 16, lineHeight: 1.25, color: tema.tono, textWrap: 'balance' }}
          >
            {valor}
          </span>
          <span className="text-[8.5px] uppercase tracking-[0.18em] text-tenue">Toca para cerrar</span>
        </button>
      )}
    </div>
  )
}

/** Cinco layouts genuinamente distintos, no variantes de estilo. */
function Disposicion({ tema, parada, oculta, onRefTap }: { tema: SlotTheme; parada: Parada; oculta: boolean; onRefTap?: () => void }) {
  const esNombre = parada.etiqueta === 'Ejercicio'
  const largo = parada.valor.length > 26

  /**
   * El nombre era la ÚNICA parada que no encogía nunca.
   *
   * `esNombre ? n : …` se saltaba la comprobación de longitud, así que
   * «Empuje de cadera (unilateral, con pausa)» —40 caracteres— se pintaba al
   * mismo tamaño que «Sentadilla» y se salía de una ventana de 104 px con
   * `overflow: hidden`. Se veía cortado a media letra, que no parece una
   * decisión de diseño: parece la app rota.
   *
   * Ahora encoge por tramos. Sigue siendo el texto más grande del gabinete
   * —es el dato por el que se mira—, pero cabe.
   */
  const factorNombre =
    parada.valor.length > 38 ? 0.62 : parada.valor.length > 30 ? 0.74 : parada.valor.length > 22 ? 0.86 : 1

  const cuerpo = (n: number, r: number, l: number) =>
    esNombre ? Math.round(n * factorNombre * 10) / 10 : largo ? l : r
  const envoltura = (hijos: ReactElement) =>
    parada.accion && onRefTap ? (
      <button type="button" onClick={onRefTap} className="h-full w-full" style={{ opacity: oculta ? 0 : 1 }}>
        {hijos}
      </button>
    ) : (
      <div className="h-full w-full" style={{ opacity: oculta ? 0 : 1 }} aria-hidden={oculta}>
        {hijos}
      </div>
    )

  if (tema.id === 'liberty') {
    const filete = <span style={{ width: 26, height: 1, background: `linear-gradient(90deg, transparent, ${tema.acento})` }} />
    return envoltura(
      <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
        <span className="flex items-center gap-2" style={{ color: tema.acento }}>
          {filete}
          <Icono clave={parada.simbolo} tam={15} />
          <span style={{ fontFamily: tema.fuente, fontStyle: 'italic', fontSize: 10.5, letterSpacing: '.1em', color: '#c8ad6e' }}>
            {parada.etiqueta}
          </span>
          <span style={{ width: 26, height: 1, background: `linear-gradient(90deg, ${tema.acento}, transparent)` }} />
        </span>
        <span data-valor style={{ fontFamily: tema.fuente, fontWeight: 900, fontSize: cuerpo(23, 17, 15), color: tema.tono, textWrap: 'balance', lineHeight: 1.15 }}>
          {parada.valor}
        </span>
      </div>,
    )
  }

  if (tema.id === 'fruit') {
    return envoltura(
      <div className="flex h-full items-center gap-3 px-3">
        <span
          className="grid shrink-0 place-items-center rounded-full"
          style={{ width: 54, height: 54, background: 'radial-gradient(circle at 40% 30%, #241c15, #0c0907)', border: '2px solid #d9c9a6', color: '#e2564a' }}
        >
          <Icono clave={parada.simbolo} tam={25} />
        </span>
        <span className="min-w-0 flex-1">
          <span style={{ display: 'inline-block', background: '#a8261c', padding: '2px 8px', borderRadius: 2, fontFamily: tema.fuente, fontSize: 8, color: '#ffeccf', textTransform: 'uppercase' }}>
            {parada.etiqueta}
          </span>
          <span data-valor className="mt-1 block" style={{ fontFamily: tema.fuente, fontSize: cuerpo(19, 14, 12.5), color: tema.tono, lineHeight: 1.15 }}>
            {parada.valor}
          </span>
        </span>
      </div>,
    )
  }

  if (tema.id === 'sevens') {
    return envoltura(
      <div className="grid h-full items-center px-2" style={{ gridTemplateColumns: '54px 1fr 26px' }}>
        <span className="grid h-full place-items-center" style={{ color: tema.acento, borderRight: '1px dashed rgba(200,255,30,.22)' }}>
          <Icono clave={parada.simbolo} tam={24} />
        </span>
        <span className="min-w-0 px-3">
          <span className="cifras block" style={{ fontSize: 8, letterSpacing: '.24em', color: '#8a9299', textTransform: 'uppercase' }}>
            {parada.etiqueta}
          </span>
          <span data-valor className="mt-0.5 block" style={{ fontFamily: tema.fuente, fontSize: cuerpo(23, 18, 15), color: tema.tono, textTransform: 'uppercase', lineHeight: 1.1 }}>
            {parada.valor}
          </span>
        </span>
        <span className="grid h-full place-items-center" style={{ borderLeft: '1px dashed rgba(200,255,30,.22)', fontFamily: tema.fuente, fontSize: 15, color: '#e2564a', opacity: 0.75 }}>
          7
        </span>
      </div>,
    )
  }

  if (tema.id === 'diamond') {
    return envoltura(
      <div className="relative flex h-full items-center justify-end pl-16 pr-4">
        <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2" style={{ color: tema.acento, opacity: 0.17 }} aria-hidden="true">
          <Icono clave={parada.simbolo} tam={86} />
        </span>
        <span className="pointer-events-none absolute bottom-3 top-3" style={{ left: 62, width: 1, background: `linear-gradient(180deg, transparent, ${tema.acento}66, transparent)` }} aria-hidden="true" />
        <span className="min-w-0 text-right">
          <span className="block" style={{ fontFamily: tema.fuente, fontWeight: 600, fontSize: 8.5, letterSpacing: '.34em', color: '#5d7f92', textTransform: 'uppercase' }}>
            {parada.etiqueta}
          </span>
          <span data-valor className="mt-1 block" style={{ fontFamily: tema.fuente, fontWeight: 900, fontSize: cuerpo(20, 15.5, 13.5), letterSpacing: '.03em', color: tema.tono, textWrap: 'balance', lineHeight: 1.2 }}>
            {parada.valor}
          </span>
        </span>
      </div>,
    )
  }

  // Cash Bonanza: la información va impresa sobre una plancha de billete.
  return envoltura(
    <div className="h-full" style={{ padding: '9px 11px' }}>
      <div
        className="relative flex h-full items-center gap-2.5 px-3"
        style={{
          border: '1.5px solid rgba(200,155,70,.55)', borderRadius: 4,
          backgroundColor: '#0a120d',
          backgroundImage: 'repeating-linear-gradient(135deg, rgba(127,201,141,.05) 0 6px, transparent 6px 12px)',
        }}
      >
        <span className="absolute left-1.5 top-1" style={{ fontFamily: tema.fuente, fontSize: 7.5, color: '#c89b46' }} aria-hidden="true">A</span>
        <span className="absolute bottom-1 right-1.5" style={{ fontFamily: tema.fuente, fontSize: 7.5, color: '#c89b46' }} aria-hidden="true">A</span>
        <span className="grid shrink-0 place-items-center rounded-full" style={{ width: 46, height: 46, border: '1.5px dashed #c89b46', color: tema.acento }}>
          <Icono clave={parada.simbolo} tam={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block" style={{ fontFamily: tema.fuente, fontSize: 7.5, letterSpacing: '.16em', color: tema.acento, textTransform: 'uppercase' }}>
            {parada.etiqueta}
          </span>
          <span data-valor className="mt-0.5 block" style={{ fontFamily: tema.fuente, fontSize: cuerpo(15, 12, 10.5), color: tema.tono, lineHeight: 1.2 }}>
            {parada.valor}
          </span>
        </span>
      </div>
    </div>,
  )
}

function Palanca({ tema, abajo, onTirar }: { tema: SlotTheme; abajo: boolean; onTirar: () => void }) {
  const p = tema.palanca
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1" style={{ width: 48 }}>
      <button
        type="button"
        onClick={onTirar}
        aria-label="Girar información del ejercicio"
        className="flex flex-col items-center"
        style={{
          transform: abajo ? `rotate(${p.grados}deg) translateY(${p.baja}px)` : 'rotate(0deg)',
          transformOrigin: 'bottom center',
          transition: `transform ${p.vuelta}`,
        }}
      >
        <span
          style={{
            width: p.pomoTam, height: p.pomoTam,
            borderRadius: p.rombo ? 3 : 999,
            transform: p.rombo ? 'rotate(45deg)' : undefined,
            background: p.pomo,
            boxShadow: `0 4px 10px rgba(0,0,0,.6), 0 0 12px ${tema.acento}55`,
          }}
        />
        <span style={{ width: p.vastagoAncho, height: 30, background: p.vastago, borderRadius: p.rombo ? 0 : '0 0 4px 4px' }} />
      </button>
      <span style={{ fontFamily: tema.fuente, fontSize: 8, color: tema.acento, fontStyle: tema.id === 'liberty' ? 'italic' : undefined }}>
        {p.etiqueta}
      </span>
    </div>
  )
}

function Paginador({ tema, paradas, catIdx, onIr }: { tema: SlotTheme; paradas: Parada[]; catIdx: number; onIr: (i: number) => void }) {
  return (
    <div className="mt-2 flex items-center justify-center">
      {paradas.map((parada, i) => {
        const activo = i === catIdx
        // El punto alargado se ensancha al activarse. Lo hacia con `width`, que
        // relayoutea en cada fotograma — y este gabinete vive en la misma
        // pantalla que la camara. Ahora el ancho es FIJO (el del activo) y lo
        // que cambia es un `scaleX`, que se queda en el compositor. Sale del
        // centro para que el punto siga centrado en su area tactil de 44 px.
        // Las otras dos formas no cambian de tamano: su transform es estatico.
        const anchoAbierto = tema.id === 'fruit' ? 24 : 22
        const forma: CSSProperties =
          tema.punto === 'rombo'
            ? { width: 9, height: 9, borderRadius: 2, transform: 'rotate(45deg)' }
            : tema.punto === 'circulo'
              ? { width: 9, height: 9, borderRadius: 999 }
              : {
                  width: anchoAbierto,
                  height: 8,
                  borderRadius: 2,
                  transform: `scaleX(${activo ? 1 : 8 / anchoAbierto})`,
                }
        return (
          <button
            key={parada.etiqueta}
            type="button"
            onClick={() => onIr(i)}
            aria-label={`Ver ${parada.etiqueta.toLowerCase()}`}
            aria-current={activo}
            // Área táctil de 44px aunque el punto mida 9.
            className="grid place-items-center"
            style={{ width: 44, height: 44 }}
          >
            <span
              style={{
                ...forma,
                background: activo ? tema.acento : '#4a4133',
                transition: 'transform var(--dur-base) var(--ease-salida)',
              }}
            />
          </button>
        )
      })}
    </div>
  )
}

function Bandeja({ tema, credits, win, reducido }: { tema: SlotTheme; credits: number; win: boolean; reducido: boolean }) {
  return (
    <div className="mt-1 flex items-center justify-between gap-2" style={{ borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: 7 }}>
      <span className="flex items-center gap-2" style={{ color: tema.acento }}>
        <span className="flex items-center gap-1" aria-hidden="true">
          {tema.bandeja.simbolos.map((clave, i) => (
            <Icono key={i} clave={clave} tam={13} />
          ))}
        </span>
        <span style={{ fontFamily: tema.fuente, fontSize: 8.5, opacity: 0.85, fontStyle: tema.id === 'liberty' ? 'italic' : undefined }}>
          {tema.bandeja.leyenda}
        </span>
      </span>
      <span className="relative flex items-center gap-1.5">
        {win && !reducido && (
          <span
            aria-hidden="true"
            className="absolute -left-4"
            style={{ color: tema.acento, animation: 'coinFall .4s ease-out' }}
          >
            <Icono clave="moneda" tam={12} />
          </span>
        )}
        <span style={{ fontFamily: tema.fuente, fontSize: 7.5, letterSpacing: '.14em', color: '#7d7d7d' }}>CRÉDITOS</span>
        <span
          className={tema.id === 'sevens' ? 'cifras' : undefined}
          style={{ fontFamily: tema.id === 'sevens' ? undefined : tema.fuente, fontWeight: 900, fontSize: tema.id === 'liberty' ? 15 : 14, color: tema.acento }}
        >
          {credits}
        </span>
      </span>
    </div>
  )
}

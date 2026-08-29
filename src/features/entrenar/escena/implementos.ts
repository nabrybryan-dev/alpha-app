import { grados, V, type Vec3 } from '../../../domain/patrones/algebra'
import { Malla, type Color } from '../../../domain/patrones/malla'
import { puntoDeHueso, type EsqueletoResuelto } from '../../../domain/patrones/esqueleto'
import { modeloDePalanca, planDeMedida } from '../../../domain/biomecanica/palancas'
import type { Articulacion } from '../../../domain/biomecanica/tipos'
// La primitiva que se orienta sola vive en `sala.ts` y se importa, no se copia:
// dos copias de la regla de enrollado es como vuelven las caras del revés.
import { cuadro } from './sala'

/**
 * LOS IMPLEMENTOS: la barra, la mancuerna y la máquina.
 *
 * ## Por qué esto faltaba, y por qué se nota tanto
 *
 * Hasta hoy el sujeto del salón entrenaba con las manos vacías. Un press sin
 * barra no es un press: es alguien empujando el aire, y el ojo lo detecta antes
 * que cualquier otra cosa de la escena. No es un adorno — es el quinto de los
 * cinco elementos que tienen que verse a la vez, y sin él los otros cuatro
 * quedan describiendo un gesto que no está.
 *
 * ## La colocación NO se decide aquí
 *
 * Ésta es la regla que ordena el módulo entero, y conviene leerla antes de
 * tocar nada: **este archivo no sabe de ejercicios**. No hay ninguna tabla que
 * diga «la sentadilla lleva barra a la espalda» ni «la prensa lleva raíl». Eso
 * ya está decidido, y está decidido en un sitio:
 *
 *   - `domain/biomecanica/implementos.ts` — qué implemento declara el NOMBRE del
 *     ejercicio (`implementoDe`), y qué le hace ese implemento a la medida. De
 *     ahí sale la pieza que se dibuja.
 *   - `PerfilDeImplemento.aplicacion` — **dónde entra la carga en el cuerpo**:
 *     manos, hombros, pelvis, pies, tobillo o el cuerpo entero. De ahí sale el
 *     punto de agarre, y por eso una prensa no cuelga de las manos.
 *   - `PerfilDeImplemento.cargas` — una masa o dos. De ahí sale si las dos manos
 *     comparten una pieza rígida (barra) o si cada una lleva la suya
 *     (mancuernas). La tabla ya avisa de que dos masas no son una con el doble
 *     de peso, y aquí eso se ve: dos piezas que pueden ir a distinta altura.
 *   - `ModeloDePalanca.cadena` y `anclaje` — quién está fijo al mundo. Con
 *     cadena cerrada y las manos en una barra fija, la barra **no la lleva el
 *     sujeto**: está clavada al techo y es él quien sube. Dibujarla en las manos
 *     de una dominada contaría el ejercicio contrario.
 *   - `PlanDeMedida.unilateral` — si la carga va a un solo lado. Es ortogonal al
 *     implemento (hay mancuernas, poleas y prensas unilaterales), así que va
 *     aparte, igual que en la tabla.
 *
 * Duplicar cualquiera de esas decisiones aquí sería el fallo de siempre: dos
 * tablas que empiezan iguales y se separan en el primer ajuste, y entonces la
 * pantalla enseña un implemento y la medida usa otro.
 *
 * `src/domain/**` es de solo lectura para este trabajo. Se lee y se obedece.
 *
 * ## Dos pasos, y el primero es puro
 *
 * `implementosDeEscena(categoria, nombre)` no dibuja: devuelve QUÉ piezas van y
 * DÓNDE se enganchan, en huesos y en metros, sin tocar una malla. Se puede
 * examinar, contar y comparar sin pintar un píxel — que es lo que permite
 * comprobar que una sentadilla en barra y una prensa no reciben lo mismo.
 *
 * `construirImplementos(m, escena, esq)` resuelve esos enganches contra el
 * ESQUELETO REAL de la fase que se está dibujando y construye la geometría. Las
 * manos las da `puntoDeHueso`, no una tabla de alturas: si el sujeto baja, la
 * barra baja con él, y no hay dos versiones de dónde está la mano.
 *
 * ## Lo que la escena no puede prometer
 *
 * `avisos` sale de `PlanDeMedida.limites`, tal cual. Si el implemento es un
 * Smith, ahí está escrito que el raíl fija el brazo de momento; si es unilateral,
 * que el momento frontal no se ve de lado. La escena dibuja el objeto; lo que ese
 * objeto le hace a la medida lo sigue diciendo la tabla, con sus palabras.
 */

// ---------------------------------------------------------------------------
// Materia. Negro mate y acentos rojo profundo, contra la iluminación fija del
// motor (dos luces y bruma azulada). Un color elegido a ojo fuera sale distinto.
// ---------------------------------------------------------------------------

/** El acero de la barra: claro para que el contraluz la separe del fondo. */
const ACERO: Color = [0.36, 0.385, 0.43]
/** La manga, un punto más apagada que la barra: es donde no se agarra. */
const MANGA: Color = [0.26, 0.28, 0.32]
/** Caucho de disco. Casi negro: el disco es masa, no brillo. */
const CAUCHO: Color = [0.055, 0.06, 0.068]
/** El filo del disco lleva el rojo de la marca. Es el único acento de la barra. */
const FILO: Color = [0.42, 0.115, 0.125]
/** La cabeza de la mancuerna, hexagonal y mate. */
const CABEZA: Color = [0.155, 0.165, 0.19]
/** Bastidor de máquina: más oscuro que la barra, para que no le robe la mirada. */
const BASTIDOR: Color = [0.105, 0.113, 0.128]
/** La pila de placas. Gris medio: se tiene que leer que son muchas y apiladas. */
const PLACA: Color = [0.175, 0.187, 0.212]
/** Tapizado del respaldo y de los rodillos. */
const TAPIZADO: Color = [0.082, 0.085, 0.095]
/** El cable de la polea. Fino y claro, porque su DIRECCIÓN es el dato. */
const CABLE: Color = [0.34, 0.36, 0.40]

const ARRIBA: Vec3 = [0, 1, 0]

// ---------------------------------------------------------------------------
// Medidas. Las de un gimnasio real, en metros.
// ---------------------------------------------------------------------------

/** Radio de la zona moleteada de una barra olímpica: 28 mm de diámetro. */
const RADIO_BARRA = 0.014
/** Radio de la manga, donde entran los discos: 50 mm de diámetro. */
const RADIO_MANGA = 0.025
/**
 * Cuánto sobresale la barra por fuera de cada mano.
 *
 * No es un número por ejercicio: es lo que mide una manga con su disco y su
 * cierre, y se suma a la distancia REAL entre las manos de la pose. Así un
 * agarre ancho de press y uno estrecho de curl dan barras de distinta longitud
 * sin que nadie tenga que declararlo.
 */
const VUELO = 0.42
/** Disco grande de 45 cm de diámetro: el que se ve en el suelo del peso muerto. */
const RADIO_DISCO = 0.225
/** Grosor del disco de caucho. */
const GRUESO_DISCO = 0.06
/** Largo de la mancuerna, de cabeza a cabeza. */
const LARGO_MANCUERNA = 0.36
/** Media diagonal de la cabeza de mancuerna. */
const RADIO_CABEZA = 0.075

// ---------------------------------------------------------------------------
// Primitivas. Todas pasan por `cuadro`, que SE ORIENTA SOLA.
// ---------------------------------------------------------------------------

const cara = cuadro

/**
 * Base perpendicular a un eje. La misma receta que usa `viga` en `tripode.ts`:
 * una auxiliar que no sea paralela al eje, y dos cruces.
 */
function base(eje: Vec3): { u: Vec3; w: Vec3 } {
  const aux: Vec3 = Math.abs(eje[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
  const u = V.normalizar(V.cruz(eje, aux))
  return { u, w: V.normalizar(V.cruz(eje, u)) }
}

/**
 * Un disco plano que mira hacia `n`.
 *
 * El abanico se enrolla a mano y no con `cuadro`, así que el orden importa: con
 * `u × w = n`, ir de `u` hacia `w` es antihorario visto desde `+n`, que es
 * justo la cara que el motor no descarta. Escribirlo al revés no da ningún
 * error — la GPU tira la cara en silencio y el disco desaparece exactamente
 * desde el lado desde el que importa verlo.
 */
function tapa(m: Malla, centro: Vec3, n: Vec3, radio: number, c: Color, seg = 16): void {
  const { u, w } = base(n)
  const k = m.vertices
  m.vertice(centro, n, c, 0)
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2
    m.vertice(
      V.sumar(centro, V.sumar(V.escalar(u, Math.cos(a) * radio), V.escalar(w, Math.sin(a) * radio))),
      n,
      c,
      0,
    )
  }
  for (let i = 0; i < seg; i++) m.triangulo(k, k + 1 + i, k + 2 + i)
}

/** El manto de un cilindro entre dos puntos, sin tapas. */
function manto(m: Malla, a: Vec3, b: Vec3, radio: number, c: Color, seg = 12): void {
  const eje = V.normalizar(V.restar(b, a))
  const { u, w } = base(eje)
  const en = (p: Vec3, ang: number): Vec3 =>
    V.sumar(p, V.sumar(V.escalar(u, Math.cos(ang) * radio), V.escalar(w, Math.sin(ang) * radio)))
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2
    const a1 = ((i + 1) / seg) * Math.PI * 2
    const medio = (a0 + a1) / 2
    const n = V.sumar(V.escalar(u, Math.cos(medio)), V.escalar(w, Math.sin(medio)))
    cara(m, [en(a, a0), en(b, a0), en(b, a1), en(a, a1)], n, c)
  }
}

/** Cilindro cerrado. Las tapas se pueden quitar cuando quedan dentro de otra pieza. */
function cilindro(
  m: Malla,
  a: Vec3,
  b: Vec3,
  radio: number,
  c: Color,
  seg = 12,
  tapar = true,
): void {
  manto(m, a, b, radio, c, seg)
  if (!tapar) return
  const eje = V.normalizar(V.restar(b, a))
  tapa(m, b, eje, radio, c, seg)
  tapa(m, a, V.escalar(eje, -1), radio, c, seg)
}

/**
 * Una caja con giro alrededor del eje vertical. Es el ladrillo de las máquinas:
 * bastidores, placas, respaldos y bases se construyen con cajas.
 */
function caja(m: Malla, centro: Vec3, medias: Vec3, giroY: number, c: Color): void {
  const g = grados(giroY)
  const ex: Vec3 = [Math.cos(g), 0, -Math.sin(g)]
  const ez: Vec3 = [Math.sin(g), 0, Math.cos(g)]
  const ey = ARRIBA
  const p = (sx: number, sy: number, sz: number): Vec3 =>
    V.sumar(
      centro,
      V.sumar(
        V.escalar(ex, sx * medias[0]),
        V.sumar(V.escalar(ey, sy * medias[1]), V.escalar(ez, sz * medias[2])),
      ),
    )
  const caras: [Vec3, [Vec3, Vec3, Vec3, Vec3]][] = [
    [ez, [p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1)]],
    [V.escalar(ez, -1), [p(1, -1, -1), p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1)]],
    [ex, [p(1, -1, 1), p(1, -1, -1), p(1, 1, -1), p(1, 1, 1)]],
    [V.escalar(ex, -1), [p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1)]],
    [ey, [p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1), p(-1, 1, -1)]],
    [V.escalar(ey, -1), [p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1)]],
  ]
  for (const [n, q] of caras) cara(m, q, n, c)
}

// ---------------------------------------------------------------------------
// Los constructores de malla. Cada uno recibe geometría ya resuelta: ninguno
// sabe de qué ejercicio viene, y ésa es la idea.
// ---------------------------------------------------------------------------

export interface BarraConDiscos {
  /** Los dos puntos por donde se agarra, en espacio mundo. */
  agarreA: Vec3
  agarreB: Vec3
  /** Radio del disco. Cero deja la barra desnuda, que es lo que lleva un Smith vacío. */
  radioDisco: number
  /** Cuánto sobresale por fuera de cada mano. */
  vuelo: number
}

/**
 * Barra olímpica con un disco por lado.
 *
 * La longitud NO es un dato del ejercicio: sale de la distancia real entre las
 * dos manos de la pose más el vuelo de las mangas. Un agarre ancho de press y
 * uno estrecho de curl dan barras distintas sin declarar nada.
 *
 * Un disco por lado y no cuatro: la escena tiene que decir «esto es una barra
 * cargada», no cuántos kilos hay. El número exacto ya lo dice el marcador de la
 * pared, con cifras, que es donde se lee sin contar discos de reojo.
 */
export function construirBarra(m: Malla, b: BarraConDiscos): void {
  const eje = V.normalizar(V.restar(b.agarreB, b.agarreA))
  const extA = V.restar(b.agarreA, V.escalar(eje, b.vuelo))
  const extB = V.sumar(b.agarreB, V.escalar(eje, b.vuelo))

  // El cuerpo de la barra, de manga a manga. Sin tapas: quedan dentro de ellas.
  manto(m, extA, extB, RADIO_BARRA, ACERO, 10)

  for (const [ext, signo] of [
    [extA, 1],
    [extB, -1],
  ] as const) {
    // La manga: el tramo grueso donde entran los discos.
    const dentro = V.sumar(ext, V.escalar(eje, b.vuelo * 0.72 * signo))
    cilindro(m, ext, dentro, RADIO_MANGA, MANGA, 10)
    if (b.radioDisco <= 0) continue
    // El disco, pegado al tope de la manga y no al extremo: es donde se apoya.
    const caraInterior = V.sumar(dentro, V.escalar(eje, -GRUESO_DISCO * signo))
    manto(m, caraInterior, dentro, b.radioDisco, FILO, 16)
    tapa(m, dentro, V.escalar(eje, -signo), b.radioDisco * 0.94, CAUCHO, 16)
    tapa(m, caraInterior, V.escalar(eje, signo), b.radioDisco * 0.94, CAUCHO, 16)
  }
}

/**
 * Una mancuerna, centrada en la mano y alineada con el eje que se le pase.
 *
 * Se dibuja UNA. Que haya dos es decisión de la tabla —`cargas: 2`— y por eso
 * se llama dos veces, con dos agarres distintos: cada una puede ir a su altura,
 * que es exactamente lo que la tabla avisa que desde el lateral no se ve.
 */
export function construirMancuerna(m: Malla, agarre: Vec3, eje: Vec3): void {
  const e = V.normalizar(eje)
  const medio = LARGO_MANCUERNA / 2
  const a = V.restar(agarre, V.escalar(e, medio))
  const b = V.sumar(agarre, V.escalar(e, medio))
  // El mango.
  manto(m, a, b, 0.016, ACERO, 8)
  // Las dos cabezas, hexagonales: una mancuerna redonda rueda y la del gimnasio
  // no lo hace. Seis lados es lo que la distingue de un cilindro a tres metros.
  for (const [extremo, haciaDentro] of [
    [a, e],
    [b, V.escalar(e, -1)],
  ] as const) {
    const fondo = V.sumar(extremo, V.escalar(haciaDentro, 0.008))
    const tope = V.sumar(extremo, V.escalar(haciaDentro, 0.11))
    cilindro(m, fondo, tope, RADIO_CABEZA, CABEZA, 6)
  }
}

/** Las cuatro formas de máquina que la tabla de implementos distingue. */
export type FormaDeMaquina = 'placas' | 'rail-vertical' | 'rail-inclinado' | 'polea'

export interface VolumenDeMaquina {
  forma: FormaDeMaquina
  /** Dónde se planta en el suelo de la sala, respecto al sujeto en el origen. */
  centro: Vec3
  /** Hacia dónde mira. Cero es de cara al sujeto. */
  giroGrados: number
  /** La altura a la que la máquina entrega la carga al cuerpo. */
  alturaDeCarga: number
  /** El punto del cuerpo al que llega el cable o el carro, si llega a alguno. */
  agarre?: Vec3
}

/**
 * Un volumen de máquina genérico: bastidor, pila de placas y lo que cambia de
 * una forma a otra.
 *
 * Genérico a propósito, y no por pereza. La tabla de implementos distingue
 * cuatro máquinas por lo que le hacen a la MEDIDA —leva, raíl vertical, raíl
 * inclinado y cable—, no por su marca, y son esas cuatro diferencias las que se
 * dibujan: la pila y el brazo de la de placas, los dos raíles del Smith, el
 * carro inclinado de la prensa y la columna con su cable en la polea. Modelar un
 * catálogo de máquinas reales sería dibujar diferencias que la medida no
 * distingue.
 */
export function construirMaquina(m: Malla, v: VolumenDeMaquina): void {
  const c = v.centro
  const g = v.giroGrados

  if (v.forma === 'rail-vertical') {
    // Smith: dos raíles que flanquean al sujeto. Tienen que flanquearlo porque
    // la barra va ENTRE las manos, y las manos van a los lados del cuerpo.
    for (const lado of [-1, 1]) {
      const x = c[0] + lado * 0.82
      caja(m, [x, 1.2, c[2]], [0.035, 1.2, 0.035], g, BASTIDOR)
      caja(m, [x, 0.05, c[2]], [0.09, 0.05, 0.34], g, BASTIDOR)
    }
    // El travesaño de arriba, que es lo que dice que los dos raíles son uno.
    caja(m, [c[0], 2.4, c[2]], [0.86, 0.04, 0.04], g, BASTIDOR)
    return
  }

  if (v.forma === 'rail-inclinado') {
    // Prensa: el carro corre por un raíl a 45°, y la fuerza va A LO LARGO del
    // raíl, no hacia abajo. Por eso el raíl se dibuja: es la dirección que
    // ninguno de los tres orígenes de línea de la tabla sabe describir.
    const dir: Vec3 = [0, Math.sin(grados(45)), Math.cos(grados(45))]
    const pie: Vec3 = [c[0], 0.12, c[2]]
    const alto = V.sumar(pie, V.escalar(dir, 2.05))
    for (const lado of [-1, 1]) {
      const o: Vec3 = [lado * 0.36, 0, 0]
      const a = V.sumar(pie, o)
      const b = V.sumar(alto, o)
      manto(m, a, b, 0.045, BASTIDOR, 8)
      tapa(m, b, dir, 0.045, BASTIDOR, 8)
    }
    // El carro: la plataforma donde apoyan los pies, sobre el raíl.
    const carro = v.agarre ?? V.sumar(pie, V.escalar(dir, 0.5))
    caja(m, carro, [0.42, 0.05, 0.26], 0, PLACA)
    caja(m, [c[0], 0.06, c[2] - 0.35], [0.5, 0.06, 0.4], g, BASTIDOR)
    return
  }

  if (v.forma === 'polea') {
    // Polea: una columna y un cable. El cable es la pieza que importa —la
    // dirección la fija él y no la gravedad—, y la tabla exige además que el
    // punto de anclaje ENTRE EN EL ENCUADRE: sin él no hay dirección, y sin
    // dirección no hay brazo. Por eso la columna se dibuja entera, con su polea.
    caja(m, [c[0], v.alturaDeCarga / 2, c[2]], [0.06, v.alturaDeCarga / 2, 0.06], g, BASTIDOR)
    caja(m, [c[0], 0.05, c[2]], [0.16, 0.05, 0.32], g, BASTIDOR)
    const polea: Vec3 = [c[0], v.alturaDeCarga, c[2]]
    cilindro(m, V.sumar(polea, [-0.03, 0, 0]), V.sumar(polea, [0.03, 0, 0]), 0.055, PLACA, 10)
    // La pila de placas, pegada a la columna.
    for (let i = 0; i < 8; i++) {
      caja(m, [c[0], 0.14 + i * 0.075, c[2] - 0.13], [0.13, 0.03, 0.1], g, PLACA)
    }
    if (v.agarre) cilindro(m, polea, v.agarre, 0.007, CABLE, 6, false)
    return
  }

  // Máquina de placas: bastidor, pila y un brazo que llega hasta el agarre. La
  // leva no se dibuja porque no se ve desde fuera, y es justo lo que impide
  // convertir el peso de la pila en newtons: eso lo dice la tabla, no la escena.
  caja(m, [c[0], 0.06, c[2]], [0.34, 0.06, 0.5], g, BASTIDOR)
  caja(m, [c[0], 0.85, c[2] - 0.18], [0.13, 0.79, 0.11], g, BASTIDOR)
  for (let i = 0; i < 9; i++) {
    caja(m, [c[0], 0.16 + i * 0.078, c[2] - 0.18], [0.16, 0.031, 0.15], g, PLACA)
  }
  // El respaldo, que es lo que dice que el cuerpo va apoyado y no libre.
  caja(m, [c[0], 0.62, c[2] + 0.26], [0.22, 0.3, 0.06], g, TAPIZADO)
  if (v.agarre) {
    const codo: Vec3 = [c[0], v.alturaDeCarga, c[2]]
    manto(m, codo, v.agarre, 0.022, BASTIDOR, 8)
    cilindro(
      m,
      V.sumar(v.agarre, [-0.14, 0, 0]),
      V.sumar(v.agarre, [0.14, 0, 0]),
      0.03,
      TAPIZADO,
      8,
    )
  }
}

// ---------------------------------------------------------------------------
// La parte pura: qué implementos y dónde.
// ---------------------------------------------------------------------------

export type Pieza = 'barra' | 'mancuerna' | 'disco' | 'barra-fija' | 'maquina'

/**
 * Un punto del sujeto por el que entra la carga, en coordenadas de hueso.
 *
 * Va en huesos y no en metros a propósito: la mano de una sentadilla en el
 * fondo y la del bloqueo están en sitios distintos, y una altura de tabla
 * pondría la barra en el aire en una de las dos. `t` va de 0 —origen del
 * hueso— a 1 —su extremo distal—, igual que en `puntoDeHueso`.
 */
export interface PuntoDeAgarre {
  hueso: string
  t: number
  desvio: Vec3
}

export interface ImplementoEnEscena {
  pieza: Pieza
  forma?: FormaDeMaquina
  /**
   * Los puntos por los que la carga entra en el cuerpo. Uno cuando es
   * unilateral o cuando la carga es única y centrada; dos en lo demás.
   */
  agarres: readonly PuntoDeAgarre[]
  /**
   * Si los dos agarres son de UNA sola pieza rígida. Sale de `cargas` de la
   * tabla: una barra es una masa que las dos manos comparten, dos mancuernas
   * son dos masas sueltas, una por mano, y no valen dibujadas como una sola.
   */
  rigida: boolean
  radioDisco: number
  /** Dónde se planta la pieza cuando no la lleva el sujeto, con él en el origen. */
  enElSuelo?: { centro: Vec3; giroGrados: number; alturaDeCarga: number }
  /** De dónde salió esta decisión. Es la trazabilidad, no un adorno. */
  porQue: string
}

export interface EscenaDeImplementos {
  piezas: readonly ImplementoEnEscena[]
  /**
   * Lo que con este implemento NO se puede prometer, tal cual lo dice
   * `PlanDeMedida.limites`. La escena dibuja el objeto; lo que ese objeto le
   * hace a la medida lo sigue diciendo la tabla, con sus palabras.
   */
  avisos: readonly string[]
  /**
   * `true` cuando el nombre del ejercicio no declara implemento y la escena ha
   * tenido que suponer peso libre. No es lo mismo que saberlo, y quien pinte
   * esto tiene derecho a distinguirlo.
   */
  supuesto: boolean
}

const SIN_IMPLEMENTOS: EscenaDeImplementos = { piezas: [], avisos: [], supuesto: false }

/** Las dos manos, a media palma. Es donde se cierra el agarre. */
const MANOS: readonly PuntoDeAgarre[] = [
  { hueso: 'manoD', t: 0.45, desvio: [0, 0, 0] },
  { hueso: 'manoI', t: 0.45, desvio: [0, 0, 0] },
]

/**
 * Dónde entra la carga, por `aplicacion` de la tabla de implementos.
 *
 * Cada entrada traduce una palabra de la tabla —manos, hombros, pelvis, pies,
 * tobillo, cuerpo— al hueso donde eso cae. La palabra la decide la tabla; aquí
 * solo se sabe qué hueso es cada parte, que es geometría y no biomecánica.
 */
const AGARRE_POR_APLICACION: Record<string, readonly PuntoDeAgarre[]> = {
  manos: MANOS,
  // Sobre el trapecio, por detrás del cuello: es donde se apoya una barra en
  // una sentadilla trasera, y el desvío en −Z es lo que la pone detrás.
  hombros: [{ hueso: 'torax', t: 0.86, desvio: [0, 0, -0.075] }],
  // Sobre el pliegue de la cadera, por delante: el hip thrust y la bisagra con
  // cinturón. La tabla ya avisa de que ahí el reparto entre dos apoyos no sale
  // de la distancia horizontal.
  pelvis: [{ hueso: 'pelvis', t: 0.55, desvio: [0, 0, 0.115] }],
  pies: [
    { hueso: 'pieD', t: 0.55, desvio: [0, 0, 0] },
    { hueso: 'pieI', t: 0.55, desvio: [0, 0, 0] },
  ],
  // El extremo distal de la tibia es el tobillo. La tabla lo pide por su
  // nombre en `marcasExtra`, porque el cable tira de ahí y no de la mano.
  tobillo: [
    { hueso: 'tibiaD', t: 1, desvio: [0, 0, 0] },
    { hueso: 'tibiaI', t: 1, desvio: [0, 0, 0] },
  ],
  cuerpo: [],
}

/**
 * Qué pieza dibuja cada implemento de la tabla.
 *
 * `guiado-vertical` sale dos veces —la máquina y la barra— y no es un descuido:
 * un Smith es un raíl Y una barra, y quitarle cualquiera de los dos deja una
 * escena que miente. Es la misma razón por la que la tabla lo separa de `barra`:
 * lo que cambia es quién decide el brazo, no que deje de haber barra.
 */
const PIEZAS_POR_IMPLEMENTO: Record<string, readonly { pieza: Pieza; forma?: FormaDeMaquina }[]> = {
  barra: [{ pieza: 'barra' }],
  disco: [{ pieza: 'disco' }],
  mancuernas: [{ pieza: 'mancuerna' }],
  'guiado-vertical': [{ pieza: 'maquina', forma: 'rail-vertical' }, { pieza: 'barra' }],
  'guiado-inclinado': [{ pieza: 'maquina', forma: 'rail-inclinado' }],
  polea: [{ pieza: 'maquina', forma: 'polea' }],
  'polea-tobillera': [{ pieza: 'maquina', forma: 'polea' }],
  maquina: [{ pieza: 'maquina', forma: 'placas' }],
  'peso-corporal': [],
}

/**
 * A qué altura entrega la carga una polea.
 *
 * Alta cuando el eje que manda es el hombro o la escápula tirando hacia abajo
 * —un jalón, un pullover, una extensión de tríceps en polea alta—; baja en lo
 * demás, que incluye las tobilleras y los curls. Es una regla gruesa y se dice
 * gruesa: lo que la afinaría es que el modelo declarase el anclaje del cable,
 * y hoy la tabla no lo lleva. Mientras no lo lleve, esto acierta el caso normal
 * y se equivoca de forma visible, que es preferible a acertar por casualidad.
 */
function poleaAlta(articulacion: Articulacion | undefined, accion: string | undefined): boolean {
  if (articulacion !== 'hombro' && articulacion !== 'escapula') return false
  return accion === 'aduccion' || accion === 'extension' || accion === 'retraccion'
}

/**
 * Qué implementos van en la escena de este ejercicio y dónde se enganchan.
 *
 * Pura: no toca una malla ni necesita un esqueleto. Cuanto decide sale de
 * `planDeMedida` y `modeloDePalanca`, que son la tabla, y lo único que este
 * módulo aporta es saber qué hueso es cada parte del cuerpo.
 */
export function implementosDeEscena(categoria: string, nombreEjercicio = ''): EscenaDeImplementos {
  const plan = planDeMedida(categoria, nombreEjercicio)
  const modelo = modeloDePalanca(categoria, nombreEjercicio)
  if (!plan || !modelo) return SIN_IMPLEMENTOS

  // Cadena cerrada con las manos en algo fijo: la barra NO la lleva el sujeto,
  // está clavada al mundo y es él quien sube. Dibujarla en las manos de una
  // dominada contaría el ejercicio contrario, que es justo lo que la tabla
  // separa por variante.
  const manosAlMundo = modelo.cadena === 'cerrada' && /barra fija|barra|paralelas/i.test(modelo.anclaje)
  if (manosAlMundo && plan.linea.origen === 'centro-de-masas') {
    return {
      piezas: [
        {
          pieza: 'barra-fija',
          agarres: MANOS,
          rigida: true,
          radioDisco: 0,
          porQue:
            'cadena cerrada con el anclaje en ' +
            modelo.anclaje +
            ': la barra está fija al mundo y el que gira es el cuerpo',
        },
      ],
      avisos: plan.limites,
      supuesto: false,
    }
  }

  const perfil = plan.perfilDeImplemento
  // Sin implemento declarado no se sabe con qué se hace. La tabla dice que
  // suponer barra ahí es cómo entraría un Smith con el modelo equivocado, así
  // que se supone peso libre —el defecto de la tabla— y se DECLARA supuesto.
  const supuesto = plan.implemento === undefined
  const clave = plan.implemento ?? 'barra'
  const piezas = PIEZAS_POR_IMPLEMENTO[clave] ?? []
  if (piezas.length === 0) return { piezas: [], avisos: plan.limites, supuesto }

  const aplicacion = perfil?.aplicacion ?? 'manos'
  let agarres = AGARRE_POR_APLICACION[aplicacion] ?? MANOS
  // La lateralidad es ortogonal al implemento, igual que en la tabla: con la
  // carga a un lado hay UN agarre, sea mancuerna, polea o prensa.
  if (plan.unilateral && agarres.length === 2) agarres = [agarres[0]]

  const principal = plan.ejes[0]
  const alto = poleaAlta(principal?.articulacion, principal?.accion)

  const salida: ImplementoEnEscena[] = piezas.map(({ pieza, forma }) => {
    // Una masa (`cargas: 1`) es una pieza rígida que las dos manos comparten;
    // dos masas son dos piezas que pueden ir a distinta altura, y eso es
    // exactamente lo que la tabla avisa que desde el lateral no se ve.
    const rigida = pieza !== 'mancuerna' && (perfil?.cargas ?? 1) === 1
    const base: ImplementoEnEscena = {
      pieza,
      forma,
      agarres,
      rigida,
      radioDisco: pieza === 'barra' || pieza === 'disco' ? RADIO_DISCO : 0,
      porQue:
        `implemento «${perfil?.nombre ?? 'peso libre supuesto'}»` +
        `, carga aplicada en ${aplicacion}` +
        `, ${perfil?.cargas ?? 1} masa(s)` +
        (plan.unilateral ? ', a un solo lado' : ''),
    }
    if (pieza !== 'maquina') return base
    return {
      ...base,
      radioDisco: 0,
      enElSuelo: sueloDeMaquina(forma, alto),
    }
  })

  return { piezas: salida, avisos: plan.limites, supuesto }
}

/**
 * Dónde se planta cada máquina, con el sujeto en el origen y mirando a +Z.
 *
 * Ninguna se planta en −X. Ése es el sitio del trípode —`SALA.estacion` lo pone
 * a 180°, perpendicular al plano sagital— y es el único plano desde el que una
 * cámara puede medir. Una máquina ahí taparía la toma, que es el fallo que la
 * escena existe para evitar.
 */
function sueloDeMaquina(
  forma: FormaDeMaquina | undefined,
  alto: boolean,
): { centro: Vec3; giroGrados: number; alturaDeCarga: number } {
  switch (forma) {
    case 'rail-vertical':
      // El Smith envuelve al sujeto: su centro es el suyo.
      return { centro: [0, 0, 0], giroGrados: 0, alturaDeCarga: 1.35 }
    case 'rail-inclinado':
      // La prensa se apoya donde apoyan los pies: delante, en +Z.
      return { centro: [0, 0, 0.55], giroGrados: 0, alturaDeCarga: 0.6 }
    case 'polea':
      // La columna, delante y a la vista: la tabla exige que el anclaje entre
      // en el encuadre, porque sin él no hay dirección de cable ni brazo.
      return { centro: [0, 0, 1.15], giroGrados: 180, alturaDeCarga: alto ? 2.2 : 0.32 }
    default:
      // La de placas, detrás: el cuerpo va apoyado en ella.
      return { centro: [0, 0, -0.72], giroGrados: 0, alturaDeCarga: 1.15 }
  }
}

// ---------------------------------------------------------------------------
// La parte que dibuja.
// ---------------------------------------------------------------------------

/**
 * Construye los implementos de la escena sobre el esqueleto de la fase actual.
 *
 * El esqueleto es el que se está dibujando, no uno de reposo: si el sujeto baja,
 * la barra baja con él. Ésa es la diferencia entre un implemento y una calcomanía.
 */
export function construirImplementos(
  m: Malla,
  escena: EscenaDeImplementos,
  esq: EsqueletoResuelto,
): void {
  for (const pieza of escena.piezas) construirPieza(m, pieza, esq)
}

/** Un solo implemento. Se expone para poder contar su coste por separado. */
export function construirPieza(m: Malla, p: ImplementoEnEscena, esq: EsqueletoResuelto): void {
  const puntos = p.agarres.map((a) => puntoDeHueso(esq, a.hueso, a.t, a.desvio))
  if (puntos.length === 0 && !p.enElSuelo) return

  switch (p.pieza) {
    case 'barra':
    case 'barra-fija': {
      // Con un solo agarre —unilateral, o la carga sobre los hombros— no hay dos
      // manos que definan el eje. Se toma el eje transversal del sujeto, que es
      // el que una barra sigue siempre: cruzada, nunca en el plano sagital.
      const [a, b] = puntos.length >= 2 ? puntos : ejeTransversal(puntos[0], esq)
      construirBarra(m, {
        agarreA: a,
        agarreB: b,
        radioDisco: p.pieza === 'barra-fija' ? 0 : p.radioDisco,
        vuelo: p.pieza === 'barra-fija' ? 0.55 : VUELO,
      })
      break
    }
    case 'disco': {
      // El disco a dos manos va centrado entre ellas, de canto al plano sagital:
      // es el caso más limpio de medir de cuantos hay en el corpus, justamente porque no
      // hay dos masas ni nada que tape al atleta.
      const centro =
        puntos.length >= 2 ? V.escalar(V.sumar(puntos[0], puntos[1]), 0.5) : puntos[0]
      const eje: Vec3 = [1, 0, 0]
      const grueso = V.escalar(eje, GRUESO_DISCO / 2)
      manto(m, V.restar(centro, grueso), V.sumar(centro, grueso), RADIO_DISCO, FILO, 16)
      tapa(m, V.sumar(centro, grueso), eje, RADIO_DISCO * 0.94, CAUCHO, 16)
      tapa(m, V.restar(centro, grueso), V.escalar(eje, -1), RADIO_DISCO * 0.94, CAUCHO, 16)
      break
    }
    case 'mancuerna': {
      // Una por agarre. Dos masas sueltas, cada una en su mano.
      for (const punto of puntos) construirMancuerna(m, punto, [0, 0, 1])
      break
    }
    case 'maquina': {
      const s = p.enElSuelo
      if (!s) break
      construirMaquina(m, {
        forma: p.forma ?? 'placas',
        centro: s.centro,
        giroGrados: s.giroGrados,
        alturaDeCarga: s.alturaDeCarga,
        agarre: puntos.length >= 2 ? V.escalar(V.sumar(puntos[0], puntos[1]), 0.5) : puntos[0],
      })
      break
    }
  }
}

/**
 * Los dos extremos de una barra que cruza al sujeto por un punto.
 *
 * El ancho sale de la separación real de los hombros en la pose —de la distancia
 * entre los dos húmeros—, no de una constante: una barra a la espalda se agarra
 * más ancha que los hombros, y ese «más ancho» es proporcional a ellos.
 */
function ejeTransversal(centro: Vec3, esq: EsqueletoResuelto): [Vec3, Vec3] {
  const hombroD = puntoDeHueso(esq, 'brazoD', 0)
  const hombroI = puntoDeHueso(esq, 'brazoI', 0)
  const semi = Math.max(V.largo(V.restar(hombroI, hombroD)) * 0.62, 0.22)
  return [
    [centro[0] - semi, centro[1], centro[2]],
    [centro[0] + semi, centro[1], centro[2]],
  ]
}

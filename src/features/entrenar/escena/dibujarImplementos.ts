import { grados, V, type Vec3 } from '../../../domain/patrones/algebra'
import type { Malla } from '../../../domain/patrones/malla'
import { puntoDeHueso, type EsqueletoResuelto } from '../../../domain/patrones/esqueleto'
// La primitiva que se orienta sola vive en `sala.ts` y se importa, no se copia:
// dos copias de la regla de enrollado es como vuelven las caras del revés.
import { caja, cilindro, manto, tapa } from './piezas'
import { ACERO, BASTIDOR, CABEZA, CABLE, CAUCHO, FILO, MANGA, PLACA, TAPIZADO } from './materia'
import { construirMaquinaAsistida } from './maquinaAsistida'
import { construirBanco } from './banco'
import type { EscenaDeImplementos, FormaDeMaquina, ImplementoEnEscena } from './implementos'

/**
 * LA PARTE QUE DIBUJA de los implementos: barras, mancuernas, discos, máquinas y el mueble,
 * construidos sobre el esqueleto de la fase que se está pintando.
 *
 * Qué piezas van y dónde entra la carga lo decide `implementos.ts` (la parte pura); aquí solo
 * se les da cuerpo. Salió de allí el 2026-09-06 al pasar el archivo de las 800 líneas. Este
 * módulo importa TIPOS de la parte pura y nada más; la parte pura importa de aquí una sola
 * medida (`RADIO_DISCO`). Sin ciclos.
 *
 * Una regla de aquí que no se ve desde la parte pura: **el banco se dibuja antes de la guarda
 * de agarres** (`construirPieza`), porque un banco no se agarra, uno se apoya en él; si esa
 * salida temprana se moviera detrás de la guarda, el mueble desaparecería sin que fallara
 * nada. Y `construirBanco` recibe los colores por parámetro a propósito, para que `banco.ts`
 * no importe de aquí.
 */

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
export const RADIO_DISCO = 0.225
/** Grosor del disco de caucho. */
const GRUESO_DISCO = 0.06
/** Largo de la mancuerna, de cabeza a cabeza. */
const LARGO_MANCUERNA = 0.36
/** Media diagonal de la cabeza de mancuerna. */
const RADIO_CABEZA = 0.075

// ---------------------------------------------------------------------------
// Primitivas. Todas pasan por `cuadro`, que SE ORIENTA SOLA.
// ---------------------------------------------------------------------------


/**
 * Base perpendicular a un eje. La misma receta que usa `viga` en `tripode.ts`:
 * una auxiliar que no sea paralela al eje, y dos cruces.
 */

/**
 * Un disco plano que mira hacia `n`.
 *
 * El abanico se enrolla a mano y no con `cuadro`, así que el orden importa: con
 * `u × w = n`, ir de `u` hacia `w` es antihorario visto desde `+n`, que es
 * justo la cara que el motor no descarta. Escribirlo al revés no da ningún
 * error — la GPU tira la cara en silencio y el disco desaparece exactamente
 * desde el lado desde el que importa verlo.
 */




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
 * LA BARRA FIJA: una estructura, no una barra olímpica flotando.
 *
 * Una dominada se hace colgado de una barra anclada —a un rack, a la pared, al techo—, y
 * hasta hoy se dibujaba con `construirBarra` sin discos: una barra olímpica con sus
 * mangas, suspendida en el aire. Bryan lo vio el 2026-09-06 en las dominadas asistidas:
 * «una barra olímpica flotando». Lo que la hace fija es lo que la sujeta, y eso es lo que
 * se dibuja: la barra, más ancha que las manos, y dos montantes hasta el suelo con su pie.
 *
 * Los montantes bajan hasta y = 0 del mundo del sujeto: en el salón es el suelo, y en una
 * demostración —donde el sujeto flota— siguen siendo los pies de la estructura.
 */
export function construirBarraFija(m: Malla, agarreA: Vec3, agarreB: Vec3): void {
  const eje = V.normalizar(V.restar(agarreB, agarreA))
  const vuelo = 0.3
  const extA = V.restar(agarreA, V.escalar(eje, vuelo))
  const extB = V.sumar(agarreB, V.escalar(eje, vuelo))
  // La barra: lisa, sin mangas. Una barra de dominadas no lleva discos.
  manto(m, extA, extB, RADIO_BARRA * 1.15, ACERO, 10)
  for (const ext of [extA, extB]) {
    // El montante, del extremo de la barra al suelo, y el pie que lo planta.
    const alto = Math.max(ext[1], 0.1)
    caja(m, [ext[0], alto / 2, ext[2]], [0.03, alto / 2, 0.03], 0, BASTIDOR)
    caja(m, [ext[0], 0.03, ext[2]], [0.16, 0.03, 0.3], 0, BASTIDOR)
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

export interface VolumenDeMaquina {
  forma: FormaDeMaquina
  /** Dónde se planta en el suelo de la sala, respecto al sujeto en el origen. */
  centro: Vec3
  /** Hacia dónde mira. Cero es de cara al sujeto. */
  giroGrados: number
  /** La altura a la que la máquina entrega la carga al cuerpo. */
  alturaDeCarga: number
  /**
   * DÓNDE ENTREGA LA CARGA: la polea del cable, o el eje sobre el que gira el brazo.
   *
   * No tiene por qué caer sobre la vertical de `centro`, y ésa es la novedad del
   * 2026-09-06: la torre se aparta del sujeto y un brazo superior la alcanza, igual que un
   * jalón de verdad, para que la polea pueda quedar donde la física la pide —encima del
   * que jala, detrás del que abre— sin que la columna se le plante dentro.
   */
  anclaje?: Vec3
  /** El punto del cuerpo al que llega el cable o el carro, si llega a alguno. */
  agarre?: Vec3
  /**
   * LOS DOS AGARRES POR SEPARADO, para las máquinas de un brazo por mano. `agarre` sigue
   * siendo el punto medio —lo usan el cable y el carro—; esto lo usa la de placas cuando
   * `porLado` dice que cada mano tiene su brazo y su eje en espejo.
   */
  agarres?: readonly Vec3[]
  porLado?: boolean
  /**
   * EL CUERPO, para las maquinas que hay que construir contra el —hoy solo la prensa.
   *
   * Es la misma regla del banco (`banco.ts`): la altura a la que el catalogo pone a cada
   * sujeto no es la misma, asi que un asiento en coordenadas fijas deja a uno flotando y a
   * otro dentro del tapizado. Con la prensa ademas hay una razon geometrica: el rail y el
   * asiento tienen que ser compatibles con una persona sentada, y cuando los dos se
   * escriben a mano no lo son. Medido el 2026-09-06, el rail dibujado arrancaba 62 cm por
   * delante y 30 cm por debajo de donde caian los pies de alguien sentado en su asiento.
   */
  cuerpo?: { pelvis: Vec3; torax: Vec3 }
  /** Los dos pies (tobillo y punta) y las dos manos, para las máquinas de cardio. */
  extremidades?: { pieD: [Vec3, Vec3]; pieI: [Vec3, Vec3]; manoD: Vec3; manoI: Vec3 }
}

/**
 * LAS MÁQUINAS DE CARDIO, construidas contra el cuerpo.
 *
 * Ninguna se planta en un sitio fijo: la cinta va bajo los pies, la escaladora pone sus
 * peldaños donde pisan, la bici su sillín bajo la pelvis y sus pedales en los pies, y la
 * elíptica sus plataformas en los pies y sus barras en las manos. Es la misma regla del
 * banco y de la prensa: la altura a la que el catálogo pone a cada sujeto no es la misma, y
 * una máquina en coordenadas fijas deja a uno flotando y a otro dentro del tapizado.
 */
function construirMaquinaDeCardio(m: Malla, v: VolumenDeMaquina): void {
  const e = v.extremidades
  if (!e) return
  const [tobD, puntaD] = e.pieD
  const [tobI, puntaI] = e.pieI
  const pies = [tobD, puntaD, tobI, puntaI]
  const bajo = Math.min(...pies.map((p) => p[1]))
  const centroX = (tobD[0] + tobI[0]) / 2
  const centroZ = (tobD[2] + tobI[2] + puntaD[2] + puntaI[2]) / 4

  if (v.forma === 'cinta') {
    // La banda bajo los pies, larga en Z para que la zancada quepa entera; el bastidor
    // delante con la consola, a la altura de las manos.
    // La banda a 4,5 cm y el bastidor debajo, a ras: ni un vertice bajo la goma del suelo.
    const y = Math.max(0.045, bajo - 0.09)
    caja(m, [centroX, y, centroZ], [0.42, 0.02, 0.95], 0, PLACA)
    caja(m, [centroX, y - 0.025, centroZ], [0.46, 0.02, 1.0], 0, BASTIDOR)
    for (const lado of [-1, 1]) {
      caja(m, [centroX + lado * 0.36, 0.55, centroZ + 0.78], [0.03, 0.55, 0.03], 0, BASTIDOR)
      caja(m, [centroX + lado * 0.36, 0.98, centroZ + 0.3], [0.03, 0.03, 0.5], 0, BASTIDOR)
    }
    caja(m, [centroX, 1.22, centroZ + 0.8], [0.38, 0.2, 0.06], 0, PLACA)
    return
  }

  if (v.forma === 'escaladora') {
    // Tres peldaños que suben hacia delante, el de en medio bajo el pie más alto; las
    // barandillas a la altura de las manos.
    const pisa = Math.max(0.02, bajo - 0.07)
    for (let k = 0; k < 3; k++) {
      caja(m, [centroX, pisa + k * 0.18 + 0.02, centroZ - 0.15 + k * 0.26], [0.3, 0.02, 0.15], 0, PLACA)
    }
    caja(m, [centroX, 0.3, centroZ + 0.1], [0.32, 0.3, 0.42], 0, BASTIDOR)
    for (const lado of [-1, 1]) {
      const alto = (e.manoD[1] + e.manoI[1]) / 2
      caja(m, [centroX + lado * 0.36, alto / 2, centroZ + 0.3], [0.025, alto / 2, 0.025], 0, BASTIDOR)
      caja(m, [centroX + lado * 0.36, alto, centroZ], [0.025, 0.025, 0.42], 0, BASTIDOR)
    }
    return
  }

  if (v.forma === 'bicicleta') {
    // El sillín bajo la pelvis, el manillar en las manos, la biela entre los dos pies.
    const pelvis = v.cuerpo?.pelvis ?? [centroX, 0.9, centroZ]
    const eje: Vec3 = [centroX, (tobD[1] + tobI[1]) / 2, (tobD[2] + tobI[2]) / 2]
    caja(m, [pelvis[0], pelvis[1] - 0.09, pelvis[2] - 0.04], [0.09, 0.03, 0.14], 0, TAPIZADO)
    manto(m, [pelvis[0], pelvis[1] - 0.12, pelvis[2] - 0.04], [eje[0], eje[1] + 0.06, eje[2] - 0.12], 0.03, BASTIDOR, 8)
    manto(m, [eje[0], 0.12, eje[2]], [eje[0], eje[1], eje[2]], 0.03, BASTIDOR, 8)
    caja(m, [eje[0], 0.05, eje[2]], [0.3, 0.05, 0.42], 0, BASTIDOR)
    cilindro(m, [eje[0] - 0.12, eje[1], eje[2]], [eje[0] + 0.12, eje[1], eje[2]], 0.04, PLACA, 10)
    for (const tob of [tobD, tobI]) manto(m, eje, [tob[0], tob[1], tob[2]], 0.012, BASTIDOR, 6)
    const manillar: Vec3 = [(e.manoD[0] + e.manoI[0]) / 2, (e.manoD[1] + e.manoI[1]) / 2, (e.manoD[2] + e.manoI[2]) / 2]
    manto(m, [eje[0], eje[1] + 0.1, eje[2] + 0.05], [manillar[0], manillar[1] - 0.04, manillar[2]], 0.03, BASTIDOR, 8)
    cilindro(m, e.manoD, e.manoI, 0.015, BASTIDOR, 8)
    return
  }

  if (v.forma === 'remo') {
    // Un carril largo con el carro debajo de la pelvis, la caja del volante delante con los
    // reposapiés, y la cadena del volante al mango que llevan las manos.
    const pelvis = v.cuerpo?.pelvis ?? [centroX, 0.4, centroZ]
    const frente: Vec3 = [centroX, 0.1, Math.max(...pies.map((p) => p[2])) + 0.34]
    caja(m, [centroX, 0.16, centroZ + 0.1], [0.05, 0.03, 1.0], 0, BASTIDOR)
    caja(m, [centroX, 0.06, centroZ - 0.75], [0.24, 0.05, 0.16], 0, BASTIDOR)
    caja(m, [pelvis[0], pelvis[1] - 0.07, pelvis[2]], [0.16, 0.035, 0.2], 0, TAPIZADO)
    caja(m, [frente[0], 0.32, frente[2] + 0.12], [0.22, 0.3, 0.16], 0, BASTIDOR)
    cilindro(m, [frente[0] - 0.03, 0.5, frente[2] + 0.12], [frente[0] + 0.03, 0.5, frente[2] + 0.12], 0.15, PLACA, 14)
    for (const [tob, punta] of [e.pieD, e.pieI]) {
      const c: Vec3 = [(tob[0] + punta[0]) / 2, (tob[1] + punta[1]) / 2 - 0.02, (tob[2] + punta[2]) / 2 + 0.04]
      caja(m, c, [0.09, 0.13, 0.03], 0, PLACA)
    }
    const mango: Vec3 = [(e.manoD[0] + e.manoI[0]) / 2, (e.manoD[1] + e.manoI[1]) / 2, (e.manoD[2] + e.manoI[2]) / 2]
    manto(m, [frente[0], 0.5, frente[2] + 0.05], mango, 0.008, BASTIDOR, 6)
    cilindro(m, e.manoD, e.manoI, 0.014, BASTIDOR, 8)
    return
  }

  if (v.forma === 'eliptica') {
    // Una plataforma bajo cada pie —van con él— y una barra a cada mano; el eje detrás.
    for (const [tob, punta] of [e.pieD, e.pieI]) {
      const c: Vec3 = [(tob[0] + punta[0]) / 2, Math.min(tob[1], punta[1]) - 0.04, (tob[2] + punta[2]) / 2]
      caja(m, c, [0.08, 0.02, 0.18], 0, PLACA)
    }
    const eje: Vec3 = [centroX, 0.45, centroZ - 0.55]
    caja(m, [eje[0], 0.06, eje[2]], [0.3, 0.06, 0.3], 0, BASTIDOR)
    caja(m, [eje[0], eje[1] / 2, eje[2]], [0.06, eje[1] / 2, 0.06], 0, BASTIDOR)
    for (const mano of [e.manoD, e.manoI]) manto(m, [eje[0], eje[1], eje[2] + 0.3], mano, 0.02, BASTIDOR, 8)
    return
  }
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
  if (v.forma === 'cinta' || v.forma === 'escaladora' || v.forma === 'bicicleta' || v.forma === 'eliptica' || v.forma === 'remo') {
    construirMaquinaDeCardio(m, v)
    return
  }
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
    // EL RAIL SE ALINEA CON LOS PIES, no con un punto fijo del suelo. El carro corre por
    // el rail y los pies van sobre el carro, asi que si el rail no pasa por donde pasan
    // los pies, la maquina no toca al sujeto: es el fallo que tenia esta pieza hasta el
    // 2026-09-06, cuando la prensa era la ficha de la sentadilla y los pies no se movian.
    const carro = v.agarre ?? V.sumar([c[0], 0.12, c[2]], V.escalar(dir, 0.5))
    const pie = V.restar(carro, V.escalar(dir, 0.78))
    const alto = V.sumar(pie, V.escalar(dir, 2.3))
    for (const lado of [-1, 1]) {
      const o: Vec3 = [lado * 0.36, 0, 0]
      const a = V.sumar(pie, o)
      const b = V.sumar(alto, o)
      manto(m, a, b, 0.045, BASTIDOR, 8)
      tapa(m, b, dir, 0.045, BASTIDOR, 8)
    }
    // El carro: la plataforma donde apoyan los pies, sobre el raíl. Se dibuja con canto
    // —no como una chapa— porque de frente una chapa horizontal se ve de perfil y
    // desaparece: es la mitad de lo que dejaba esta máquina en 36 píxeles.
    caja(m, carro, [0.44, 0.05, 0.26], 0, PLACA)
    // La plataforma de los pies, perpendicular al raíl y de cara a quien empuja. Es la
    // pieza que más silueta da, y la que dice de un vistazo qué máquina es.
    const plato = V.sumar(carro, V.escalar(dir, 0.16))
    caja(m, [plato[0], plato[1] + 0.24, plato[2] + 0.2], [0.42, 0.3, 0.055], 0, PLACA)
    // EL RESPALDO Y EL ASIENTO, debajo de quien se sienta. Sin ellos la prensa es un rail
    // suelto: no hay donde tumbarse, y en pantalla no hay nada por encima del suelo.
    const asiento: Vec3 = v.cuerpo
      ? [v.cuerpo.pelvis[0], v.cuerpo.pelvis[1] - 0.09, v.cuerpo.pelvis[2]]
      : [c[0], 0.42, c[2] - 0.62]
    caja(m, asiento, [0.3, 0.06, 0.34], g, TAPIZADO)
    if (v.cuerpo) {
      // El respaldo sigue al tronco: se dibuja como una tabla detras de el, entre la
      // pelvis y el torax, en vez de una caja vertical que atravesaria a un sujeto
      // reclinado.
      const medio = V.escalar(V.sumar(v.cuerpo.pelvis, v.cuerpo.torax), 0.5)
      caja(m, [medio[0], medio[1], medio[2] - 0.17], [0.3, 0.34, 0.07], g, TAPIZADO)
    } else {
      caja(m, [asiento[0], asiento[1] + 0.32, asiento[2] - 0.3], [0.3, 0.34, 0.08], g, TAPIZADO)
    }
    caja(m, [asiento[0], asiento[1] / 2, asiento[2]], [0.1, asiento[1] / 2, 0.1], g, BASTIDOR)
    // La base, con canto suficiente para leerse contra el suelo.
    caja(m, [asiento[0], 0.09, asiento[2] - 0.28], [0.5, 0.09, 0.44], g, BASTIDOR)
    return
  }

  if (v.forma === 'polea') {
    // Polea: una columna y un cable. El cable es la pieza que importa —la
    // dirección la fija él y no la gravedad—, y la tabla exige además que el
    // punto de anclaje ENTRE EN EL ENCUADRE: sin él no hay dirección, y sin
    // dirección no hay brazo. Por eso la columna se dibuja entera, con su polea.
    caja(m, [c[0], v.alturaDeCarga / 2, c[2]], [0.06, v.alturaDeCarga / 2, 0.06], g, BASTIDOR)
    caja(m, [c[0], 0.05, c[2]], [0.16, 0.05, 0.32], g, BASTIDOR)
    const polea: Vec3 = v.anclaje ?? [c[0], v.alturaDeCarga, c[2]]
    // EL BRAZO SUPERIOR, que es lo que permite que la polea no esté sobre la columna. Sin
    // él la polea de un jalón tendría que ir en el suelo o la columna sobre la cabeza del
    // sujeto; con él, la torre se aparta y el cable sigue llegando desde arriba.
    const alto: Vec3 = [c[0], v.alturaDeCarga, c[2]]
    if (V.largo(V.restar(polea, alto)) > 0.04) manto(m, alto, polea, 0.035, BASTIDOR, 8)
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
  if (v.porLado && v.anclaje && v.agarres && v.agarres.length === 2) {
    // UN BRAZO POR MANO, como una pec deck: dos ejes en espejo unidos por un travesaño que
    // sale del bastidor, y de cada eje un brazo a su mano. Con un solo brazo al punto medio
    // el brazo se estiraba 40 cm entre el arranque y el final, porque ningún eje es
    // concéntrico con las dos manos a la vez.
    const ejeD = v.anclaje
    const ejeI: Vec3 = [-ejeD[0], ejeD[1], ejeD[2]]
    const cabeza: Vec3 = [c[0], v.alturaDeCarga, c[2]]
    const medio: Vec3 = [0, ejeD[1], ejeD[2]]
    if (V.largo(V.restar(medio, cabeza)) > 0.06) manto(m, cabeza, medio, 0.03, BASTIDOR, 8)
    manto(m, ejeI, ejeD, 0.03, BASTIDOR, 8)
    for (const [eje, mano] of [
      [ejeD, v.agarres[0]],
      [ejeI, v.agarres[1]],
    ] as const) {
      manto(m, eje, mano, 0.022, BASTIDOR, 8)
      const hacia = V.normalizar(V.restar(mano, eje))
      cilindro(m, V.restar(mano, V.escalar(hacia, 0.06)), V.sumar(mano, V.escalar(hacia, 0.06)), 0.03, TAPIZADO, 8)
    }
    return
  }
  if (v.agarre) {
    // El eje del brazo va donde la carga gira, que desde el 2026-09-06 lo calcula
    // `anclajeQueSeOpone` ajustando una circunferencia al recorrido: así el brazo dibujado
    // es RÍGIDO —mide lo mismo en las once fases— en vez de estirarse como una goma.
    const codo: Vec3 = v.anclaje ?? [c[0], v.alturaDeCarga, c[2]]
    // EL TIRANTE QUE UNE EL BASTIDOR CON EL EJE. Desde que el eje va donde la carga gira
    // —en la articulación que trabaja— deja de caer sobre la vertical del bastidor, y sin
    // esta pieza el brazo sale flotando al lado del sujeto con la máquina a un metro, sin
    // nada que los una. En una máquina real es el travesaño que sujeta el pivote.
    const alto: Vec3 = [c[0], v.alturaDeCarga, c[2]]
    if (V.largo(V.restar(codo, alto)) > 0.06) manto(m, alto, codo, 0.03, BASTIDOR, 8)
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
  // El banco no se agarra: se apoya uno en él. Sale antes de la guarda de agarres, que
  // existe para las piezas que el sujeto sujeta o que se plantan en el suelo.
  if (p.pieza === 'banco') {
    if (p.apoyo) construirBanco(m, p.apoyo, esq, TAPIZADO, BASTIDOR)
    return
  }
  if (puntos.length === 0 && !p.enElSuelo) return

  switch (p.pieza) {
    case 'barra-fija': {
      const [a, b] = puntos.length >= 2 ? puntos : ejeTransversal(puntos[0], esq)
      construirBarraFija(m, a, b)
      break
    }
    case 'barra': {
      // Con un solo agarre —unilateral, o la carga sobre los hombros— no hay dos
      // manos que definan el eje. Se toma el eje transversal del sujeto, que es
      // el que una barra sigue siempre: cruzada, nunca en el plano sagital.
      const [a, b] = puntos.length >= 2 ? puntos : ejeTransversal(puntos[0], esq)
      construirBarra(m, { agarreA: a, agarreB: b, radioDisco: p.radioDisco, vuelo: VUELO })
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
      if (p.forma === 'asistida') {
        // La única máquina que se construye contra el cuerpo: su rodillera sube con él.
        construirMaquinaAsistida(m, esq, puntos)
        break
      }
      construirMaquina(m, {
        forma: p.forma ?? 'placas',
        centro: s.centro,
        giroGrados: s.giroGrados,
        alturaDeCarga: s.alturaDeCarga,
        anclaje: s.anclaje,
        agarres: puntos,
        porLado: s.porLado,
        cuerpo:
          p.forma === 'rail-inclinado' || p.forma === 'bicicleta'
            ? { pelvis: puntoDeHueso(esq, 'pelvis', 0), torax: puntoDeHueso(esq, 'torax', 1) }
            : undefined,
        extremidades: {
          pieD: [puntoDeHueso(esq, 'tibiaD', 1), puntoDeHueso(esq, 'pieD', 1)],
          pieI: [puntoDeHueso(esq, 'tibiaI', 1), puntoDeHueso(esq, 'pieI', 1)],
          manoD: puntoDeHueso(esq, 'manoD', 0.45),
          manoI: puntoDeHueso(esq, 'manoI', 0.45),
        },
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

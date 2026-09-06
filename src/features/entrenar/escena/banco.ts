import { V, type Vec3 } from '../../../domain/patrones/algebra'
import { Malla, type Color } from '../../../domain/patrones/malla'
import { puntoDeHueso, type EsqueletoResuelto } from '../../../domain/patrones/esqueleto'
import type { Patron } from '../../../domain/patrones/catalogo'
import type { ModeloDePalanca } from '../../../domain/biomecanica/tipos'
import { caja, manto } from './piezas'

/**
 * EL MUEBLE QUE SOSTIENE AL SUJETO: el banco, el asiento y el cajón.
 *
 * ## Qué faltaba
 *
 * El salón ya dibujaba la barra, la mancuerna y la máquina, así que el sujeto había dejado
 * de empujar el aire. Pero seguía **flotando**: un press de banca con el cuerpo tumbado
 * sobre nada, un hip thrust con los hombros apoyados en el vacío, una búlgara con el pie de
 * atrás en el aire. Medido el 2026-09-06 sobre el catálogo: **once patrones dejaban al
 * sujeto sin nada debajo**, y ocho de ellos ni siquiera recibían una máquina que disimulara.
 *
 * Y no es un adorno: en un press de banca el banco **es** el ancla del ejercicio. Sin él lo
 * que se ve no es un press, es alguien flotando boca arriba.
 *
 * ## La tabla no se escribe aquí, porque ya está escrita
 *
 * Es la misma regla que ordena `implementos.ts`, y aquí importa todavía más porque la
 * tentación de listar «la banca lleva banco» es grande. No hace falta:
 * `ModeloDePalanca.anclaje` **ya dice qué toca el mundo y no se mueve**, y lo dice nombrando
 * el mueble:
 *
 *     'el torso, contra el banco'                    press de banca
 *     'el torso, contra el respaldo inclinado'       press inclinado
 *     'los pies en el suelo y las escápulas en el banco'   hip thrust
 *     'las piernas, sujetas al banco'                banco romano
 *     'el fémur, contra la camilla'                  curl femoral tumbado
 *     'el antebrazo, apoyado en el muslo o en el banco'    curl de muñeca
 *
 * frente a las que NO llevan mueble y también lo dicen:
 *
 *     'los pies en el suelo'      ·  'los apoyos en el suelo'  ·  'el codo contra el costado'
 *
 * Así que el mueble se deduce de dos vocabularios cortos —la palabra del mueble y la parte
 * del cuerpo que sostiene—, los dos leídos de esa frase. Si alguien reescribe un anclaje y
 * se lleva por delante la palabra, el barrido de `banco.test.ts` se pone rojo diciendo qué
 * patrón se quedó sin mueble: es la contrapartida de leer prosa en vez de una tabla.
 *
 * ## Y no se dibuja donde ya hay máquina
 *
 * `construirMaquina` ya trae su asiento y su respaldo —una prensa los tiene, una polea de
 * jalón los tiene—. Meter aquí otro banco encima sería dibujar dos veces lo mismo y que
 * además se atraviesen. La frontera es exactamente ésa: **este módulo solo entra cuando la
 * escena no ha puesto máquina**.
 *
 * ## El mueble se calcula CONTRA EL CUERPO, no contra el mundo
 *
 * Es la diferencia con las máquinas, que se plantan en un sitio fijo del suelo. Un banco
 * tiene que quedar justo debajo de lo que sostiene, y la altura a la que el catálogo pone a
 * cada sujeto no es la misma —los patrones sin apoyo plantar viven a la altura que su
 * `raizInicio` diga—. Un banco en coordenadas fijas quedaría flotando en unos patrones y
 * enterrado en otros.
 *
 * Así que el acolchado sale de DOS PUNTOS DEL ESQUELETO ya resuelto, se cuelga por debajo de
 * ellos, y las patas bajan desde sus extremos hasta el suelo. Con eso el mismo código da un
 * banco plano, uno inclinado y un banco romano a 45°: la inclinación no se declara, la pone
 * el cuerpo.
 */

/** Qué parte del cuerpo sostiene el mueble, en huesos del rig. */
export interface ApoyoDelCuerpo {
  /** Los dos extremos del acolchado, como hueso y punto a lo largo de él. */
  desde: readonly [string, number]
  hasta: readonly [string, number]
  /** Media anchura del acolchado, en metros. */
  ancho: number
  /**
   * Si el mueble se apoya en el suelo con patas. Un cajón bajo el pie de atrás sí; el
   * acolchado de una camilla que ya cuelga de la máquina, no.
   */
  conPatas: boolean
  /** Para poder decir en una prueba de dónde salió, sin volver a leer la prosa. */
  porQue: string
}

/** Las palabras que nombran un mueble en un anclaje, y las que nombran el suelo. */
const MUEBLE = /banco|respaldo|camilla|atril|escal[oó]n/i
/**
 * `máquina` y `asiento` se quedan FUERA a propósito: los patrones que los nombran reciben
 * una pieza de máquina, que ya dibuja asiento y respaldo. Añadirles un banco encima sería
 * dibujar dos veces el mismo mueble y que se atraviesen.
 */

/**
 * La parte del cuerpo que el anclaje dice que va apoyada, traducida a huesos.
 *
 * El orden importa: `escápulas` antes que `torso`, porque un hip thrust apoya SOLO los
 * hombros y su banco es corto — dibujarle el banco del torso entero lo convertiría en un
 * press de banca con la cadera levantada.
 */
const PARTE: readonly { palabra: RegExp; apoyo: Omit<ApoyoDelCuerpo, 'porQue'> }[] = [
  {
    palabra: /esc[aá]pula/i,
    apoyo: { desde: ['torax', 0.62], hasta: ['torax', 1], ancho: 0.17, conPatas: true },
  },
  {
    palabra: /torso/i,
    apoyo: { desde: ['pelvis', 0.1], hasta: ['torax', 1], ancho: 0.15, conPatas: true },
  },
  {
    // El banco romano sujeta los MUSLOS y deja el tronco en voladizo, que es justo lo que
    // hace que el ejercicio exista.
    palabra: /pierna|f[eé]mur/i,
    apoyo: { desde: ['musloD', 0.15], hasta: ['musloD', 1], ancho: 0.17, conPatas: true },
  },
  {
    // Sentado con el antebrazo apoyado: lo que hay debajo es el asiento, bajo la pelvis.
    // El acolchado va de la pelvis HACIA EL MUSLO y no a lo largo de la pelvis: la pelvis
    // de un sujeto sentado está de pie, así que un tubo de pelvis a pelvis salía vertical
    // —un asiento clavado como un poste—. Medido el 2026-09-06 al ver la primera versión.
    palabra: /antebrazo/i,
    apoyo: { desde: ['pelvis', 0], hasta: ['musloD', 0.4], ancho: 0.18, conPatas: true },
  },
  {
    palabra: /antep[ie]|pie/i,
    apoyo: { desde: ['pieD', 0], hasta: ['pieD', 1], ancho: 0.2, conPatas: true },
  },
]

/**
 * El mueble que sostiene a este sujeto, o `undefined` si se sostiene solo.
 *
 * `hayMaquina` lo decide quien llama: este módulo no sabe qué otras piezas se han puesto, y
 * meterle esa consulta sería devolverle el conocimiento de la escena que se le acaba de
 * quitar.
 */
export function apoyoQueSostiene(
  patron: Patron | undefined,
  modelo: ModeloDePalanca | undefined,
  hayMaquina: boolean,
): ApoyoDelCuerpo | undefined {
  if (hayMaquina) return undefined

  // 1. Lo que el propio patrón declara que apoya ADEMÁS de los pies. Es la vía más
  //    directa que hay: `apoyosExtra` existe porque el equilibrio no se puede comprobar
  //    sin saber dónde se apoya el cuerpo, así que ya está escrito hueso a hueso.
  const extra = patron?.apoyosExtra?.[0]
  if (extra) {
    const [hueso, t] = extra
    const esTronco = /torax|pelvis|lumbar/.test(hueso)
    return {
      desde: [hueso, esTronco ? Math.max(0, t - 0.38) : 0],
      hasta: [hueso, t],
      ancho: esTronco ? 0.17 : 0.14,
      conPatas: true,
      porQue: `el patrón declara que ${hueso} también apoya`,
    }
  }

  // 2. QUIEN PISA EL SUELO NO NECESITA MUEBLE, y esta línea vale por media tabla. Sin ella
  //    el curl de bíceps —que se hace de pie— recibía un banco a lo largo de todo el
  //    tronco, porque su anclaje dice «el húmero, contra el torso o el atril» y ahí hay una
  //    palabra de mueble. El anclaje describe contra qué se estabiliza el segmento que
  //    trabaja, que no es lo mismo que sobre qué se tumba el cuerpo.
  if (patron?.apoyo === 'suelo') return undefined

  const anclaje = modelo?.anclaje
  if (!anclaje) return undefined
  // 3. Y quien apoya en el SUELO tampoco: una plancha no lleva banco, lleva suelo.
  if (/suelo/i.test(anclaje)) return undefined

  // 4. La frase del anclaje, que nombra el mueble y la parte del cuerpo.
  if (MUEBLE.test(anclaje)) {
    for (const { palabra, apoyo } of PARTE) {
      if (palabra.test(anclaje)) return { ...apoyo, porQue: `el anclaje dice «${anclaje}»` }
    }
  }

  // 5. Y EL ÚLTIMO RECURSO, que es geometría y no prosa: un sujeto TUMBADO que no apoya los
  //    pies ni las manos en nada está encima de algo, lo diga o no su anclaje. El caso es la
  //    apertura con mancuernas, cuyo anclaje es «el torso» a secas —correcto para la
  //    medida, mudo para la escena—: sin esto se quedaba flotando boca arriba.
  //
  //    El sujeto tumbado se reconoce por el giro de la raíz que la ficha declara, que es un
  //    dato del catálogo y no una estimación: entre 60 y 120 grados el cuerpo está acostado.
  const giro = patron?.giroInicio ?? patron?.giro
  const tumbado = giro !== undefined && Math.abs(giro[0]) >= 60 && Math.abs(giro[0]) <= 120
  if (tumbado) {
    return {
      desde: ['pelvis', 0.1],
      hasta: ['torax', 1],
      ancho: 0.15,
      conPatas: true,
      porQue: `el sujeto va tumbado (giro ${Math.round(giro[0])}°) y no apoya en el suelo`,
    }
  }
  return undefined
}

/** Cuánto se separa el acolchado del hueso que sostiene: la carne de en medio. */
const CARNE = 0.1
/** Media altura del acolchado. */
const GROSOR = 0.045
/**
 * Lo más largo que puede ser una pata, en metros.
 *
 * Un banco de gimnasio mide 45 cm y un banco romano llega a 90 por su parte alta, así que
 * 62 cm cubre el mueble real con holgura y corta lo que solo es altura postiza del catálogo.
 */
const PATA_MAXIMA = 0.62

export function construirBanco(
  m: Malla,
  apoyo: ApoyoDelCuerpo,
  esq: EsqueletoResuelto,
  tapizado: Color,
  bastidor: Color,
): void {
  const a = puntoDeHueso(esq, apoyo.desde[0], apoyo.desde[1])
  const b = puntoDeHueso(esq, apoyo.hasta[0], apoyo.hasta[1])
  if (!Number.isFinite(a[1]) || !Number.isFinite(b[1])) return

  // El acolchado va POR DEBAJO del eje del hueso, no sobre él: el hueso pasa por dentro de
  // la carne, y un banco a la altura de la columna sale atravesando la espalda.
  const bajar: Vec3 = [0, -(CARNE + GROSOR), 0]
  const p = V.sumar(a, bajar)
  const q = V.sumar(b, bajar)

  // Un tubo grueso, no una caja: `caja` solo gira en Y, y un banco inclinado o un banco
  // romano a 45° necesitan seguir el eje del cuerpo. El tubo lo hace solo.
  manto(m, p, q, GROSOR + 0.02, tapizado, 8)

  if (!apoyo.conPatas) return

  // LAS PATAS, ACOTADAS. Bajan desde los dos extremos del acolchado, pero **no más de
  // `PATA_MAXIMA`**, y eso no es un capricho de dibujo: los patrones sin apoyo plantar viven
  // a la altura que diga su `raizInicio`, que en el catálogo es un desplazamiento sobre la
  // altura de pie y no una cota real —un sujeto sentado sale a 1,46 m—. Sin tope, el asiento
  // del curl de muñeca salía con patas de metro y medio: un taburete de bar.
  //
  // Con el tope, el mueble es un objeto con su propia base que acompaña al cuerpo. Y el día
  // que el catálogo baje a esos patrones al suelo, las patas llegarán solas: el tope solo
  // recorta lo que sobra.
  const alturaDePata = (extremo: Vec3): number => Math.min(extremo[1] - GROSOR, PATA_MAXIMA)
  for (const extremo of [p, q]) {
    const alto = alturaDePata(extremo)
    if (alto <= 0.05) continue
    caja(m, [extremo[0], extremo[1] - GROSOR - alto / 2, extremo[2]], [0.05, alto / 2, 0.05], 0, bastidor)
  }
  // Y el pie, que es lo que apoya de verdad: sin él las patas nacen de una línea. Va a la
  // altura donde acaban las patas, no en el suelo, para que el mueble no se estire.
  const base = Math.min(p[1] - GROSOR - alturaDePata(p), q[1] - GROSOR - alturaDePata(q))
  const medio: Vec3 = [(p[0] + q[0]) / 2, base + 0.03, (p[2] + q[2]) / 2]
  const largo = Math.hypot(q[0] - p[0], q[2] - p[2]) / 2 + 0.08
  caja(m, medio, [Math.max(0.12, largo * 0.5), 0.03, Math.max(0.14, largo)], 0, bastidor)
}

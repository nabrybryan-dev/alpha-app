/**
 * DE LA DECLARACIÓN A LA MALLA: qué se sube al motor en cada escalón de W.
 *
 * `nivelesAnatomicos.ts` es el contrato —dice QUÉ se ve en cada nivel— y este archivo
 * es el traductor: convierte esa declaración en las mallas concretas que se le pasan a
 * `Motor.subir()`. Es la pieza que faltaba para que atravesar el cuerpo cambie el
 * cuerpo, y no solo el rótulo.
 *
 * ## Por qué el filtro vive aquí y no en `construirMusculos()`
 *
 * `construirMusculos()` recorre las setenta porciones de `PORCIONES` y no admite
 * filtro: dibuja siempre el cuerpo entero. Ese archivo está en `src/domain/`, que en
 * esta rama es de solo lectura —es el motor del sujeto en producción—, así que el
 * recorte se hace desde fuera, que es exactamente lo que el contrato pedía: «quien
 * monte la capa de interfaz tiene que recorrer `PORCIONES` y saltarse las que el nivel
 * no lista». Aquí se recorre.
 *
 * El precio es que `dibujarPorcion()` repite el cuerpo del bucle de
 * `construirMusculos()` —el ensanche por volumen constante, el tono, la resolución del
 * tubo, el ángulo de fibra—. Eso se puede separar en silencio, y por eso el filtro se
 * escribe con un hueco para comprobarlo: `construirMusculosFiltrado(..., null)` no
 * filtra nada, y su malla tiene que salir IDÉNTICA a la de `construirMusculos()` con
 * los mismos argumentos —mismo número de vértices, mismos índices, mismos colores—.
 * Esa igualdad es el guardián de la copia: mientras se cumpla, las dos rutas dibujan el
 * mismo cuerpo y lo único que cambia es cuánto de él. En cuanto alguien afine
 * `musculos.ts` sin pasar por aquí, deja de cumplirse y se ve.
 *
 * ## Lo que un nivel declara y no llega a ser malla
 *
 * `articulaciones` no se dibuja: no hay constructor de articulaciones en el código —los
 * topes de `noPuede` son texto, y es como se leen en el panel—. Se declara en el nivel
 * porque la capa de texto la usa, no porque haya geometría esperándola. Y `huesos` es
 * todo el rig o nada: `construirHuesos()` levanta los veintiún huesos de una pieza, y
 * los tres niveles que encienden hueso encienden los veintiuno. Ninguno pide un
 * subconjunto, así que no hay recorte que hacer ahí; si algún día lo pidiera, esto se
 * enteraría por `huesosParcialesDeNivel()` en vez de por una pantalla rara.
 */

import { limitar } from '../../../domain/patrones/algebra'
import type { Patron } from '../../../domain/patrones/catalogo'
import { LADO, type EsqueletoResuelto, type Lado } from '../../../domain/patrones/esqueleto'
import { curva, Malla, tubo } from '../../../domain/patrones/malla'
import {
  activacionDe,
  colorDeMusculo,
  largoDeTrazado,
  PORCIONES,
  radioDePorcion,
  trazadoDeFasciculo,
  type Activacion,
  type Porcion,
  type PorcionLocalizada,
} from '../../../domain/patrones/musculos'
import type { NivelW } from '../salon/huecos'
import { NIVEL_POR_W, type AcabadoMuscular, type PiezaDelSujeto } from './nivelesAnatomicos'

/** Los dos lados, derivados de `LADO` para que no haya una segunda lista que mantener. */
const LADOS = Object.keys(LADO) as Lado[]

/**
 * Una malla del sujeto tal y como se va a construir, descrita sin construirla.
 *
 * Es el objeto que hace comprobable el eje W sin abrir un canvas: dice qué piezas se
 * suben, con qué porciones dentro y con qué color. Dos niveles que devolvieran listas
 * iguales serían dos niveles que se ven igual, y eso es un fallo del eje —por eso esto
 * se puede comparar entre los cinco de un vistazo.
 */
export interface MallaDelSujeto {
  /** Qué constructor la levanta. */
  pieza: PiezaDelSujeto
  /** Cómo se pinta el músculo. La malla de hueso lleva siempre `ninguno`. */
  acabado: AcabadoMuscular
  /** Claves de porción que entran, en el orden de `PORCIONES`. Vacía en el hueso. */
  porciones: readonly string[]
  /** Nombres de `ESQUELETO` que entran. Vacía en el músculo. */
  huesos: readonly string[]
  /**
   * La activación con la que se colorea, que es la que de verdad recibe el constructor.
   * En los niveles de envolvente es el objeto vacío: `activacionDe()` devuelve 0 y
   * `colorDeMusculo(0)` es `COLOR_PASIVO`, así que la superficie sale de un solo color
   * sin tocar el catálogo.
   */
  activacion: Activacion
}

/** Las porciones del catálogo que se dibujan en un nivel, en el orden de `PORCIONES`. */
export function porcionesDeNivel(w: NivelW): PorcionLocalizada[] {
  const nivel = NIVEL_POR_W[w]
  const musculos = new Set(nivel.musculos)
  const pasivas = new Set(nivel.porcionesPasivas)
  return PORCIONES.filter((p) => musculos.has(p.musculo.id) || pasivas.has(p.clave))
}

/**
 * Las claves de porción de un nivel, cacheadas.
 *
 * El bucle de dibujo pregunta por ellas en cada fotograma; rehacer el `Set` sesenta
 * veces por segundo para un dato que no cambia nunca sería trabajo por nada.
 */
const clavesCache = new Map<NivelW, ReadonlySet<string>>()

export function clavesDeNivel(w: NivelW): ReadonlySet<string> {
  let claves = clavesCache.get(w)
  if (!claves) {
    claves = new Set(porcionesDeNivel(w).map((p) => p.clave))
    clavesCache.set(w, claves)
  }
  return claves
}

/**
 * Los huesos que un nivel declara pero que no se pueden encender por separado.
 *
 * Sale vacío mientras todos los niveles con hueso enciendan el rig entero, que es el
 * caso hoy. Existe para que el día que un nivel pida media pelvis se sepa por una lista
 * y no por una pantalla rara: `construirHuesos()` no admite subconjuntos.
 */
export function huesosParcialesDeNivel(w: NivelW, huesosDelRig: readonly string[]): string[] {
  const nivel = NIVEL_POR_W[w]
  if (!nivel.piezas.includes('huesos')) return []
  return huesosDelRig.filter((h) => !nivel.huesos.includes(h))
}

/**
 * QUÉ MALLAS SE VAN A CONSTRUIR en un nivel, dado el patrón. Función pura.
 *
 * El orden es el del búfer: primero el hueso y después el músculo, igual que los empuja
 * el visor. Ninguno de los cinco niveles devuelve una lista vacía y no hay dos iguales;
 * si las hubiera, el eje tendría menos de cinco escalones de verdad.
 */
export function mallasDelSujeto(w: NivelW, patron: Patron): MallaDelSujeto[] {
  const nivel = NIVEL_POR_W[w]
  const mallas: MallaDelSujeto[] = []
  if (nivel.piezas.includes('huesos')) {
    mallas.push({
      pieza: 'huesos',
      acabado: 'ninguno',
      porciones: [],
      huesos: nivel.huesos,
      activacion: {},
    })
  }
  if (nivel.piezas.includes('musculos')) {
    mallas.push({
      pieza: 'musculos',
      acabado: nivel.acabado,
      porciones: porcionesDeNivel(w).map((p) => p.clave),
      huesos: [],
      // La envolvente es la misma geometría sin el trabajo encima: activación vacía.
      activacion: nivel.acabado === 'activacion' ? patron.activacion : {},
    })
  }
  return mallas
}

/**
 * Cómo van las fibras de una porción, en lo que el dibujo necesita saber.
 *
 * Copia de la de `musculos.ts`, que no se exporta. Entra en el guardián de la copia
 * descrito arriba: si esta se separa de aquella, la malla sin filtrar deja de coincidir
 * con la de `construirMusculos()` y se sabe.
 */
function fibraDe(porcion: Porcion): { penacion: number; bilateral: boolean } {
  const arq = porcion.arquitectura ?? 'fusiforme'
  const grados = porcion.penacion ?? 0
  return {
    penacion: (grados * Math.PI) / 180,
    bilateral: arq === 'bipenado' || arq === 'multipenado',
  }
}

/**
 * Una porción, sus dos lados y todos sus fascículos, dentro de la malla que se le pase.
 *
 * Es el cuerpo del bucle de `construirMusculos()`, sacado aparte para poder llamarlo
 * sobre unas porciones y no sobre otras.
 */
function dibujarPorcion(
  m: Malla,
  esq: EsqueletoResuelto,
  { musculo, porcion, clave }: PorcionLocalizada,
  activacion: Activacion,
  enReposo: Record<string, number>,
): void {
  for (const lado of LADOS) {
    const a = activacionDe(activacion, musculo.id, porcion.id, lado)
    const color = colorDeMusculo(a)
    const nf = porcion.fasciculos ?? 1
    for (let f = 0; f < nf; f++) {
      const control = trazadoDeFasciculo(esq, porcion, lado, f)
      const largo = largoDeTrazado(control)
      const largo0 = enReposo[`${clave}${lado}${f}`] ?? largo
      // Volumen constante: al acortarse, el vientre engorda con 1/raíz(L).
      const ensanche = limitar(Math.sqrt(largo0 / (largo || 1e-6)), 0.78, 1.55)
      // El que trabaja se marca algo más, como en contracción real.
      const tono = 0.86 + a * 0.3
      // Resolución según el grosor de la porción: el poplíteo es un tubo de un
      // centímetro y no se merece la malla del glúteo mayor.
      const grande = porcion.radio >= 0.018
      const anillos = grande ? 12 : porcion.radio >= 0.013 ? 10 : 8
      // Los penados necesitan más lados: la estría oblicua varía alrededor del tubo.
      const oblicua = (porcion.penacion ?? 0) > 0
      const lados = oblicua
        ? grande
          ? 14
          : 12
        : grande
          ? 7
          : porcion.radio >= 0.013
            ? 6
            : 5
      const puntos = curva(control, anillos)
      tubo(
        m,
        puntos,
        (t) => radioDePorcion(t, porcion.radio, ensanche, tono, porcion.arquitectura ?? 'fusiforme'),
        {
          radial: lados,
          color,
          hueso: 0,
          aplanar: porcion.aplanar ?? 1,
          tapar: true,
          fibra: fibraDe(porcion),
        },
      )
    }
  }
}

/**
 * La musculatura, pero solo las porciones que se piden.
 *
 * `claves` a `null` significa TODAS, y ese caso es el guardián: sin filtro esto tiene
 * que dar exactamente la misma malla que `construirMusculos()`.
 *
 * `reutilizar` funciona igual que allí: la topología de un nivel no cambia entre
 * fotogramas, así que el búfer del cuadro anterior sirve y basta con poner el cursor a
 * cero. Cambiar de capa sí cambia la topología, y por eso `reiniciar()` va siempre.
 */
export function construirMusculosFiltrado(
  esq: EsqueletoResuelto,
  activacion: Activacion,
  enReposo: Record<string, number>,
  claves: ReadonlySet<string> | null,
  reutilizar?: Malla,
): Malla {
  const m = reutilizar ?? new Malla(16384)
  m.reiniciar()
  for (const pl of PORCIONES) {
    if (claves && !claves.has(pl.clave)) continue
    dibujarPorcion(m, esq, pl, activacion, enReposo)
  }
  return m
}

/**
 * La musculatura de un nivel del eje W: ya filtrada y ya coloreada como toca.
 *
 * Es `construirMusculosFiltrado()` con lo que `mallasDelSujeto()` declara para ese
 * nivel —las mismas porciones y la misma activación—. Que las dos rutas lean del mismo
 * sitio es lo que impide que la lista que se comprueba y la malla que se pinta se
 * separen: si `mallasDelSujeto()` dice que en la piel entran veinte músculos sin
 * activación, eso es literalmente lo que se sube.
 */
export function construirMusculosDeNivel(
  w: NivelW,
  esq: EsqueletoResuelto,
  patron: Patron,
  enReposo: Record<string, number>,
  reutilizar?: Malla,
): Malla {
  const nivel = NIVEL_POR_W[w]
  const activacion: Activacion = nivel.acabado === 'activacion' ? patron.activacion : {}
  return construirMusculosFiltrado(esq, activacion, enReposo, clavesDeNivel(w), reutilizar)
}

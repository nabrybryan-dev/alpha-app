import type { Color, Malla } from '../../../domain/patrones/malla'
import { colocar } from '../escena/piezas3d'
import { regionDeMusculo, type IdDeRegion } from './regiones'
import type { TinteDeRegion, TinteDelCuerpo } from './tinte'

/**
 * PINTAR EL SUJETO DE BLENDER: el tinte por region, el dolor en rojo y las tres capas.
 *
 * El atlas es COMPARTIDO (el explorador anatomico lo usa tal cual) y su color es el de cada
 * musculo en Blender. Pintarlo en sitio ensuciaria el de todos, asi que aqui se trabaja sobre
 * COPIAS: `CuerpoPintado` clona las mallas de musculo una vez, y `pintar()` reescribe sus
 * colores y su alfa. Quien llama vuelve a subir `musculos` al motor cuando cambia la `firma`.
 *
 * Los colores salen de los tokens `--salon-3d-*` y `--rojo` (ver `paletaDelTema`).
 *
 * ## Dos rojos que no se pueden confundir (Bryan, 25-oct)
 *
 * El rojo liso es lo que la sesion deja POR TRABAJAR; al terminar sus ejercicios la region
 * pasa del rojo a «trabajado» en `TRANSICION_MS`. El dolor sigue siendo rojo, pero A RAYAS
 * (bandas horizontales de `BANDA_DEL_DOLOR`), y debajo del cuerpo se lee «Te duele»: asi un
 * hombro adolorido no se lee como un hombro que toca entrenar.
 */

export type CapaDelCuerpo = 'piel' | 'musculo' | 'hueso'

export interface Paleta {
  base: Color
  luz: Color
  rojo: Color
  tendon: Color
}

/** Lo que tarda una region en pasar del rojo de «por trabajar» al color de lo trabajado. */
export const TRANSICION_MS = 1200

/**
 * En cuántos pasos se pinta la transición. Cada paso vuelve a subir lo estático al motor
 * (sala y atlas), así que van pocos: con 8 en 1,2 s se ve continua y sube 8 veces, no 20
 * (revisión ciega, N2).
 */
export const PASOS_DE_TRANSICION = 8

/** Alto de cada raya del dolor, en metros del sujeto (una de cada dos va oscura). */
export const BANDA_DEL_DOLOR = 0.03

/** Cuanto oscurece la raya oscura del dolor. */
const RAYA_OSCURA = 0.35

/** Opacidad de los musculos segun la capa: translucidos sobre el hueso, opacos en las demas. */
const ALFA_DEL_MUSCULO: Record<CapaDelCuerpo, number> = { piel: 1, musculo: 1, hueso: 0.3 }

export function colorDeRegion(k: number, dolor: boolean, p: Paleta): Color {
  if (dolor) return [...p.rojo]
  if (k <= 0) return [...p.base]
  return [
    p.base[0] + (p.luz[0] - p.base[0]) * k,
    p.base[1] + (p.luz[1] - p.base[1]) * k,
    p.base[2] + (p.luz[2] - p.base[2]) * k,
  ]
}

function mezclar(a: Color, b: Color, m: number): Color {
  return [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m, a[2] + (b[2] - a[2]) * m]
}

/** De 0 (recien terminada, aun roja) a 1 (ya en su color de trabajada). Sin marca, 1. */
export function avanceDeTransicion(t: TinteDeRegion, ahora: number): number {
  if (t.pendiente || t.trabajadaEn === undefined) return 1
  const m = (ahora - t.trabajadaEn) / TRANSICION_MS
  return m <= 0 ? 0 : m >= 1 ? 1 : m
}

/**
 * El color liso de una region (sin las rayas del dolor, que van por vertice). En Piel no se
 * ve ni el tinte de series ni lo pendiente (la maqueta lo oculta): solo el dolor.
 */
export function colorDeTinte(t: TinteDeRegion, p: Paleta, capa: CapaDelCuerpo, ahora: number): Color {
  if (t.dolor) return [...p.rojo]
  if (capa === 'piel') return [...p.base]
  if (t.pendiente) return [...p.rojo]
  const trabajada = colorDeRegion(t.k, false, p)
  return mezclar(p.rojo, trabajada, avanceDeTransicion(t, ahora))
}

export interface ParteDeMusculo {
  malla: Malla
  /** El nombre anatomico de la parte, con su `.l` / `.r`. */
  nombre: string
}

function esTendon(c: Float32Array, i: number): boolean {
  return c[i] >= 0.99 && c[i + 1] >= 0.99 && c[i + 2] >= 0.99
}

export class CuerpoPintado {
  /** Las copias que se suben al motor, en el mismo orden en que se entregaron. */
  readonly musculos: Malla[]
  private readonly regiones: (IdDeRegion | undefined)[]
  private readonly originales: Float32Array[]

  constructor(partes: readonly ParteDeMusculo[]) {
    this.musculos = partes.map(({ malla }) => {
      const copia = colocar([malla], { x: 0, z: 0, giroY: 0 })[0]
      copia.colgarDe(0) // identidad: quieto y de pie (ver `cuerpoEnEscena`)
      copia.textura = null
      return copia
    })
    this.originales = partes.map(({ malla }) => Float32Array.from(malla.color))
    this.regiones = partes.map(({ nombre }) => {
      const r = regionDeMusculo(nombre)
      return r === 'sin-region' ? undefined : r
    })
  }

  pintar(tinte: TinteDelCuerpo, paleta: Paleta, capa: CapaDelCuerpo, ahora = Date.now()): void {
    const oscuro: Color = [paleta.rojo[0] * RAYA_OSCURA, paleta.rojo[1] * RAYA_OSCURA, paleta.rojo[2] * RAYA_OSCURA]
    this.musculos.forEach((malla, i) => {
      const region = this.regiones[i]
      const t: TinteDeRegion = region ? tinte[region] : { k: 0, dolor: false }
      const color = colorDeTinte(t, paleta, capa, ahora)
      const destino = malla.color
      const original = this.originales[i]
      const posicion = malla.posicion
      for (let v = 0; v < destino.length; v += 3) {
        let c = color
        if (t.dolor) {
          // LAS RAYAS DEL DOLOR: bandas horizontales por la altura del vertice.
          if (Math.floor(posicion[v + 1] / BANDA_DEL_DOLOR) % 2 !== 0) c = oscuro
        } else if (esTendon(original, v) && !t.pendiente) {
          c = paleta.tendon
        }
        destino[v] = c[0]
        destino[v + 1] = c[1]
        destino[v + 2] = c[2]
      }
      malla.alfa = ALFA_DEL_MUSCULO[capa]
    })
  }

  /**
   * Cambia solo si cambia algo que se ve. Los k se redondean a dos decimales, y durante una
   * transicion el avance va en `PASOS_DE_TRANSICION` pasos.
   */
  firma(tinte: TinteDelCuerpo, capa: CapaDelCuerpo, ahora = Date.now()): string {
    const partes = Object.entries(tinte)
      .map(([id, t]) => {
        if (t.dolor) return `${id}:D`
        if (t.pendiente) return `${id}:P`
        const avance = avanceDeTransicion(t, ahora)
        return `${id}:${Math.round(t.k * 100)}${avance < 1 ? `~${Math.round(avance * PASOS_DE_TRANSICION)}` : ''}`
      })
      .join(',')
    return `${capa}|${partes}`
  }
}

/** Convierte «#rrggbb» o «r g b» a 0-1; devuelve el respaldo si no se entiende. */
function leerColor(texto: string, respaldo: Color): Color {
  const t = texto.trim()
  const hex = /^#([0-9a-f]{6})$/i.exec(t)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  }
  const trio = /^(\d+)[ ,]+(\d+)[ ,]+(\d+)$/.exec(t)
  if (trio) return [Number(trio[1]) / 255, Number(trio[2]) / 255, Number(trio[3]) / 255]
  return respaldo
}

const PALETA_OSCURA: Paleta = {
  base: [0.231, 0.255, 0.294],
  luz: [0.914, 0.933, 0.957],
  rojo: [0.86, 0.2, 0.2],
  tendon: [0.85, 0.83, 0.78],
}

const paletasGuardadas = new WeakMap<Element, { cuando: number; paleta: Paleta }>()

/**
 * La paleta del tema, leida del CONTENEDOR que se le pase (el salon) y no de `:root`.
 *
 * El salon fuerza `data-theme="dark"` (su sala es oscura en los dos temas); si se leyera de
 * `:root` en tema claro, la «luz» seria oscura y la «base» clara, y el tinte saldria
 * INVERTIDO: lo trabajado, mas apagado que lo que no. Sin DOM (pruebas) devuelve la oscura.
 */
export function paletaDelTema(contenedor?: Element | null): Paleta {
  if (typeof document === 'undefined') return PALETA_OSCURA
  const donde = contenedor ?? document.documentElement
  // `getComputedStyle` en cada cuadro costaria; el tema cambia de a uno por sesion.
  const ahora = Date.now()
  const guardada = paletasGuardadas.get(donde)
  if (guardada && ahora - guardada.cuando < 500) return guardada.paleta
  const paleta = leerPaleta(donde)
  paletasGuardadas.set(donde, { cuando: ahora, paleta })
  return paleta
}

function leerPaleta(donde: Element): Paleta {
  const css = getComputedStyle(donde)
  const v = (n: string) => css.getPropertyValue(n)
  return {
    base: leerColor(v('--salon-3d-apagada'), PALETA_OSCURA.base),
    luz: leerColor(v('--salon-3d-luz'), PALETA_OSCURA.luz),
    rojo: leerColor(v('--rojo-rgb'), PALETA_OSCURA.rojo),
    tendon: leerColor(v('--salon-3d-hueso'), PALETA_OSCURA.tendon),
  }
}

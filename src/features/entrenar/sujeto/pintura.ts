import { INDICE_RAIZ } from '../../../domain/patrones/esqueleto'
import type { Color, Malla } from '../../../domain/patrones/malla'
import { colocar } from '../escena/piezas3d'
import { regionDeMusculo, type IdDeRegion } from './regiones'
import type { TinteDelCuerpo } from './tinte'

/**
 * PINTAR EL SUJETO DE BLENDER: el tinte por region, el dolor en rojo y las tres capas.
 *
 * El atlas es COMPARTIDO (el explorador anatomico lo usa tal cual) y su color es el de cada
 * musculo en Blender. Pintarlo en sitio ensuciaria el de todos, asi que aqui se trabaja sobre
 * COPIAS: `CuerpoPintado` clona las mallas de musculo una vez, y `pintar()` reescribe sus
 * colores y su alfa. Quien llama vuelve a subir `musculos` al motor cuando cambia la `firma`.
 *
 * Los colores salen de los tokens `--salon-3d-*` y `--rojo` (ver `paletaDelTema`): el rojo es
 * el unico del cuerpo y es del dolor (regla de la app: dolor = rojo).
 */

export type CapaDelCuerpo = 'piel' | 'musculo' | 'hueso'

export interface Paleta {
  base: Color
  luz: Color
  rojo: Color
  tendon: Color
}

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
      copia.colgarDe(INDICE_RAIZ)
      copia.textura = null
      return copia
    })
    this.originales = partes.map(({ malla }) => Float32Array.from(malla.color))
    this.regiones = partes.map(({ nombre }) => {
      const r = regionDeMusculo(nombre)
      return r === 'sin-region' ? undefined : r
    })
  }

  pintar(tinte: TinteDelCuerpo, paleta: Paleta, capa: CapaDelCuerpo): void {
    this.musculos.forEach((malla, i) => {
      const region = this.regiones[i]
      const t = region ? tinte[region] : { k: 0, dolor: false }
      // En Piel el tinte de series no se ve (la maqueta lo oculta): solo el dolor.
      const k = capa === 'piel' ? 0 : t.k
      const color = colorDeRegion(k, t.dolor, paleta)
      const destino = malla.color
      const original = this.originales[i]
      for (let v = 0; v < destino.length; v += 3) {
        const c = esTendon(original, v) && !t.dolor ? paleta.tendon : color
        destino[v] = c[0]
        destino[v + 1] = c[1]
        destino[v + 2] = c[2]
      }
      malla.alfa = ALFA_DEL_MUSCULO[capa]
    })
  }

  /** Cambia solo si cambia algo que se ve. Los k se redondean a dos decimales. */
  firma(tinte: TinteDelCuerpo, capa: CapaDelCuerpo): string {
    const partes = Object.entries(tinte)
      .map(([id, t]) => `${id}:${t.dolor ? 'D' : Math.round(t.k * 100)}`)
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

/** La paleta del tema que esta puesto. Sin DOM (pruebas) devuelve la oscura. */
export function paletaDelTema(): Paleta {
  if (typeof document === 'undefined') return PALETA_OSCURA
  const css = getComputedStyle(document.documentElement)
  const v = (n: string) => css.getPropertyValue(n)
  return {
    base: leerColor(v('--salon-3d-apagada'), PALETA_OSCURA.base),
    luz: leerColor(v('--salon-3d-luz'), PALETA_OSCURA.luz),
    rojo: leerColor(v('--rojo-rgb'), PALETA_OSCURA.rojo),
    tendon: leerColor(v('--salon-3d-hueso'), PALETA_OSCURA.tendon),
  }
}

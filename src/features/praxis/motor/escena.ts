import { raiz, reducido } from './entorno'
import { DUR } from './movimiento'

/**
 * La escena: lo que comparten los dos lienzos.
 * Un solo DPR para el cielo y el agujero, un solo redimensionado y una sola Quieta: el
 * agujero y el centelleo del cielo se apagan en los mismos 1 600 ms, con la misma curva.
 */
export interface Deslizamiento { t0: number; dur: number; desde: number }

export const Escena = {
  dpr: 1,
  baja: false, sala: false, quietaActiva: false, quietaT0: 0, tRes: 0,
  desliz: null as Deslizamiento | null,
  reiniciar(): void {
    clearTimeout(this.tRes)
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5) // DPR_ESCENA = min(devicePixelRatio, 1,5)
    this.baja = false; this.sala = false; this.quietaActiva = false; this.quietaT0 = 0; this.desliz = null
  },
  quietaAmp(ahora: number): number {
    if (!this.quietaActiva) return 1
    if (reducido()) return 0
    return Math.max(0, 1 - (ahora - this.quietaT0) / DUR.apagado)
  },
}

/**
 * Tema: los dos lienzos leen sus colores de los tokens de la raíz (--lienzo-*). Oscuro: el
 * de siempre. Claro: papel cálido, el agujero y las órbitas en tinta, el disco en rojo
 * Praxis (plata cuando habla la persona), mezcla multiply en vez de lighter.
 */
export type Rgb = number[]
export interface Paleta {
  claro: boolean; cielo: string; mezcla: string; horizonte: string; foton: Rgb | null
  astros: string[]; astrosK: number; nebulosa: string[]; nebulosaK: number
  discoP: Rgb[]; discoU: Rgb[]; luz: Rgb; blanco: string; luzTxt: string; brasa: Rgb; ascua: Rgb
}

function leerPaleta(): Paleta {
  let cs: CSSStyleDeclaration | null = null
  try { cs = getComputedStyle(raiz()) } catch { cs = null }
  const g = (n: string, def: string) => { const x = cs ? cs.getPropertyValue(n).trim() : ''; return x || def }
  const rgb = (x: string): Rgb => x.split(',').map((n) => Math.round(+n) || 0)
  const lista = (x: string) => x.split(/\s+/).filter(Boolean)
  const foton = g('--lienzo-foton', 'none')
  return {
    claro: /multiply/.test(g('--lienzo-mezcla', 'lighter')),
    cielo: g('--lienzo-cielo', '3,4,8'), mezcla: g('--lienzo-mezcla', 'lighter'), horizonte: g('--lienzo-horizonte', '0,0,0'),
    foton: foton === 'none' ? null : rgb(foton),
    astros: lista(g('--lienzo-astros', '255,200,165 190,206,255 244,245,246')), astrosK: parseFloat(g('--lienzo-astros-k', '1')) || 1,
    nebulosa: lista(g('--lienzo-nebulosa', '255,30,30 72,60,170 120,40,110 255,170,120 180,190,255')), nebulosaK: parseFloat(g('--lienzo-nebulosa-k', '1')) || 1,
    discoP: lista(g('--lienzo-disco-p', '255,236,200 255,170,80 255,90,40 255,30,30 150,12,24')).map(rgb),
    discoU: lista(g('--lienzo-disco-u', '255,255,255 228,233,240 194,200,207 154,161,171 92,100,114')).map(rgb),
    luz: rgb(g('--lienzo-luz', '244,245,246')), blanco: g('--lienzo-blanco', '255,255,255'), luzTxt: g('--lienzo-luz', '244,245,246'),
    brasa: rgb(g('--lienzo-brasa', '255,90,60')), ascua: rgb(g('--lienzo-ascua', '255,176,130')),
  }
}

let paleta: Paleta | null = null
export const Tema = {
  leer(): Paleta { paleta = leerPaleta(); return paleta },
  get v(): Paleta { return paleta || this.leer() },
}

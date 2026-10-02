import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Cosmos } from './cosmos'
import { fijarEntorno, fijarMovSuave, limpiarEntorno } from './entorno'
import { Escena } from './escena'

/**
 * El cielo en viaje, con un lienzo falso que apunta lo que se le pide pintar. Aquí se prueba lo
 * que el estado puro (`viaje.test.ts`) no ve: que de verdad se dibujan los rayos mientras se
 * escucha, que con movimiento reducido NO se dibuja ninguno ni se mueve una estrella, y que al
 * acabar todo vuelve a su sitio.
 */
interface Lienzo { ctx: Record<string, unknown>; llamadas: string[]; fills: string[]; strokes: number; rayos: number; estrellas: [number, number][]; cuadros: [number, number][][] }

function lienzoFalso(): { canvas: HTMLCanvasElement; l: Lienzo } {
  const l: Lienzo = { ctx: {}, llamadas: [], fills: [], strokes: 0, rayos: 0, estrellas: [], cuadros: [] }
  const registro = (n: string) => () => { l.llamadas.push(n) }
  const ctx = new Proxy(l.ctx, {
    get(o, k: string) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop: () => {} })
      if (k === 'setTransform') return () => { l.cuadros.push([]) } // cada cuadro del cielo empieza así
      if (k === 'stroke') return () => { l.strokes++ }
      if (k === 'lineTo') return () => { l.rayos++ }
      if (k === 'fillRect') return (x: number, y: number, w: number) => { if (w < 1.2) { l.estrellas.push([x, y]); l.cuadros.at(-1)?.push([x, y]) } }
      if (k in o) return o[k]
      return registro(k)
    },
    set(o, k: string, v) { o[k] = v; if (k === 'fillStyle') l.fills.push(String(v)); return true },
  })
  const canvas = document.createElement('canvas')
  Object.defineProperty(canvas, 'clientWidth', { value: 390 })
  Object.defineProperty(canvas, 'clientHeight', { value: 844 })
  // Los demás lienzos (la nebulosa, que el cielo pinta aparte) reciben un contexto mudo: no cuentan.
  const mudo = new Proxy({}, { get: (_o, k: string) => (k === 'createRadialGradient' ? () => ({ addColorStop: () => {} }) : () => {}), set: () => true })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) { return (this === canvas ? ctx : mudo) as unknown as CanvasRenderingContext2D })
  return { canvas, l }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
function montarCielo(reducido: boolean) {
  const raiz = document.createElement('div')
  raiz.innerHTML = '<div id="salaCuerpo"></div>'
  document.body.append(raiz)
  fijarEntorno(raiz, 'tu', 'prueba-cielo')
  fijarMovSuave(reducido)
  Escena.reiniciar(); Escena.sala = true // la sala abierta: el cielo no se duerme
  const { canvas, l } = lienzoFalso()
  document.body.append(canvas)
  Cosmos.iniciar(canvas)
  Cosmos.fijarCentro(() => ({ x: 195, y: 422, r: 110 }))
  return { l, raiz }
}

beforeEach(() => {
  localStorage.clear()
  window.matchMedia = ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia
})
afterEach(() => { Cosmos.escucha(false); limpiarEntorno(); document.body.innerHTML = ''; vi.restoreAllMocks() })

describe('el cielo en viaje', () => {
  it('en reposo no hay ni un rayo', async () => {
    const { l } = montarCielo(false)
    await esperar(300)
    expect(l.strokes).toBe(0)
  })

  it('mientras se escucha se dibujan rayos (dos trazos por cuadro, no uno por rayo)', async () => {
    const { l } = montarCielo(false)
    Cosmos.escucha(true)
    await esperar(900)
    expect(l.strokes).toBeGreaterThan(10)
    expect(l.rayos).toBeGreaterThan(l.strokes * 20) // muchos rayos, pocos trazos
    expect(l.strokes % 2).toBe(0) // exactamente dos trazos por cuadro
  })

  it('las estrellas se abren desde el agujero mientras se escucha, y al soltar vuelven a su sitio', async () => {
    const { l } = montarCielo(false)
    await esperar(300)
    const reposo = l.cuadros.at(-2) as [number, number][] // el último cuadro completo en reposo
    Cosmos.escucha(true); Cosmos.pulso()
    await esperar(900)
    const viaje = l.cuadros.at(-2) as [number, number][]
    const dist = (p: [number, number]) => Math.hypot(p[0] - 195, p[1] - 422)
    expect(viaje.length).toBe(reposo.length)
    const mas = viaje.filter((p, i) => dist(p) > dist(reposo[i]) + 1).length
    expect(mas).toBeGreaterThan(viaje.length * 0.9) // casi todas más lejos del centro
    Cosmos.escucha(false)
    await esperar(1200)
    expect(l.cuadros.at(-2)).toEqual(reposo) // cada una exactamente en su sitio
    const strokes = l.strokes
    await esperar(400)
    expect(l.strokes).toBe(strokes) // ya no se pinta ningún rayo
  })
})

describe('el cielo en viaje · movimiento reducido', () => {
  it('con «Movimiento suave» no se pinta ni un rayo ni se mueve una estrella, aunque se escuche y se pulse', async () => {
    const { l } = montarCielo(true)
    await esperar(100)
    const reposo = l.cuadros.at(-1)
    Cosmos.escucha(true)
    for (let i = 0; i < 5; i++) { Cosmos.pulso(); await esperar(100) }
    expect(l.strokes).toBe(0)
    expect(l.cuadros.at(-1)).toEqual(reposo) // ni una estrella se movió
  })

  it('solo hay un leve aumento de brillo mientras se escucha, y se va al soltar', async () => {
    const { l } = montarCielo(true)
    await esperar(50)
    const alfa = (s: string) => parseFloat(s.slice(s.lastIndexOf(',') + 1))
    const reposo = l.fills.filter((f) => f.startsWith('rgba(')).slice(-50).map(alfa)
    Cosmos.escucha(true)
    const escuchando = l.fills.filter((f) => f.startsWith('rgba(')).slice(-50).map(alfa)
    const suma = (a: number[]) => a.reduce((s, x) => s + x, 0)
    expect(suma(escuchando)).toBeGreaterThan(suma(reposo) * 1.05)
    expect(suma(escuchando)).toBeLessThan(suma(reposo) * 1.3) // leve
    Cosmos.escucha(false)
    const fin = l.fills.filter((f) => f.startsWith('rgba(')).slice(-50).map(alfa)
    expect(suma(fin)).toBeCloseTo(suma(reposo), 1)
    expect(l.strokes).toBe(0)
  })
})

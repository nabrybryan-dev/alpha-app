import { describe, expect, it } from 'vitest'
import {
  interpretarSerie,
  proporcionTempo,
  segmentarCiclos,
  type EntradaSerie,
  type MuestraDeVideo,
} from './serieMedida'

const FPS = 30

/**
 * Fabrica una serie de repeticiones limpias.
 *
 * Cada ciclo sube `recorridoM` en `tironS`, hace una pausa y baja en
 * `bajadaS`. La velocidad decae un `decaePct` por repetición, que es lo que
 * hace de esto una serie y no un metrónomo.
 */
function serie(opciones: {
  reps: number
  recorridoM?: number
  tironS?: number
  bajadaS?: number
  pausaS?: number
  decaePct?: number
  codoGrados?: number
  derivaLateralM?: number
}): MuestraDeVideo[] {
  const {
    reps, recorridoM = 0.41, tironS = 0.8, bajadaS = 2.1, pausaS = 0.3,
    decaePct = 4, codoGrados = 95, derivaLateralM = 0,
  } = opciones
  const m: MuestraDeVideo[] = []
  let t = 0
  let altura = 0
  const paso = 1 / FPS
  const empujar = (dur: number, desde: number, hasta: number) => {
    const n = Math.max(1, Math.round(dur / paso))
    for (let i = 1; i <= n; i++) {
      t += paso
      altura = desde + ((hasta - desde) * i) / n
      m.push({
        t: Math.round(t * 1000) / 1000,
        alturaM: altura,
        lateralM: derivaLateralM * (t / (reps * (tironS + bajadaS + pausaS))),
        troncoGrados: 34,
        codoGrados,
      })
    }
  }
  // Un poco de reposo antes de empezar, como en cualquier toma real.
  empujar(0.4, 0, 0)
  for (let r = 0; r < reps; r++) {
    const factor = 1 - (decaePct / 100) * r
    empujar(tironS / Math.max(0.2, factor), 0, recorridoM)
    empujar(pausaS, recorridoM, recorridoM)
    empujar(bajadaS, recorridoM, 0)
    empujar(pausaS, 0, 0)
  }
  return m
}

function entrada(muestras: MuestraDeVideo[], extra: Partial<EntradaSerie> = {}): EntradaSerie {
  return {
    ejercicio: 'Remo',
    lado: 'derecho',
    muestras,
    fotogramasTotales: muestras.length,
    umbralPerdidaPct: 30,
    ...extra,
  }
}

describe('segmentarCiclos', () => {
  it('cuenta un ciclo por repetición', () => {
    const m = serie({ reps: 8 })
    const c = segmentarCiclos(m.map((x) => x.t), m.map((x) => x.alturaM))
    expect(c).toHaveLength(8)
  })

  it('no cuenta el temblor de quien sujeta la mancuerna esperando', () => {
    // Oscilación de 2 cm: por debajo del recorrido mínimo.
    const m: MuestraDeVideo[] = []
    for (let i = 0; i < 120; i++) {
      m.push({ t: i / FPS, alturaM: 0.02 * Math.sin(i / 3), lateralM: 0 })
    }
    const c = segmentarCiclos(m.map((x) => x.t), m.map((x) => x.alturaM))
    expect(c).toHaveLength(0)
  })
})

describe('interpretarSerie · cuando sí se puede medir', () => {
  const r = interpretarSerie(entrada(serie({ reps: 8 })))

  it('cuenta las ocho repeticiones', () => {
    expect(r.estado).toBe('medida')
    if (r.estado !== 'medida') return
    expect(r.reps).toBe(8)
    expect(r.velocidades).toHaveLength(8)
  })

  it('la velocidad decae a lo largo de la serie', () => {
    if (r.estado !== 'medida') throw new Error('debería medir')
    const v = r.velocidades.map((x) => x.velocidadMs)
    expect(v[0]).toBeGreaterThan(v[v.length - 1])
    expect(r.perdidaPct).toBeGreaterThan(0)
  })

  it('mide el recorrido y el tronco', () => {
    if (r.estado !== 'medida') throw new Error('debería medir')
    expect(r.recorridoCm).toBeGreaterThan(35)
    expect(r.recorridoCm).toBeLessThan(46)
    expect(r.troncoGrados).toBe(34)
  })

  it('separa bajada, pausa y tirón', () => {
    if (r.estado !== 'medida') throw new Error('debería medir')
    expect(r.tempo).not.toBeNull()
    expect(r.tempo!.bajadaS).toBeGreaterThan(r.tempo!.tironS)
  })

  it('arrastra el umbral del asesorado, no uno inventado', () => {
    const otro = interpretarSerie(entrada(serie({ reps: 8 }), { umbralPerdidaPct: 20 }))
    if (otro.estado !== 'medida') throw new Error('debería medir')
    expect(otro.umbralPct).toBe(20)
  })
})

describe('interpretarSerie · cuando no se puede medir', () => {
  it('el codo estirado va primero, porque explica a los demás', () => {
    const r = interpretarSerie(entrada(serie({ reps: 8, codoGrados: 161 })))
    expect(r.estado).toBe('sin-medida')
    if (r.estado !== 'sin-medida') return
    expect(r.motivos[0].clave).toBe('codo-estirado')
    expect(r.motivos[0].cifra).toContain('161')
  })

  it('detecta que te desplazas por la habitación', () => {
    const r = interpretarSerie(entrada(serie({ reps: 8, derivaLateralM: 0.8 })))
    if (r.estado !== 'sin-medida') throw new Error('debería fallar')
    const m = r.motivos.find((x) => x.clave === 'te-desplazas')
    expect(m).toBeDefined()
    expect(m!.titulo).toContain('cm en horizontal')
  })

  it('avisa cuando la mano tapa la mancuerna', () => {
    const m = serie({ reps: 8 })
    const r = interpretarSerie(entrada(m, { fotogramasTotales: Math.round(m.length / 0.65) }))
    if (r.estado !== 'sin-medida') throw new Error('debería fallar')
    const tapado = r.motivos.find((x) => x.clave === 'objeto-tapado')
    expect(tapado).toBeDefined()
    expect(tapado!.cifra).toContain(String(m.length))
  })

  it('un solo gesto no es una serie', () => {
    const r = interpretarSerie(entrada(serie({ reps: 1 })))
    if (r.estado !== 'sin-medida') throw new Error('debería fallar')
    expect(r.motivos.some((x) => x.clave === 'un-solo-ciclo')).toBe(true)
  })

  it('lo medido no se tira: recorrido y pico viajan igual', () => {
    const r = interpretarSerie(entrada(serie({ reps: 1 })))
    if (r.estado !== 'sin-medida') throw new Error('debería fallar')
    expect(r.loQuedoMedido.verticalCm).toBeGreaterThan(0)
    expect(r.loQuedoMedido.picoMs).toBeGreaterThan(0)
  })

  it('las repeticiones que no se pudieron contar son null, nunca cero', () => {
    const r = interpretarSerie(entrada(serie({ reps: 1 })))
    if (r.estado !== 'sin-medida') throw new Error('debería fallar')
    // Un cero es un dato; una raya es una ausencia. Si esto se relaja, la
    // pantalla acabará diciendo «0 repeticiones» de una serie sin medir.
    expect(r.loQuedoMedido.reps).toBeNull()
  })

  it('conserva la traza para poder dibujar lo que sí pasó', () => {
    const r = interpretarSerie(entrada(serie({ reps: 1 })))
    if (r.estado !== 'sin-medida') throw new Error('debería fallar')
    expect(r.trazaAltura.length).toBeGreaterThan(30)
  })
})

describe('proporcionTempo', () => {
  it('compara la bajada con el tirón', () => {
    const p = proporcionTempo({ bajadaS: 2.1, pausaS: 0.3, tironS: 0.8 })
    expect(p).not.toBeNull()
    expect(p!.veces).toBeCloseTo(2.6, 1)
    expect(p!.frase).toContain('2,6 veces')
  })

  it('no inventa una proporción si no hubo tirón', () => {
    expect(proporcionTempo({ bajadaS: 2.1, pausaS: 0.3, tironS: 0 })).toBeNull()
  })
})

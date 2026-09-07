import { describe, expect, it } from 'vitest'
import { PATRONES, type Patron } from '../src/domain/patrones/catalogo'

/**
 * UNA ZANCADA ES SU PROPIO ESPEJO, canal a canal.
 *
 * Las fichas cíclicas del cardio (Bryan, 2026-09-07) no son una repetición: la fase 0 es la
 * pierna derecha delante y la izquierda atrás, y la fase 1 es exactamente lo contrario. Si
 * un canal de un lado no coincide con el del otro lado en la fase opuesta, el sujeto cojea:
 * una pierna zancadea más que la otra, o un brazo bombea y el otro no. Y no se ve leyendo
 * la ficha, porque son veinte números en dos líneas.
 *
 * Lo que se afirma: para cada canal con lado —`caderaFlexD`/`caderaFlexI`, etc.— el D de la
 * fase 0 es el I de la fase 1 y viceversa, dentro de un grado; y los canales sin lado son
 * los mismos en las dos fases, porque el tronco no sabe qué pierna va delante.
 */

const ciclicos = PATRONES.filter((p) => p.ciclo)

function porLado(pose: Record<string, number>): Map<string, { D?: number; I?: number }> {
  const salida = new Map<string, { D?: number; I?: number }>()
  for (const [canal, valor] of Object.entries(pose)) {
    const m = /^(.*)([DI])$/.exec(canal)
    if (!m) continue
    const fila = salida.get(m[1]) ?? {}
    fila[m[2] as 'D' | 'I'] = valor
    salida.set(m[1], fila)
  }
  return salida
}

function espejo(p: Patron): string[] {
  const fallos: string[] = []
  const a = porLado(p.inicio)
  const b = porLado(p.fin)
  for (const [canal, ini] of a) {
    const fin = b.get(canal) ?? {}
    if (Math.abs((ini.D ?? 0) - (fin.I ?? 0)) > 1) fallos.push(`${canal}: D en 0 = ${ini.D}, I en 1 = ${fin.I}`)
    if (Math.abs((ini.I ?? 0) - (fin.D ?? 0)) > 1) fallos.push(`${canal}: I en 0 = ${ini.I}, D en 1 = ${fin.D}`)
  }
  for (const [canal, valor] of Object.entries(p.inicio)) {
    if (/[DI]$/.test(canal)) continue
    if (Math.abs(valor - (p.fin[canal] ?? 0)) > 1) fallos.push(`${canal} sin lado: ${valor} en 0, ${p.fin[canal]} en 1`)
  }
  return fallos
}

describe('el instrumento distingue, que es lo primero', () => {
  it('a una zancada coja la llama coja', () => {
    // Si `espejo` devolviera siempre vacío, todo lo de abajo pasaría sin mirar nada.
    const coja = { ...ciclicos[0], fin: { ...ciclicos[0].fin, rodillaFlexI: (ciclicos[0].fin.rodillaFlexI ?? 0) + 15 } }
    expect(espejo(coja).length).toBeGreaterThan(0)
  })
})

describe('las fichas cíclicas son su propio espejo', () => {
  it('hay fichas cíclicas: las cinco del cardio', () => {
    expect(ciclicos.length).toBeGreaterThanOrEqual(5)
  })

  it.each(ciclicos.map((p) => [p.id, p] as const))('%s', (_id, p) => {
    expect(espejo(p), espejo(p).join(' · ')).toEqual([])
  })

  it('alternan de verdad: la pierna derecha y la izquierda no van juntas', () => {
    // Una ficha con las dos piernas iguales pasaría el espejo —es simétrica— y no sería una
    // zancada sino un salto a pies juntos. Lo que separa a las dos piernas en la fase 0
    // tiene que ser grande.
    for (const p of ciclicos) {
      const d = p.inicio.caderaFlexD ?? 0
      const i = p.inicio.caderaFlexI ?? 0
      expect(Math.abs(d - i), `${p.id}: las dos caderas van juntas`).toBeGreaterThan(20)
    }
  })
})

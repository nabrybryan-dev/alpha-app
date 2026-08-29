import { describe, expect, it } from 'vitest'
import { PATRONES } from './catalogo'
import { DEMOSTRACIONES, demostracionesDe } from './demostraciones'
import { esqueletoEnFase } from './escena'
import { resolver, type Lado } from './esqueleto'
import { baseDeApoyo, centroDeMasas, desequilibrio, _soloParaTests } from './gravedad'

describe('el peso del sujeto', () => {
  it('reparte la masa entera, con los dos lados', () => {
    const total = _soloParaTests.SEGMENTOS.reduce((s, [, f]) => s + f, 0)
    expect(total).toBeGreaterThan(0.98)
    expect(total).toBeLessThan(1.02)
  })

  it('pone el centro de masas de un cuerpo de pie donde va: el mediopié y la pelvis', () => {
    // El clásico: en bipedestación el centro de masas ronda la altura del
    // sacro, algo por delante de él. Si sale en otro sitio, las fracciones
    // están mal repartidas.
    // Raíz en cero: la altura de pie ya está horneada en el hueso de la
    // pelvis, y sumarle la raíz de los patrones daría un sujeto a dos metros.
    const esq = resolver({}, [0, 0, 0], [0, 0, 0])
    const com = centroDeMasas(esq)
    expect(Math.abs(com[0]), 'descentrado lateral').toBeLessThan(0.03)
    expect(com[1]).toBeGreaterThan(0.9)
    expect(com[1]).toBeLessThan(1.35)
  })

  it('mantiene el equilibrio en todo patrón de pie, en todas las fases', () => {
    // Newton antes que nadie: la resultante del peso —el paralelogramo de todas
    // las fuerzas de los segmentos— tiene que caer dentro del apoyo, o el
    // sujeto se va de bruces. Es la restricción que obliga a que la cadera se
    // eche atrás cuando la rodilla va adelante, y la que habría cazado sola el
    // peso muerto que se doblaba hacia adelante.
    const MARGEN = 0.04
    // La sentadilla profunda es la excepción documentada: con la dorsiflexión
    // en sus 20° reales, bajar del paralelo solo equilibra con el talón
    // elevado, que el modelo no dibuja. Es el mismo hecho que documenta el
    // techo de dorsiflexión: no un fallo del gesto, una exigencia real de
    // movilidad. Fijado para que no crezca.
    const EXCEPCIONES: Record<string, number> = { sentadilla: 0.10 }
    for (const p of PATRONES) {
      const pies: Lado[] = p.pies ?? (p.apoyo === 'suelo' ? ['D', 'I'] : [])
      if (pies.length === 0) continue
      for (const fase of [0, 0.25, 0.5, 0.75, 1]) {
        const esq = esqueletoEnFase(p, fase)
        const fuera = desequilibrio(esq, pies, p.apoyosExtra ?? [])
        expect(
          fuera,
          `${p.id} en fase ${fase}: el peso cae ${(fuera * 100).toFixed(1)} cm fuera del apoyo`,
        ).toBeLessThan(EXCEPCIONES[p.id] ?? MARGEN)
      }
    }
  })

  it('mantiene el equilibrio también en las demostraciones cerradas', () => {
    for (const id of ['rodilla', 'cadera', 'tobillo']) {
      for (const d of demostracionesDe(id, 'cerrada')) {
        const pies: Lado[] = d.patron.pies ?? (d.patron.apoyo === 'suelo' ? ['D', 'I'] : [])
        if (pies.length === 0) continue
        for (const fase of [0, 0.5, 1]) {
          const esq = esqueletoEnFase(d.patron, fase)
          expect(desequilibrio(esq, pies), `${d.id} fase ${fase}`).toBeLessThan(0.05)
        }
      }
    }
  })

  it('no reclama equilibrio a quien no está de pie', () => {
    // Un press de banca no tiene base de apoyo en los pies: exigirle la
    // plomada sería inventar una física que no aplica tumbado.
    const esq = resolver({}, [0, 0.95, 0], [0, 0, 0])
    expect(baseDeApoyo(esq, [])).toBeNull()
    expect(desequilibrio(esq, [])).toBe(0)
  })

  it('deja las demostraciones flotantes fuera del contrato', () => {
    // Las abiertas flotan a propósito: sin apoyo no hay plomada que exigir.
    for (const d of DEMOSTRACIONES) {
      expect(d.patron.apoyo, d.id).toBe('ninguno')
    }
  })
})

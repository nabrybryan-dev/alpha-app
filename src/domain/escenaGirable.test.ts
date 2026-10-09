import { describe, expect, it } from 'vitest'
import {
  GIRO_MAXIMO,
  VISTA_3D,
  VISTA_PLANA,
  cajaProyectada,
  carasVisibles,
  ejeDesdeCero,
  esVistaPlana,
  limitarGiro,
  proyectar,
} from './escenaGirable'

describe('proyectar', () => {
  it('en la vista plana es el plano de frente: x queda, y sube en pantalla y la profundidad es z', () => {
    const p = proyectar({ x: 10, y: 40, z: 5 }, VISTA_PLANA)
    expect(p.x).toBeCloseTo(10)
    expect(p.y).toBeCloseTo(-40)
    expect(p.profundidad).toBeCloseTo(5)
  })

  it('girar 90° manda lo que estaba al fondo hacia el lado', () => {
    const p = proyectar({ x: 0, y: 0, z: 10 }, { giro: 90, inclinacion: 0 })
    expect(p.x).toBeCloseTo(10)
  })

  it('con inclinación, lo que está al fondo se ve más arriba en pantalla', () => {
    const cerca = proyectar({ x: 0, y: 0, z: -10 }, VISTA_3D)
    const lejos = proyectar({ x: 0, y: 0, z: 10 }, VISTA_3D)
    expect(lejos.y).toBeLessThan(cerca.y)
    expect(lejos.profundidad).toBeGreaterThan(cerca.profundidad)
  })

  it('la altura se conserva a escala en la vista plana (no hay perspectiva que engañe)', () => {
    const a = proyectar({ x: 0, y: 100, z: 0 }, VISTA_PLANA)
    const b = proyectar({ x: 0, y: 100, z: 500 }, VISTA_PLANA)
    expect(a.y).toBeCloseTo(b.y)
  })
})

describe('carasVisibles', () => {
  it('la vista plana solo enseña el frente: ni tapas ni costados', () => {
    expect(carasVisibles(VISTA_PLANA)).toEqual({ frente: true, derecha: false, izquierda: false, arriba: false })
  })

  it('girando a la derecha aparece el costado derecho, a la izquierda el izquierdo', () => {
    expect(carasVisibles({ giro: 20, inclinacion: 20 })).toMatchObject({ derecha: true, izquierda: false, arriba: true })
    expect(carasVisibles({ giro: -20, inclinacion: 20 })).toMatchObject({ derecha: false, izquierda: true })
  })
})

describe('cajaProyectada', () => {
  const caja = { x0: 0, x1: 20, z0: -10, z1: 10, alto: 100 }

  it('en plano es un rectángulo de 20 × 100 con la cima arriba', () => {
    const r = cajaProyectada(caja, VISTA_PLANA)
    expect(r.caras.map((c) => c.nombre)).toEqual(['frente'])
    const ys = r.caras[0].puntos.map((p) => p.y)
    expect(Math.min(...ys)).toBeCloseTo(-100)
    expect(Math.max(...ys)).toBeCloseTo(0)
    expect(r.cima.y).toBeCloseTo(-100)
  })

  it('en 3D pinta tres caras (frente, un costado y la tapa)', () => {
    const r = cajaProyectada(caja, VISTA_3D)
    expect(r.caras.map((c) => c.nombre).sort()).toEqual(['arriba', 'derecha', 'frente'])
  })
})

describe('el giro', () => {
  it('se limita a su rango y no acepta números rotos', () => {
    expect(limitarGiro(400)).toBe(GIRO_MAXIMO)
    expect(limitarGiro(-400)).toBe(-GIRO_MAXIMO)
    expect(limitarGiro(Number.NaN)).toBe(0)
    expect(limitarGiro(12)).toBe(12)
  })

  it('reconoce la vista plana', () => {
    expect(esVistaPlana(VISTA_PLANA)).toBe(true)
    expect(esVistaPlana(VISTA_3D)).toBe(false)
  })
})

describe('ejeDesdeCero', () => {
  it('empieza en cero y su tope cubre el máximo con números redondos', () => {
    expect(ejeDesdeCero(64)).toEqual({ tope: 80, marcas: [0, 20, 40, 60, 80] })
    expect(ejeDesdeCero(1980)).toEqual({ tope: 2000, marcas: [0, 500, 1000, 1500, 2000] })
  })

  it('un máximo exacto no se queda corto', () => {
    const eje = ejeDesdeCero(100)
    expect(eje.tope).toBeGreaterThanOrEqual(100)
    expect(eje.marcas[0]).toBe(0)
  })

  it('con cero o con un número roto devuelve un eje válido, no uno vacío', () => {
    expect(ejeDesdeCero(0)).toEqual({ tope: 1, marcas: [0, 1] })
    expect(ejeDesdeCero(Number.NaN).marcas[0]).toBe(0)
  })

  it('nunca recorta: el tope es siempre al menos el máximo', () => {
    for (const m of [1, 3, 7, 13, 99, 101, 4999, 31250, 123456]) {
      expect(ejeDesdeCero(m).tope).toBeGreaterThanOrEqual(m)
    }
  })
})

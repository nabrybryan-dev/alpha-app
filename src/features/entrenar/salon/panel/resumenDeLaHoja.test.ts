import { describe, expect, it } from 'vitest'
import type { DiaRuta } from '../../../../domain/rutaEntrenamiento'
import type { Sesion } from '../../../../domain/types'
import { resumenDeLaHoja } from './resumenDeLaHoja'

function dia(sobre: Partial<DiaRuta>): DiaRuta {
  return {
    fechaIso: '2026-10-29',
    dia: 'JUEVES',
    abreviatura: 'JUE',
    numero: '29',
    esHoy: false,
    estado: 'programada',
    titulo: 'TORSO B',
    sesionId: 's-b',
    ...sobre,
  } as DiaRuta
}

const semana: DiaRuta[] = [
  dia({ fechaIso: '2026-10-27', dia: 'MARTES', numero: '27', estado: 'completada', titulo: 'TORSO A', sesionId: 's-a' }),
  dia({ fechaIso: '2026-10-29', dia: 'JUEVES', esHoy: true, estado: 'hoy' }),
  dia({ fechaIso: '2026-10-31', dia: 'SÁBADO', numero: '31', titulo: 'PIERNA', sesionId: 's-c' }),
]

function sesion(id: string, nombre: string, n: number, hechas = false): Sesion {
  return {
    id,
    nombre,
    orden: 1,
    ejercicios: Array.from({ length: n }, (_, i) => ({
      id: `${id}-${i}`,
      nombre: `E${i}`,
      series: hechas ? [{ reps: 8, cargaKg: 20 }] : [],
    })),
  } as unknown as Sesion
}

describe('resumenDeLaHoja: lo que dice la hoja plegada', () => {
  it('hoy: «Torso B · hoy», cuántos ejercicios y el botón Empezar sesión hacia su sesión', () => {
    const r = resumenDeLaHoja({
      sesion: sesion('s-b', 'TORSO B', 6),
      semana,
      diaElegido: null,
      sesionCta: { id: 's-b', nombre: 'TORSO B', empezada: false, esDeHoy: true },
    })
    expect(r.titulo).toBe('TORSO B · hoy')
    expect(r.detalle).toBe('6 ejercicios')
    expect(r.boton).toEqual({ texto: 'Empezar sesión', a: '/entrenar/sesion/s-b' })
  })

  it('con series ya anotadas el botón dice Continuar sesión', () => {
    const r = resumenDeLaHoja({
      sesion: sesion('s-b', 'TORSO B', 1, true),
      semana,
      diaElegido: null,
      sesionCta: { id: 's-b', nombre: 'TORSO B', empezada: true, esDeHoy: true },
    })
    expect(r.detalle).toBe('1 ejercicio')
    expect(r.boton?.texto).toBe('Continuar sesión')
  })

  it('una sesión ya completa ofrece Ver resumen', () => {
    const r = resumenDeLaHoja({
      sesion: sesion('s-a', 'TORSO A', 5, true),
      semana,
      diaElegido: null,
      sesionCta: { id: 's-a', nombre: 'TORSO A', empezada: true, esDeHoy: false },
    })
    expect(r.boton?.texto).toBe('Ver resumen')
  })

  it('mirando otro día: dice el día, avisa de que no se anota y NO ofrece empezar', () => {
    const r = resumenDeLaHoja({
      sesion: sesion('s-c', 'PIERNA', 4),
      semana,
      diaElegido: 2,
      sesionCta: { id: 's-b', nombre: 'TORSO B', empezada: false, esDeHoy: true },
    })
    expect(r.titulo).toBe('PIERNA · sábado')
    expect(r.detalle).toBe('Solo para mirar: aquí no se anota')
    expect(r.boton).toBeNull()
  })

  it('sin sesión no inventa nada y no hay botón', () => {
    const r = resumenDeLaHoja({ sesion: undefined, semana, diaElegido: null, sesionCta: undefined })
    expect(r.titulo).toBe('Sin sesión')
    expect(r.boton).toBeNull()
  })
})

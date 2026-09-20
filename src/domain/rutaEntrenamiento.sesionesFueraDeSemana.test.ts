import { describe, expect, it } from 'vitest'
import { armarSemana, sesionesFueraDeLaSemana } from './rutaEntrenamiento'
import type { Microciclo, Sesion } from './types'

/**
 * SI ALGO NO CABE EN LA SEMANA, SE DICE — NO SE OCULTA.
 *
 * `armarSemana` SIEMPRE pinta 7 días: es una rejilla semanal, y la regla nueva
 * de Bryan (19-sep-2026) exige que todo microciclo NUEVO dure exactamente 7.
 * Pero mientras existan microciclos heredados con `cadenciaDias` 8 o 15, un
 * microciclo puede traer más sesiones «con día» que huecos libres en esos 7
 * días, o dos sesiones que casan el mismo nombre de día (`diaDeSesion` solo se
 * queda con la primera — ver el mapa `conDia` de `armarSemana`). Antes esto no
 * se decía en ningún sitio: la sesión que sobraba sencillamente no aparecía.
 *
 * `sesionesFueraDeLaSemana` es la señal de solo lectura para que la interfaz
 * pueda avisarlo (ver `CalendarioSemana` / `PanelInferior`).
 */

const s = (id: string, nombre: string, orden: number, dia?: Sesion['dia']): Sesion => ({
  id,
  nombre,
  orden,
  dia,
  ejercicios: [],
})

function micro(sesiones: Sesion[], cadenciaDias: 7 | 8 | 15, fechaInicio: string): Microciclo {
  return {
    id: 'm-1',
    usuarioId: 'u-1',
    numero: 1,
    cadenciaDias,
    estado: 'activo',
    fechaInicio,
    sesiones,
  }
}

describe('sesionesFueraDeLaSemana — el caso normal (cadenciaDias 7, sin días repetidos)', () => {
  it('con 7 días y como mucho una sesión por nombre de día, nunca queda ninguna fuera', () => {
    const m = micro(
      [
        s('s1', 'FULL A (LUNES)', 1),
        s('s2', 'FULL B (MIÉRCOLES)', 2),
        s('s3', 'FULL C (VIERNES)', 3),
      ],
      7,
      '2026-09-07',
    )
    const dias = armarSemana(m, '2026-09-08')
    expect(sesionesFueraDeLaSemana(m, dias)).toEqual([])
  })
})

describe('sesionesFueraDeLaSemana — cadenciaDias 15 heredada con más sesiones que huecos', () => {
  it('detecta las sesiones que la rejilla de 7 días no pudo colocar', () => {
    // Un microciclo quincenal real: dos semanas de lunes a viernes, cada una
    // con las MISMAS cinco etiquetas de día. `armarSemana` solo pinta 7 días
    // —una semana—, así que la primera semana ocupa sus 5 días con día propio
    // y sábado/domingo (sin día propio) se rellenan con las dos primeras
    // sesiones de la segunda semana. Las tres restantes de la segunda semana
    // no tienen dónde caer: antes desaparecían sin decir nada.
    const semana1 = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'].map((dia, i) =>
      s(`s${i + 1}`, `FULL ${dia}`, i + 1, dia),
    )
    const semana2 = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'].map((dia, i) =>
      s(`s${i + 6}`, `FULL ${dia} · SEMANA 2`, i + 6, dia),
    )
    const m = micro([...semana1, ...semana2], 15, '2026-09-07')
    const dias = armarSemana(m, '2026-09-08')
    const fuera = sesionesFueraDeLaSemana(m, dias)

    expect(fuera).toHaveLength(3)
    expect(fuera.every((sesion) => m.sesiones.includes(sesion))).toBe(true)
    // Y no se pierden del microciclo — siguen ahí, solo fuera de ESTA rejilla.
    expect(m.sesiones).toHaveLength(10)
  })

  it('una quincena real (dos sesiones, sin choque) no reporta ninguna fuera', () => {
    // El caso real de hoy en la base (`u-sara`, ver `data/seed/otros.ts`): un
    // microciclo de 15 días con solo dos sesiones, sin nombre de día. Cabe
    // entero en la semana, así que la compatibilidad no rompe nada para el
    // caso que existe hoy.
    const m = micro([s('s1', 'FULL A', 1), s('s2', 'FULL B', 2)], 15, '2026-09-07')
    const dias = armarSemana(m, '2026-09-08')
    expect(sesionesFueraDeLaSemana(m, dias)).toEqual([])
  })
})

describe('detalleDeSesion / sesionCompleta — el cardio cuenta como sesión', () => {
  it('una sesión sin ejercicios de fuerza, solo con bloques de cardio, ocupa su día en la rejilla', () => {
    const cardio: Sesion = {
      id: 's-cardio',
      nombre: 'ZONA 2 (MARTES)',
      orden: 1,
      ejercicios: [],
      tipo: 'metabolica',
      bloquesCardio: [{ id: 'b1', titulo: 'Trote suave', indicaciones: 'Zona 2, 30 min', duracionMin: 30 }],
    }
    const m = micro([cardio], 7, '2026-09-07')
    const dias = armarSemana(m, '2026-09-08')
    const martes = dias.find((d) => d.fechaIso === '2026-09-08')
    expect(martes?.sesionId).toBe('s-cardio')
    // No es «descanso»: es una sesión programada como cualquier otra, aunque no
    // traiga ejercicios de fuerza.
    expect(martes?.estado).not.toBe('descanso')
    expect(martes?.detalle).toContain('cardio')
  })
})

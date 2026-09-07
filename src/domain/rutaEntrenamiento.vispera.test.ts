import { describe, expect, it } from 'vitest'
import { armarSemana, semanaEsAdelantada, sesionDestacada } from './rutaEntrenamiento'
import type { Microciclo, Sesion } from './types'

/**
 * La semana que empieza se ve LA VÍSPERA.
 *
 * ROJO A PROPÓSITO contra el código anterior al 2026-09-06.
 *
 * EL CASO REAL. El domingo 6-sep se cargaron catorce microciclos que arrancaban
 * el lunes 7. Al entrar en las cuentas ese domingo, todas decían «Descanso» los
 * siete días. Los planes estaban bien; lo que fallaba era cuándo se pueden ver.
 *
 * Y no es cosmético: el coach revisa la víspera. Si no ve el plan hasta que ya
 * ha empezado, un error de programación se descubre con la gente entrenándolo.
 * Textual: «no puedo esperar hasta las doce, porque muchas veces el flujo cambia
 * o cometes errores, y si yo no lo veo, pues no lo puedo corregir».
 *
 * SON DOS COSAS ENCADENADAS, y la segunda es la que de verdad lo impedía:
 *
 *   1. `yaEmpezo` no reparte sesiones en fechas anteriores a `fechaInicio`.
 *   2. La rejilla se ancla a la semana natural de HOY. El domingo 6, esa semana
 *      va del lunes 31-ago al domingo 6: el lunes 7 ni siquiera está dibujado.
 *
 * Por eso el arreglo NO toca el candado —que existe por el fallo del 24-ago y
 * sigue haciendo falta— sino a qué semana se ancla la rejilla.
 */

const s = (id: string, nombre: string, orden: number): Sesion => ({
  id,
  nombre,
  orden,
  ejercicios: [],
})

/** Los días de Juan Felipe: lunes, miércoles y viernes. */
function microLMV(fechaInicio: string): Microciclo {
  return {
    id: 'm-jf',
    usuarioId: 'u-jf',
    numero: 1,
    cadenciaDias: 8,
    estado: 'activo',
    fechaInicio,
    sesiones: [
      s('s1', 'CUERPO ENTERO A (LUNES)', 1),
      s('s2', 'CUERPO ENTERO B (MIÉRCOLES)', 2),
      s('s3', 'CUERPO ENTERO C (VIERNES)', 3),
    ],
  }
}

const dia = (dias: ReturnType<typeof armarSemana>, fechaIso: string) => {
  const d = dias.find((x) => x.fechaIso === fechaIso)
  if (!d) throw new Error(`la rejilla no cubre ${fechaIso}`)
  return d
}

describe('armarSemana — la semana que aún no empieza se ve la víspera', () => {
  it('el domingo 6 se ven las sesiones del microciclo que arranca el lunes 7', () => {
    // Domingo 6-sep. El microciclo empieza mañana. Antes: siete «Descanso».
    const dias = armarSemana(microLMV('2026-09-07'), '2026-09-06')

    expect(dia(dias, '2026-09-07').titulo).toBe('CUERPO ENTERO A (LUNES)')
    expect(dia(dias, '2026-09-09').titulo).toBe('CUERPO ENTERO B (MIÉRCOLES)')
    expect(dia(dias, '2026-09-11').titulo).toBe('CUERPO ENTERO C (VIERNES)')
    expect(dias.filter((d) => d.estado === 'descanso')).toHaveLength(4)
  })

  it('ningún día de esa rejilla es «hoy», porque hoy no está dentro', () => {
    const dias = armarSemana(microLMV('2026-09-07'), '2026-09-06')

    expect(dias.some((d) => d.esHoy)).toBe(false)
    expect(dias.some((d) => d.estado === 'hoy')).toBe(false)
  })

  it('el botón propone la primera sesión de la semana, y NO como si fuera de hoy', () => {
    const destacada = sesionDestacada(armarSemana(microLMV('2026-09-07'), '2026-09-06'))

    // «Pendiente del lunes», no «Sesión de hoy»: es lo que separa avisar de mentir.
    expect(destacada?.sesionId).toBe('s1')
    expect(destacada?.esDeHoy).toBe(false)
  })

  it('se adelanta aunque falten varios días, no solo la víspera', () => {
    // Miércoles 2, microciclo del lunes 7: cinco días por delante.
    const dias = armarSemana(microLMV('2026-09-07'), '2026-09-02')

    expect(dia(dias, '2026-09-07').sesionId).toBe('s1')
    expect(semanaEsAdelantada(microLMV('2026-09-07'), '2026-09-02')).toBe(true)
  })

  it('`semanaEsAdelantada` es falso en cuanto el microciclo ya corre', () => {
    expect(semanaEsAdelantada(microLMV('2026-09-07'), '2026-09-07')).toBe(false)
    expect(semanaEsAdelantada(microLMV('2026-09-07'), '2026-09-10')).toBe(false)
  })
})

describe('lo que NO se puede romper al adelantar', () => {
  /**
   * El fallo del 2026-08-24, que es la razón de que el candado exista.
   * Microciclo del martes 25; su sesión «(LUNES)» es el 31, el ÚLTIMO día.
   * El lunes 24 esa sesión NO se ofrece.
   *
   * AQUÍ EL ADELANTO NO CAMBIA NADA, y es lo que lo hace seguro: el lunes 24 y
   * el martes 25 caen en la MISMA semana natural, así que anclar a hoy y anclar
   * al arranque dan la misma rejilla. Lo que impide el fallo sigue siendo
   * `yaEmpezo`, intacto.
   */
  function microMartes(): Microciclo {
    return {
      id: 'm-1',
      usuarioId: 'u-1',
      numero: 1,
      cadenciaDias: 8,
      estado: 'activo',
      fechaInicio: '2026-08-25',
      sesiones: [
        s('s1', 'PIERNA A (MARTES)', 1),
        s('s2', 'TORSO A (MIÉRCOLES)', 2),
        s('s3', 'ZONA 2 (LUNES)', 3),
      ],
    }
  }

  it('el lunes 24 nunca lleva la sesión «(LUNES)» del bloque que empieza el 25', () => {
    const dias = armarSemana(microMartes(), '2026-08-24')
    const lunes24 = dias.find((d) => d.fechaIso === '2026-08-24')

    // O no está en la rejilla, o está y va vacío. Lo que no puede es traer la sesión.
    expect(lunes24?.sesionId).toBeUndefined()
  })

  it('la rejilla de ese caso es la misma que antes: lunes 24 a domingo 30', () => {
    const dias = armarSemana(microMartes(), '2026-08-24')

    expect(dias[0].fechaIso).toBe('2026-08-24')
    expect(dias[6].fechaIso).toBe('2026-08-30')
    // El 31 —donde de verdad cae la sesión «(LUNES)»— es de la semana siguiente
    // y nunca estuvo en esta rejilla. Adelantar no lo trae.
    expect(dias.some((d) => d.fechaIso === '2026-08-31')).toBe(false)
  })

  it('y el martes 25, primer día del bloque, sí lleva su sesión', () => {
    const dias = armarSemana(microMartes(), '2026-08-24')
    expect(dia(dias, '2026-08-25').sesionId).toBe('s1')
  })

  it('a mitad de microciclo la rejilla sigue siendo la de hoy', () => {
    // Empezó el lunes 31-ago; hoy es jueves 3-sep, dentro del bloque.
    const dias = armarSemana(microLMV('2026-08-31'), '2026-09-03')

    expect(dias[0].fechaIso).toBe('2026-08-31')
    expect(dia(dias, '2026-09-03').esHoy).toBe(true)
    expect(semanaEsAdelantada(microLMV('2026-08-31'), '2026-09-03')).toBe(false)
  })

  it('sin `fechaInicio` no se adelanta nada: la rejilla es la de hoy', () => {
    const sinFecha = { ...microLMV('2026-09-07'), fechaInicio: '' } as Microciclo
    const dias = armarSemana(sinFecha, '2026-09-06')

    expect(dia(dias, '2026-09-06').esHoy).toBe(true)
    expect(semanaEsAdelantada(sinFecha, '2026-09-06')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { microcicloVigente, semanaEsAdelantada, semanaEsVencida } from './rutaEntrenamiento'
import type { Microciclo } from './types'

/**
 * EL VIGENTE SE ELIGE POR FECHA, NO POR NÚMERO.
 *
 * Regla de Bryan (19-sep-2026): un microciclo comienza el lunes y cubre hasta
 * el domingo — intervalo [lunes 00:00, lunes siguiente 00:00) en
 * America/Bogotá. Contrato en
 * `auditoria-alpha-20260919/vigia-codex/REGLA-SEMANA-LUNES-DOMINGO.md`.
 *
 * Hasta hoy, `HoyPage`, `RutaPage` y `ProgresoPage` hacían
 * `db.microciclos.byUsuario(id).find(m => m.estado === 'activo')`, y esa lista
 * viene ordenada por NÚMERO descendente (`mockDb.ts`). Mientras solo hay un
 * `activo` da igual. El problema es la invariante rota que ya pasó DOS VECES en
 * producción (ver `MicrociclosRepo.activarPropuesta` en `data/repos.ts`): con
 * dos `activo` a la vez, ese `find` devuelve el de MAYOR NÚMERO — casi siempre
 * el más nuevo, y por tanto el futuro. Un microciclo preparado para la semana
 * que viene desplazaba al vigente.
 *
 * Las fechas de aquí son reales del calendario: 2026-08-31, 2026-09-07,
 * 2026-09-14, 2026-09-21 y 2026-09-28 son LUNES; 2026-09-06, 2026-09-13,
 * 2026-09-20 y 2026-09-27 son DOMINGO (se apoya en el mismo hecho de calendario
 * que ya usa `rutaEntrenamiento.vencido.test.ts`: «lunes 31-ago» + cadencia 8 =
 * «lunes 7-sep»).
 */

function micro(
  id: string,
  numero: number,
  fechaInicio: string,
  cadenciaDias: 7 | 8 | 15 = 7,
  estado: Microciclo['estado'] = 'activo',
): Microciclo {
  return {
    id,
    usuarioId: 'u-1',
    numero,
    cadenciaDias,
    estado,
    fechaInicio,
    sesiones: [],
  }
}

describe('microcicloVigente — un único activo: la comprobación de fecha SIEMPRE corre', () => {
  // Devolución de la auditoría (A020) al PR #308: la primera versión devolvía
  // el único `activo` con un atajo (`activos.length <= 1`) que NUNCA miraba la
  // fecha. Con un solo candidato futuro eso hacía pasar por «vigente», en
  // silencio, una semana que todavía no le tocaba a la persona. Estos tres
  // casos —futuro, vencido y control— fijan la decisión explícita: la función
  // SIEMPRE evalúa la fecha, y cuando nadie cubre hoy sigue devolviendo el
  // mejor candidato (no `undefined`) por las razones documentadas en el
  // comentario de `microcicloVigente` — pero quien llama puede (y en `HoyPage`
  // ya lo hace) comprobar `semanaEsAdelantada`/`semanaEsVencida` sobre el
  // resultado para saber que NO es la semana de verdad.
  it('un único activo FUTURO: se devuelve igual (aviso «empieza el…»), pero pasó por la comprobación de fecha', () => {
    const futuro = micro('m-futuro', 9, '2026-09-14') // arranca el lunes 14, hoy es antes
    const resultado = microcicloVigente([futuro], '2026-09-10')
    expect(resultado?.id).toBe('m-futuro')
    // La prueba de que SÍ se comprobó la fecha, y no un atajo por conteo: este
    // candidato es, con las mismas reglas del dominio, «adelantado» — no
    // «vigente». Quien llama debe seguir usando esta función para decidirlo.
    expect(semanaEsAdelantada(futuro, '2026-09-10')).toBe(true)
    expect(semanaEsVencida(futuro, '2026-09-10')).toBe(false)
  })

  it('un único activo VENCIDO: se devuelve igual (entrenar el plan viejo es mejor que nada)', () => {
    const vencido = micro('m-vencido', 4, '2026-08-10', 7) // cubre 10..16-ago, hoy ya pasó
    const resultado = microcicloVigente([vencido], '2026-09-05')
    expect(resultado?.id).toBe('m-vencido')
    expect(semanaEsVencida(vencido, '2026-09-05')).toBe(true)
    expect(semanaEsAdelantada(vencido, '2026-09-05')).toBe(false)
  })

  it('control: un único activo que SÍ cubre hoy, se devuelve como vigente de verdad', () => {
    const vigente = micro('m-vigente', 5, '2026-09-07', 7) // cubre 07..13
    const resultado = microcicloVigente([vigente], '2026-09-10')
    expect(resultado?.id).toBe('m-vigente')
    expect(semanaEsAdelantada(vigente, '2026-09-10')).toBe(false)
    expect(semanaEsVencida(vigente, '2026-09-10')).toBe(false)
  })

  it('sin ningún activo, no hay vigente', () => {
    const propuesto = micro('m1', 5, '2026-09-07', 7, 'propuesto')
    const cerrado = micro('m0', 4, '2026-08-31', 7, 'cerrado')
    expect(microcicloVigente([propuesto, cerrado], '2026-09-08')).toBeUndefined()
    expect(microcicloVigente([], '2026-09-08')).toBeUndefined()
  })
})

describe('microcicloVigente — dos activos, uno vigente y otro futuro: el futuro no gana', () => {
  const vigente = micro('m-vigente', 7, '2026-09-07') // cubre 07..13
  const futuro = micro('m-futuro', 8, '2026-09-14') // cubre 14..20, todavía no

  it('hoy dentro del intervalo del vigente: gana el vigente, sea cual sea el orden del array', () => {
    expect(microcicloVigente([vigente, futuro], '2026-09-10')?.id).toBe('m-vigente')
    // El MISMO resultado con el array al revés: no puede depender del orden en
    // que `byUsuario` los devuelva.
    expect(microcicloVigente([futuro, vigente], '2026-09-10')?.id).toBe('m-vigente')
  })

  it('el futuro NUNCA gana solo por tener número más alto', () => {
    // Es literalmente el bug reportado: `find` sobre una lista ordenada por
    // número descendente devolvía el de número más alto -> el futuro.
    const numeroMasAlto = micro('m-futuro-2', 99, '2026-10-05')
    expect(microcicloVigente([vigente, numeroMasAlto], '2026-09-10')?.id).toBe('m-vigente')
  })
})

describe('microcicloVigente — frontera domingo 23:59 → lunes 00:00 (Bogotá)', () => {
  // Dos microciclos consecutivos, semana a semana: el primero cierra el
  // domingo 13-sep, el segundo abre el lunes 14-sep. La fecha es de día
  // completo (como toda la app: `hoyIso()` es local, no UTC), así que el
  // «domingo 23:59 → lunes 00:00» es exactamente el salto de una fecha a la
  // siguiente.
  const semana1 = micro('m-semana1', 10, '2026-09-07') // 07..13
  const semana2 = micro('m-semana2', 11, '2026-09-14') // 14..20

  it('el domingo, último instante de su semana: sigue vigente la semana que se cierra', () => {
    expect(microcicloVigente([semana1, semana2], '2026-09-13')?.id).toBe('m-semana1')
  })

  it('el lunes siguiente: la vigencia ya pasó a la semana nueva', () => {
    expect(microcicloVigente([semana1, semana2], '2026-09-14')?.id).toBe('m-semana2')
  })
})

describe('microcicloVigente — cadencia 15 heredada', () => {
  it('un microciclo de 15 días sigue vigente más allá del séptimo día, aunque haya uno futuro ya cargado', () => {
    const quincenal = micro('m-quincenal', 20, '2026-09-07', 15) // cubre 07-sep..21-sep
    const futuro = micro('m-futuro', 21, '2026-09-21', 7) // arranca justo cuando el quincenal cierra
    // Día 12 del ciclo de 15: ya pasó la semana «normal» de 7 días, y sigue
    // siendo el vigente — no el futuro, aunque exista y esté cargado.
    expect(microcicloVigente([quincenal, futuro], '2026-09-18')?.id).toBe('m-quincenal')
  })

  it('el mismo caso con cadencia 8', () => {
    const ocho = micro('m-ocho', 5, '2026-08-31', 8) // cubre 31-ago..07-sep
    const futuro = micro('m-futuro', 6, '2026-09-07', 7)
    expect(microcicloVigente([ocho, futuro], '2026-09-05')?.id).toBe('m-ocho')
  })
})

describe('microcicloVigente — cuando nadie cubre exactamente hoy', () => {
  it('si ambos ya empezaron y los dos vencieron, gana el que arrancó más tarde (el menos viejo)', () => {
    const viejo = micro('m-viejo', 3, '2026-08-10', 7) // 10..16
    const menosViejo = micro('m-menos-viejo', 4, '2026-08-24', 7) // 24..30
    expect(microcicloVigente([viejo, menosViejo], '2026-09-05')?.id).toBe('m-menos-viejo')
  })

  it('si los dos son futuros, gana el que empieza más pronto', () => {
    const lejano = micro('m-lejano', 9, '2026-10-05', 7)
    const cercano = micro('m-cercano', 8, '2026-09-21', 7)
    expect(microcicloVigente([lejano, cercano], '2026-09-10')?.id).toBe('m-cercano')
  })
})

/**
 * El espejo, comprobado contra los fallos que vino a cazar.
 *
 * Cada aviso tiene aquí su fixture, y el fixture reproduce un fallo REAL del 6 y
 * 7 de septiembre de 2026. Un aviso que nunca se ha visto saltar no es un aviso,
 * así que ninguno de los cinco se da por bueno sin su caso en rojo — y cada uno
 * lleva además su caso limpio al lado, porque una comprobación que grita siempre
 * tampoco mide nada.
 *
 * LOS TIPOS SE IMPORTAN DEL `.d.mts` Y LOS VALORES DEL `.mts`, a propósito: si la
 * implementación cambia una firma y la declaración se queda atrás, este archivo
 * deja de compilar. Es lo que hace que el `.d.mts` no sea decorativo.
 */
import { describe, expect, it } from 'vitest'
import {
  avisosDe,
  espejar,
  leerArgumentos,
  leerFixture,
  microciclosCitados,
  renderizar,
} from './espejo.mts'
import type { Aviso, ClaveDeAviso, Espejo } from './espejo.d.mts'
import { microciclosValentina } from '../../src/data/seed/valentina.ts'
import type { EjercicioPrescrito, Microciclo, Sesion } from '../../src/domain/types.ts'

/** Un ejercicio de fuerza correcto: con sus kilos escritos. */
function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'SENTADILLA',
    nombre: 'Prensa de piernas',
    cues: 'Empuja con el talón.',
    prescripcion: '80KG A 10 REPS; 3 SERIES (RIR 2).',
    cargaKg: 80,
    unidadCarga: 'kg',
    descansoMin: 2,
    sets: 3,
    rango: '8-10',
    repsDiana: 10,
    rirObjetivo: 2,
    // Un microciclo nuevo nace SIN ejecución: la prescripción se hereda, lo que
    // la persona hizo no. Por eso los fixtures arrancan con `series` vacío.
    series: [],
    ...parcial,
  }
}

function sesion(parcial: Partial<Sesion> = {}): Sesion {
  return {
    id: 's1',
    nombre: 'PIERNA (LUNES)',
    orden: 1,
    dia: 'LUNES',
    tipo: 'fuerza',
    ejercicios: [ejercicio()],
    ...parcial,
  }
}

/** Un microciclo sano: arranca el lunes 7-sep-2026, cadencia 7. */
function microciclo(parcial: Partial<Microciclo> = {}): Microciclo {
  return {
    id: 'm-prueba',
    usuarioId: 'u-prueba',
    numero: 26,
    cadenciaDias: 8,
    estado: 'activo',
    fechaInicio: '2026-09-07',
    sesiones: [sesion()],
    ...parcial,
  }
}

const claves = (avisos: Aviso[]): ClaveDeAviso[] => avisos.map((a) => a.clave)

describe('el espejo pinta la semana', () => {
  it('devuelve siete días y los nombra, con la nota y los avisos', () => {
    const texto = renderizar(espejar(microciclo(), '2026-09-07'))
    for (const dia of ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO']) {
      expect(texto).toContain(dia)
    }
    expect(texto).toContain('NOTA:')
    expect(texto).toContain('AVISOS:')
  })

  it('lista los ejercicios con su carga y su RIR, que es lo que la persona lee', () => {
    const texto = renderizar(espejar(microciclo(), '2026-09-07'))
    expect(texto).toContain('Prensa de piernas')
    expect(texto).toContain('80 kg')
    expect(texto).toContain('RIR 2')
  })

  it('la víspera pinta la semana del microciclo, no la del calendario', () => {
    // El fallo del 6-sep: catorce cuentas decían «Descanso» los siete días porque
    // la rejilla se anclaba a hoy y el plan empezaba al día siguiente.
    const espejo = espejar(microciclo(), '2026-09-06')
    const lunes = espejo.dias.find((d) => d.dia.dia === 'LUNES')
    expect(lunes?.dia.fechaIso).toBe('2026-09-07')
    expect(lunes?.sesion?.nombre).toBe('PIERNA (LUNES)')
  })

  it('sin nota, dice que la app no pinta nada en vez de callarse', () => {
    expect(renderizar(espejar(microciclo(), '2026-09-07'))).toContain('sin nota de la semana')
  })

  it('parte la nota en tarjetas con `objetivosDelBloque`, no a mano', () => {
    const nota = 'M26 · LA SEMANA DEL GLÚTEO — Subes volumen. || PASOS: 10.000 al día.'
    const texto = renderizar(espejar(microciclo(), '2026-09-07', nota))
    expect(texto).toContain('[M26 · LA SEMANA DEL GLÚTEO]')
    expect(texto).toContain('PASOS: 10.000 al día.')
  })
})

describe('el seed de Valentina no dispara ningún aviso', () => {
  it('su microciclo activo sale limpio', () => {
    const activo = microciclosValentina.find((m) => m.estado === 'activo')
    expect(activo).toBeDefined()
    const espejo = espejar(activo as Microciclo, activo!.fechaInicio)
    expect(claves(espejo.avisos)).toEqual([])
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Y SALE LIMPIO CUALQUIER DÍA DE LA SEMANA, que es lo que faltaba.
  //
  // El seed construye su microciclo activo con `fechaInicio: diasAtras(7)`, así que
  // arranca SIEMPRE en el día de la semana en que se corran las pruebas. Con la regla
  // vieja, un arranque de jueves a sábado dejaba menos huecos que sesiones sueltas y
  // saltaba `descanso-en-cadencia`: la prueba de arriba estaba verde de domingo a
  // miércoles y roja el resto, y la comprobación automática se limitó a tener suerte
  // con el calendario. Fijar «hoy» no basta —el seed no lo mira—: hay que recorrer los
  // siete arranques.
  // ─────────────────────────────────────────────────────────────────────────────
  const SIETE_ARRANQUES = [
    '2026-09-07', // lunes
    '2026-09-08', // martes
    '2026-09-09', // miércoles
    '2026-09-10', // jueves
    '2026-09-11', // viernes
    '2026-09-12', // sábado
    '2026-09-13', // domingo
  ]

  for (const arranque of SIETE_ARRANQUES) {
    it(`sigue limpio arrancando el ${arranque}`, () => {
      const activo = microciclosValentina.find((m) => m.estado === 'activo') as Microciclo
      const espejo = espejar({ ...activo, fechaInicio: arranque }, arranque)
      expect(claves(espejo.avisos)).toEqual([])
    })
  }
})

describe('aviso · sesión vacía sin bloques', () => {
  it('salta cuando una sesión no tiene ni ejercicios ni bloques', () => {
    // El 6-sep un ③ acabó con dos sesiones, una sin un solo ejercicio, y validaba.
    const micro = microciclo({
      sesiones: [sesion(), sesion({ id: 's2', nombre: 'TORSO (MARTES)', orden: 2, dia: 'MARTES', ejercicios: [] })],
    })
    const espejo = espejar(micro, '2026-09-07')
    expect(claves(espejo.avisos)).toContain('sesion-vacia')
    expect(renderizar(espejo)).toContain('TORSO (MARTES)')
  })

  it('NO salta en una metabólica: sus bloques SON la sesión', () => {
    const micro = microciclo({
      sesiones: [
        sesion(),
        sesion({
          id: 's2',
          nombre: 'ZONA 2 (MARTES)',
          orden: 2,
          dia: 'MARTES',
          tipo: 'metabolica',
          ejercicios: [],
          bloquesCardio: [{ id: 'b1', titulo: 'Bici 30 min', indicaciones: 'Ritmo conversacional.' }],
        }),
      ],
    })
    expect(claves(espejar(micro, '2026-09-07').avisos)).not.toContain('sesion-vacia')
  })
})

describe('aviso · `||` literal', () => {
  it('salta cuando las indicaciones traen el separador del generador', () => {
    const micro = microciclo({
      sesiones: [
        sesion({
          bloquesCardio: [
            { id: 'b1', titulo: 'Cardio', indicaciones: 'Bici 30 min. || SIN inclinación.' },
          ],
        }),
      ],
    })
    const avisos = espejar(micro, '2026-09-07').avisos
    expect(claves(avisos)).toContain('barras-literales')
    expect(avisos.find((a) => a.clave === 'barras-literales')?.donde).toContain('Cardio')
  })

  it('NO salta con un texto normal', () => {
    const micro = microciclo({
      sesiones: [sesion({ bloquesCardio: [{ id: 'b1', titulo: 'Cardio', indicaciones: 'Bici 30 min.' }] })],
    })
    expect(claves(espejar(micro, '2026-09-07').avisos)).not.toContain('barras-literales')
  })
})

describe('aviso · nota que cita un microciclo anterior', () => {
  it('salta cuando la nota dice M25 y el activo es el M26', () => {
    // El 7-sep nueve personas tenían la nota hablando de un microciclo que ya pasó.
    const espejo = espejar(microciclo(), '2026-09-07', 'M25 · LA SEMANA QUE TE GUSTÓ — repetimos.')
    const aviso = espejo.avisos.find((a) => a.clave === 'nota-vieja')
    expect(aviso).toBeDefined()
    expect(aviso?.detalle).toContain('M25')
    expect(aviso?.detalle).toContain('M26')
  })

  it('NO salta cuando la nota habla del activo o de uno futuro', () => {
    expect(claves(espejar(microciclo(), '2026-09-07', 'M26 · vamos allá').avisos)).not.toContain('nota-vieja')
    expect(claves(espejar(microciclo(), '2026-09-07', 'En el M27 subimos').avisos)).not.toContain('nota-vieja')
  })

  it('lee los números de microciclo que cita un texto', () => {
    expect(microciclosCitados('M25 y luego M27')).toEqual([25, 27])
    expect(microciclosCitados('sin citas')).toEqual([])
  })
})

describe('aviso · pide kilos y no dice cuántos', () => {
  it('salta cuando pide kilos y no hay número ni en el campo ni en la frase', () => {
    // Es lo que hacía que una asesorada no entrenara justo las sesiones sin
    // números: se plantaba delante de la máquina sin saber qué poner.
    const micro = microciclo({
      sesiones: [
        sesion({
          ejercicios: [
            ejercicio({ cargaKg: undefined, unidadCarga: 'kg', prescripcion: 'A 10 REPS; 3 SERIES (RIR 2).' }),
          ],
        }),
      ],
    })
    const espejo = espejar(micro, '2026-09-07')
    expect(claves(espejo.avisos)).toContain('carga-sin-kilos')
    expect(renderizar(espejo)).toContain('sin kilos')
  })

  it('NO salta si la frase trae los kilos: la persona tiene su número', () => {
    // Que `cargaKg` esté vacío mientras la frase dice «40KG» es una divergencia
    // campo/texto —la vigilan `comprobar-alineacion.sql` y su hermana— pero a la
    // persona no le duele: abre la app y lee sus 40 kg. El espejo mira lo que ve
    // ella, no la coherencia interna del registro.
    const micro = microciclo({
      sesiones: [
        sesion({
          ejercicios: [
            ejercicio({ cargaKg: undefined, unidadCarga: 'kg', prescripcion: '40KG A 10 REPS; 3 SERIES.' }),
          ],
        }),
      ],
    })
    expect(claves(espejar(micro, '2026-09-07').avisos)).not.toContain('carga-sin-kilos')
  })

  it('NO salta en peso corporal, que legítimamente no lleva kilos', () => {
    const micro = microciclo({
      sesiones: [
        sesion({
          ejercicios: [
            ejercicio({
              nombre: 'Plancha',
              cargaKg: undefined,
              unidadCarga: undefined,
              prescripcion: '40 SEGUNDOS; 3 SERIES.',
            }),
          ],
        }),
      ],
    })
    expect(claves(espejar(micro, '2026-09-07').avisos)).not.toContain('carga-sin-kilos')
  })
})

describe('aviso · «Descanso» dentro de la cadencia', () => {
  it('salta cuando una sesión no llega a ningún día de la rejilla', () => {
    // Dos sesiones el mismo día: la segunda no cabe y desaparece de la semana.
    const micro = microciclo({
      sesiones: [
        sesion(),
        sesion({ id: 's2', nombre: 'TORSO (LUNES)', orden: 2, dia: 'LUNES' }),
        sesion({ id: 's3', nombre: 'EXTRA (LUNES)', orden: 3, dia: 'LUNES' }),
        sesion({ id: 's4', nombre: 'MÁS (LUNES)', orden: 4, dia: 'LUNES' }),
        sesion({ id: 's5', nombre: 'OTRA (LUNES)', orden: 5, dia: 'LUNES' }),
        sesion({ id: 's6', nombre: 'Y OTRA (LUNES)', orden: 6, dia: 'LUNES' }),
        sesion({ id: 's7', nombre: 'PERDIDA (LUNES)', orden: 7, dia: 'LUNES' }),
        sesion({ id: 's8', nombre: 'TAMBIÉN PERDIDA (LUNES)', orden: 8, dia: 'LUNES' }),
      ],
    })
    const espejo = espejar(micro, '2026-09-07')
    const aviso = espejo.avisos.find((a) => a.clave === 'descanso-en-cadencia')
    expect(aviso).toBeDefined()
    expect(aviso?.detalle).toContain('PERDIDA (LUNES)')
  })

  it('salta con el incidente del 24-ago: arranque a media semana y sesión de un día anterior', () => {
    // El microciclo empieza el miércoles 9 y tiene una sesión llamada (LUNES).
    // El lunes 7 cae ANTES del arranque, así que `yaEmpezo` lo bloquea a
    // propósito —para no ofrecer lo que no ha empezado— y esa sesión no llega a
    // ningún día. El candado es correcto; lo que faltaba era decirlo.
    const micro = microciclo({
      fechaInicio: '2026-09-09',
      sesiones: [
        sesion(),
        sesion({ id: 's2', nombre: 'TORSO (MIÉRCOLES)', orden: 2, dia: 'MIÉRCOLES' }),
      ],
    })
    const aviso = espejar(micro, '2026-09-09').avisos.find((a) => a.clave === 'descanso-en-cadencia')
    expect(aviso).toBeDefined()
    expect(aviso?.detalle).toContain('PIERNA (LUNES)')
  })

  it('NO salta en una semana normal con días de descanso legítimos', () => {
    // Cuatro sesiones en siete días deja tres de descanso, y eso es el plan.
    const micro = microciclo({
      sesiones: [
        sesion(),
        sesion({ id: 's2', nombre: 'TORSO (MARTES)', orden: 2, dia: 'MARTES' }),
        sesion({ id: 's3', nombre: 'PIERNA B (JUEVES)', orden: 3, dia: 'JUEVES' }),
        sesion({ id: 's4', nombre: 'TORSO B (VIERNES)', orden: 4, dia: 'VIERNES' }),
      ],
    })
    expect(claves(espejar(micro, '2026-09-07').avisos)).not.toContain('descanso-en-cadencia')
  })
})

describe('la entrada por línea de comandos', () => {
  it('lee las tres banderas', () => {
    expect(leerArgumentos(['--microciclo', 'a.json', '--hoy', '2026-09-07', '--nota', 'n.txt'])).toEqual({
      microciclo: 'a.json',
      hoy: '2026-09-07',
      nota: 'n.txt',
    })
  })

  it('acepta un microciclo pelado y también `{ microciclo, nota }`', () => {
    const micro = microciclo()
    expect(leerFixture(JSON.stringify(micro)).microciclo.numero).toBe(26)
    const conNota = leerFixture(JSON.stringify({ microciclo: micro, nota: 'hola' }))
    expect(conNota.nota).toBe('hola')
    expect(conNota.microciclo.numero).toBe(26)
  })
})

describe('el espejo no reinterpreta a la app', () => {
  it('los siete días salen de `armarSemana`, con sus fechas consecutivas', () => {
    const espejo: Espejo = espejar(microciclo(), '2026-09-07')
    expect(espejo.dias).toHaveLength(7)
    const fechas = espejo.dias.map((d) => d.dia.fechaIso)
    expect(fechas).toEqual([...fechas].sort())
    expect(new Set(fechas).size).toBe(7)
  })

  it('`avisosDe` opera sobre la rejilla ya armada, no sobre el JSON crudo', () => {
    const micro = microciclo()
    const espejo = espejar(micro, '2026-09-07')
    expect(avisosDe(micro, espejo.dias)).toEqual(espejo.avisos)
  })
})

import { describe, expect, it } from 'vitest'
import type { CheckinDiario, Cribado, MedidaCorporal, Microciclo, PerfilNutricion, Sesion } from '../types'
import {
  adherenciaNutricionalPorSemana,
  adherenciaPorMicrociclo,
  datosAlimentacion,
  edadDe,
  fechaCorta,
  leerCribado,
  partirObjetivo,
  serieDeCheckins,
  seriePeso,
  seriesPerimetros,
  sinMarkdown,
  tablaDelPlan,
  tendencia,
} from './perfilCompleto'

/**
 * El perfil completo cruza las TRES fuentes de peso y perímetros. La prueba que más
 * importa es la primera: un dato que existe en el formulario de nutrición no puede
 * desaparecer porque la ficha no lo tenga (pasó con cinco personas el 6-sep).
 * Datos ficticios.
 */

const checkin = (fecha: string, extra: Partial<CheckinDiario> = {}): CheckinDiario => ({
  id: `ck-${fecha}`,
  usuarioId: 'u-1',
  fecha,
  ...extra,
})

const medida = (fecha: string, extra: Partial<MedidaCorporal> = {}): MedidaCorporal => ({
  fecha,
  alturaCm: 170,
  perimetros: {},
  ...extra,
})

const formulario: PerfilNutricion = {
  usuarioId: 'u-1',
  completadaEn: '2026-08-05T10:00:00Z',
  respuestas: { pesoKg: 71, cinturaCm: 80, caderaCm: 98, alergias: ['lacteos'], frecuenciaCocina: 'casi_siempre' },
}

describe('seriePeso', () => {
  it('junta check-ins, medidas y formulario, ordenados y cada uno con su fuente', () => {
    const serie = seriePeso(
      [checkin('2026-09-10', { pesoKg: 69.5 }), checkin('2026-09-01', { pesoKg: 70 }), checkin('2026-09-02')],
      [medida('2026-08-20', { pesoKg: 70.4 })],
      formulario,
    )
    expect(serie.map((p) => [p.fecha, p.valor, p.fuente])).toEqual([
      ['2026-08-05', 71, 'formulario'],
      ['2026-08-20', 70.4, 'medida'],
      ['2026-09-01', 70, 'checkin'],
      ['2026-09-10', 69.5, 'checkin'],
    ])
  })

  it('sin ningún peso devuelve vacío, no un cero', () => {
    expect(seriePeso([checkin('2026-09-01')], [medida('2026-09-01')], undefined)).toEqual([])
  })

  it('un formulario sin completar no aporta punto: no hay fecha que darle', () => {
    expect(seriePeso([], [], { ...formulario, completadaEn: undefined })).toEqual([])
  })
})

describe('seriesPerimetros', () => {
  it('cruza perímetros de la ficha, las medidas del cuerpo y el formulario sin fundir nombres', () => {
    const series = seriesPerimetros(
      [
        medida('2026-08-20', { perimetros: { Glúteo: 99, Glúteos: 100 } }),
        medida('2026-09-15', { cuerpo: { cinturaCm: 78 } }),
      ],
      formulario,
    )
    expect(series.get('Cintura')?.map((p) => [p.fecha, p.valor, p.fuente])).toEqual([
      ['2026-08-05', 80, 'formulario'],
      ['2026-09-15', 78, 'medida'],
    ])
    expect(series.get('Cadera')?.[0].valor).toBe(98)
    // «Glúteo» y «Glúteos» son dos series: juntarlas sería decidir que son el mismo sitio.
    expect(series.has('Glúteo')).toBe(true)
    expect(series.has('Glúteos')).toBe(true)
  })
})

describe('tendencia', () => {
  it('compara el último valor con el más antiguo dentro de la ventana', () => {
    const t = tendencia([
      { fecha: '2026-07-01', valor: 75, fuente: 'checkin' },
      { fecha: '2026-09-01', valor: 71, fuente: 'checkin' },
      { fecha: '2026-09-20', valor: 70.2, fuente: 'checkin' },
    ])
    expect(t?.ultimo.valor).toBe(70.2)
    expect(t?.delta).toBe(-0.8)
  })

  it('con un solo punto en la ventana no inventa una tendencia', () => {
    const t = tendencia([
      { fecha: '2026-06-01', valor: 75, fuente: 'checkin' },
      { fecha: '2026-09-20', valor: 70, fuente: 'checkin' },
    ])
    expect(t?.delta).toBeUndefined()
  })

  it('sin puntos no hay tendencia', () => {
    expect(tendencia([])).toBeUndefined()
  })
})

describe('adherencia', () => {
  const sesion = (hecha: boolean): Sesion =>
    ({
      id: `s-${Math.random()}`,
      nombre: 'Cardio',
      ejercicios: [],
      bloquesCardio: [{ id: 'b', titulo: 'Zona 2', ...(hecha ? { hechoEn: '2026-09-01T10:00:00Z' } : {}) }],
    }) as unknown as Sesion

  const micro = (numero: number, estado: Microciclo['estado'], hechas: boolean[]): Microciclo => ({
    id: `m-${numero}`,
    usuarioId: 'u-1',
    numero,
    cadenciaDias: 7,
    estado,
    fechaInicio: `2026-09-0${numero}`,
    sesiones: hechas.map(sesion),
  })

  it('una barra por microciclo entrenado, en orden, sin las propuestas', () => {
    const lista = adherenciaPorMicrociclo([
      micro(3, 'activo', [true, false]),
      micro(1, 'cerrado', [true, true]),
      micro(4, 'propuesto', [false]),
    ])
    expect(lista.map((m) => [m.numero, m.pct, m.registradas, m.totales])).toEqual([
      [1, 100, 2, 2],
      [3, 50, 1, 2],
    ])
  })

  it('la adherencia nutricional se agrupa por semana de lunes a domingo', () => {
    const semanas = adherenciaNutricionalPorSemana([
      { id: '1', usuarioId: 'u-1', fecha: '2026-09-21', estado: 'si' }, // lunes
      { id: '2', usuarioId: 'u-1', fecha: '2026-09-27', estado: 'parcial' }, // domingo
      { id: '3', usuarioId: 'u-1', fecha: '2026-09-28', estado: 'no' }, // lunes siguiente
    ])
    expect(semanas).toEqual([
      { semana: '2026-09-21', si: 1, parcial: 1, no: 0 },
      { semana: '2026-09-28', si: 0, parcial: 0, no: 1 },
    ])
  })
})

describe('leerCribado', () => {
  const base: Cribado = { usuarioId: 'u-1', fecha: '2026-09-01', fuente: 'app', detalle: {} }

  it('sin cribado: sin dato, no verde', () => {
    expect(leerCribado(undefined).color).toBe('sin_dato')
  })

  it('síntomas con el esfuerzo o cardiopatía en el PAR-Q: rojo', () => {
    expect(leerCribado({ ...base, sintomasConEsfuerzo: 'presente' }).color).toBe('rojo')
    expect(leerCribado({ ...base, parqEnfermedadCardiaca: true }).color).toBe('rojo')
  })

  it('cualquier otro «sí»: ámbar, con el texto que escribió la persona', () => {
    const l = leerCribado({ ...base, diagnostico: 'presente', detalle: { diagnostico: 'algo en la rodilla' } })
    expect(l.color).toBe('ambar')
    expect(l.positivos[0]).toMatchObject({ etiqueta: 'Diagnóstico', detalle: 'algo en la rodilla' })
  })

  it('la medicación crónica sola es ámbar y lo avisa, nunca rojo (decisión de Bryan, 26-sep)', () => {
    const l = leerCribado({ ...base, medicacionCronica: 'presente', detalle: { medicacionCronica: 'algo diario' } })
    expect(l.color).toBe('ambar')
    expect(l.motivo).toMatch(/medicación crónica/)
    expect(l.positivos[0]).toMatchObject({ etiqueta: 'Medicación crónica', detalle: 'algo diario' })
    // Con un síntoma crítico el rojo sigue mandando: la medicación no lo baja.
    expect(leerCribado({ ...base, medicacionCronica: 'presente', sintomasConEsfuerzo: 'presente' }).color).toBe('rojo')
  })

  it('todo contestado que no: verde; lo no preguntado queda como sin declarar', () => {
    const l = leerCribado({ ...base, diagnostico: 'ausente', sintomasConEsfuerzo: 'no_declarado', parqEnfermedadCardiaca: false })
    expect(l.color).toBe('verde')
    expect(l.sinDeclarar).toContain('Síntomas con el esfuerzo')
    expect(l.sinDeclarar).not.toContain('PAR-Q · enfermedad cardíaca')
  })
})

describe('perfil legible', () => {
  it('parte el objetivo en titular y apartados «TÍTULO: texto»', () => {
    const o = partirObjetivo('M5 · SEMANA DE BASE — Texto de arranque. || DOLOR, CADA DÍA: marca el cero. || Sin título aquí')
    expect(o.titular).toBe('M5 · SEMANA DE BASE')
    expect(o.apartados).toEqual([
      { texto: 'Texto de arranque.' },
      { titulo: 'DOLOR, CADA DÍA', texto: 'marca el cero.' },
      { texto: 'Sin título aquí' },
    ])
    expect(partirObjetivo('')).toEqual({ apartados: [] })
  })

  it('la edad sale de la ficha y, si falta, de la fecha de nacimiento del formulario', () => {
    const conNacimiento: PerfilNutricion = { usuarioId: 'u-1', respuestas: { fechaNacimiento: '2000-10-01' } }
    expect(edadDe(undefined, conNacimiento, '2026-09-26')).toBe(25)
    expect(edadDe(undefined, conNacimiento, '2026-10-01')).toBe(26)
    expect(edadDe(undefined, undefined, '2026-09-26')).toBeUndefined()
  })

  it('la alimentación se lee en pares legibles, sin guiones bajos', () => {
    expect(datosAlimentacion(formulario)).toEqual([
      { etiqueta: 'Alergias', valor: 'lacteos' },
      { etiqueta: 'Cocina', valor: 'casi siempre' },
    ])
    expect(datosAlimentacion(undefined)).toEqual([])
  })

  it('las señales numéricas del check-in, solo donde hay número', () => {
    const s = serieDeCheckins([checkin('2026-09-02', { dolor: 0 }), checkin('2026-09-01'), checkin('2026-09-03', { dolor: 3 })], 'dolor')
    // El cero es una medición: «sin dolor» cuenta.
    expect(s.map((p) => p.valor)).toEqual([0, 3])
  })

  it('fechaCorta no depende del idioma del navegador', () => {
    expect(fechaCorta('2026-09-07')).toBe('7 sep')
  })
})

describe('tablaDelPlan', () => {
  const contenido = {
    cabecera: ['Micro', 'Series', 'Energía'],
    filas: {
      '4': { columnas: { Micro: 'M4', Series: '~55', Energía: '−8 %' }, condiciones: {} },
      '3': { columnas: { Micro: '**M3**', Series: '~50', Energía: '[ver nota](../x.md)' }, condiciones: {} },
    },
  }

  it('ordena las filas, quita el Markdown y marca la del microciclo en curso', () => {
    const t = tablaDelPlan(contenido, 4)
    expect(t?.cabecera).toEqual(['Micro', 'Series', 'Energía'])
    expect(t?.filas).toEqual([
      { numero: 3, celdas: ['M3', '~50', 'ver nota'], actual: false },
      { numero: 4, celdas: ['M4', '~55', '−8 %'], actual: true },
    ])
  })

  it('sin la forma cabecera + filas no inventa una tabla', () => {
    expect(tablaDelPlan({ cabecera: [], filas: {} }, 1)).toBeUndefined()
    expect(tablaDelPlan({ objetivo_largo_plazo: 'x' }, 1)).toBeUndefined()
    expect(tablaDelPlan(null, 1)).toBeUndefined()
  })

  it('sinMarkdown respeta el texto', () => {
    expect(sinMarkdown('**−15 %** ⬅ *bajada por decisión del coach*')).toBe('−15 % ⬅ bajada por decisión del coach')
  })
})

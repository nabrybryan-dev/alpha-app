// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { armarContexto, microcicloVencido, sanearComidasAyer, sanearItemsCtx, type MicrocicloJson } from './contexto.ts'
import { horaLocal, resolverFecha } from './fecha.ts'
import { prepararSeries, prepararTestPost } from './guardado.ts'
import { revisarCarga, revisarGramos, revisarPasos } from './limites.ts'
import { armarContextoParaModelo, armarMensajeUsuario } from './prompt.ts'
import { resolverReserva } from './rir.ts'
import type { RegistroSeries, RegistroSesionCampo } from './tipos.ts'
import { normalizarUnidadCarga, resolverUnidad, unidadDeSerie } from './unidad.ts'

/**
 * El registrador de Praxis recibe tres cosas que no puede dar por buenas: lo que manda el
 * teléfono (el contexto), lo que devuelve el modelo (la propuesta que vuelve en /guardar) y
 * lo que hay en la base (un microciclo viejo, con campos que faltan). Aquí está lo que hace
 * con cada una cuando viene mal: rechazar, preguntar o dejar vacío. Nunca rellenar.
 */
const AHORA = '2026-09-28T18:40:00-05:00'
const micro: MicrocicloJson = {
  id: 'm-1', numero: 12, cadenciaDias: 7, fechaInicio: '2026-09-28',
  sesiones: [
    { id: 'S1', nombre: 'PIERNA', dia: 'LUNES', ejercicios: [{ id: 'pa1', nombre: 'SENTADILLA TRASERA', sets: 4, rango: '8-12', unidadCarga: 'kg', series: [] }] },
    { id: 'S2', nombre: 'EMPUJE', dia: 'MARTES', ejercicios: [{ id: 'pb1', nombre: 'PRESS BANCA PLANO', sets: 4, unidadCarga: 'por mano', cargaKg: 22.5, repsDiana: 8, series: [] }] },
  ],
}
const ctx = () => armarContexto({ ahora: AHORA, activo: micro })
const reg = (o: Partial<RegistroSeries> = {}): RegistroSeries => ({
  campo: 'series', ejercicio_id: 'pa1', ejercicio_nombre: 'SENTADILLA TRASERA', sesion_id: 'S1',
  valor: [{ orden: 1, cargaKg: 45, reps: 10 }], unidad: 'kg', confianza: 'media', avisos: [], ...o,
})

describe('/guardar vuelve a comprobar lo que le llega', () => {
  it('un orden de serie que no es un entero de 1 a 20 se rechaza', () => {
    for (const orden of [0, 21, 1.5, Number.NaN]) {
      expect(prepararSeries(reg({ valor: [{ orden, cargaKg: 45 }] }), ctx(), [], { ahora: AHORA })).toEqual({ ok: false, motivo: 'orden de serie inválido' })
    }
  })

  it('una carga que no es un número se rechaza: no se guarda un texto como kilos', () => {
    const malo = reg({ valor: [{ orden: 1, cargaKg: '45' as unknown as number }] })
    expect(prepararSeries(malo, ctx(), [], { ahora: AHORA })).toEqual({ ok: false, motivo: 'carga inválida' })
  })

  it('una confianza que no existe baja a «baja», no sube a «alta»', () => {
    const w = prepararSeries(reg({ confianza: 'altísima' as never }), ctx(), [], { ahora: AHORA })
    expect(w.ok && w.valor.series[0].confianza).toBe('baja')
  })

  it('lo no dicho queda AUSENTE: sin reps, sin RIR y sin origen si no los hubo', () => {
    const w = prepararSeries(reg({ valor: [{ orden: 1, cargaKg: 45 }] }), ctx(), [], { ahora: AHORA })
    expect(w.ok && w.valor.series[0]).toEqual({ orden: 1, cargaKg: 45, fuente: 'praxis', confianza: 'media', hechoEn: AHORA })
  })

  it('lo dicho se conserva: RIR, bloques extra y de dónde se copió', () => {
    const w = prepararSeries(reg({ origen: 'copiado_de_pauta', valor: [{ orden: 1, cargaKg: 45, reps: 10, rir: 2, extra: [{ reps: 4, cargaKg: 30 }] }] }), ctx(), [], { ahora: AHORA })
    expect(w.ok && w.valor.series[0]).toMatchObject({ reps: 10, rir: 2, extra: [{ reps: 4, cargaKg: 30 }], origen: 'copiado_de_pauta' })
  })

  it('el test de la sesión no se escribe sin microciclo, ni en uno vencido, ni en una sesión ajena', () => {
    const rpe: RegistroSesionCampo = { campo: 'testPost.rpeSesion', sesion_id: 'S1', valor: 8, unidad: 'rpe', confianza: 'alta' }
    expect(prepararTestPost(rpe, armarContexto({ ahora: AHORA, activo: null }), null)).toEqual({ ok: false, motivo: 'no hay microciclo activo' })
    expect(prepararTestPost(rpe, armarContexto({ ahora: '2026-10-20T10:00:00-05:00', activo: micro }), null)).toEqual({ ok: false, motivo: 'el microciclo venció' })
    expect(prepararTestPost({ ...rpe, sesion_id: 'S9' }, ctx(), null)).toEqual({ ok: false, motivo: 'esa sesión no está en tu microciclo activo' })
  })

  it('el test de la sesión se fusiona con lo que había, sin pisarlo', () => {
    const dur: RegistroSesionCampo = { campo: 'testPost.duracionMin', sesion_id: 'S1', valor: 55, unidad: 'min', confianza: 'alta' }
    expect(prepararTestPost(dur, ctx(), { rpeSesion: 8, prsEntrada: 6 })).toEqual({ ok: true, valor: { sesionId: 'S1', testPost: { rpeSesion: 8, prsEntrada: 6, duracionMin: 55 } } })
    expect(prepararTestPost(dur, ctx(), undefined)).toEqual({ ok: true, valor: { sesionId: 'S1', testPost: { duracionMin: 55 } } })
  })
})

describe('un microciclo con campos que faltan no rompe el contexto', () => {
  it('sesiones sin ejercicios, ejercicios sin series y sin unidad', () => {
    const viejo: MicrocicloJson = { id: 'm-v', sesiones: [{ id: 'C1', nombre: 'CARDIO' }, { id: 'S1', nombre: 'PIERNA', ejercicios: [{ id: 'x1', nombre: 'PRENSA', sets: 3 }] }] }
    const c = armarContexto({ ahora: AHORA, activo: viejo })
    expect(c.sesiones[0].ejercicios).toEqual([])
    expect(c.sesiones[1].ejercicios[0]).toMatchObject({ id: 'x1', unidad: null, series: [] })
    expect(c.microciclo).toEqual({ id: 'm-v', numero: undefined, vencido: false })
  })

  it('sin fecha de inicio o sin cadencia no se da por vencido', () => {
    expect(microcicloVencido({ id: 'a', sesiones: [] }, '2030-01-01')).toBe(false)
    expect(microcicloVencido({ id: 'a', fechaInicio: '2026-09-28', sesiones: [] }, '2030-01-01')).toBe(false)
  })

  it('el cardio y la preparación toman su nombre de donde lo haya, y dicen si ya están hechos', () => {
    const m: MicrocicloJson = { id: 'm', sesiones: [{ id: 'S1', nombre: 'X', bloquesCardio: [{ id: 'c1', titulo: 'Caminata', duracionMin: 20 }, { id: 'c2', nombre: 'Bici' }, { id: 'c3' }], preparacion: [{ id: 'p1', titulo: 'Movilidad', hechoEn: AHORA }, { id: 'p2' }] }] }
    const s = armarContexto({ ahora: AHORA, activo: m }).sesiones[0]
    expect(s.bloquesCardio).toEqual([{ id: 'c1', nombre: 'Caminata', duracionMin: 20 }, { id: 'c2', nombre: 'Bici', duracionMin: undefined }, { id: 'c3', nombre: 'c3', duracionMin: undefined }])
    expect(s.preparacion).toEqual([{ id: 'p1', nombre: 'Movilidad', hecha: true }, { id: 'p2', nombre: 'p2', hecha: false }])
  })

  it('de la semana anterior solo entran los ejercicios con series', () => {
    const anterior: MicrocicloJson = { id: 'm-0', sesiones: [{ id: 'S0', nombre: 'P' }, { id: 'S1', nombre: 'P', ejercicios: [{ id: 'pa1', nombre: 'X', sets: 3, series: [{ orden: 2, cargaKg: 50 }, { orden: 1, cargaKg: 45 }] }, { id: 'pa2', nombre: 'Y', sets: 3 }] }] }
    const c = armarContexto({ ahora: AHORA, activo: micro, anterior })
    expect(Object.keys(c.semanaAnterior)).toEqual(['pa1'])
    expect(c.semanaAnterior.pa1.map((s) => s.orden)).toEqual([1, 2])
  })
})

describe('lo que manda el teléfono se sanea', () => {
  it('las comidas de ayer: solo las de un tipo conocido y con ítems de verdad', () => {
    const r = sanearComidasAyer([
      null, 'texto', { comida: 'brunch', items: [{ alimento: 'arepa' }] }, { comida: 'cena', items: [] },
      { comida: 'almuerzo', items: [null, 7, { alimento: '  ' }, { alimento: 'x'.repeat(81) }, { alimento: ' arroz ', gramos: 150, medida_nombre: 'taza', medida_cantidad: 1, fuente_medida: 'TCAC', estado: 'cocido' }, { alimento: 'pollo', gramos: -5, medida_nombre: 3 }] },
    ])
    expect(r).toEqual([{ comida: 'almuerzo', items: [
      { alimento: 'arroz', gramos: 150, medida_nombre: 'taza', medida_cantidad: 1, fuente_medida: 'TCAC', estado: 'cocido' },
      { alimento: 'pollo', gramos: null, medida_nombre: null, medida_cantidad: null, fuente_medida: null, estado: null },
    ] }])
  })

  it('lo que no es una lista se trata como vacío', () => {
    expect(sanearComidasAyer('no soy una lista')).toEqual([])
    expect(sanearItemsCtx({ alimento: 'arepa' })).toEqual([])
  })

  it('el contexto solo lleva comidas y visibilidad cuando el teléfono las mandó', () => {
    const sin = armarContexto({ ahora: AHORA, activo: micro })
    expect(sin).not.toHaveProperty('comidasAyer')
    expect(sin).not.toHaveProperty('comidaPendiente')
    expect(sin.perfil).toEqual({ pesoBarraKg: null })
    const con = armarContexto({ ahora: AHORA, activo: micro, verComposicion: false, pesoBarraKg: 20, comidasAyer: [], comidaPendiente: [{ alimento: 'arepa', gramos: 56 }] })
    expect(con.perfil).toEqual({ pesoBarraKg: 20, verComposicion: false })
    expect(con.comidasAyer).toEqual([])
    expect(con.comidaPendiente).toHaveLength(1)
  })
})

describe('lo que SÍ viaja al modelo', () => {
  it('lleva nombres y conteos, nunca cargas, pautas ni RIR: el modelo no puede «completar» con ellos', () => {
    const paquete = armarContextoParaModelo(armarContexto({ ahora: AHORA, activo: micro, pantallaEjercicioId: 'pb1', pesoBarraKg: 20 }))
    expect(paquete).toEqual({
      hora_local: AHORA,
      sesion: { nombre: 'EMPUJE', ejercicios: [{ ref: 'e1', nombre: 'PRESS BANCA PLANO', unidad: 'por_mano', series_hechas: 0, sets: 4 }] },
      ejercicio_en_pantalla: 'PRESS BANCA PLANO',
      barra_conocida: true,
    })
    expect(JSON.stringify(paquete)).not.toMatch(/22[.,]5|cargaKg|repsDiana|rango|8-12/)
  })

  it('sin una sesión clara de hoy van todas las sesiones, y lo dice con un nombre nulo', () => {
    const sinDia: MicrocicloJson = { ...micro, sesiones: micro.sesiones.map((s) => ({ ...s, dia: undefined })) }
    const paquete = armarContextoParaModelo(armarContexto({ ahora: AHORA, activo: sinDia })) as { sesion: { nombre: string | null; ejercicios: { ref: string }[] }; ejercicio_en_pantalla: string | null; barra_conocida: boolean }
    expect(paquete.sesion.nombre).toBeNull()
    expect(paquete.sesion.ejercicios.map((e) => e.ref)).toEqual(['e1', 'e2'])
    expect(paquete.ejercicio_en_pantalla).toBeNull()
    expect(paquete.barra_conocida).toBe(false)
  })

  it('el mensaje al modelo trae la frase entre comillas y avisa que el contexto no es para completar números', () => {
    const m = armarMensajeUsuario(ctx(), 'le metí 40')
    expect(m).toContain('no lo uses para completar números')
    expect(m).toContain('«le metí 40»')
  })
})

describe('las unidades no se parten ni se duplican a ciegas', () => {
  it.each([
    ['kg', 'kg'], ['Kilos', 'kg'], ['total', 'total'], ['KG TOTAL', 'total'], ['por mano', 'por_mano'], ['mano', 'por_mano'],
    ['por-lado', 'por_lado'], ['lado', 'por_lado'], ['corporal', 'corporal'], ['peso corporal', 'corporal'], ['banda', 'banda'],
  ] as const)('«%s» se lee como %s', (bruta, unidad) => {
    expect(normalizarUnidadCarga(bruta)).toBe(unidad)
  })

  it('una unidad desconocida o vacía es nula, no «kg»', () => {
    expect(normalizarUnidadCarga('arrobas')).toBeNull()
    expect(normalizarUnidadCarga('')).toBeNull()
    expect(normalizarUnidadCarga(undefined)).toBeNull()
  })

  it('cómo se guarda cada unidad: «total» y lo desconocido son kilos', () => {
    expect([unidadDeSerie('por_mano'), unidadDeSerie('por_lado'), unidadDeSerie('corporal'), unidadDeSerie('banda'), unidadDeSerie('total'), unidadDeSerie(null)])
      .toEqual(['por_mano', 'por_lado', 'corporal', 'banda', 'kg', 'kg'])
  })

  const mancuerna = { nombre: 'CURL MARTILLO', unidad: 'por_mano' as const }
  const barra = { nombre: 'PRESS BANCA', unidad: 'kg' as const }
  const unilateral = { nombre: 'PRENSA UNILATERAL', unidad: 'por_lado' as const }

  it('si lo dicho coincide con el ejercicio, se guarda tal cual', () => {
    expect(resolverUnidad(mancuerna, 'mano', 12)).toEqual({ unidad: 'por_mano', delEjercicio: false })
    expect(resolverUnidad(unilateral, 'lado', 40)).toEqual({ unidad: 'por_lado', delEjercicio: false })
    expect(resolverUnidad(barra, 'total', 60)).toEqual({ unidad: 'kg', delEjercicio: false })
  })

  it('si no dijo nada, manda la unidad del ejercicio', () => {
    expect(resolverUnidad(mancuerna, 'no_dicho', 12)).toEqual({ unidad: 'por_mano', delEjercicio: true })
    expect(resolverUnidad({ nombre: 'DOMINADAS', unidad: 'corporal' }, 'total', 0)).toEqual({ unidad: 'corporal', delEjercicio: true })
    expect(resolverUnidad({ nombre: 'FACE PULL', unidad: 'banda' }, 'mano', 0)).toEqual({ unidad: 'banda', delEjercicio: true })
  })

  it('«en cada mano» sobre un ejercicio en total PREGUNTA, con la cuenta a la vista', () => {
    const r = resolverUnidad(barra, 'mano', 20)
    expect(r.pregunta).toEqual({
      texto: 'PRESS BANCA va en kilos en total. ¿Los 20 kg fueron en cada mano?',
      opciones: ['20 kg en cada mano (40 en total)', '20 kg en total'],
      campo_bloqueante: 'unidad_carga',
    })
    expect(resolverUnidad(unilateral, 'mano', 20).pregunta?.texto).toBe('PRENSA UNILATERAL va en kilos por lado. ¿Los 20 kg fueron en cada mano?')
  })

  it('«por lado» sobre un ejercicio que no es por lado también pregunta', () => {
    expect(resolverUnidad(barra, 'lado', 20).pregunta?.opciones).toEqual(['20 kg por lado (40 en total)', '20 kg en total'])
  })

  it('«en total» sobre un ejercicio por mano o por lado pregunta por la mitad, sin partirla sola', () => {
    expect(resolverUnidad(mancuerna, 'total', 25).pregunta).toMatchObject({ texto: 'CURL MARTILLO se anota por mano. ¿25 en total son 12,5 por mano?', opciones: ['Sí, 12,5 por mano', 'No, 25 por mano'] })
    expect(resolverUnidad(unilateral, 'total', 80).pregunta?.texto).toBe('PRENSA UNILATERAL se anota por lado. ¿80 en total son 40 por lado?')
  })
})

describe('el RIR, las fechas y los límites', () => {
  it('una reserva sin número, negativa o con decimales queda ausente: no se inventa', () => {
    expect(resolverReserva({ tipo: 'reserva_dicha', cita: 'me quedaban algunas' }, [])).toEqual({})
    expect(resolverReserva({ tipo: 'reserva_dicha', cita: null }, [])).toEqual({})
    expect(resolverReserva({ tipo: 'reserva_dicha', cita: 'dos y medio' }, [])).toEqual({})
  })

  it('«no me acuerdo bien» baja la confianza del RIR', () => {
    const seguro = resolverReserva({ tipo: 'reserva_dicha', cita: 'dos' }, [])
    const dudoso = resolverReserva({ tipo: 'reserva_dicha', cita: 'dos' }, ['no_recuerda'])
    expect(seguro.rir).toBe(2)
    expect(dudoso.rir).toBe(2)
    expect(dudoso.confianza).not.toBe(seguro.confianza)
  })

  it('«anteayer» y «hace un rato» se resuelven sobre la fecha local', () => {
    expect(resolverFecha('anteayer en la tarde', AHORA)).toMatchObject({ fecha: '2026-09-26', relativa: 'anteayer', esHoy: false })
    expect(resolverFecha('hace un rato', AHORA)).toMatchObject({ fecha: '2026-09-28', relativa: 'hoy', esHoy: true, etiqueta: 'hoy' })
  })

  it('una hora que no se puede leer es mediodía, no medianoche', () => {
    expect(horaLocal('2026-09-28')).toEqual({ h: 12, m: 0 })
    expect(horaLocal(AHORA)).toEqual({ h: 18, m: 40 })
  })

  it('una carga negativa, unos pasos desmedidos o unos gramos imposibles no pasan como normales', () => {
    expect(revisarCarga(-5)).toEqual({ tipo: 'imposible', motivo: 'carga negativa' })
    expect(revisarCarga(Number.NaN).tipo).toBe('imposible')
    expect(revisarPasos(45_000)).toEqual({ tipo: 'aviso', aviso: 'Dato fuera de lo habitual' })
    expect(revisarGramos(0).tipo).toBe('imposible')
    expect(revisarGramos(2500).tipo).toBe('imposible')
    expect(revisarGramos(150)).toEqual({ tipo: 'ok' })
  })
})

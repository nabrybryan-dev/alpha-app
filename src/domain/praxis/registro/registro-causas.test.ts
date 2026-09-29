// @vitest-environment node
/**
 * Pruebas de las causas raíz del 29-sep-2026 (corrida del banco con Haiku): cada una fija una REGLA
 * general con frases y contextos distintos a los del corpus, no el caso suelto.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contextoDeCorpus, itemDeComida } from '../../../../scripts/praxis-eval/contexto-corpus.ts'
import { EXTRACCIONES_GRABADAS_RELAJADAS } from '../../../../scripts/praxis-eval/extracciones-grabadas.ts'
import { numerosInventados, puntuarRelajado, type Caso } from '../../../../scripts/praxis-eval/puntuar.ts'
import { armarContexto, sanearComidasAyer } from './contexto.ts'
import { validarExtraccion } from './esquema.ts'
import { desambiguarConContexto, resolverComida } from './comida.ts'
import { escanearNumeros, minutosDeCita, valorDeCita } from './numeros.ts'
import { resolverPropuesta } from './resolver.ts'
import { resolverVida, sinDolorExplicito } from './vida.ts'
import type {
  BloqueExtraido, ComidaExtraida, ContextoRegistro, Extraccion, RegistroCheckin, RegistroSeries, VidaExtraida,
} from './tipos.ts'

const ctx = (extra: Partial<ContextoRegistro> = {}, ahora = '2026-10-01T13:10:00-05:00'): ContextoRegistro => ({
  ahora, microciclo: null, sesionHoyId: null, sesiones: [], pantalla: { ejercicioId: null }, ultimoTocado: null,
  semanaAnterior: {}, perfil: { pesoBarraKg: null }, ...extra,
})
const vida = (o: Partial<VidaExtraida>): VidaExtraida => ({
  sueno_horas: null, hora_acostarse: null, hora_levantarse: null, calidad_sueno: null, pasos: null,
  actividad_sin_numero: null, agua: null, escalas: [], senales: [], ...o,
})
const comida = (o: Partial<ComidaExtraida>): ComidaExtraida => ({
  comida_cita: null, cuando: null, segun_plan: 'no_dicho', items: [], plato: null, cocinado_por_ella: 'no_dicho', aceite: null, sal: null, ...o,
})
const extraccion = (o: Partial<Extraccion>): Extraccion => ({
  intencion: [], entreno: [], comida: null, vida: null, sesion: null, correccion: null, aclaracion: null,
  clinico: { hay: false, cita: null }, fuera_de_alcance: false, ...o,
})
const checkin = (r: { registros: unknown[] }): RegistroCheckin =>
  r.registros.find((x) => (x as { campo: string }).campo === 'checkin') as RegistroCheckin

const sesionHoy: Partial<ContextoRegistro> = {
  sesionHoyId: 'S2',
  sesiones: [{ id: 'S2', nombre: 'Espalda A', ejercicios: [] }],
}

describe('«y media» pegado a la unidad', () => {
  it('«una taza y media» son 1,5; «ocho horas y media» son 8,5; lo demás no cambia', () => {
    expect(valorDeCita('una taza y media')).toBe(1.5)
    expect(valorDeCita('ocho horas y media')).toBe(8.5)
    expect(valorDeCita('3 litros y medio')).toBe(3.5)
    expect(valorDeCita('cuarenta y cinco')).toBe(45)
    expect(valorDeCita('dos series')).toBe(2)
    expect(valorDeCita('una y media')).toBe(1.5)
    expect(escanearNumeros('dos tazas y media de arroz y tres huevos').map((n) => n.valor)).toEqual([2.5, 3])
  })
  it('las horas siguen leyéndose aparte: «dos horas y media» son 150 min', () => {
    expect(minutosDeCita('dos horas y media')).toBe(150)
  })
})

describe('cita literal: el prompt no puede enseñar lo que el validador rechaza', () => {
  it('«una taza y media» es cita válida de «comí una taza y media de arroz»; «una y media» no', () => {
    const frase = 'comí una taza y media de arroz'
    const item = (cantidad: string) => ({ comida: { items: [{ alimento: 'arroz', cantidad, medida: 'taza' }] } })
    expect(validarExtraccion(frase, item('una taza y media')).citasInvalidas).toEqual([])
    expect(validarExtraccion(frase, item('una y media')).citasInvalidas).toHaveLength(1)
  })
  it('la comida con «una taza y media» en la cantidad da 1,5 tazas (237 g)', () => {
    const { registro } = resolverComida(
      comida({ items: [{ alimento: 'arroz', cantidad: 'una taza y media', medida: 'taza', estado: null, senales: [] }] }), ctx(),
    )
    expect(registro?.items[0]).toMatchObject({ gramos: 237, medida_cantidad: 1.5 })
  })
  it('y con «y media» partido entre cantidad y medida también', () => {
    const { registro } = resolverComida(
      comida({ items: [{ alimento: 'arroz', cantidad: 'una', medida: 'taza y media', estado: null, senales: [] }] }), ctx(),
    )
    expect(registro?.items[0]).toMatchObject({ gramos: 237 })
  })
})

describe('peso corporal', () => {
  it('«78 y medio» en ayunas: peso 78,5 en el check-in', () => {
    const r = resolverVida(vida({ peso_corporal: '78 y medio' }), ctx(), 'me pesé en ayunas y salí en 78 y medio')
    expect(r.registros[0]).toMatchObject({ campo: 'checkin', parche: { pesoKg: 78.5 }, confianza_por_campo: { pesoKg: 'alta' } })
  })
  it('la coma es decimal: «80,2»', () => {
    expect(resolverVida(vida({ peso_corporal: '80,2' }), ctx(), 'peso 80,2 en ayunas').registros[0]).toMatchObject({ parche: { pesoKg: 80.2 } })
  })
  it('una suposición o un «no me pesé» no se anota', () => {
    const r = resolverVida(vida({ peso_corporal: '78' }), ctx(), 'hoy no me pesé pero creo que estoy como en 78')
    expect(r.registros).toEqual([])
    expect(r.descartado).toHaveLength(1)
  })
  it('si la persona no ve su composición, no se anota', () => {
    const r = resolverVida(vida({ peso_corporal: '70' }), ctx({ perfil: { pesoBarraKg: null, verComposicion: false } }), 'me pesé y salí en 70')
    expect(r.registros).toEqual([])
    expect(r.descartado[0].motivo).toMatch(/no lleva el peso/)
  })
  it('un peso imposible se pregunta, no se recorta', () => {
    const r = resolverVida(vida({ peso_corporal: '780' }), ctx(), 'me pesé y salí en 780')
    expect(r.pregunta?.campo_bloqueante).toBe('pesoKg')
    expect(r.registros).toEqual([])
  })
})

describe('el entreno de hoy que no fue la pauta', () => {
  const dia = (estado: 'no_entreno' | 'descanso' | 'cambio', motivo: string | null = null, hizo: string | null = null) =>
    vida({ dia_de_entreno: { estado, motivo, hizo } })

  it('no entrenó: se anota la sesión y el motivo citado, sin reproche', () => {
    const r = resolverVida(dia('no_entreno', 'se me cruzó una reunión'), ctx(sesionHoy), 'hoy no fui al gym porque se me cruzó una reunión')
    expect(r.registros[0]).toMatchObject({ parche: { entreno: 'No entrenó (Espalda A) — «se me cruzó una reunión»' } })
    expect(Object.keys((r.registros[0] as RegistroCheckin).parche)).toEqual(['entreno'])
  })
  it('sin motivo ni sesión clara: solo «No entrenó»', () => {
    expect(resolverVida(dia('no_entreno'), ctx(), 'hoy no entrené').registros[0]).toMatchObject({ parche: { entreno: 'No entrenó' } })
  })
  it('descanso', () => {
    expect(resolverVida(dia('descanso'), ctx(sesionHoy), 'hoy fue mi día libre').registros[0]).toMatchObject({ parche: { entreno: 'Descanso' } })
  })
  it('cambio: dice qué hizo y cuál era la pauta', () => {
    expect(resolverVida(dia('cambio', null, 'hombro'), ctx(sesionHoy), 'me tocaba espalda pero hice hombro').registros[0])
      .toMatchObject({ parche: { entreno: 'hombro (cambió Espalda A)' } })
  })
  it('cambio sin decir qué hizo: no se anota nada', () => {
    const r = resolverVida(dia('cambio'), ctx(sesionHoy), 'cambié la sesión')
    expect(r.registros).toEqual([])
    expect(r.descartado).toHaveLength(1)
  })
  it('«no entrené» junto a series en la misma frase es una contradicción: no se anota', () => {
    const r = resolverVida(dia('no_entreno', 'x'), ctx(sesionHoy), 'no entrené ni comí pero hice sentadilla', { hizoEntreno: true })
    expect(r.registros).toEqual([])
  })
  it('el motivo no se vuelve ánimo ni ganas', () => {
    const r = resolverVida(dia('no_entreno', 'llovía y me dio pereza'), ctx(sesionHoy), 'no entrené porque llovía y me dio pereza')
    expect(Object.keys((r.registros[0] as RegistroCheckin).parche)).toEqual(['entreno'])
  })
  it('de punta a punta: la propuesta es una tarjeta, no «nada (sin_datos)»', () => {
    const p = resolverPropuesta('hoy no fui al gym', extraccion({ intencion: ['vida'], vida: dia('no_entreno') }), ctx(sesionHoy))
    expect(p.accion).toBe('tarjeta')
  })
})

describe('tiempos sueltos: caminata, siesta, pantalla', () => {
  it('una siesta y las horas de pantalla van a comentarios con la duración citada, sin tocar el sueño', () => {
    const r = resolverVida(
      vida({ tiempos: [{ actividad: 'siesta', duracion: 'veinte minutos' }, { actividad: 'pantalla', duracion: 'unas cuatro horas' }] }),
      ctx(), 'me eché una siesta de veinte minutos y estuve unas cuatro horas en el celular',
    )
    const c = checkin(r)
    expect(c.parche).toEqual({ comentarios: 'Siesta: veinte minutos · Pantalla: unas cuatro horas' })
    expect(c.parche.horasSueno).toBeUndefined()
  })
  it('suma a lo que ya decía el comentario de hoy y muestra el antes', () => {
    const c = checkin(resolverVida(
      vida({ tiempos: [{ actividad: 'siesta', duracion: 'una hora' }] }), ctx({ checkinHoy: { comentarios: 'Semana pesada' } }), 'siesta de una hora',
    ))
    expect(c.parche.comentarios).toBe('Semana pesada · Siesta: una hora')
    expect(c.antes).toEqual({ comentarios: 'Semana pesada' })
  })
  it('caminata con duración: tarjeta, y los pasos quedan como duda que NO bloquea; nunca minutos a pasos', () => {
    const p = resolverPropuesta(
      'caminé un montón, como hora y media',
      extraccion({ intencion: ['vida'], vida: vida({ tiempos: [{ actividad: 'caminata', duracion: 'como hora y media' }] }) }),
      ctx(),
    )
    expect(p.accion).toBe('tarjeta')
    expect(p.seguimiento?.campo_bloqueante).toBe('pasos')
    expect(checkin(p).parche.pasos).toBeUndefined()
  })
  it('«caminé bastante» sin duración sigue sin registrarse: pregunta por los pasos', () => {
    const p = resolverPropuesta('caminé bastante', extraccion({ intencion: ['vida'], vida: vida({ actividad_sin_numero: 'caminé bastante' }) }), ctx())
    expect(p.accion).toBe('preguntar')
  })
  it('una duración ilegible se descarta', () => {
    const r = resolverVida(vida({ tiempos: [{ actividad: 'pantalla', duracion: 'un buen rato' }] }), ctx(), 'un buen rato en el celular')
    expect(r.registros).toEqual([])
    expect(r.descartado).toHaveLength(1)
  })
  it('más de 24 horas no cabe', () => {
    expect(resolverVida(vida({ tiempos: [{ actividad: 'siesta', duracion: '30 horas' }] }), ctx(), 'siesta de 30 horas').registros).toEqual([])
  })
})

describe('ausencia explícita de dolor', () => {
  it('tabla cerrada: solo estas negaciones', () => {
    expect(sinDolorExplicito('hoy sin dolor')).toBe(true)
    expect(sinDolorExplicito('no siento ningún dolor')).toBe(true)
    expect(sinDolorExplicito('hoy no me duele nada, estoy perfecto')).toBe(true)
    expect(sinDolorExplicito('estoy perfecto')).toBe(false)
    expect(sinDolorExplicito('me duele poquito')).toBe(false)
  })
  it('una negación con otro dolor en la misma frase no es un cero', () => {
    expect(sinDolorExplicito('no me duele nada la espalda pero me duele el hombro')).toBe(false)
    expect(sinDolorExplicito('sin dolor en la rodilla, pero el cuello me molesta')).toBe(false)
  })
  it('se anota dolor 0 con confianza alta, y la frase que solo dice «perfecto» no', () => {
    const c = checkin(resolverVida(vida({ sin_dolor: 'hoy sin dolor' }), ctx(), 'hoy sin dolor'))
    expect(c.parche).toEqual({ dolor: 0 })
    expect(c.confianza_por_campo.dolor).toBe('alta')
    const r = resolverVida(vida({ sin_dolor: 'estoy perfecto' }), ctx(), 'estoy perfecto')
    expect(r.registros).toEqual([])
  })
})

describe('«lo mismo de ayer»', () => {
  const ayer: ContextoRegistro['comidasAyer'] = [
    { comida: 'almuerzo', items: [{ alimento: 'arroz', gramos: 150 }, { alimento: 'pechuga', gramos: 200 }, { alimento: 'plátano maduro', gramos: 66 }] },
    { comida: 'cena', items: [{ alimento: 'huevos', gramos: 100 }, { alimento: 'arepa delgada', gramos: 56 }] },
  ]
  const ref = (o: Partial<ComidaExtraida>) => comida({ referencia: 'igual_que_ayer', ...o })

  it('copia la comida equivalente de ayer con sus gramos, como estimado editable', () => {
    const r = resolverComida(ref({ comida_cita: 'almorcé' }), ctx({ comidasAyer: ayer }))
    expect(r.registro?.comida).toBe('almuerzo')
    expect(r.registro?.items.map((i) => [i.alimento, i.gramos])).toEqual([['arroz', 150], ['pechuga', 200], ['plátano maduro', 66]])
    expect(r.registro?.items.every((i) => i.editable && i.confianza === 'media')).toBe(true)
    expect(r.registro?.confianza_registro).toBe('estimado')
  })
  it('«sin el huevo» quita el ítem que coincide y lo dice', () => {
    const r = resolverComida(ref({ comida_cita: 'cené', sin: ['el huevo'] }), ctx({ comidasAyer: ayer }, '2026-10-01T20:00:00-05:00'))
    expect(r.registro?.items.map((i) => i.alimento)).toEqual(['arepa delgada'])
    expect(r.avisos.join(' ')).toMatch(/huevos/)
  })
  it('lo que quita y no estaba ayer se descarta a la vista, no se inventa', () => {
    const r = resolverComida(ref({ comida_cita: 'almorcé', sin: ['el aguacate'] }), ctx({ comidasAyer: ayer }))
    expect(r.registro?.items).toHaveLength(3)
    expect(r.descartado[0].cita).toBe('el aguacate')
  })
  it('agrega lo nuevo que dijo además de la copia', () => {
    const r = resolverComida(
      ref({ comida_cita: 'almorcé', items: [{ alimento: 'huevos', cantidad: 'dos', medida: null, estado: null, senales: [] }] }),
      ctx({ comidasAyer: ayer }),
    )
    expect(r.registro?.items).toHaveLength(4)
  })
  it('si ayer no hay registro de esa comida, NO se inventa: se pregunta, diciendo por qué', () => {
    const r = resolverComida(ref({ comida_cita: 'desayuné' }), ctx({ comidasAyer: ayer }, '2026-10-01T07:20:00-05:00'))
    expect(r.registro).toBeNull()
    expect(r.seguimiento?.texto).toMatch(/No tengo anotado tu desayuno de ayer/)
  })
  it('sin nada de ayer en el contexto, tampoco', () => {
    expect(resolverComida(ref({ comida_cita: 'almorcé' }), ctx()).registro).toBeNull()
  })
  it('de punta a punta: tarjeta cuando existe el registro; pregunta cuando no', () => {
    const e = extraccion({ intencion: ['comida'], comida: ref({ comida_cita: 'almorcé' }) })
    expect(resolverPropuesta('almorcé lo mismo', e, ctx({ comidasAyer: ayer })).accion).toBe('tarjeta')
    expect(resolverPropuesta('almorcé lo mismo', e, ctx()).accion).toBe('preguntar')
  })
  it('el contexto que manda la app se sanea', () => {
    expect(sanearComidasAyer([{ comida: 'brunch', items: [{ alimento: 'x' }] }, { comida: 'cena', items: [{ alimento: '  ' }, { alimento: 'sopa', gramos: -3 }] }]))
      .toEqual([{ comida: 'cena', items: [{ alimento: 'sopa', gramos: null, medida_nombre: null, medida_cantidad: null, fuente_medida: null, estado: null }] }])
    expect(sanearComidasAyer('basura')).toEqual([])
    expect(armarContexto({ ahora: '2026-10-01T10:00:00-05:00', activo: null, comidasAyer: ayer, comidaPendiente: 7 }).comidaPendiente).toEqual([])
  })
})

describe('una precisión de la tarjeta pendiente no es una pregunta nueva', () => {
  const pendiente = [{ alimento: 'arepa delgada', gramos: 56 }]
  const dos = comida({ items: [{ alimento: 'arepas', cantidad: 'dos', medida: null, estado: null, senales: [] }] })

  it('«dos arepas» con una arepa delgada pendiente son dos delgadas (112 g), sin preguntar', () => {
    const r = resolverComida(dos, ctx({ comidaPendiente: pendiente }))
    expect(r.seguimiento).toBeUndefined()
    expect(r.registro?.items[0]).toMatchObject({ alimento: 'arepa delgada', gramos: 112 })
    expect(r.registro?.items[0].nota).toMatch(/ya tenías anotado/)
  })
  it('sin tarjeta pendiente, «dos arepas» sigue preguntando cuál', () => {
    expect(resolverComida(dos, ctx()).seguimiento?.campo_bloqueante).toBe('alimento')
  })
  it('con dos variantes en la tarjeta no se adivina', () => {
    const dosVariantes = [{ alimento: 'arepa delgada', gramos: 56 }, { alimento: 'arepa grande', gramos: 52 }]
    expect(desambiguarConContexto('arepas', ctx({ comidaPendiente: dosVariantes }))).toBeNull()
    expect(resolverComida(dos, ctx({ comidaPendiente: dosVariantes })).seguimiento).toBeDefined()
  })
  it('lo pendiente pesa más que lo de ayer', () => {
    const c = ctx({ comidaPendiente: pendiente, comidasAyer: [{ comida: 'cena', items: [{ alimento: 'arepa grande', gramos: 52 }] }] })
    expect(desambiguarConContexto('arepa', c)).toBe('arepa delgada')
  })
  it('otro alimento no se contagia', () => {
    expect(desambiguarConContexto('pan', ctx({ comidaPendiente: pendiente }))).toBeNull()
  })
})

describe('un ordinal es UNA serie', () => {
  const bloque = (ordinal: string, reserva: string): BloqueExtraido => ({
    n_series: 'las tres', ordinal, reps: '10',
    carga: { tipo: 'absoluta', valor: '60', unidad_cita: null, discos: null, delta: null, por: 'no_dicho' },
    reserva: { tipo: 'reserva_dicha', cita: reserva }, es_calentamiento: false, extra: [], senales: [],
  })
  const contexto: ContextoRegistro = ctx({
    microciclo: { id: 'M1' }, sesionHoyId: 'S1',
    sesiones: [{ id: 'S1', nombre: 'PIERNA', ejercicios: [{ id: 'a1', nombre: 'SENTADILLA TRASERA', sesionId: 'S1', sets: 4, unidad: 'kg', series: [] }] }],
  })
  it('tres bloques con ordinal y «las tres» repetido siguen siendo tres series, no nueve', () => {
    const p = resolverPropuesta(
      'sentadilla 60 por 10 las tres, la primera me quedaron 3, la segunda 2 y la tercera 1',
      extraccion({ intencion: ['entreno'], entreno: [{
        ejercicio: { cita: 'sentadilla', ref_sugerida: null, implicito: 'no' },
        bloques: [bloque('la primera', 'me quedaron 3'), bloque('la segunda', '2'), bloque('la tercera', '1')],
        cuando: null,
      }] }),
      contexto,
    )
    expect(p.accion).toBe('tarjeta')
    const s = (p.registros[0] as RegistroSeries).valor
    expect(s.map((x) => [x.orden, x.cargaKg, x.reps, x.rir])).toEqual([[1, 60, 10, 3], [2, 60, 10, 2], [3, 60, 10, 1]])
  })
})

describe('el contexto del corpus para nutrición y vida', () => {
  it('itemDeComida entiende las tres formas en prosa', () => {
    expect(itemDeComida('150 g arroz')).toEqual({ alimento: 'arroz', gramos: 150 })
    expect(itemDeComida('2 huevos (100 g)')).toEqual({ alimento: 'huevos', gramos: 100 })
    expect(itemDeComida('1 arepa delgada 56 g')).toEqual({ alimento: 'arepa delgada', gramos: 56 })
  })
  it('lee lo de ayer, la tarjeta pendiente y verComposicion', () => {
    const a = contextoDeCorpus('Ayer almuerzo registrado: 150 g arroz, 200 g pechuga, 1/4 platano maduro (66 g). Hoy 13:10.')
    expect(a.comidasAyer?.[0].comida).toBe('almuerzo')
    expect(a.comidasAyer?.[0].items).toHaveLength(3)
    expect(a.ahora).toMatch(/T13:10/)
    const b = contextoDeCorpus('Tarjeta pendiente sin confirmar: 1 arepa delgada 56 g.')
    expect(b.comidaPendiente).toEqual([{ alimento: 'arepa delgada', gramos: 56 }])
    expect(contextoDeCorpus('Lun 28-sep, 6:50 am. verComposicion=true. Ultimo peso: 78.9.').perfil.verComposicion).toBe(true)
  })
})

describe('el esquema trae los campos nuevos y el validador cita', () => {
  it('valida vida.peso_corporal, dia_de_entreno, tiempos y sin_dolor contra la frase', () => {
    const frase = 'hoy no fui al gym porque llovía, me pesé y salí en 71 y medio, y una siesta de una hora'
    const { extraccion: e, citasInvalidas } = validarExtraccion(frase, {
      vida: {
        peso_corporal: '71 y medio',
        dia_de_entreno: { estado: 'no_entreno', motivo: 'llovía', hizo: null },
        tiempos: [{ actividad: 'siesta', duracion: 'una hora' }, { actividad: 'gimnasio', duracion: 'una hora' }],
        sin_dolor: 'sin dolor',
      },
      comida: { referencia: 'igual_que_ayer', sin: ['el huevo'], items: [] },
    })
    expect(e.vida?.peso_corporal).toBe('71 y medio')
    expect(e.vida?.dia_de_entreno).toEqual({ estado: 'no_entreno', motivo: 'llovía', hizo: null })
    expect(e.vida?.tiempos).toEqual([{ actividad: 'siesta', duracion: 'una hora' }])
    expect(e.vida?.sin_dolor).toBeNull()
    expect(e.comida?.referencia).toBe('igual_que_ayer')
    expect(citasInvalidas.join('|')).toMatch(/sin_dolor/)
    expect(citasInvalidas.join('|')).toMatch(/comida\.sin\[0\]/)
  })
})

describe('los 14 casos N/V/D que fallaron, con la extracción que el prompt nuevo pide', () => {
  const corpus: Caso[] = JSON.parse(readFileSync(new URL('../../../../scripts/praxis-eval/corpus.json', import.meta.url), 'utf8'))
  const ids = Object.keys(EXTRACCIONES_GRABADAS_RELAJADAS)

  it.each(ids)('%s: citas literales, acción esperada y cero números inventados', (id) => {
    const c = corpus.find((x) => x.id === id)!
    const contexto = contextoDeCorpus(c.contexto)
    const { extraccion: e, citasInvalidas } = validarExtraccion(c.frase, EXTRACCIONES_GRABADAS_RELAJADAS[id])
    expect(citasInvalidas).toEqual([])
    const p = resolverPropuesta(c.frase, e, contexto, citasInvalidas)
    const r = puntuarRelajado(c, p, false)
    expect(r.campos.filter((x) => !x.ok), `${id} «${c.frase}» -> ${JSON.stringify(p)}`).toEqual([])
    expect(numerosInventados(c.frase, contexto, p)).toEqual([])
  })

  it('N59: la copia sale con los tres ítems de ayer; N60 sin el huevo; N76 dos delgadas', () => {
    const corre = (id: string) => {
      const c = corpus.find((x) => x.id === id)!
      const { extraccion: e } = validarExtraccion(c.frase, EXTRACCIONES_GRABADAS_RELAJADAS[id])
      return resolverPropuesta(c.frase, e, contextoDeCorpus(c.contexto))
    }
    const items = (id: string) => (corre(id).registros[0] as { items: { alimento: string; gramos: number | null }[] }).items
    expect(items('N59').map((i) => i.gramos)).toEqual([150, 200, 66])
    expect(items('N60').map((i) => i.alimento)).toEqual(['arepa delgada', 'tinto con 23 g azucar'])
    expect(items('N76')[0]).toMatchObject({ alimento: 'arepa delgada', gramos: 112 })
  })
})

import { describe, expect, it } from 'vitest'
import {
  FORMULAS_PROHIBIDAS, RANURAS_EN_CHARLA, analizarCharla, analizarHistorial, armarResumen, bloqueRanurasParaPrompt,
  debeAvisarAlCoach, queFaltaQueCambia, siguientePregunta, validarEtiquetas, type TurnoDeCharla,
} from './ranuras.ts'
import { CATALOGO } from './ranurasCatalogo.ts'
import { armarContextoCharla } from './modelo.ts'

// Todas las frases de aquí son INVENTADAS (CLAUDE.md §4): ninguna es de una persona real.
const persona = (texto: string): TurnoDeCharla => ({ rol: 'persona', texto })
const praxis = (texto: string, extra: Partial<TurnoDeCharla> = {}): TurnoDeCharla => ({ rol: 'praxis', texto, ...extra })
const valor = (h: TurnoDeCharla[], id: string) => analizarHistorial(h).llenas.find((l) => l.id === id)

describe('ranuras: una frase llena varias con su cita', () => {
  const h = [persona('Salgo tarde de la oficina y llego a entrenar casi a las 8, quiero que me quede bien la ropa para diciembre, entreno cuatro días a la semana')]
  const e = analizarHistorial(h)

  it('llena varias ranuras a la vez, cada una con valor, cita y turno', () => {
    const ids = e.llenas.map((l) => l.id)
    expect(ids).toEqual(expect.arrayContaining(['objetivo', 'trabajo', 'horario_entreno', 'dias_semana']))
    expect(valor(h, 'objetivo')).toMatchObject({ valor: 'estetica', cita: 'me quede bien la ropa', turno: 1 })
    expect(valor(h, 'trabajo')).toMatchObject({ valor: 'oficina', cita: 'oficina', turno: 1 })
    expect(valor(h, 'horario_entreno')).toMatchObject({ valor: 'noche' })
    expect(valor(h, 'dias_semana')).toMatchObject({ valor: 4, cita: 'cuatro días a la semana' })
  })

  it('toda cita es un fragmento literal de lo que se dijo', () => {
    for (const l of e.llenas) expect(h[0].texto).toContain(l.cita)
  })

  it('«llevo años» llena el tiempo entrenando pero NO el nivel', () => {
    const e2 = analizarHistorial([persona('Llevo años con las mismas rutinas, ya me aburren')])
    expect(e2.llenas.map((l) => l.id)).toEqual(['tiempo_entrenando'])
    expect(e2.vacias).toContain('nivel')
  })

  it('el sueño y el estrés salen de frases sueltas', () => {
    const e3 = analizarHistorial([persona('Anoche me quedé viendo una serie hasta la 1. Esta semana tengo cierre de mes, no doy abasto')])
    expect(e3.llenas.find((l) => l.id === 'hora_acostarse')).toMatchObject({ valor: '01:00' })
    expect(e3.llenas.find((l) => l.id === 'estres')).toMatchObject({ valor: 'alto', cita: 'no doy abasto' })
  })

  it('«a las 8» sin más contexto no se adivina', () => {
    expect(analizarHistorial([persona('Entreno a las 8')]).llenas.find((l) => l.id === 'horario_entreno')).toBeUndefined()
  })

  it('el catálogo tiene al menos 3 preguntas abiertas por ranura y ninguna con fórmula prohibida', () => {
    for (const d of CATALOGO) {
      expect(d.preguntas.length).toBeGreaterThanOrEqual(3)
      for (const p of d.preguntas) for (const f of FORMULAS_PROHIBIDAS) expect(p).not.toMatch(f)
    }
  })
})

describe('ranuras: lo ya dicho no se vuelve a preguntar', () => {
  it('con el objetivo y los días dichos, el plan pregunta por el tiempo, no por ellos', () => {
    const e = analizarHistorial([persona('Quiero verme mejor y puedo ir tres días a la semana')])
    const falta = queFaltaQueCambia('plan_entrenamiento', e).map((f) => f.ranura)
    expect(falta).not.toContain('objetivo')
    expect(falta).not.toContain('dias_semana')
    expect(falta[0]).toBe('tiempo_disponible')
  })

  it('nunca se pregunta una ranura llena, sea cual sea el tema', () => {
    const e = analizarHistorial([persona('Duermo seis horas, estoy muy estresado, yo cocino casi todo y entreno en ayunas por la mañana, quiero competir')])
    for (const tema of ['plan_entrenamiento', 'progresion_carga', 'nutricion', 'recuperacion', 'horarios', 'motivacion'] as const) {
      const llenas = new Set(e.llenas.map((l) => l.id))
      for (const f of queFaltaQueCambia(tema, e)) expect(llenas.has(f.ranura)).toBe(false)
      const p = siguientePregunta(tema, e)
      if (p) expect(llenas.has(p.ranura)).toBe(false)
    }
  })

  it('no repite la misma pregunta que Praxis ya hizo con esas palabras', () => {
    const e = analizarHistorial([persona('Hola, quiero ponerme en forma')])
    const primera = siguientePregunta('plan_entrenamiento', e)
    expect(primera).not.toBeNull()
    const ya = [persona('Hola'), praxis(primera!.pregunta)]
    const segunda = siguientePregunta('plan_entrenamiento', analizarHistorial(ya), { historial: ya })
    expect(segunda?.pregunta).not.toBe(primera!.pregunta)
  })
})

describe('ranuras: solo se pregunta lo que cambia la respuesta', () => {
  it('con objetivo de salud, el nivel no cambia el plan: no se pregunta', () => {
    const e = analizarHistorial([persona('Lo mío es por salud, tengo media hora para entrenar al día, cuatro días a la semana')])
    expect(queFaltaQueCambia('plan_entrenamiento', e)).toEqual([])
    expect(siguientePregunta('plan_entrenamiento', e)).toBeNull()
  })

  it('con objetivo de rendimiento, el nivel sí cambia la respuesta', () => {
    const e = analizarHistorial([persona('Quiero competir en un torneo, cuatro días a la semana, tengo una hora para entrenar al día')])
    expect(queFaltaQueCambia('plan_entrenamiento', e).map((f) => f.ranura)).toContain('nivel')
  })

  it('la hora de acostarse sobra si ya se sabe cuántas horas duerme', () => {
    const e = analizarHistorial([persona('Duermo como seis horas')])
    expect(queFaltaQueCambia('recuperacion', e).map((f) => f.ranura)).not.toContain('hora_acostarse')
  })

  it('no pregunta con apuro, con ánimo bajo ni si ya preguntó una ranura en los 2 turnos anteriores', () => {
    const e = analizarHistorial([persona('Hola')])
    expect(siguientePregunta('plan_entrenamiento', e, { apuro: true })).toBeNull()
    expect(siguientePregunta('plan_entrenamiento', e, { emocionBaja: true })).toBeNull()
    const h = [persona('Hola'), praxis('¿Qué buscas?', { preguntaDeRanura: true }), persona('No sé')]
    expect(siguientePregunta('plan_entrenamiento', analizarHistorial(h), { historial: h })).toBeNull()
  })

  it('una sola pregunta por turno', () => {
    const p = siguientePregunta('plan_entrenamiento', analizarHistorial([persona('Hola')]))
    expect(p).not.toBeNull()
    expect((p!.pregunta.match(/\?/g) ?? []).length).toBe(1)
  })
})

describe('ranuras: la pregunta no suena a cuestionario', () => {
  it('se enlaza a lo último que dijo la persona', () => {
    const h = [persona('Trabajo en una oficina y a veces se me complica el tiempo')]
    const p = siguientePregunta('plan_entrenamiento', analizarHistorial(h), { historial: h })
    expect(p?.pregunta).toContain('oficina')
  })

  it('si la persona se fue por otro lado, el puente es suave y sin fórmulas prohibidas', () => {
    const textos: string[] = []
    for (let n = 0; n < 8; n++) {
      const h: TurnoDeCharla[] = [persona('Ayer vi un partido buenísimo')]
      for (let i = 0; i < n; i++) h.push(praxis(`respuesta ${i}`), persona('jaja sí, fue increíble'))
      const p = siguientePregunta('plan_entrenamiento', analizarHistorial(h), { historial: h })
      if (p) textos.push(p.pregunta)
    }
    expect(textos.length).toBeGreaterThan(0)
    for (const t of textos) for (const f of FORMULAS_PROHIBIDAS) expect(t).not.toMatch(f)
  })

  it('la misma ranura se pregunta de formas distintas según el momento de la charla', () => {
    const formas = new Set<string>()
    for (let n = 0; n < 4; n++) {
      const h: TurnoDeCharla[] = []
      for (let i = 0; i < n; i++) h.push(praxis(`comentario ${i}`))
      const p = siguientePregunta('motivacion', analizarHistorial([persona('hola')]), { historial: h })
      if (p) formas.add(p.pregunta)
    }
    expect(formas.size).toBeGreaterThanOrEqual(3)
  })
})

describe('ranuras: lo clínico va aparte y no llena nada', () => {
  it('«me duele la rodilla» va al coach y la oración no llena ranuras', () => {
    const e = analizarHistorial([persona('Me duele la rodilla cuando entreno en la mañana')])
    expect(e.alCoach.map((a) => a.tema)).toContain('dolor')
    expect(e.llenas).toEqual([])
    expect(e.dudosas).toEqual([])
  })

  it('la oración limpia de la misma frase sí llena, la clínica no', () => {
    const e = analizarHistorial([persona('Tomo un medicamento para la presión. Entreno cuatro días a la semana')])
    expect(e.alCoach.length).toBeGreaterThan(0)
    expect(e.llenas.map((l) => l.id)).toEqual(['dias_semana'])
  })

  it('20 señales clínicas sembradas: 20 marcadas y 0 llenadas', () => {
    const frases = [
      'Me duele la espalda', 'Tengo una lesión en el hombro', 'Estoy embarazada', 'Me operaron del menisco', 'Tengo diabetes',
      'Tomo losartan todos los días', 'Tengo asma', 'Me dio un infarto hace años', 'Soy alérgico al gluten', 'Tengo escoliosis',
      'Me pincha la rodilla', 'Tengo una hernia de disco', 'Me mareo cuando entreno', 'Tengo artrosis', 'Padezco hipertensión',
      'Me baja la regla muy fuerte', 'Tengo tendinopatía', 'Me duele el codo', 'Tengo cáncer', 'Tuve un atracón anoche',
    ]
    let marcadas = 0
    for (const f of frases) {
      const e = analizarHistorial([persona(`${f} cuando entreno cuatro días a la semana por la mañana`)])
      if (e.alCoach.length > 0) marcadas++
      expect(e.llenas).toEqual([])
    }
    expect(marcadas).toBe(20)
  })

  it('el aviso al coach se da UNA sola vez por charla', () => {
    const h: TurnoDeCharla[] = [persona('Tengo escoliosis')]
    expect(debeAvisarAlCoach(analizarHistorial(h), h)).toBe(true)
    h.push(praxis('Eso lo ve tu coach.', { aviso: 'coach' }), persona('Y también me duele la cadera'), praxis('Seguimos.'), persona('Otra vez la escoliosis'))
    const e = analizarHistorial(h)
    expect(e.alCoach.length).toBeGreaterThan(0)
    expect(debeAvisarAlCoach(e, h)).toBe(false)
  })

  it('sin nada clínico no hay aviso', () => {
    const h = [persona('Entreno tres días a la semana')]
    expect(debeAvisarAlCoach(analizarHistorial(h), h)).toBe(false)
  })

  it('la cita clínica solo trae la palabra que la disparó, no la frase', () => {
    const e = analizarHistorial([persona('Mi casa queda lejos y me duele la rodilla izquierda cuando bajo escaleras')])
    expect(e.alCoach[0].cita.length).toBeLessThan(25)
  })
})

describe('ranuras: correcciones y dudas', () => {
  it('una corrección explícita deja la ranura dudosa y se pregunta para confirmar', () => {
    const h = [persona('Entreno tres días a la semana'), praxis('Anotado'), persona('No, son cuatro días a la semana')]
    const e = analizarHistorial(h)
    expect(e.llenas.find((l) => l.id === 'dias_semana')).toBeUndefined()
    expect(e.dudosas[0]).toMatchObject({ id: 'dias_semana', motivo: 'correccion' })
    expect(e.dudosas[0].candidatos.map((c) => c.valor)).toEqual([3, 4])
    const p = siguientePregunta('horarios', e, { historial: h })
    expect(p).toMatchObject({ ranura: 'dias_semana', confirmar: true })
  })

  it('«ya no entreno en la mañana» retira el dato en vez de llenar «mañana»', () => {
    const e = analizarHistorial([persona('Entreno en la mañana'), persona('Ya no entreno en la mañana')])
    expect(e.llenas.find((l) => l.id === 'horario_entreno')).toBeUndefined()
    expect(e.dudosas[0]).toMatchObject({ id: 'horario_entreno', motivo: 'retirada' })
  })

  it('repetir lo mismo no genera duda', () => {
    const e = analizarHistorial([persona('Entreno cuatro días a la semana'), persona('Sí, cuatro días a la semana')])
    expect(e.dudosas).toEqual([])
    expect(e.llenas.find((l) => l.id === 'dias_semana')?.turno).toBe(1)
  })
})

describe('ranuras: valores inventados por un modelo se descartan (5 de 5)', () => {
  const h = [persona('Trabajo en una oficina y entreno cuatro días a la semana')]
  it('sin cita, con cita ajena, ranura rara, valor fuera de opciones, o cita clínica', () => {
    const r = validarEtiquetas([...h, persona('Me duele la rodilla')], [
      { ranura: 'objetivo', valor: 'salud', cita: '' },
      { ranura: 'objetivo', valor: 'salud', cita: 'quiero estar sano' },
      { ranura: 'color_favorito', valor: 'azul', cita: 'oficina' },
      { ranura: 'trabajo', valor: 'astronauta', cita: 'oficina' },
      { ranura: 'dias_semana', valor: 2, cita: 'me duele la rodilla' },
    ])
    expect(r.aceptadas).toEqual([])
    expect(r.descartadas.map((d) => d.motivo)).toEqual(['sin_cita', 'cita_invalida', 'ranura_desconocida', 'valor_invalido', 'cita_clinica'])
  })

  it('una etiqueta válida con cita literal sí entra', () => {
    const e = analizarHistorial(h, [{ ranura: 'nivel', valor: 'intermedio', cita: 'oficina' }])
    expect(e.llenas.find((l) => l.id === 'nivel')).toMatchObject({ valor: 'intermedio', cita: 'oficina' })
  })
})

describe('ranuras: el resumen del final', () => {
  const h = [
    persona('Salgo tarde de la oficina, entreno de madrugada porque no hay otra hora, cuatro días a la semana'),
    persona('Quiero que me quede bien la ropa. Me duele la rodilla'),
  ]
  const e = analizarHistorial(h)

  it('lista todo lo entendido con su cita, en espejo', () => {
    const r = armarResumen(e, 'tu')
    for (const l of e.llenas) expect(r.texto).toContain(`«${l.cita}»`)
    expect(r.lineas.length).toBe(e.llenas.length)
    expect(r.texto).toContain('Entendí que entrenas de madrugada')
    expect(r.texto).toContain('corrígelo')
  })

  it('lo clínico va aparte, al coach, y no aparece entre lo entendido', () => {
    const r = armarResumen(e, 'tu')
    expect(r.alCoach.length).toBeGreaterThan(0)
    expect(r.lineas.some((l) => /rodilla|dolor/i.test(l.cita))).toBe(false)
    expect(r.texto).toMatch(/lo ve tu coach/)
  })

  it('lo dudoso sale «por confirmar»; la voz del equipo va en tercera persona', () => {
    const d = analizarHistorial([persona('Entreno tres días a la semana'), persona('No, son cuatro días a la semana')])
    expect(armarResumen(d).lineas[0].estado).toBe('por_confirmar')
    const eq = armarResumen(e, 'equipo').texto
    expect(eq).toMatch(/Días por semana: 4 días/)
    expect(eq).not.toMatch(/Entendí que/)
  })

  it('sin nada que resumir, el resumen está vacío', () => {
    expect(armarResumen(analizarHistorial([persona('Hola, buenas')])).vacio).toBe(true)
  })
})

describe('ranuras: aislamiento entre personas', () => {
  it('nada de una persona aparece en el resultado de otra, ni alternando las llamadas', () => {
    const a = [persona('Soy profesora, entreno ocho horas de lunes a viernes de pie todo el día y tengo diabetes. Quiero competir en un maratón')]
    const b = [persona('Trabajo en una oficina y duermo seis horas')]
    const rb1 = JSON.stringify([analizarHistorial(b), armarResumen(analizarHistorial(b)), siguientePregunta('nutricion', analizarHistorial(b))])
    const ra = JSON.stringify([analizarHistorial(a), armarResumen(analizarHistorial(a)), siguientePregunta('nutricion', analizarHistorial(a))])
    const rb2 = JSON.stringify([analizarHistorial(b), armarResumen(analizarHistorial(b)), siguientePregunta('nutricion', analizarHistorial(b))])
    expect(rb2).toBe(rb1)
    for (const marca of ['profesora', 'maratón', 'diabet', 'de pie todo el día', 'competir']) {
      expect(rb1).not.toContain(marca)
      expect(rb2).not.toContain(marca)
    }
    expect(ra).not.toContain('oficina')
  })
})

describe('ranuras: bandera apagada, todo idéntico', () => {
  const contexto = { trato: 'tu' as const, nombre: 'Vale', turnos: [{ rol: 'persona' as const, texto: 'Entreno cuatro días a la semana' }], apertura: null }

  it('la bandera está apagada', () => {
    expect(RANURAS_EN_CHARLA).toBe(false)
  })

  it('apagada: analizarCharla devuelve null y el bloque del prompt está vacío', () => {
    expect(analizarCharla(contexto.turnos)).toBeNull()
    expect(bloqueRanurasParaPrompt(contexto.turnos)).toBe('')
  })

  it('apagada: armarContextoCharla no menciona las ranuras', () => {
    expect(armarContextoCharla(contexto, '2026-11-06T09:00:00-05:00')).not.toMatch(/YA DICHO|ranura/i)
  })

  it('encendida a la fuerza (solo en la prueba) el bloque lista lo dicho sin citas', () => {
    const b = bloqueRanurasParaPrompt(contexto.turnos, true)
    expect(b).toContain('Días por semana: 4 días')
    expect(b).not.toContain('«')
  })
})

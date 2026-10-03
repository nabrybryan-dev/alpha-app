import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoQuePraxisVe } from '../../../domain/praxis/plan/listaBlanca'
import { filtroDeRiesgo } from '../../../domain/praxis/riesgo'
import { aperturaInmediata, aperturasPosibles, colasPosibles, decidirTurnoConCharla, fijarAzarDeCharla, momentoDelDia, normalizarCharla, pareceCharla, reiniciarVariantes, responderCharla, textosPosibles, type ContextoDeCharla, type IntencionDeCharla } from './charla'

const ve: LoQuePraxisVe = { activo: null, cerrados: [], perfil: null, checkins: [], adherencias: [], hidratacionHoyMl: 0, comida: null, falta: ['plan_activo'] }
const HOY = '2026-10-01'
const base: ContextoDeCharla = { trato: 'tu', hora: 9, esperaAnimo: false, yaHablo: false }
const ctx = (extra: Partial<ContextoDeCharla> = {}): ContextoDeCharla => ({ ...base, ...extra })
const dice = (frase: string, extra: Partial<ContextoDeCharla> = {}) => responderCharla(frase, ctx(extra))

/** [frase, intención, texto en tú, texto en usted], con la hora 9 (mañana). */
const CASOS: [string, IntencionDeCharla, string, string][] = [
  ['hola', 'saludo', 'Buenos días. ¿Cómo amaneciste?', 'Buenos días. ¿Cómo amaneció?'],
  ['Holi', 'saludo', 'Buenos días. ¿Cómo amaneciste?', 'Buenos días. ¿Cómo amaneció?'],
  ['¡Buenas!', 'saludo', 'Buenos días. ¿Cómo amaneciste?', 'Buenos días. ¿Cómo amaneció?'],
  ['buenos días', 'saludo', 'Buenos días. ¿Cómo amaneciste?', 'Buenos días. ¿Cómo amaneció?'],
  ['buenas tardes', 'saludo', 'Buenos días. ¿Cómo amaneciste?', 'Buenos días. ¿Cómo amaneció?'],
  ['qué más', 'saludo', 'Buenos días. ¿Cómo amaneciste?', 'Buenos días. ¿Cómo amaneció?'],
  ['quiubo', 'saludo', 'Buenos días. ¿Cómo amaneciste?', 'Buenos días. ¿Cómo amaneció?'],
  ['qué hubo', 'saludo', 'Buenos días. ¿Cómo amaneciste?', 'Buenos días. ¿Cómo amaneció?'],
  ['hey', 'saludo', 'Buenos días. ¿Cómo amaneciste?', 'Buenos días. ¿Cómo amaneció?'],
  ['hola Praxis', 'saludo', 'Buenos días. ¿Cómo amaneciste?', 'Buenos días. ¿Cómo amaneció?'],
  ['eh, hola, buenos días', 'saludo', 'Buenos días. ¿Cómo amaneciste?', 'Buenos días. ¿Cómo amaneció?'], // la pausa de dictado no estorba
  ['¿Cómo estás?', 'estado', 'Bien, gracias por preguntar. ¿Y tú, cómo vas?', 'Bien, gracias por preguntar. ¿Y usted cómo va?'],
  ['cómo vas', 'estado', 'Bien, gracias por preguntar. ¿Y tú, cómo vas?', 'Bien, gracias por preguntar. ¿Y usted cómo va?'],
  ['qué tal', 'estado', 'Bien, gracias por preguntar. ¿Y tú, cómo vas?', 'Bien, gracias por preguntar. ¿Y usted cómo va?'],
  ['cómo te va', 'estado', 'Bien, gracias por preguntar. ¿Y tú, cómo vas?', 'Bien, gracias por preguntar. ¿Y usted cómo va?'],
  ['todo bien', 'estado', 'Bien, gracias por preguntar. ¿Y tú, cómo vas?', 'Bien, gracias por preguntar. ¿Y usted cómo va?'],
  ['y tú qué', 'estado', 'Bien, gracias por preguntar. ¿Y tú, cómo vas?', 'Bien, gracias por preguntar. ¿Y usted cómo va?'],
  ['hola, cómo estás', 'estado', 'Bien, gracias por preguntar. ¿Y tú, cómo vas?', 'Bien, gracias por preguntar. ¿Y usted cómo va?'],
  ['gracias', 'gracias', 'Con mucho gusto.', 'Con mucho gusto.'],
  ['muchas gracias', 'gracias', 'Con mucho gusto.', 'Con mucho gusto.'],
  ['mil gracias', 'gracias', 'Con mucho gusto.', 'Con mucho gusto.'],
  ['quién eres', 'quien',
    'Soy Praxis, la guía de hábitos de Alpha. Anoto lo que entrenas, cómo duermes, lo que comes y cómo te sientes, y te respondo sobre tu plan.',
    'Soy Praxis, la guía de hábitos de Alpha. Anoto lo que entrena, cómo duerme, lo que come y cómo se siente, y le respondo sobre su plan.'],
  ['qué eres', 'quien', 'Soy Praxis, la guía de hábitos de Alpha. Anoto lo que entrenas, cómo duermes, lo que comes y cómo te sientes, y te respondo sobre tu plan.', 'Soy Praxis, la guía de hábitos de Alpha. Anoto lo que entrena, cómo duerme, lo que come y cómo se siente, y le respondo sobre su plan.'],
  ['cómo te llamas', 'quien', 'Soy Praxis, la guía de hábitos de Alpha. Anoto lo que entrenas, cómo duermes, lo que comes y cómo te sientes, y te respondo sobre tu plan.', 'Soy Praxis, la guía de hábitos de Alpha. Anoto lo que entrena, cómo duerme, lo que come y cómo se siente, y le respondo sobre su plan.'],
  ['quién es Praxis', 'quien', 'Soy Praxis, la guía de hábitos de Alpha. Anoto lo que entrenas, cómo duermes, lo que comes y cómo te sientes, y te respondo sobre tu plan.', 'Soy Praxis, la guía de hábitos de Alpha. Anoto lo que entrena, cómo duerme, lo que come y cómo se siente, y le respondo sobre su plan.'],
  ['¿eres real?', 'real', 'Soy una inteligencia artificial de Alpha. Tu coach sí es una persona, y ve lo que anotamos.', 'Soy una inteligencia artificial de Alpha. Su coach sí es una persona, y ve lo que anotamos.'],
  ['eres humana', 'real', 'Soy una inteligencia artificial de Alpha. Tu coach sí es una persona, y ve lo que anotamos.', 'Soy una inteligencia artificial de Alpha. Su coach sí es una persona, y ve lo que anotamos.'],
  ['eres un robot', 'real', 'Soy una inteligencia artificial de Alpha. Tu coach sí es una persona, y ve lo que anotamos.', 'Soy una inteligencia artificial de Alpha. Su coach sí es una persona, y ve lo que anotamos.'],
  ['eres una persona', 'real', 'Soy una inteligencia artificial de Alpha. Tu coach sí es una persona, y ve lo que anotamos.', 'Soy una inteligencia artificial de Alpha. Su coach sí es una persona, y ve lo que anotamos.'],
  ['eres una IA', 'real', 'Soy una inteligencia artificial de Alpha. Tu coach sí es una persona, y ve lo que anotamos.', 'Soy una inteligencia artificial de Alpha. Su coach sí es una persona, y ve lo que anotamos.'],
  ['qué puedes hacer', 'ayuda',
    'Cuéntame lo que hiciste, como «hice 4 series de sentadilla con 60», «dormí 6 horas» o «me tomé dos litros de agua». También puedes preguntarme por tu plan de hoy.',
    'Cuénteme lo que hizo, como «hice 4 series de sentadilla con 60», «dormí 6 horas» o «me tomé dos litros de agua». También puede preguntarme por su plan de hoy.'],
  ['cómo funciona', 'ayuda', 'Cuéntame lo que hiciste, como «hice 4 series de sentadilla con 60», «dormí 6 horas» o «me tomé dos litros de agua». También puedes preguntarme por tu plan de hoy.', 'Cuénteme lo que hizo, como «hice 4 series de sentadilla con 60», «dormí 6 horas» o «me tomé dos litros de agua». También puede preguntarme por su plan de hoy.'],
  ['chao', 'despedida', 'Hasta luego. Aquí estoy cuando quieras.', 'Hasta luego. Aquí estoy cuando quiera.'],
  ['adiós', 'despedida', 'Hasta luego. Aquí estoy cuando quieras.', 'Hasta luego. Aquí estoy cuando quiera.'],
  ['hasta luego', 'despedida', 'Hasta luego. Aquí estoy cuando quieras.', 'Hasta luego. Aquí estoy cuando quiera.'],
  ['hasta mañana', 'despedida', 'Hasta luego. Aquí estoy cuando quieras.', 'Hasta luego. Aquí estoy cuando quiera.'],
  ['nos vemos', 'despedida', 'Hasta luego. Aquí estoy cuando quieras.', 'Hasta luego. Aquí estoy cuando quiera.'],
  ['perdón', 'disculpa', 'No pasa nada.', 'No pasa nada.'],
  ['disculpa', 'disculpa', 'No pasa nada.', 'No pasa nada.'],
  ['lo siento', 'disculpa', 'No pasa nada.', 'No pasa nada.'],
  ['sorry', 'disculpa', 'No pasa nada.', 'No pasa nada.'],
  ['te quiero', 'cariño', 'Gracias, qué amable. Estoy aquí para acompañarte con tus hábitos.', 'Gracias, qué amable. Estoy aquí para acompañarle con sus hábitos.'],
  ['te amo', 'cariño', 'Gracias, qué amable. Estoy aquí para acompañarte con tus hábitos.', 'Gracias, qué amable. Estoy aquí para acompañarle con sus hábitos.'],
  ['eres linda', 'cariño', 'Gracias, qué amable. Estoy aquí para acompañarte con tus hábitos.', 'Gracias, qué amable. Estoy aquí para acompañarle con sus hábitos.'],
  ['eres hermosa', 'cariño', 'Gracias, qué amable. Estoy aquí para acompañarte con tus hábitos.', 'Gracias, qué amable. Estoy aquí para acompañarle con sus hábitos.'],
  ['me gustas', 'cariño', 'Gracias, qué amable. Estoy aquí para acompañarte con tus hábitos.', 'Gracias, qué amable. Estoy aquí para acompañarle con sus hábitos.'],
  ['eres la mejor', 'cariño', 'Gracias, qué amable. Estoy aquí para acompañarte con tus hábitos.', 'Gracias, qué amable. Estoy aquí para acompañarle con sus hábitos.'],
]

describe('charla · cada intención, en tú y en usted', () => {
  it.each(CASOS)('«%s» → %s', (frase, intencion, tuTxt, ustedTxt) => {
    const t = dice(frase, { trato: 'tu' }), u = dice(frase, { trato: 'usted' })
    expect(t?.intencion).toBe(intencion)
    expect(textosPosibles(intencion, 'tu')).toContain(tuTxt) // la primera variante sigue siendo la de siempre
    expect(textosPosibles(intencion, 'tu')).toContain(t?.texto)
    expect(u?.intencion).toBe(intencion)
    expect(textosPosibles(intencion, 'usted')).toContain(ustedTxt)
    expect(textosPosibles(intencion, 'usted')).toContain(u?.texto)
  })

  it('las respuestas en usted no se pasan al tú ni al revés', () => {
    for (const [frase, , , ustedTxt] of CASOS) {
      const t = dice(frase, { trato: 'tu' })?.texto ?? ''
      const u = dice(frase, { trato: 'usted' })?.texto ?? ''
      expect(textosPosibles(dice(frase)!.intencion, 'usted')).toContain(u)
      expect(ustedTxt).toBeTruthy()
      if (t !== u) expect(u).not.toMatch(/\b(tu|tus|te|quieras|puedes|cuéntame|acompañarte|descanses)\b/i)
    }
  })
})

describe('charla · el saludo sigue la hora local', () => {
  it.each([5, 11, 12, 18, 19, 23, 0, 4])('a las %i h el saludo y su cola son del momento del día', (hora) => {
    const r = dice('hola', { hora })!
    expect(aperturasPosibles(hora)).toContain(r.apertura)
    expect(colasPosibles(hora, 'tu')).toContain(r.cola)
    expect(r.texto).toBe(`${r.apertura} ${r.cola}`)
  })
  it('las colas de la mañana preguntan por la mañana y las de la noche, por el día que pasó', () => {
    expect(colasPosibles(9, 'tu')).toContain('¿Cómo amaneciste?')
    expect(colasPosibles(15, 'tu')).toContain('¿Cómo va el día?')
    expect(colasPosibles(21, 'tu')).toContain('¿Cómo te fue hoy?')
    expect(colasPosibles(21, 'usted')).toContain('¿Cómo le fue hoy?')
  })
  it('el nombre aparece en algunas aperturas, no en todas', () => {
    const con = aperturasPosibles(9, 'Bryan')
    expect(con).toContain('Hola, Bryan.')
    expect(con).toContain('Muy buenos días.')
  })
  it('el saludo y el «¿Y tú, cómo vas?» dejan la pregunta de ánimo abierta; lo demás no', () => {
    expect(dice('hola')?.esperaAnimo).toBe(true)
    expect(dice('cómo estás')?.esperaAnimo).toBe(true)
    for (const f of ['gracias', 'perdón', 'quién eres', 'chao', 'te quiero', 'qué puedes hacer', 'eres un robot']) expect(dice(f)?.esperaAnimo).toBe(false)
    expect(dice('bien', { esperaAnimo: true })?.esperaAnimo).toBe(false)
    expect(dice('mal', { esperaAnimo: true })?.esperaAnimo).toBe(false)
  })
  it('los límites de las franjas', () => {
    expect([4, 5, 11, 12, 18, 19].map(momentoDelDia)).toEqual(['noche', 'manana', 'manana', 'tarde', 'tarde', 'noche'])
  })
})

describe('charla · la despedida', () => {
  it('«buenas noches» dicho al empezar es un saludo; tras haber hablado ya, una despedida', () => {
    expect(dice('buenas noches', { hora: 21, yaHablo: false })?.intencion).toBe('saludo')
    const d = dice('buenas noches', { hora: 21, yaHablo: true })!
    expect(d.intencion).toBe('despedida')
    expect(textosPosibles('despedida', 'tu', 21)).toContain(d.texto)
    expect(textosPosibles('despedida', 'usted', 21)).toContain(dice('buenas noches', { hora: 21, yaHablo: true, trato: 'usted' })!.texto)
  })
  it('de día la despedida es de día, de noche es de noche', () => {
    expect(textosPosibles('despedida', 'tu', 10)).toContain(dice('chao', { hora: 10 })!.texto)
    expect(textosPosibles('despedida', 'tu', 22)).toContain(dice('chao', { hora: 22 })!.texto)
    expect(textosPosibles('despedida', 'usted', 22)).toContain(dice('hasta mañana', { hora: 22, trato: 'usted' })!.texto)
    expect(textosPosibles('despedida', 'tu', 22)).not.toContain('Hasta luego. Aquí estoy cuando quieras.')
  })
  it('«buenas noches» tras haber hablado, aunque sea de tarde, se despide de noche', () => {
    expect(textosPosibles('despedida', 'tu', 22)).toContain(dice('buenas noches', { hora: 17, yaHablo: true })!.texto)
  })
})

describe('charla · la respuesta de ánimo solo vale si Praxis acababa de preguntar', () => {
  const positivas = ['bien', 'muy bien', 'súper', 'excelente', 'todo bien', 'bien y tú', 'de maravilla']
  const negativas = ['mal', 'regular', 'más o menos', 'cansado', 'cansada', 'no muy bien']
  it.each(positivas)('«%s» tras la pregunta es ánimo bueno', (f) => {
    expect(dice(f, { esperaAnimo: true })?.intencion).toBe('animoBueno')
    expect(textosPosibles('animoBueno', 'tu')).toContain(dice(f, { esperaAnimo: true })!.texto)
    expect(textosPosibles('animoBueno', 'usted')).toContain(dice(f, { esperaAnimo: true, trato: 'usted' })!.texto)
  })
  it.each(negativas)('«%s» tras la pregunta es ánimo malo', (f) => {
    expect(dice(f, { esperaAnimo: true })?.intencion).toBe('animoMalo')
    expect(textosPosibles('animoMalo', 'tu')).toContain(dice(f, { esperaAnimo: true })!.texto)
    expect(textosPosibles('animoMalo', 'usted')).toContain(dice(f, { esperaAnimo: true, trato: 'usted' })!.texto)
  })
  it('fuera de ese contexto, «bien» y «mal» sueltos NO son charla', () => {
    for (const f of [...positivas, ...negativas].filter((x) => x !== 'todo bien')) expect(dice(f, { esperaAnimo: false })).toBeNull()
  })
  it('«todo bien» sin pregunta previa es la pregunta «¿todo bien?», no una respuesta', () => {
    expect(dice('todo bien', { esperaAnimo: false })?.intencion).toBe('estado')
    expect(dice('todo bien', { esperaAnimo: true })?.intencion).toBe('animoBueno')
  })
  it('el saludo y el «¿Y tú, cómo vas?» dejan la pregunta de ánimo abierta; lo demás no', () => {
    expect(dice('hola')?.esperaAnimo).toBe(true)
    expect(dice('cómo estás')?.esperaAnimo).toBe(true)
    for (const f of ['gracias', 'perdón', 'quién eres', 'chao', 'te quiero', 'qué puedes hacer', 'eres un robot']) expect(dice(f)?.esperaAnimo).toBe(false)
    expect(dice('bien', { esperaAnimo: true })?.esperaAnimo).toBe(false)
    expect(dice('mal', { esperaAnimo: true })?.esperaAnimo).toBe(false)
  })
})

describe('charla · solo si la FRASE ENTERA lo es', () => {
  it.each([
    'hola, hice 4 series de sentadilla con 60',
    'hola dormí 6 horas',
    'gracias por anotar mi entreno',
    'buenas, me tomé dos litros de agua',
    'qué tal la sentadilla de hoy',
    'perdón, se me olvidó anotar el desayuno',
    'te quiero decir que dormí mal',
    'chao, mañana entreno pierna',
    'bien, hice pierna',
    'quién eres tú para decirme qué comer',
    'hola ' + 'palabra '.repeat(20),
    'hice 40 kilos',
    'praxis',
    '',
    '   ',
    'eh',
    '¿?',
  ])('«%s» NO es charla', (f) => {
    expect(dice(f, { esperaAnimo: true })).toBeNull()
    expect(dice(f, { esperaAnimo: false })).toBeNull()
  })

  it('«ayuda» suelta NO es charla: puede ser un pedido de auxilio y lo lee el modelo de riesgo', () => {
    expect(dice('ayuda')).toBeNull()
    expect(dice('necesito ayuda')).toBeNull()
    expect(dice('ayúdame')).toBeNull()
  })

  it('normaliza: mayúsculas, tildes, signos y pausas de dictado', () => {
    expect(normalizarCharla('  ¡¡HOLA!!, Eh... ¿Cómo ESTÁS?  ')).toBe('hola como estas')
    expect(normalizarCharla('Buenos días.')).toBe('buenos dias')
    expect(dice('¡¡HOLA!!, Eh... ¿Cómo ESTÁS?')?.intencion).toBe('estado')
  })
})

describe('charla · el filtro de riesgo va primero', () => {
  it('«hola, ya no quiero vivir» nunca es charla: va a la Quieta', () => {
    const t = decidirTurnoConCharla('hola, ya no quiero vivir', ve, HOY, ctx())
    expect(t.paso).toBe('quieta')
    expect(dice('hola, ya no quiero vivir')).toBeNull()
  })

  it('una frase que el filtro marca NO se trata como charla aunque la charla la reconociera', () => {
    const charla = vi.fn(() => ({ intencion: 'saludo' as const, texto: 'Buenos días.', esperaAnimo: true }))
    for (const [frase, paso] of [['ya no quiero vivir', 'quieta'], ['no aguanto más', 'cuidado'], ['me duele la rodilla', 'salud']] as const) {
      expect(filtroDeRiesgo(frase)).not.toBeNull()
      const t = decidirTurnoConCharla(frase, ve, HOY, ctx(), charla)
      expect(t.paso).toBe(paso)
    }
    expect(charla).not.toHaveBeenCalled() // ni siquiera se le pregunta
  })

  it('si el filtro no marca nada: lo exacto («gracias», «quién eres») se contesta local; el saludo y el «¿cómo estás?» van al modelo con su apertura', () => {
    for (const f of ['gracias', 'quién eres', 'chao', 'qué puedes hacer']) {
      expect(filtroDeRiesgo(f)).toBeNull()
      expect(decidirTurnoConCharla(f, ve, HOY, ctx())).toMatchObject({ paso: 'charla', vaAlModelo: false })
    }
    for (const f of ['hola', 'cómo estás', 'qué tal']) {
      expect(filtroDeRiesgo(f)).toBeNull()
      expect(decidirTurnoConCharla(f, ve, HOY, ctx())).toMatchObject({ paso: 'charlaModelo', vaAlModelo: true })
    }
  })

  it('lo que no es charla sigue su camino de siempre', () => {
    expect(decidirTurnoConCharla('hola, hice 4 series de sentadilla con 60', ve, HOY, ctx()).paso).toBe('registrar')
    expect(decidirTurnoConCharla('qué toca hoy', ve, HOY, ctx()).paso).toBe('plan')
  })

  it('NINGUNA frase de charla del catálogo cae en el filtro de riesgo (si alguna cayera, ganaría el filtro)', () => {
    for (const [frase] of CASOS) {
      const t = decidirTurnoConCharla(frase, ve, HOY, ctx())
      expect(['charla', 'charlaModelo'], frase).toContain(t.paso) // nunca quieta, cuidado, salud ni plan
    }
  })
})

describe('charla · varía y no repite la última dicha', () => {
  beforeEach(() => reiniciarVariantes())
  afterEach(() => fijarAzarDeCharla(null))
  it.each(['gracias', 'cómo estás', 'perdón', 'chao', 'te quiero', 'hola'])('«%s»: 60 veces seguidas, nunca igual que la anterior', (f) => {
    let anterior = ''
    const vistos = new Set<string>()
    for (let i = 0; i < 60; i++) {
      const t = dice(f)!.texto
      expect(t).not.toBe(anterior)
      anterior = t
      vistos.add(t)
    }
    expect(vistos.size).toBeGreaterThanOrEqual(3)
  })
  it('aunque el azar insista en el mismo número, la variante cambia', () => {
    fijarAzarDeCharla(() => 0)
    const a = dice('gracias')!.texto, b = dice('gracias')!.texto, c = dice('gracias')!.texto
    expect(a).not.toBe(b)
    expect(b).not.toBe(c)
  })
  it('la apertura inmediata: solo si la frase empieza saludando, es corta y no trae cifras', () => {
    expect(aperturaInmediata('hola, ¿qué me cuentas?', ctx())).not.toBeNull()
    expect(aperturaInmediata('buenas', ctx())).not.toBeNull()
    expect(aperturaInmediata('hola, hice 4 series de sentadilla con 60', ctx())).toBeNull()
    expect(aperturaInmediata('qué me cuentas', ctx())).toBeNull()
    expect(aperturaInmediata('hola ' + 'palabra '.repeat(8), ctx())).toBeNull()
    expect(aperturaInmediata('buenas noches', ctx({ yaHablo: true }))).toBeNull() // es una despedida
  })
  it('una pregunta fuera del plan va al modelo, salvo las de nutrición, suplementos o salud, que siguen su camino', () => {
    expect(decidirTurnoConCharla('¿qué me cuentas?', ve, HOY, ctx()).paso).toBe('charlaModelo')
    expect(decidirTurnoConCharla('¿la creatina engorda?', ve, HOY, ctx()).paso).toBe('plan')
    expect(decidirTurnoConCharla('¿puedo tomar pastillas para dormir?', ve, HOY, ctx()).paso).toBe('salud')
    expect(pareceCharla('¿qué me cuentas?')).toBe(true)
    expect(pareceCharla('hice 4 series')).toBe(false)
  })
})

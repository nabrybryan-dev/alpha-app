import { describe, expect, it, vi } from 'vitest'
import type { LoQuePraxisVe } from '../../../domain/praxis/plan/listaBlanca'
import { filtroDeRiesgo } from '../../../domain/praxis/riesgo'
import { decidirTurnoConCharla, momentoDelDia, normalizarCharla, responderCharla, type ContextoDeCharla, type IntencionDeCharla } from './charla'

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
    expect(t?.texto).toBe(tuTxt)
    expect(u?.intencion).toBe(intencion)
    expect(u?.texto).toBe(ustedTxt)
  })

  it('las respuestas en usted no se pasan al tú ni al revés', () => {
    for (const [frase, , , ustedTxt] of CASOS) {
      const t = dice(frase, { trato: 'tu' })?.texto ?? ''
      const u = dice(frase, { trato: 'usted' })?.texto ?? ''
      expect(u).toBe(ustedTxt)
      if (t !== u) expect(u).not.toMatch(/\b(tu|tus|te|quieras|puedes|cuéntame|acompañarte|descanses)\b/i)
    }
  })
})

describe('charla · el saludo sigue la hora local', () => {
  it.each([
    [5, 'Buenos días. ¿Cómo amaneciste?'], [11, 'Buenos días. ¿Cómo amaneciste?'],
    [12, 'Buenas tardes. ¿Cómo va el día?'], [18, 'Buenas tardes. ¿Cómo va el día?'],
    [19, 'Buenas noches. ¿Cómo te fue hoy?'], [23, 'Buenas noches. ¿Cómo te fue hoy?'], [0, 'Buenas noches. ¿Cómo te fue hoy?'], [4, 'Buenas noches. ¿Cómo te fue hoy?'],
  ])('a las %i h', (hora, texto) => {
    expect(dice('hola', { hora })?.texto).toBe(texto)
  })
  it('en usted también', () => {
    expect(dice('hola', { hora: 15, trato: 'usted' })?.texto).toBe('Buenas tardes. ¿Cómo va el día?')
    expect(dice('hola', { hora: 22, trato: 'usted' })?.texto).toBe('Buenas noches. ¿Cómo le fue hoy?')
  })
  it('los límites de las franjas', () => {
    expect([4, 5, 11, 12, 18, 19].map(momentoDelDia)).toEqual(['noche', 'manana', 'manana', 'tarde', 'tarde', 'noche'])
  })
})

describe('charla · la despedida', () => {
  it('«buenas noches» dicho al empezar es un saludo; tras haber hablado ya, una despedida', () => {
    expect(dice('buenas noches', { hora: 21, yaHablo: false })).toMatchObject({ intencion: 'saludo', texto: 'Buenas noches. ¿Cómo te fue hoy?' })
    expect(dice('buenas noches', { hora: 21, yaHablo: true })).toMatchObject({ intencion: 'despedida', texto: 'Que descanses. Aquí estoy mañana.' })
    expect(dice('buenas noches', { hora: 21, yaHablo: true, trato: 'usted' })?.texto).toBe('Que descanse. Aquí estoy mañana.')
  })
  it('de día la despedida es «Hasta luego», de noche «Que descanses»', () => {
    expect(dice('chao', { hora: 10 })?.texto).toBe('Hasta luego. Aquí estoy cuando quieras.')
    expect(dice('chao', { hora: 22 })?.texto).toBe('Que descanses. Aquí estoy mañana.')
    expect(dice('hasta mañana', { hora: 22, trato: 'usted' })?.texto).toBe('Que descanse. Aquí estoy mañana.')
  })
  it('«buenas noches» tras haber hablado, aunque sea de tarde, se despide de noche', () => {
    expect(dice('buenas noches', { hora: 17, yaHablo: true })?.texto).toBe('Que descanses. Aquí estoy mañana.')
  })
})

describe('charla · la respuesta de ánimo solo vale si Praxis acababa de preguntar', () => {
  const positivas = ['bien', 'muy bien', 'súper', 'excelente', 'todo bien', 'bien y tú', 'de maravilla']
  const negativas = ['mal', 'regular', 'más o menos', 'cansado', 'cansada', 'no muy bien']
  it.each(positivas)('«%s» tras la pregunta es ánimo bueno', (f) => {
    expect(dice(f, { esperaAnimo: true })).toMatchObject({ intencion: 'animoBueno', texto: 'Me alegra. ¿Qué anotamos hoy?' })
    expect(dice(f, { esperaAnimo: true, trato: 'usted' })?.texto).toBe('Me alegra. ¿Qué anotamos hoy?')
  })
  it.each(negativas)('«%s» tras la pregunta es ánimo malo', (f) => {
    expect(dice(f, { esperaAnimo: true })).toMatchObject({ intencion: 'animoMalo', texto: 'Gracias por contarme. ¿Es el cuerpo, el sueño o el día? Si quieres, lo anoto.' })
    expect(dice(f, { esperaAnimo: true, trato: 'usted' })?.texto).toBe('Gracias por contarme. ¿Es el cuerpo, el sueño o el día? Si quiere, lo anoto.')
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

  it('si el filtro no marca nada, la charla gana al plan y al registrador, y no va al modelo', () => {
    for (const f of ['hola', 'cómo estás', 'qué tal', 'gracias', 'quién eres']) {
      expect(filtroDeRiesgo(f)).toBeNull()
      const t = decidirTurnoConCharla(f, ve, HOY, ctx())
      expect(t).toMatchObject({ paso: 'charla', vaAlModelo: false })
    }
  })

  it('lo que no es charla sigue su camino de siempre', () => {
    expect(decidirTurnoConCharla('hola, hice 4 series de sentadilla con 60', ve, HOY, ctx()).paso).toBe('registrar')
    expect(decidirTurnoConCharla('qué toca hoy', ve, HOY, ctx()).paso).toBe('plan')
  })

  it('NINGUNA frase de charla del catálogo cae en el filtro de riesgo (si alguna cayera, ganaría el filtro)', () => {
    for (const [frase] of CASOS) {
      const t = decidirTurnoConCharla(frase, ve, HOY, ctx())
      expect(t.paso, frase).toBe('charla')
    }
  })
})

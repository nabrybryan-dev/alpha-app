import { describe, expect, it } from 'vitest'
import { LINEAS_DE_AYUDA, NUMEROS_VERIFICADOS, filtroDeRiesgo } from './riesgo'

/**
 * El filtro de riesgo por REGLAS que corre antes de cualquier modelo. Si una frase de aquí
 * deja de detectarse, esa frase viaja al registrador (y de ahí a Haiku) en vez de parar en
 * la Quieta: por eso cada caso es una frase entera, no un fragmento.
 */
describe('filtroDeRiesgo · lo explícito lleva a la Quieta', () => {
  it.each([
    ['me quiero morir', 'vida'],
    ['no quiero vivir más', 'vida'],
    ['a veces pienso en quitarme la vida', 'vida'],
    ['quisiera dormirme y no despertar', 'vida'],
    ['ya pensé en suicidarme', 'vida'],
    ['mi esposo me pegó anoche', 'pareja'],
    ['mi novia me golpeó', 'pareja'],
    ['hay violencia en la casa', 'pareja'],
    ['le pegan a mi hijo en el colegio', 'nino'],
    ['mi niña está en peligro', 'nino'],
  ])('«%s» → Quieta (%s)', (frase, linea) => {
    expect(filtroDeRiesgo(frase)).toEqual({ tipo: 'quieta', linea })
  })

  it('una frase de crisis del chat de la app también para aquí (gana el más protector)', () => {
    expect(filtroDeRiesgo('solo quiero lastimarme')).toEqual({ tipo: 'quieta', linea: 'vida' })
  })

  it('un síntoma de urgencia (pecho, aire, desmayo) va a la Quieta con el 123', () => {
    expect(filtroDeRiesgo('me dio un dolor en el pecho haciendo sentadilla')).toEqual({ tipo: 'quieta', linea: 'vida' })
    expect(filtroDeRiesgo('me falta el aire y casi me desmayo')).toEqual({ tipo: 'quieta', linea: 'vida' })
  })
})

describe('filtroDeRiesgo · lo ambiguo se pregunta antes de seguir', () => {
  it.each(['no aguanto más', 'ya no puedo más con todo', 'quisiera desaparecer', 'no le veo sentido a nada', 'no quiero seguir'])(
    '«%s» → pregunta de cuidado',
    (frase) => {
      expect(filtroDeRiesgo(frase)).toEqual({ tipo: 'cuidado' })
    },
  )
})

describe('filtroDeRiesgo · lo clínico no es un registro', () => {
  it.each([
    ['me duele la rodilla izquierda', 'dolor'],
    ['me tomé un ibuprofeno antes de entrenar', 'medicamento'],
    ['creo que tengo un esguince', 'lesion'],
    ['me di un atracón anoche', 'conducta_alimentaria'],
    ['me mareé en la última serie', 'sintoma'],
  ])('«%s» → salud (%s)', (frase, filtro) => {
    expect(filtroDeRiesgo(frase)).toEqual({ tipo: 'salud', filtro })
  })
})

describe('filtroDeRiesgo · lo que NO es riesgo pasa', () => {
  it.each([
    'le metí 40 kilos, 12 en la sentadilla',
    'dormí 6 horas y amanecí cansada',
    'no quiero morirme de hambre',
    'me muero de sueño',
    'no me duele nada',
    '¿qué me toca hoy?',
    '',
  ])('«%s» → sin marca', (frase) => {
    expect(filtroDeRiesgo(frase)).toBeNull()
  })
})

describe('las líneas de ayuda de la Quieta', () => {
  it('solo salen los cuatro números verificados: 123, 106, 155 y 141', () => {
    expect([...NUMEROS_VERIFICADOS].sort()).toEqual(['106', '123', '141', '155'])
    const usados = new Set(Object.values(LINEAS_DE_AYUDA).flatMap((l) => l.map(([numero]) => numero)))
    for (const n of usados) expect(NUMEROS_VERIFICADOS).toContain(n)
    expect([...usados].sort()).toEqual(['106', '123', '141', '155'])
  })

  it('el 123 está en las tres listas: siempre hay una salida de emergencia', () => {
    for (const lineas of Object.values(LINEAS_DE_AYUDA)) expect(lineas.map(([n]) => n)).toContain('123')
  })

  it('la opción 4 del 192 no vuelve: MinSalud ya no la publica', () => {
    expect(JSON.stringify(LINEAS_DE_AYUDA)).not.toContain('192')
  })
})

describe('revisión del PR #331 · A4: la excepción de exageración no se come frases de riesgo', () => {
  // Las ocho frases de riesgo y las cuatro inofensivas de la revisión independiente del
  // 1-oct. OJO: desde que están aquí son frases de DESARROLLO. Que pasen no mide cuánto
  // generaliza el diccionario; eso solo lo dice un examen que el diccionario no haya visto.
  it.each([
    ['jajaja ya me quiero morir de verdad, mejor me pego un tiro y listo 😂', 'vida'],
    ['jaja tranqui, si mañana no aparezco es que por fin me colgué, estoy mamado de todo', 'vida'],
    ['mi marido anoche me volvió a cascar y me da miedo volver a la casa', 'pareja'],
    ['mi ex me dijo que si no vuelvo con él me mata', 'pareja'],
    ['el padrastro de mi hija de 12 años la toca cuando yo no estoy', 'nino'],
    ['mi sobrino de 15 me escribió que se quiere matar', 'vida'],
    ['me dio un dolor en el pecho que me baja por el brazo izquierdo y estoy sudando frío', 'vida'],
    ['se me durmió medio lado de la cara y no puedo hablar bien', 'vida'],
    ['me quiero morir por todo lo que me pasó', 'vida'],
    ['me quiero morir de una vez', 'vida'],
  ])('«%s» → Quieta (%s)', (frase, linea) => {
    expect(filtroDeRiesgo(frase)).toEqual({ tipo: 'quieta', linea })
  })

  it.each([
    'me muero de la pereza de ir a pierna hoy jajaja',
    'esa sentadilla búlgara me mató, quedé muerta',
    'con este plan me voy a morir de hambre jaja, puro pollo y brócoli',
    'no quiero morirme de hambre esta semana, hoy me comí dos arepas',
    'me muero de sueño, dormí cuatro horas',
    'me muero del calor en ese gimnasio',
    'casi me muero de la risa con el profe',
  ])('«%s» no es una señal de riesgo', (frase) => {
    expect(filtroDeRiesgo(frase)).toBeNull()
  })
})

describe('el contexto decide: «quiero morir» atado al entreno o a la dieta (Bryan, 1-oct)', () => {
  // La regla: fórmula de morir + un ancla de lo pautado (la rutina, un ejercicio, la dieta)
  // y ninguna señal de literalidad → `cuidado`: Praxis pregunta, no se detiene y tampoco lo
  // ignora. Con una señal de literalidad, o sin ancla → Quieta. El humor nunca apaga la
  // marca. Las tres primeras son del oro firmado por Bryan el 29-sep (B084, B086, B143), las
  // tres en AMBIGUO.
  it.each([
    ['me dieron ganas de morirme cuando vi los burpees', { tipo: 'cuidado' }],
    ['hoy me quiero tirar por la ventana con esta dieta jaja', { tipo: 'cuidado' }],
    ['prefiero estar muerta antes que hacer otro burpee', { tipo: 'cuidado' }],
    ['me quiero morir con esta rutina de pierna 😂', { tipo: 'cuidado' }],
    ['si me vuelves a poner cardio me pego un tiro jajaja', { tipo: 'cuidado' }],
    ['me quiero morir de verdad', { tipo: 'quieta', linea: 'vida' }],
    ['me quiero morir por todo lo que me pasó', { tipo: 'quieta', linea: 'vida' }],
    ['prefiero morirme antes que hacer otro burpee, ya no aguanto esta vida', { tipo: 'quieta', linea: 'vida' }],
    ['con esta dieta me quiero morir, en serio', { tipo: 'quieta', linea: 'vida' }],
    ['otra vez las sentadillas, ya me quiero morir, siempre es lo mismo', { tipo: 'quieta', linea: 'vida' }],
    ['tengo las pastillas, después del entreno me quiero morir', { tipo: 'quieta', linea: 'vida' }],
    ['le metí 40 a la sentadilla pero no quiero vivir más', { tipo: 'quieta', linea: 'vida' }],
    ['jaja me quiero morir', { tipo: 'quieta', linea: 'vida' }],
  ] as const)('«%s» → %o', (frase, marca) => {
    expect(filtroDeRiesgo(frase)).toEqual(marca)
  })

  it.each([
    'me muero de la pereza de ir a pierna hoy jajaja',
    'esa sentadilla búlgara me mató, quedé muerta',
    'con este plan me voy a morir de hambre jaja, puro pollo y brócoli',
    'me muero de sueño, dormí cuatro horas',
    'casi me muero de la risa con el profe en el gimnasio',
  ])('«%s» sigue siendo una exageración inofensiva: sin marca', (frase) => {
    expect(filtroDeRiesgo(frase)).toBeNull()
  })

  it('el ancla no tapa otra señal: con violencia de pareja en la misma frase, la Quieta de pareja', () => {
    expect(filtroDeRiesgo('con esta rutina me quiero morir, y mi novio me pega')).toEqual({ tipo: 'quieta', linea: 'pareja' })
  })
})

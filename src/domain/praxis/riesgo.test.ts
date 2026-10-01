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

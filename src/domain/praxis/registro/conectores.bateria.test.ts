// @vitest-environment node
/**
 * BATERÍA DE ESTRÉS de los conectores (7-nov-2026): 50 frases coloquiales con lo que DEBE salir según el lexicón aprobado
 * por Bryan y las reglas firmes (riesgo primero, dolor y hambre no salen de palabras, lo habitual no es hoy, lo que no
 * está en la tabla no se adivina). Lo esperado se fijó ANTES de correrla; al correrla destapó dos errores (arreglados:
 * «no dormí bien» y «ando medio estresado») y un esperado mío equivocado (corregido abajo, comentado).
 *
 * HUECOS CONOCIDOS (fuera de esta batería a propósito, en CONOCIDOS al final, para notar si cambian):
 *  - «voy regular al gimnasio» sale rendimiento REGULAR: es la tabla de vida.ts leyendo «regular» como nivel cuando es
 *    frecuencia. Cambiar esa tabla pide el sí de Bryan.
 *  - «el entreno re bien» no sale: «re bien» no está en la tabla; palabra nueva = propuesta, no arreglo.
 *
 * ESCRITAS POR IA: SOLO PRUEBA, NO SIRVEN PARA ENTRENAR EL MODELO PROPIO.
 */
import { describe, expect, it } from 'vitest'
import { conectarMensaje } from './conectores.ts'
import type { CampoCheckin } from './mensajeLargo.ts'

type Esp = Partial<Record<CampoCheckin, string | number | [string, string] | null>>
interface Caso { g: string; frase: string; p?: CampoCheckin; esp?: Esp; vacio?: true; riesgo?: true }

const C: Caso[] = [
  // A · vagas con pregunta anterior
  { g: 'A', frase: 'ahí', p: 'estres', esp: { estres: 'REGULAR' } },
  { g: 'A', frase: 'ahí vamos', p: 'motivacion', esp: { motivacion: 'REGULAR' } },
  { g: 'A', frase: 'como medio', p: 'cansancio', esp: { cansancio: 'REGULAR' } },
  { g: 'A', frase: 'más o menos', p: 'calidadSueno', esp: { calidadSueno: 'REGULAR' } },
  { g: 'A', frase: 'normal', p: 'rendimiento', esp: { rendimiento: 'REGULAR' } },
  { g: 'A', frase: 'regularcito', p: 'alimentacion', esp: { alimentacion: 'REGULAR' } },
  { g: 'A', frase: 'ni bien ni mal', p: 'rendimiento', esp: { rendimiento: 'REGULAR' } },
  { g: 'A', frase: 'no tan bien', p: 'estres', esp: { estres: ['REGULAR', 'MUCHO'] } },
  { g: 'A', frase: 'no muy bien', p: 'motivacion', esp: { motivacion: ['REGULAR', 'POCO'] } },
  { g: 'A', frase: 'bien no más', p: 'calidadSueno', esp: { calidadSueno: ['BUENA', 'REGULAR'] } },
  { g: 'A', frase: 'medio mal', p: 'alimentacion', esp: { alimentacion: ['REGULAR', 'MALA'] } },
  { g: 'A', frase: 'medio bien', p: 'rendimiento', esp: { rendimiento: ['BUENA', 'REGULAR'] } },
  { g: 'A', frase: 'pues ahí, más o menos', p: 'estres', esp: { estres: 'REGULAR' } },
  { g: 'A', frase: 'maso', p: 'cansancio', esp: { cansancio: 'REGULAR' } },
  // B · vagas sin pregunta: nada
  { g: 'B', frase: 'estoy ahí', vacio: true },
  { g: 'B', frase: 'como medio', vacio: true },
  { g: 'B', frase: 'más o menos todo', vacio: true },
  // C · falsos positivos: ahí/medio/normal/regular que NO son grado
  { g: 'C', frase: 'lo dejé ahí en el carro', p: 'estres', vacio: true },
  { g: 'C', frase: 'ahí en el gym había mucha gente', p: 'rendimiento', vacio: true },
  { g: 'C', frase: 'trabajé medio día', p: 'estres', vacio: true },
  { g: 'C', frase: 'me tomé medio litro', p: 'cansancio', vacio: true },
  { g: 'C', frase: 'en medio del entreno me llamaron', p: 'rendimiento', vacio: true },
  // Corregido tras correrla: como respuesta a «¿cómo vas de estrés?», «normal» es razonable (la persona confirma).
  { g: 'C', frase: 'una semana normal de trabajo', p: 'estres', esp: { estres: 'REGULAR' } },
  { g: 'C', frase: 'a medio camino me devolví', p: 'rendimiento', vacio: true },
  // D · polaridad y negaciones
  { g: 'D', frase: 'la energía no tan bien', esp: { cansancio: ['REGULAR', 'MUCHO'] } },
  { g: 'D', frase: 'el estrés no tan mal', esp: { estres: 'REGULAR' } },
  { g: 'D', frase: 'no estuvo nada mal el entreno', esp: { rendimiento: null } },
  { g: 'D', frase: 'no me fue mal en el entreno', esp: { rendimiento: 'REGULAR' } },
  { g: 'D', frase: 'dormí no tan bien', esp: { calidadSueno: ['REGULAR', 'MALA'] } },
  { g: 'D', frase: 'no dormí bien', esp: { calidadSueno: 'MALA' } },
  // E · intensificadores
  { g: 'E', frase: 'el entreno súper mal', esp: { rendimiento: 'MALA' } },
  { g: 'E', frase: 'comí más o menos mal', esp: { alimentacion: ['REGULAR', 'MALA'] } },
  // F · medio + adjetivo
  { g: 'F', frase: 'estoy medio cansada', esp: { cansancio: 'REGULAR' } },
  { g: 'F', frase: 'ando medio estresado', esp: { estres: 'REGULAR' } },
  { g: 'F', frase: 'el entreno medio flojo', esp: { rendimiento: ['REGULAR', 'MALA'] } },
  { g: 'F', frase: 'dormí medio mal', esp: { calidadSueno: ['REGULAR', 'MALA'] } },
  // G · habitual vs hoy
  { g: 'G', frase: 'siempre ando estresada', esp: { estres: null } },
  { g: 'G', frase: 'normalmente como mal', esp: { alimentacion: null } },
  { g: 'G', frase: 'hoy ando estresada', esp: { estres: 'MUCHO' } },
  { g: 'G', frase: 'por lo general duermo como medio', esp: { calidadSueno: null } },
  // H · riesgo y dolor
  { g: 'H', frase: 'ahí, como medio, me duele la espalda', p: 'rendimiento', riesgo: true },
  { g: 'H', frase: 'no tan bien, siento que no quiero vivir', p: 'estres', riesgo: true },
  { g: 'H', frase: 'como medio', p: 'dolor', vacio: true },
  { g: 'H', frase: 'como medio', p: 'hambreEscala', vacio: true },
  // I · multi-área
  { g: 'I', frase: 'dormí como medio, el entreno no tan bien y comí bien', esp: { calidadSueno: 'REGULAR', rendimiento: ['REGULAR', 'MALA'], alimentacion: 'BUENA' } },
  { g: 'I', frase: 'estrés normal pero cansancio alto', esp: { estres: 'REGULAR' } },
  // J · coloquial que el lexicón NO cubre (debe salir nada: nunca adivinar)
  { g: 'J', frase: 'maluco', p: 'calidadSueno', vacio: true },
  { g: 'J', frase: 'sobreviviendo', p: 'estres', vacio: true },
  { g: 'J', frase: 'bacano', p: 'rendimiento', vacio: true },
  { g: 'J', frase: 'normalito', p: 'calidadSueno', vacio: true },
]

function salidaDe(c: Pick<Caso, 'frase' | 'p'>) {
  const r = conectarMensaje(c.frase, { preguntaAnterior: c.p })
  if (r.tipo === 'riesgo') return 'riesgo' as const
  const s: Record<string, unknown> = {}
  for (const p of r.propuestas) s[p.campo] = p.valor
  for (const d of r.dudosas) s[d.campo] = [...new Set(d.candidatos.map((x) => x.valor))]
  return s
}

describe('batería de estrés de los conectores', () => {
  it.each(C.map((c) => [`[${c.g}] ${c.frase}${c.p ? ` (tras preguntar ${c.p})` : ''}`, c] as const))('%s', (_n, c) => {
    const s = salidaDe(c)
    if (c.riesgo) { expect(s).toBe('riesgo'); return }
    expect(s).not.toBe('riesgo')
    const salida = s as Record<string, unknown>
    if (c.vacio) { expect(salida).toEqual({}); return }
    for (const [campo, e] of Object.entries(c.esp ?? {})) {
      if (e === null) expect(salida[campo]).toBeUndefined()
      else expect(salida[campo]).toEqual(e)
    }
  })
})

/** Huecos conocidos, tal como están hoy: si esta prueba falla, alguien cambió su comportamiento (para bien o para mal). */
describe('«regular» como FRECUENCIA no es un nivel (Bryan, 7-nov: ajustar la tabla de vida.ts)', () => {
  it.each([
    'voy regular al gimnasio, tres veces',
    'entreno regular, cuatro días',
    'voy regularmente al gym',
    'asisto regular a la rutina',
  ])('«%s» no anota rendimiento', (frase) => {
    expect(salidaDe({ frase, p: 'motivacion' })).toEqual({})
  })

  it('«regular» como nivel sigue valiendo', () => {
    expect(salidaDe({ frase: 'el entreno estuvo regular' })).toEqual({ rendimiento: 'REGULAR' })
    expect(salidaDe({ frase: 'me fue regular en la rutina' })).toEqual({ rendimiento: 'REGULAR' })
  })
})

describe('huecos conocidos (no son la meta: avisan si cambian)', () => {
  it('«el entreno re bien» hoy no sale (palabra nueva: propuesta)', () => {
    expect(salidaDe({ frase: 'el entreno re bien' })).toEqual({})
  })
})
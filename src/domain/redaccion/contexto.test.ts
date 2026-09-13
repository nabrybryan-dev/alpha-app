import { describe, expect, it } from 'vitest'
import { cifrasEnHuecos, contextoSinCifras, microciclosEnPalabras, sinAnotaciones } from './contexto'

/** Lo que el modelo ve escrito, sin contar el número que lleva el NOMBRE de un hueco. */
const sinNombresDeHueco = (texto: string) => texto.replace(/\{[a-z0-9_]+\}/g, '')

describe('el contexto que lee el modelo no le enseña ni una cifra', () => {
  it('las etiquetas de microciclo pasan a palabras, relativas al activo', () => {
    expect(microciclosEnPalabras('M23: series de la pauta', 24)).toBe('el microciclo pasado: series de la pauta')
    expect(microciclosEnPalabras('fila M24', 24)).toBe('fila el microciclo actual')
    expect(microciclosEnPalabras('fila M25', 24)).toBe('fila el microciclo siguiente')
    expect(microciclosEnPalabras('ventana M21-M22', 24)).toBe('ventana los últimos microciclos')
    expect(microciclosEnPalabras('M20', 24)).toBe('un microciclo anterior')
  })

  it('cada cifra se vuelve un hueco con su valor dicho en voz alta', () => {
    const r = cifrasEnHuecos('| MAV bajo | −15 % | cardio compartido, 2 h |', 'siguiente', 'de su plan')
    expect(r.texto).toBe('| MAV bajo | {siguiente_1} | cardio compartido, {siguiente_2} |')
    expect(r.huecos.siguiente_1.valor).toBe('menos 15 por ciento')
    expect(r.huecos.siguiente_2.valor).toBe('2 horas')
    expect(sinNombresDeHueco(r.texto)).not.toMatch(/\d/)
  })

  it('un rango no es un número negativo: «4-5 sesiones» se dice «4 a 5»', () => {
    // El 12-sep una revisión larga dijo «tu plan pide 4menos 5 sesiones»: el guion del rango
    // se leía como el signo de la segunda cifra.
    const r = cifrasEnHuecos('Sesiones: 4-5 · RIR 1–2 · energía −15 %', 'x', 'y')
    expect(r.texto).toBe('Sesiones: {x_1} a {x_2} · RIR {x_3} a {x_4} · energía {x_5}')
    expect(Object.values(r.huecos).map((h) => h.valor)).toEqual(['4', '5', '1', '2', 'menos 15 por ciento'])
  })

  it('un guion pegado a una palabra o dentro de una fecha no es un signo', () => {
    const archivo = cifrasEnHuecos('plan-estrategico-2026-08.md', 'x', 'y')
    expect(Object.values(archivo.huecos).some((h) => h.valor.startsWith('menos'))).toBe(false)
    const fechas = cifrasEnHuecos('2026-08-25 → 2026-10-20', 'x', 'y')
    expect(Object.values(fechas.huecos).some((h) => h.valor.startsWith('menos'))).toBe(false)
    expect(fechas.texto).not.toContain(' a ')
  })

  it('una letra pegada no es una unidad: «12 grupos» no son gramos', () => {
    const r = cifrasEnHuecos('12 grupos', 'x', 'y')
    expect(r.huecos.x_1.valor).toBe('12')
    expect(r.texto).toBe('{x_1} grupos')
  })

  it('el motivo real que tumbó la primera tanda sale limpio', () => {
    const r = contextoSinCifras(
      'M23: 77 de 81 series son la pauta devuelta; solo 2 de 27 ejercicios traen algo distinto',
      'motivo',
      'del registro',
      24,
    )
    expect(sinNombresDeHueco(r.texto)).not.toMatch(/\d/)
    expect(r.texto.startsWith('el microciclo pasado:')).toBe(true)
    expect(Object.values(r.huecos).map((h) => h.valor)).toEqual(['77', '81', '2', '27'])
  })

  it('la anotación de autor y fecha del coach no llega al modelo', () => {
    // Con ella convertida en hueco, el modelo dijo «estaré con vosotros el 12 de septiembre».
    expect(sinAnotaciones('jueves = cardio compartido, 2 h (Bryan, 12-sep)')).toBe('jueves = cardio compartido, 2 h')
    const r = contextoSinCifras('| M25 | −15 % | jueves = cardio compartido, 2 h (Bryan, 12-sep) |', 'p', 's', 24)
    expect(Object.values(r.huecos).map((h) => h.valor)).toEqual(['menos 15 por ciento', '2 horas'])
  })

  it('el número de una regla no se lee', () => {
    expect(sinAnotaciones('1. Sin dato — repite carga exacta')).toBe('Sin dato — repite carga exacta')
    expect(sinAnotaciones('Escalón de 2,5 kg')).toBe('Escalón de 2,5 kg')
  })

  it('no toca nada de fuera: devuelve huecos nuevos', () => {
    const a = cifrasEnHuecos('5 series', 'p', 's')
    const b = cifrasEnHuecos('5 series', 'p', 's')
    expect(a.huecos).not.toBe(b.huecos)
    expect(a).toEqual(b)
  })
})

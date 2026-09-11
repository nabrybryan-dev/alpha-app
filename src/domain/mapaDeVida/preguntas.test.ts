/**
 * El contrato de cada pregunta del mapa de vida: si no lleva escrito QUÉ
 * mensaje dispara y A QUÉ HORA, no tiene razón de estar en la encuesta.
 *
 * El tipo ya obliga a que el campo esté presente (`PreguntaMapaDeVida` no lo
 * marca opcional), pero un `''` pasa el tipo igual que pasaría un peso de
 * fábrica sin tocar: aquí es donde se cierra ese hueco.
 *
 * Visto fallar a propósito: se añadió una pregunta de prueba con
 * `mensajeQueDispara: ''` y el primer test de este archivo se puso en rojo
 * ("toda pregunta lleva su mensaje que dispara, no vacío"). Se retiró antes de
 * este commit — el rastro queda en la descripción del PR, no en el código.
 */
import { describe, expect, it } from 'vitest'
import {
  horaBaseValida,
  PREGUNTAS_MAPA_DE_VIDA,
  type TipoPreguntaMapa,
} from './preguntas'

const TIPOS_VALIDOS: readonly TipoPreguntaMapa[] = ['si_no', 'hora', 'opcion_multiple', 'escala_1_5']

describe('el mapa de vida trae al menos una pregunta', () => {
  it('la lista no está vacía', () => {
    expect(PREGUNTAS_MAPA_DE_VIDA.length).toBeGreaterThan(0)
  })
})

describe('toda pregunta lleva su mensaje que dispara, no vacío', () => {
  it.each(PREGUNTAS_MAPA_DE_VIDA.map((p) => [p.id, p] as const))(
    '%s trae mensajeQueDispara con contenido',
    (_id, pregunta) => {
      expect(pregunta.mensajeQueDispara.trim().length).toBeGreaterThan(0)
    },
  )
})

describe('toda pregunta trae una horaBase real', () => {
  it.each(PREGUNTAS_MAPA_DE_VIDA.map((p) => [p.id, p] as const))(
    '%s trae horaBase en formato HH:MM',
    (_id, pregunta) => {
      expect(horaBaseValida(pregunta.horaBase)).toBe(true)
    },
  )

  it('una hora inventada no pasa la validación', () => {
    expect(horaBaseValida('25:00')).toBe(false)
    expect(horaBaseValida('7:30')).toBe(false)
    expect(horaBaseValida('')).toBe(false)
  })
})

describe('cada pregunta tiene un id único y un tipo conocido', () => {
  it('sin ids repetidos', () => {
    const ids = PREGUNTAS_MAPA_DE_VIDA.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(PREGUNTAS_MAPA_DE_VIDA.map((p) => [p.id, p] as const))(
    '%s trae un tipo dentro de los conocidos',
    (_id, pregunta) => {
      expect(TIPOS_VALIDOS).toContain(pregunta.tipo)
    },
  )

  it('toda pregunta de opción múltiple trae al menos dos opciones', () => {
    const deOpciones = PREGUNTAS_MAPA_DE_VIDA.filter((p) => p.tipo === 'opcion_multiple')
    for (const pregunta of deOpciones) {
      expect(pregunta.opciones?.length ?? 0).toBeGreaterThanOrEqual(2)
    }
  })

  it('mensajeQueDispara no se repite entre preguntas distintas', () => {
    const mensajes = PREGUNTAS_MAPA_DE_VIDA.map((p) => p.mensajeQueDispara)
    expect(new Set(mensajes).size).toBe(mensajes.length)
  })
})

describe('el seed de pruebas usa solo a Valentina, nunca datos reales', () => {
  it('ninguna pregunta menciona un nombre propio', () => {
    // Guarda contra copiar y pegar una pregunta real de un asesorado en vez de
    // escribirla de cero. La única persona que puede aparecer en este archivo
    // es el seed ficticio.
    const prohibidos = ['bryan', 'valentina']
    for (const pregunta of PREGUNTAS_MAPA_DE_VIDA) {
      const texto = pregunta.texto.toLowerCase()
      for (const nombre of prohibidos) {
        expect(texto.includes(nombre)).toBe(false)
      }
    }
  })
})

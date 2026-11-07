/**
 * Quien llega de la landing trae un cribado `encuesta` a medias: lo que la landing
 * pregunta con el mismo sentido que la app, y nada más. A esa persona se le abre la
 * pantalla de salud igual, pero rellena: confirma y completa, no repite.
 */
import { describe, expect, it } from 'vitest'
import type { Db } from '../../data/repos'
import type { Cribado, Perfil, Usuario } from '../../domain/types'
import { borradorDesdePrevio } from './borrador'
import { cribadoDeEncuestaIncompleto, necesitaCribado, previoDeEncuesta } from './necesitaCribado'

const asesorado = { id: 'u1', nombre: 'Valentina Cruz', rol: 'asesorado' } as Usuario

const deEncuesta: Cribado = {
  usuarioId: 'u1',
  fecha: '2026-11-04',
  fuente: 'encuesta',
  sintomasConEsfuerzo: 'ausente',
  diagnostico: 'ausente',
  parqEnfermedadCardiaca: false,
  parqMedicamentoPresion: false,
  parqHuesosArticulaciones: true,
  detalle: {
    parq_huesos_articulaciones: 'Encuesta de inscripción (lesiones): esguince de tobillo',
    medicacion_cronica: 'Encuesta de inscripción: vitamina D',
  },
}

const completo: Cribado = {
  ...deEncuesta,
  quienLoLleva: 'ausente', tratamientoActivo: 'ausente', medicacionCronica: 'ausente',
  autorizacionSanitaria: 'ausente', restriccionesExplicitas: 'ausente',
  nivelFuncional: 'ausente', queLeHanDichoQueNoHaga: 'ausente',
}

function db(c: Cribado | undefined): Db {
  return {
    cribado: { byUsuario: () => c },
    perfiles: { byUsuario: () => ({ usuarioId: 'u1', diasDisponibles: ['LUNES'] }) as unknown as Perfil },
  } as unknown as Db
}

describe('el cribado que viene de la landing', () => {
  it('a medias, se pide: lo que falta no es un «no»', () => {
    expect(cribadoDeEncuestaIncompleto(deEncuesta)).toBe(true)
    expect(necesitaCribado(db(deEncuesta), asesorado)).toBe(true)
  })

  it('completo, ya no', () => {
    expect(cribadoDeEncuestaIncompleto(completo)).toBe(false)
    expect(necesitaCribado(db(completo), asesorado)).toBe(false)
  })

  it('una fila wiki a medias sigue como antes (la decide el coach)', () => {
    const wiki = { ...deEncuesta, fuente: 'wiki' } as Cribado
    expect(necesitaCribado(db(wiki), asesorado)).toBe(false)
    expect(previoDeEncuesta(db(wiki), asesorado)).toBeUndefined()
  })

  it('cuando ya contestó en la app, la encuesta deja de rellenar nada', () => {
    const app = { ...completo, fuente: 'app' } as Cribado
    expect(previoDeEncuesta(db(app), asesorado)).toBeUndefined()
    expect(previoDeEncuesta(db(deEncuesta), asesorado)).toBe(deEncuesta)
  })
})

describe('el borrador rellenado desde la encuesta', () => {
  const b = borradorDesdePrevio(deEncuesta)

  it('marca solo lo dicho y deja sin marcar lo que no consta', () => {
    expect(b.respuestas).toEqual({
      sintomasConEsfuerzo: 'no',
      diagnostico: 'no',
      parqEnfermedadCardiaca: 'no',
      parqMedicamentoPresion: 'no',
      parqHuesosArticulaciones: 'si',
    })
    expect(b.respuestas).not.toHaveProperty('quienLoLleva')
    expect(b.dias).toEqual([])
  })

  it('trae el detalle con la clave en columnas, también el de un campo sin marcar', () => {
    expect(b.detalle.parqHuesosArticulaciones).toContain('esguince')
    // No decidió el estado, pero si la persona toca «sí» lo encuentra escrito.
    expect(b.detalle.medicacionCronica).toContain('vitamina D')
  })
})

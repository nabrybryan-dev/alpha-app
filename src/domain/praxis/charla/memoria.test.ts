/**
 * La memoria de la charla (0166, aplicada el 7-nov-2026): qué turnos se guardan de cada frase que llega al servidor.
 * Puro: sin red. El servidor (praxis-registro/memoria.ts) solo los manda con service_role.
 */
import { describe, expect, it } from 'vitest'
import { filasDeTurno, leerMarcaCharla, MAX_TEXTO_MEMORIA } from './memoria.ts'

const ID = '3f2b8c1e-9a4d-4b7e-8c21-5d6e7f809a1b'

describe('leerMarcaCharla: el cliente dice a qué charla y en qué turno va', () => {
  it('acepta un uuid y un turno entero', () => {
    expect(leerMarcaCharla({ charla_id: ID, turno: 3 })).toEqual({ charlaId: ID, turno: 3 })
  })
  it('sin marca, o con una marca rara, no se guarda nada (null)', () => {
    for (const malo of [undefined, null, 'x', {}, { charla_id: 'no-es-uuid', turno: 1 }, { charla_id: ID }, { charla_id: ID, turno: -1 },
      { charla_id: ID, turno: 1.5 }, { charla_id: ID, turno: 5000 }, { charla_id: ID, turno: '2' }]) {
      expect(leerMarcaCharla(malo), JSON.stringify(malo)).toBeNull()
    }
  })
})

describe('filasDeTurno: la frase de la persona y lo que contestó Praxis', () => {
  const base = { usuarioId: 'u-1', marca: { charlaId: ID, turno: 4 }, frase: '  hoy dormí poco  ', respuesta: 'Gracias por contarme.', clinico: false, aviso: false }

  it('dos filas con orden 2·turno y 2·turno+1; el usuario sale de la sesión, no del cliente', () => {
    expect(filasDeTurno(base)).toEqual([
      { usuario_id: 'u-1', charla_id: ID, n: 8, rol: 'persona', texto: 'hoy dormí poco', marcado_clinico: false, aviso_coach: false },
      { usuario_id: 'u-1', charla_id: ID, n: 9, rol: 'praxis', texto: 'Gracias por contarme.', marcado_clinico: false, aviso_coach: false },
    ])
  })
  it('sin respuesta de Praxis guarda solo la frase', () => {
    expect(filasDeTurno({ ...base, respuesta: null }).map((f) => f.rol)).toEqual(['persona'])
    expect(filasDeTurno({ ...base, respuesta: '   ' }).map((f) => f.rol)).toEqual(['persona'])
  })
  it('una frase marcada por riesgo se guarda con sus banderas en las dos filas', () => {
    const filas = filasDeTurno({ ...base, clinico: true, aviso: true })
    expect(filas.every((f) => f.marcado_clinico && f.aviso_coach)).toBe(true)
  })
  it('recorta al tope de la tabla (2.000) y una frase vacía no guarda nada', () => {
    expect(filasDeTurno({ ...base, respuesta: 'x'.repeat(5000) })[1].texto).toHaveLength(MAX_TEXTO_MEMORIA)
    expect(MAX_TEXTO_MEMORIA).toBe(2000)
    expect(filasDeTurno({ ...base, frase: '   ' })).toEqual([])
  })
})

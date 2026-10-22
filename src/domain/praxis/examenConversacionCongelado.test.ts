import { describe, expect, it } from 'vitest'
import banco from '../../../docs/praxis/examen-conversacion-20261006.json'
import { esConsultaDeRir } from './plan/responder'
import { aclararReferenciaAnterior } from './referenciaAnterior'

describe('examen provisional de reglas: casos distintos, sin nota clínica', () => {
  it.each(banco.casos)('$id · $clase', caso => {
    expect(esConsultaDeRir(caso.frase)).toBe(caso.rir)
    expect(aclararReferenciaAnterior(caso.frase) !== null).toBe(caso.referencia)
  })
})

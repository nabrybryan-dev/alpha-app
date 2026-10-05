// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Bryan, 3-oct-2026: Praxis no dice «no te entendí». Los textos del ingreso por voz y de los turnos repiten la pregunta en corto. */
const ARCHIVOS = ['src/features/praxis/ingreso/PasosDeVoz.tsx', 'src/features/praxis/motor/turnos.ts']
describe('ningún texto de Praxis dice «no te entendí»', () => {
  it.each(ARCHIVOS)('%s no trae «No te/le entendí»', (f) => {
    expect(readFileSync(f, 'utf8')).not.toMatch(/No (te|le) entend[ií]/i)
  })
  it('el fallo no_entendi del ingreso usa pedirDeNuevo y el de los turnos usa repetirEnCorto', () => {
    expect(readFileSync(ARCHIVOS[0], 'utf8')).toMatch(/pedirDeNuevo\(turno\.bloque/)
    expect(readFileSync(ARCHIVOS[1], 'utf8')).toMatch(/repetirEnCorto\(cfg\.pregunta/)
  })
})

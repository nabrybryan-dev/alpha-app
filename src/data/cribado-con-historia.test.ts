/**
 * El cribado guarda su historia y manda la más reciente (migración 0062).
 *
 * LA DECISIÓN QUE LO MOTIVA (Bryan, 2026-09-10). Hasta la 0058 había UNA ficha por
 * persona y la que estaba arriba ganaba siempre: si el coach volcaba el expediente y
 * después ella contestaba desde la app, su respuesta se descartaba. Sobre un cribado
 * clínico eso está al revés — **quien sabe si empezó una medicación esta semana es
 * ella**—, pero lo contrario tampoco valía: una respuesta a la ligera borraría el
 * cribado que el coach hizo con criterio.
 *
 * Se guardan las dos, cada una con su fecha, y manda la última. Estas pruebas fijan las
 * tres consecuencias que se pueden equivocar en silencio: que la nueva no borre a la
 * vieja, que la que se lee sea la NUEVA (con `find` se leía la vieja, o sea la
 * medicación de antes) y que un doble toque no llene la historia de copias.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { crearMockDb } from './mockDb'
import type { Cribado } from '../domain/types'

const BASE: Omit<Cribado, 'fecha' | 'medicacionCronica'> = {
  usuarioId: 'u1',
  fuente: 'app',
  diagnostico: 'ausente',
  quienLoLleva: 'ausente',
  tratamientoActivo: 'ausente',
  autorizacionSanitaria: 'ausente',
  restriccionesExplicitas: 'ausente',
  sintomasConEsfuerzo: 'ausente',
  nivelFuncional: 'ausente',
  queLeHanDichoQueNoHaga: 'ausente',
  // Las tres del PAR-Q son booleanas, no del vocabulario de tres valores. Lo dijo `tsc`,
  // no vitest: las pruebas se transpilan sin comprobar tipos, así que esto pasaba en
  // verde con tres cadenas donde el tipo pide un sí o un no.
  parqEnfermedadCardiaca: false,
  parqMedicamentoPresion: false,
  parqHuesosArticulaciones: false,
  detalle: {},
}

// Cada prueba con SU persona: el almacén local sobrevive entre pruebas —es el mismo
// `localStorage` del entorno— y compartir el id haría que la segunda viera lo que
// insertó la primera. Con un id por prueba, cada una parte de cero de verdad.
const cribado = (
  fecha: string,
  medicacion: Cribado['medicacionCronica'],
  usuarioId = 'u1',
): Cribado => ({ ...BASE, usuarioId, fecha, medicacionCronica: medicacion })

describe('el cribado guarda su historia', () => {
  let db: ReturnType<typeof crearMockDb>

  beforeEach(() => {
    db = crearMockDb()
  })

  it('contestar otra vez NO se descarta: se guarda al lado', () => {
    expect(db.cribado.contestar(cribado('2026-08-01', 'ausente', 'p-alta'))).toBe('guardado')
    expect(db.cribado.contestar(cribado('2026-09-10', 'presente', 'p-alta'))).toBe('guardado')
  })

  it('y la que se lee es la NUEVA, que es la que dice la verdad de hoy', () => {
    db.cribado.contestar(cribado('2026-08-01', 'ausente', 'p-lee'))
    db.cribado.contestar(cribado('2026-09-10', 'presente', 'p-lee'))
    // El caso real: empezó una medicación. Leer la vieja diría que no toma nada.
    expect(db.cribado.byUsuario('p-lee')?.medicacionCronica).toBe('presente')
    expect(db.cribado.byUsuario('p-lee')?.fecha).toBe('2026-09-10')
  })

  it('un doble toque no deja una copia, y lo dice', () => {
    expect(db.cribado.contestar(cribado('2026-09-10', 'presente', 'p-doble'))).toBe('guardado')
    expect(db.cribado.contestar(cribado('2026-09-10', 'presente', 'p-doble'))).toBe('ya_estaba')
  })

  it('el cribado de otra persona no se toca', () => {
    db.cribado.contestar(cribado('2026-09-10', 'presente', 'p-una'))
    db.cribado.contestar(cribado('2026-09-10', 'ausente', 'p-otra'))
    expect(db.cribado.byUsuario('p-una')?.medicacionCronica).toBe('presente')
    expect(db.cribado.byUsuario('p-otra')?.medicacionCronica).toBe('ausente')
  })
})

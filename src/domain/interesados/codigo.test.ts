/**
 * El código del creador llega en la URL y se normaliza como dice PASO-A-PASO, paso 2:
 * sin espacios y en mayúsculas. Lo que no tenga forma de código (una tilde, un guion)
 * NO se arregla: se descarta, porque la URL no puede colar texto libre en la base.
 * Los casos son los de la tabla del paso 2.
 */
import { describe, expect, it } from 'vitest'
import { clienteDelEnlace, codigoDelEnlace, normalizarCodigo } from './codigo'

describe('normalizarCodigo', () => {
  it('quita todos los espacios, también los del medio, y pasa a mayúsculas', () => {
    expect(normalizarCodigo(' Pruebac 1 ')).toBe('PRUEBAC1')
    expect(normalizarCodigo('prue\tba c1\n')).toBe('PRUEBAC1')
  })

  it('no arregla guiones ni tildes: solo espacios y mayúsculas', () => {
    expect(normalizarCodigo('pruebac-1')).toBe('PRUEBAC-1')
    expect(normalizarCodigo('pruébac1')).toBe('PRUÉBAC1')
  })
})

describe('codigoDelEnlace', () => {
  it('devuelve el código normalizado cuando tiene forma de código', () => {
    expect(codigoDelEnlace(' Pruebac 1 ')).toBe('PRUEBAC1')
    expect(codigoDelEnlace('pruebaviejo')).toBe('PRUEBAVIEJO')
  })

  it('descarta lo que no es A–Z y 0–9 en vez de «arreglarlo»', () => {
    expect(codigoDelEnlace('pruebac-1')).toBeNull()
    expect(codigoDelEnlace('pruébac1')).toBeNull()
  })

  it('no deja pasar texto largo por la URL', () => {
    expect(codigoDelEnlace('A'.repeat(33))).toBeNull()
  })

  it('sin parámetro o vacío, null', () => {
    expect(codigoDelEnlace(null)).toBeNull()
    expect(codigoDelEnlace(undefined)).toBeNull()
    expect(codigoDelEnlace('   ')).toBeNull()
  })
})

describe('clienteDelEnlace', () => {
  it('acepta cli-<n> y PRUEBA-<n>', () => {
    expect(clienteDelEnlace('cli-12')).toBe('cli-12')
    expect(clienteDelEnlace(' PRUEBA-003 ')).toBe('PRUEBA-003')
  })

  it('cualquier otra cosa es null (ni nombres ni teléfonos)', () => {
    expect(clienteDelEnlace('Valentina')).toBeNull()
    expect(clienteDelEnlace('0000000000')).toBeNull()
    expect(clienteDelEnlace(null)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import type { Usuario } from '../../domain/types'
import { remitentesDe, tituloDe } from './remitentes'

const coach: Usuario = { id: 'u-bryan', nombre: 'Bryan', rol: 'coach', avatarIniciales: 'B' }
const nutri: Usuario = {
  id: 'u-manuela',
  nombre: 'Manuela Quintero',
  rol: 'nutricionista',
  avatarIniciales: 'MQ',
}
const asesorada: Usuario = {
  id: 'u-valentina',
  nombre: 'Valentina Cruz',
  rol: 'asesorado',
  avatarIniciales: 'VC',
}

describe('con quién puede hablar un asesorado', () => {
  it('ofrece al equipo y deja fuera a los demás asesorados', () => {
    const lista = remitentesDe([asesorada, nutri, coach], asesorada.id)
    expect(lista.map((u) => u.id)).toEqual(['u-bryan', 'u-manuela'])
  })

  it('pone al coach primero aunque venga el último de la nube', () => {
    const lista = remitentesDe([nutri, coach], asesorada.id)
    expect(lista[0].id).toBe('u-bryan')
  })

  it('la nutricionista no se ve a sí misma: también es asesorada', () => {
    // Es el caso real de Manuela, y el que rompió la primera mesa del sábado
    // por filtrar «rol = asesorado». Ser del equipo no quita entrenar.
    const lista = remitentesDe([coach, nutri], nutri.id)
    expect(lista.map((u) => u.id)).toEqual(['u-bryan'])
  })

  it('sin nutricionista en la base, queda el coach y la pantalla sigue viva', () => {
    expect(remitentesDe([coach, asesorada], asesorada.id).map((u) => u.id)).toEqual(['u-bryan'])
  })

  it('sin nadie del equipo devuelve vacío, y no inventa un hilo', () => {
    expect(remitentesDe([asesorada], asesorada.id)).toEqual([])
  })

  it('cada hilo se llama por lo que es', () => {
    expect(tituloDe(coach)).toBe('Coach Bryan')
    expect(tituloDe(nutri)).toBe('Nutrición · Manuela')
  })
})

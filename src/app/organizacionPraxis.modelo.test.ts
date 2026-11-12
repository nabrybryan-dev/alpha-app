import { describe, expect, it } from 'vitest'
import type { Rol } from '../domain/types'
import { decidirConLectura, sePuedeConsultarAlModelo, type EstadoDeOrganizacion } from './organizacionPraxis'
import type { PerfilAcceso } from './rutas'

const ASESORADO: PerfilAcceso = { rol: 'asesorado' as Rol, capacidades: new Set() }
const SIN_NADA: EstadoDeOrganizacion = { ocultas: new Set(), hayCambiosParaDeshacer: false }

describe('decidirConLectura: lo que lee el modelo pasa por los mismos candados', () => {
  it('«traer» de una pieza real nunca abre solo: lleva confirmar', () => {
    expect(decidirConLectura({ verbo: 'traer', pieza: 'nutricion.agua' }, ASESORADO, SIN_NADA)).toMatchObject({ tipo: 'traer', confirmar: true })
  })

  it('ocultar una pieza fija o asignada se rechaza aunque el modelo la elija', () => {
    const r = decidirConLectura({ verbo: 'ocultar', pieza: 'semana.chat' }, ASESORADO, SIN_NADA)
    expect(r).toMatchObject({ tipo: 'rechaza', motivo: 'fija' })
  })

  it('ocultar una pieza libre solo se propone', () => {
    expect(decidirConLectura({ verbo: 'ocultar', pieza: 'nutricion.recetas' }, ASESORADO, SIN_NADA)).toMatchObject({ tipo: 'propone', accion: 'ocultar' })
  })

  it('el tope de ocultas también cuenta', () => {
    const lleno: EstadoDeOrganizacion = { ocultas: new Set(['a', 'b', 'c', 'd', 'e', 'f']), hayCambiosParaDeshacer: true }
    expect(decidirConLectura({ verbo: 'ocultar', pieza: 'nutricion.recetas' }, ASESORADO, lleno)).toMatchObject({ tipo: 'rechaza', motivo: 'tope_de_ocultas' })
  })

  it('una pieza que no existe para esta persona no organiza nada', () => {
    expect(decidirConLectura({ verbo: 'ocultar', pieza: 'no.existe' }, ASESORADO, SIN_NADA)).toEqual({ tipo: 'no_es_organizacion' })
  })

  it('los verbos sin pieza y «ninguno»', () => {
    expect(decidirConLectura({ verbo: 'restablecer', pieza: null }, ASESORADO, SIN_NADA)).toEqual({ tipo: 'propone_restablecer' })
    expect(decidirConLectura({ verbo: 'listar_ocultas', pieza: null }, ASESORADO, SIN_NADA)).toMatchObject({ tipo: 'lista_ocultas' })
    expect(decidirConLectura({ verbo: 'solo_lo_importante', pieza: null }, ASESORADO, SIN_NADA)).toMatchObject({ tipo: 'propone_solo_lo_importante' })
    expect(decidirConLectura({ verbo: 'ninguno', pieza: null }, ASESORADO, SIN_NADA)).toEqual({ tipo: 'no_es_organizacion' })
  })
})

describe('sePuedeConsultarAlModelo: la seguridad va primero', () => {
  it('no se consulta con frases de salud o de riesgo', () => {
    expect(sePuedeConsultarAlModelo('oculta lo de la rodilla que me duele')).toBe(false)
    expect(sePuedeConsultarAlModelo('ya no quiero vivir esconde todo')).toBe(false)
  })

  it('sí con una frase normal', () => {
    expect(sePuedeConsultarAlModelo('hazla simple porfa')).toBe(true)
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { Capacidad } from '../data/consola/capacidadesStaff'
import type { Rol } from '../domain/types'
import { FRASE_SIN_ACCESO, navegarA, navegarPorFrase } from './navegarPraxis'
import type { PerfilAcceso } from './rutas'

const perfil = (rol: Rol, capacidades: Capacidad[] = []): PerfilAcceso => ({ rol, capacidades: new Set(capacidades) })
const asesorado = perfil('asesorado')
const coach = perfil('coach', ['leer_entrenamiento', 'ver_administracion'])

describe('navegarA: la guarda de rol es la de la app', () => {
  it('una pantalla del asesorado: navega y dice el título', () => {
    const navegar = vi.fn()
    expect(navegarA('/entrenar', asesorado, navegar)).toEqual({ tipo: 'navego', patron: '/entrenar', titulo: 'Entrenar' })
    expect(navegar.mock.calls).toEqual([['/entrenar']])
  })

  it('el título cambia para el equipo («Hoy» / «Mi día»)', () => {
    expect(navegarA('/', coach, vi.fn())).toMatchObject({ tipo: 'navego', titulo: 'Mi día' })
  })

  it('un asesorado no entra a una ruta del equipo: se le dice y NO se navega a ninguna parte', () => {
    const navegar = vi.fn()
    expect(navegarA('/entrenar/encoder', asesorado, navegar)).toEqual({ tipo: 'sin_acceso', patron: '/entrenar/encoder', frase: FRASE_SIN_ACCESO })
    expect(navegar).not.toHaveBeenCalled()
  })

  it('un destino que no existe, con parámetros o de la propia Praxis no es destino', () => {
    const navegar = vi.fn()
    for (const p of ['/no-existe', '/entrenar/sesion/:sesionId', '/entrenar/sesion/s-1', '/praxis', '']) {
      expect(navegarA(p, coach, navegar), p).toEqual({ tipo: 'no_es_destino', patron: p })
    }
    expect(navegar).not.toHaveBeenCalled()
  })
})

describe('navegarPorFrase: lo de salud y riesgo nunca navega', () => {
  it('«qué me toca hoy» lleva a «/» con la guarda', () => {
    const navegar = vi.fn()
    expect(navegarPorFrase('muéstrame lo de hoy', asesorado, navegar)).toMatchObject({ tipo: 'navego', patron: '/' })
    expect(navegar.mock.calls).toEqual([['/']])
  })

  it.each(['me quiero morir', 'me duele el pecho, muéstrame lo de hoy', 'ya no puedo más con todo, llévame a hoy', 'me da miedo ir a hoy'])(
    '«%s» no navega',
    (frase) => {
      const navegar = vi.fn()
      const r = navegarPorFrase(frase, coach, navegar)
      expect(r.tipo).not.toBe('navego')
      expect(navegar).not.toHaveBeenCalled()
    },
  )

  it('una frase de riesgo devuelve la respuesta del filtro, no un destino', () => {
    expect(navegarPorFrase('me quiero morir', coach, vi.fn())).toMatchObject({ tipo: 'no_navega', motivo: 'riesgo' })
  })

  it('una orden que mueve el salón (no es ruta) no navega', () => {
    const navegar = vi.fn()
    expect(navegarPorFrase('muéstrame cuádriceps', coach, navegar).tipo).toBe('no_es_destino')
    expect(navegar).not.toHaveBeenCalled()
  })
})

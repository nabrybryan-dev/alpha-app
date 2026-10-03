import { describe, expect, it, vi } from 'vitest'
import { guardarPerfilDelSalon, type RepositorioDePerfiles } from './perfiles'

const medidas = {
  estaturaCm: 175, masaKg: 75, torsoCm: 55, brazoCm: 32,
  antebrazoCm: 27, femurCm: 45, tibiaCm: 41, pieCm: 26,
}

describe('servicio de perfiles del salón', () => {
  it('valida y persiste bajo el usuario autenticado', async () => {
    const guardar = vi.fn().mockResolvedValue(undefined)
    const repositorio: RepositorioDePerfiles = { guardar, obtener: vi.fn() }
    const perfil = await guardarPerfilDelSalon('usuario-1', medidas, repositorio, new Date('2026-09-03T12:00:00Z'))
    expect(perfil.usuarioId).toBe('usuario-1')
    expect(guardar).toHaveBeenCalledOnce()
  })

  it('convierte un fallo de persistencia en un error estable sin éxito parcial', async () => {
    const repositorio: RepositorioDePerfiles = {
      guardar: vi.fn().mockRejectedValue(new Error('proveedor caído')),
      obtener: vi.fn(),
    }
    await expect(guardarPerfilDelSalon('usuario-1', medidas, repositorio)).rejects.toMatchObject({
      codigo: 'PERSISTENCIA_NO_DISPONIBLE', estadoHttp: 503,
    })
  })
})

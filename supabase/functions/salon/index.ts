import { guardarPerfilDelSalon, type RepositorioDePerfiles } from '../../../src/server/salon/perfiles.ts'
import type { PerfilAntropometricoPersistido } from '../../../src/data/antropometria/perfil.ts'

export interface DependenciasSalon {
  autenticar(req: Request): Promise<string | null>
  repositorio: RepositorioDePerfiles
}

export function crearManejadorSalon(dependencias: DependenciasSalon) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Método no permitido' }, { status: 405 })
    }
    const usuarioId = await dependencias.autenticar(req)
    if (!usuarioId) return Response.json({ error: 'No autorizado' }, { status: 401 })

    try {
      const cuerpo = await req.json() as { medidas?: unknown }
      const perfil: PerfilAntropometricoPersistido = await guardarPerfilDelSalon(
        usuarioId,
        cuerpo.medidas,
        dependencias.repositorio,
      )
      return Response.json({ perfil }, { status: 200 })
    } catch (error) {
      const estado = typeof error === 'object' && error !== null && 'estadoHttp' in error
        ? Number(error.estadoHttp)
        : 400
      const mensaje = error instanceof Error ? error.message : 'Petición inválida'
      return Response.json({ error: mensaje }, { status: estado })
    }
  }
}

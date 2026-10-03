import { validarPerfilAntropometrico } from '../../data/antropometria/perfil'
import type { PerfilAntropometricoPersistido } from '../../data/antropometria/perfil'
import { ErrorDeSalon } from './errores'

export interface RepositorioDePerfiles {
  guardar(perfil: PerfilAntropometricoPersistido): Promise<void>
  obtener(usuarioId: string): Promise<PerfilAntropometricoPersistido | null>
}

export async function guardarPerfilDelSalon(
  usuarioId: string,
  entrada: unknown,
  repositorio: RepositorioDePerfiles,
  ahora = new Date(),
): Promise<PerfilAntropometricoPersistido> {
  if (!usuarioId.trim()) {
    throw new ErrorDeSalon('NO_AUTORIZADO', 'Falta el usuario autenticado', 401)
  }

  let medidas
  try {
    medidas = validarPerfilAntropometrico(entrada)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Perfil inválido'
    throw new ErrorDeSalon('PETICION_INVALIDA', mensaje, 400)
  }

  const perfil = { usuarioId, medidas, actualizadoEn: ahora.toISOString() }
  try {
    await repositorio.guardar(perfil)
  } catch {
    throw new ErrorDeSalon(
      'PERSISTENCIA_NO_DISPONIBLE',
      'No se pudo guardar el perfil antropométrico',
      503,
    )
  }
  return perfil
}

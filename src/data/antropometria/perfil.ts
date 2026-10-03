import {
  CLAVES_ANTROPOMETRICAS,
  type PerfilAntropometrico,
} from '../../domain/biomecanica/personalizacion'

export interface PerfilAntropometricoPersistido {
  usuarioId: string
  medidas: PerfilAntropometrico
  actualizadoEn: string
}

export function validarPerfilAntropometrico(valor: unknown): PerfilAntropometrico {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new Error('El perfil antropométrico debe ser un objeto')
  }
  const entrada = valor as Record<string, unknown>
  const claves = Object.keys(entrada)
  if (claves.length !== CLAVES_ANTROPOMETRICAS.length) {
    throw new Error('El perfil debe contener exactamente ocho medidas')
  }

  const salida = {} as PerfilAntropometrico
  for (const clave of CLAVES_ANTROPOMETRICAS) {
    const medida = entrada[clave]
    if (typeof medida !== 'number' || !Number.isFinite(medida) || medida <= 0) {
      throw new Error(`Medida inválida: ${clave}`)
    }
    salida[clave] = medida
  }
  return salida
}

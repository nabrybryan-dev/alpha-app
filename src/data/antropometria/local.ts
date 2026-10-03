import { crearPerfilAntropometrico, medidasDe } from '../../domain/antropometria'
import type { MedidasAntropometricas, PerfilAntropometrico } from '../../domain/types'

/** Clave propia: nunca comparte el JSON grande de `alpha-db-v2`. */
const CLAVE = 'alpha-antropometria-v1'

function leerTodo(): PerfilAntropometrico[] {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return []
    const filas = JSON.parse(crudo) as unknown
    if (!Array.isArray(filas)) return []
    const validas: PerfilAntropometrico[] = []
    for (const fila of filas) {
      if (!fila || typeof fila !== 'object') continue
      const f = fila as Record<string, unknown>
      if (typeof f.usuarioId !== 'string') continue
      try {
        validas.push(
          crearPerfilAntropometrico(
            f.usuarioId,
            f,
            typeof f.actualizadoEn === 'string' ? f.actualizadoEn : new Date(0).toISOString(),
          ),
        )
      } catch {
        // Una fila incompleta no se rellena: una proporción inventada sería peor.
      }
    }
    return validas
  } catch {
    return []
  }
}

function escribirTodo(perfiles: readonly PerfilAntropometrico[]): void {
  localStorage.setItem(CLAVE, JSON.stringify(perfiles))
}

export function perfilAntropometricoDe(usuarioId: string): PerfilAntropometrico | undefined {
  return leerTodo().find((perfil) => perfil.usuarioId === usuarioId)
}

export function guardarPerfilAntropometrico(
  usuarioId: string,
  medidas: MedidasAntropometricas,
  actualizadoEn = new Date().toISOString(),
): PerfilAntropometrico {
  const perfil = crearPerfilAntropometrico(usuarioId, medidas, actualizadoEn)
  const previos = leerTodo().filter((p) => p.usuarioId !== usuarioId)
  escribirTodo([...previos, perfil])
  return perfil
}

/**
 * Reemplaza la copia aislada con la foto que RLS dejó ver. La validación se
 * repite fila por fila y no transforma ausencias en ceros.
 */
export function reemplazarPerfilesAntropometricos(
  perfiles: readonly PerfilAntropometrico[],
): void {
  const unicos = new Map<string, PerfilAntropometrico>()
  for (const perfil of perfiles) {
    try {
      const valido = crearPerfilAntropometrico(
        perfil.usuarioId,
        medidasDe(perfil),
        perfil.actualizadoEn,
      )
      unicos.set(valido.usuarioId, valido)
    } catch {
      // La fila queda fuera y no se repara con datos ficticios.
    }
  }
  escribirTodo([...unicos.values()])
}

/** El cierre de sesión también borra esta segunda persistencia. */
export function olvidarAntropometriaLocal(): void {
  localStorage.removeItem(CLAVE)
}

export const _antropometriaLocal = { CLAVE, leerTodo }

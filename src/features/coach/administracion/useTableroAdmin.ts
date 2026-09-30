import { useCallback, useState } from 'react'
import { useSesionOpcional } from '../../../app/SessionProvider'
import { useLectura } from '../../../components/ui/useLectura'
import { adminTablero } from '../../../data/consola/adminTablero'
import type { Lectura } from '../../../data/consola/creadores'
import { esTablaAusente, SECCIONES, type Seccion, type SeccionLeida } from '../../../domain/adminTablero'
import { useCapacidades } from '../consola/useCapacidades'
import type { Capacidad } from '../../../data/consola/capacidadesStaff'

const CLAVE_ABIERTAS = 'alpha.admin.abiertas'

function esTelefono(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 767px)').matches
      : false
  } catch {
    return false
  }
}

function leerAbiertas(): Seccion[] {
  try {
    const crudo = window.localStorage.getItem(CLAVE_ABIERTAS)
    if (!crudo) return []
    const v: unknown = JSON.parse(crudo)
    if (!Array.isArray(v)) return []
    const validas = v.filter((x): x is Seccion => typeof x === 'string' && (SECCIONES as readonly string[]).includes(x))
    // En teléfono solo cabe una abierta.
    return esTelefono() ? validas.slice(0, 1) : validas
  } catch {
    return []
  }
}

function guardarAbiertas(abiertas: Seccion[]): void {
  try {
    window.localStorage.setItem(CLAVE_ABIERTAS, JSON.stringify(abiertas))
  } catch {
    /* sin almacenamiento (ventana privada, datos bloqueados): la pantalla no lo necesita */
  }
}

const SIN_LEER: Lectura<SeccionLeida[]> = { ok: true, datos: [] }
const leerNada = () => Promise.resolve(SIN_LEER)

/** Estado del tablero de la 0102. `pendiente` = sin el permiso o sin la tabla: tarjetas grises. */
export type EstadoTablero =
  | { tipo: 'pendiente' }
  | { tipo: 'cargando' }
  | { tipo: 'fallo'; error: string }
  | { tipo: 'ok'; secciones: SeccionLeida[] }

export interface TableroAdmin {
  estado: EstadoTablero
  reintentar: () => void
  abiertas: Seccion[]
  alternar: (s: Seccion) => void
  esCoach: boolean
  tiene: (capacidad: Capacidad) => boolean
}

/**
 * El tablero (`admin_tablero`, migración 0102) solo se LEE con `ver_administracion` (o siendo el
 * coach). Sin ese permiso no se hace ni una consulta; si la consulta dice que la tabla no existe,
 * se dice «pendiente de activar». Un fallo de lectura de otra clase se dice como fallo.
 */
export function useTableroAdmin(): TableroAdmin {
  const esCoach = useSesionOpcional()?.usuario.rol === 'coach'
  const { tiene } = useCapacidades()
  const puedeLeer = esCoach || tiene('ver_administracion')
  const leer = useCallback(() => (puedeLeer ? adminTablero() : leerNada()), [puedeLeer])
  const { lectura, reintentar } = useLectura(leer)
  const [abiertas, setAbiertas] = useState<Seccion[]>(leerAbiertas)

  const alternar = useCallback((seccion: Seccion) => {
    setAbiertas((antes) => {
      const yaAbierta = antes.includes(seccion)
      const despues = yaAbierta ? antes.filter((s) => s !== seccion) : esTelefono() ? [seccion] : [...antes, seccion]
      guardarAbiertas(despues)
      return despues
    })
  }, [])

  let estado: EstadoTablero
  if (!puedeLeer) estado = { tipo: 'pendiente' }
  else if (lectura === null) estado = { tipo: 'cargando' }
  else if (!lectura.ok) estado = esTablaAusente(lectura.error) ? { tipo: 'pendiente' } : { tipo: 'fallo', error: lectura.error }
  else estado = { tipo: 'ok', secciones: lectura.datos }

  return { estado, reintentar, abiertas, alternar, esCoach, tiene }
}

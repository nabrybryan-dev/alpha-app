import { useEffect, useState } from 'react'
import { useSesionOpcional } from '../../../app/SessionProvider'
import { capacidadesDe, type Capacidad } from '../../../data/consola/capacidadesStaff'

/**
 * Las capacidades del usuario actual (`capacidades_staff`, migración 0083), cacheadas
 * durante la sesión: una sola consulta por persona conectada, no una por botón ni una por
 * pestaña. El caché vive en el módulo (no en el componente) a propósito: sobrevive a que
 * la consola se desmonte y se vuelva a montar al cambiar de pestaña del navegador, y se
 * comparte entre todos los botones que usan el hook a la vez.
 */
let cacheUsuarioId: string | undefined
let cachePromesa: Promise<Capacidad[]> | undefined

function capacidadesCacheadas(usuarioId: string): Promise<Capacidad[]> {
  if (cacheUsuarioId === usuarioId && cachePromesa) return cachePromesa
  cacheUsuarioId = usuarioId
  cachePromesa = capacidadesDe(usuarioId)
  return cachePromesa
}

/** Solo para pruebas: vacía el caché de módulo entre casos, para que cada uno arranque con
 *  una consulta propia en vez de heredar la del caso anterior. */
export function _reiniciarCacheCapacidadesParaPruebas(): void {
  cacheUsuarioId = undefined
  cachePromesa = undefined
}

export interface UseCapacidadesResultado {
  /** Todavía no llegó la respuesta de la base: los botones que dependen de esto deben
   *  quedar deshabilitados mientras tanto — nunca habilitados "por si acaso". */
  cargando: boolean
  tiene: (capacidad: Capacidad) => boolean
  /** El id de quien está viendo la consola, o `null` sin sesión (una pantalla montada
   *  suelta, fuera de `SessionProvider` — solo pasa en pruebas). Sirve para el `actorId`
   *  que piden `detenerPublicacion`/`reportarRiesgo`; nunca hace falta para la RPC
   *  `responder_como_staff`, que saca el actor de `auth.uid()` en el servidor. */
  usuarioId: string | null
}

/** Sin `SessionProvider` por encima (una pantalla montada suelta en una prueba) no hay a
 *  quién preguntarle capacidades: el resultado seguro es "ninguna", no una excepción. */
const SIN_SESION: UseCapacidadesResultado = { cargando: false, tiene: () => false, usuarioId: null }

interface EstadoCapacidades {
  usuarioId: string | undefined
  capacidades: Set<Capacidad>
  cargando: boolean
}

export function useCapacidades(): UseCapacidadesResultado {
  const sesion = useSesionOpcional()
  const usuarioId = sesion?.usuario.id
  const [estado, setEstado] = useState<EstadoCapacidades>(() => ({
    usuarioId,
    capacidades: new Set(),
    cargando: Boolean(usuarioId),
  }))

  useEffect(() => {
    if (!usuarioId) return
    let vivo = true
    // Nada de `setState` síncrono aquí: el efecto solo arranca la consulta (cacheada por
    // módulo) y deja que sea SU callback, no el cuerpo del efecto, quien actualice el
    // estado — así no encadena un render extra por cada montaje.
    capacidadesCacheadas(usuarioId).then((lista) => {
      if (!vivo) return
      setEstado({ usuarioId, capacidades: new Set(lista), cargando: false })
    })
    return () => {
      vivo = false
    }
  }, [usuarioId])

  if (!usuarioId) return SIN_SESION
  // Si `usuarioId` cambió (otra persona inició sesión) pero el efecto de arriba todavía
  // no resolvió para ESE id, `estado` sigue siendo el de la persona anterior: "cargando"
  // se deriva de esa comparación en vez de necesitar su propio `setState` disparador.
  const cargando = estado.usuarioId !== usuarioId || estado.cargando
  return { cargando, tiene: (capacidad) => estado.capacidades.has(capacidad), usuarioId }
}

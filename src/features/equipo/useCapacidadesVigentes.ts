import { useEffect, useState } from 'react'
import { useSesionOpcional } from '../../app/SessionProvider'
import { capacidadesDe, type Capacidad } from '../../data/consola/capacidadesStaff'

/**
 * Las capacidades VIGENTES de quien mira Equipo (E-11, segunda vuelta de la revisión de Codex
 * del 28-sep).
 *
 * `useCapacidades` de la consola guarda la primera respuesta durante toda la sesión (un caché
 * de módulo, pensado para no repetir la consulta en cada botón). Para Equipo eso no basta: la
 * cartera enseña nombres y semáforos que salen del entrenamiento, y si el coach le quita
 * `leer_entrenamiento` a mitad de sesión la pantalla seguía mostrándola con el permiso viejo.
 *
 * Aquí no hay caché: se pregunta al montar, cada vez que la pestaña vuelve a primer plano
 * (`focus` y `visibilitychange`) y, por si nunca pierde el foco, cada
 * `REVALIDAR_CAPACIDADES_MS`. En cuanto la respuesta llega sin la capacidad, lo que dependía
 * de ella deja de calcularse y de pintarse. `capacidadesDe` ya falla cerrado: un error de la
 * base es «ninguna capacidad», así que un fallo de red retira la cartera en vez de dejarla.
 */
export const REVALIDAR_CAPACIDADES_MS = 5 * 60 * 1000

export interface CapacidadesVigentes {
  /** Todavía no llegó la PRIMERA respuesta: nada que dependa de un permiso se enseña. */
  cargando: boolean
  tiene: (capacidad: Capacidad) => boolean
}

interface Estado {
  usuarioId: string | undefined
  capacidades: ReadonlySet<Capacidad>
  listo: boolean
}

export function useCapacidadesVigentes(): CapacidadesVigentes {
  const usuarioId = useSesionOpcional()?.usuario.id
  const [estado, setEstado] = useState<Estado>({ usuarioId, capacidades: new Set(), listo: false })

  useEffect(() => {
    if (!usuarioId) return
    let montado = true
    // Solo cuenta la respuesta de la ÚLTIMA pregunta: una lenta y vieja no pisa a una nueva.
    let turno = 0
    const preguntar = () => {
      const mio = ++turno
      void capacidadesDe(usuarioId).then((lista) => {
        if (montado && mio === turno) setEstado({ usuarioId, capacidades: new Set(lista), listo: true })
      })
    }
    preguntar()
    const alVolver = () => {
      if (document.visibilityState !== 'hidden') preguntar()
    }
    window.addEventListener('focus', alVolver)
    document.addEventListener('visibilitychange', alVolver)
    const reloj = window.setInterval(preguntar, REVALIDAR_CAPACIDADES_MS)
    return () => {
      montado = false
      window.removeEventListener('focus', alVolver)
      document.removeEventListener('visibilitychange', alVolver)
      window.clearInterval(reloj)
    }
  }, [usuarioId])

  if (!usuarioId) return { cargando: false, tiene: () => false }
  // Si cambió la persona, el estado es de la anterior: no vale.
  const propio = estado.usuarioId === usuarioId && estado.listo
  return {
    cargando: !propio,
    tiene: (capacidad) => propio && estado.capacidades.has(capacidad),
  }
}

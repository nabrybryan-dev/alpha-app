import { useCallback, useEffect, useState } from 'react'
import type { Lectura } from '../../data/consola/creadores'

/**
 * Una lectura con sus tres estados: `null` = cargando; luego los datos o el fallo. Un fallo
 * NUNCA se presenta como lista vacía: quien la usa debe pintar el error y ofrecer `reintentar`.
 * `leer` tiene que ser estable (una función de módulo o un `useCallback`).
 */
export function useLectura<T>(leer: () => Promise<Lectura<T>>): {
  lectura: Lectura<T> | null
  reintentar: () => void
} {
  const [lectura, setLectura] = useState<Lectura<T> | null>(null)
  const [vuelta, setVuelta] = useState(0)
  useEffect(() => {
    let vivo = true
    void leer().then((r) => {
      if (vivo) setLectura(r)
    })
    return () => {
      vivo = false
    }
  }, [leer, vuelta])
  const reintentar = useCallback(() => {
    setLectura(null)
    setVuelta((v) => v + 1)
  }, [])
  return { lectura, reintentar }
}

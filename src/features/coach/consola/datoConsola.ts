import { createContext, useContext, useEffect, useState } from 'react'

/**
 * Las lecturas asíncronas de la consola (plan vigente, historial de microciclos, corridas
 * de la cadena) cacheadas MIENTRAS LA CONSOLA ESTÉ ABIERTA.
 *
 * Es lo que hace que la consola se sienta conectada: la cabecera y la pestaña que piden el
 * mismo dato comparten una sola consulta, y volver a una pestaña o a una persona ya vista
 * pinta al instante en vez de volver a pasar por el esqueleto.
 *
 * El caché vive en el `ProveedorDatosConsola` (un `Map` por montaje de la página), no en el
 * módulo: cerrar la consola y volver a abrirla trae datos frescos, y las pruebas que montan
 * una pestaña suelta, sin proveedor, no heredan lo que cargó el caso anterior.
 *
 * Solo LEE: las funciones que se le pasan son de lectura y nunca lanzan (contrato de
 * `src/data/consola/*`); aun así, un rechazo se trata como `fallo` y no tumba la pantalla.
 */

export type CacheConsola = Map<string, Promise<unknown>>

/** El caché lo pone `ProveedorDatosConsola`; sin proveedor, cada lectura va directa. */
export const ContextoCacheConsola = createContext<CacheConsola | null>(null)

export type EstadoDato<T> = { estado: 'cargando' } | { estado: 'listo'; valor: T } | { estado: 'fallo' }

interface Guardado<T> {
  clave: string
  resultado: EstadoDato<T>
}

export function useDatoConsola<T>(clave: string | null, cargar: () => Promise<T>): EstadoDato<T> {
  const cache = useContext(ContextoCacheConsola)
  const [guardado, setGuardado] = useState<Guardado<T> | null>(null)

  useEffect(() => {
    if (clave === null) return
    let vivo = true
    let promesa = cache?.get(clave) as Promise<T> | undefined
    if (!promesa) {
      promesa = cargar()
      cache?.set(clave, promesa)
    }
    promesa.then(
      (valor) => {
        if (vivo) setGuardado({ clave, resultado: { estado: 'listo', valor } })
      },
      () => {
        // Un rechazo no se queda en el caché: la próxima vez se vuelve a intentar.
        cache?.delete(clave)
        if (vivo) setGuardado({ clave, resultado: { estado: 'fallo' } })
      },
    )
    return () => {
      vivo = false
    }
    // `cargar` cambia en cada render (es una flecha); la clave es la identidad del dato.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, cache])

  if (clave === null) return { estado: 'cargando' }
  // Si la clave cambió (otra persona) y el efecto aún no resolvió, lo guardado es de la
  // anterior: se deriva «cargando» en vez de pintar datos de otra persona un fotograma.
  if (!guardado || guardado.clave !== clave) return { estado: 'cargando' }
  return guardado.resultado
}

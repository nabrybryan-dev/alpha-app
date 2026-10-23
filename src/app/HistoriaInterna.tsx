import { useState, type ReactNode } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { ContextoDeHistoria } from './historiaInternaContexto'

interface Entrada {
  clave: string
  pathname: string
}

interface Estado {
  /** La clave de la dirección ya contada: para contar cada navegación una sola vez. */
  vista: string
  pila: Entrada[]
  /** Dónde está la persona dentro de `pila`. */
  i: number
}

/**
 * Lleva la cuenta de las pantallas que la persona ha recorrido DENTRO de la app (la pila y dónde está en
 * ella), para que el «‹» sepa si `navigate(-1)` la deja en una pantalla de la app. Se monta una vez, dentro del
 * enrutador. Una entrada nueva (PUSH) corta lo que hubiera «hacia delante»; un `replace` sustituye la actual;
 * el atrás y adelante del sistema (POP) mueven el puntero a la entrada con esa clave.
 */
export function HistoriaInterna({ children }: { children: ReactNode }) {
  const ubicacion = useLocation()
  const tipo = useNavigationType()
  const clave = ubicacion.key
  const pathname = ubicacion.pathname
  const [estado, setEstado] = useState<Estado>({ vista: clave, pila: [{ clave, pathname }], i: 0 })

  // Se ajusta durante el render (patrón de React para derivar estado de una prop): una vez por navegación.
  if (estado.vista !== clave) {
    const nueva = { clave, pathname }
    let siguiente: Estado
    if (tipo === 'PUSH') {
      const pila = [...estado.pila.slice(0, estado.i + 1), nueva]
      siguiente = { vista: clave, pila, i: pila.length - 1 }
    } else if (tipo === 'REPLACE') {
      const pila = estado.pila.map((e, n) => (n === estado.i ? nueva : e))
      siguiente = { vista: clave, pila, i: estado.i }
    } else {
      const donde = estado.pila.findIndex((e) => e.clave === clave)
      siguiente = donde >= 0 ? { vista: clave, pila: estado.pila, i: donde } : { vista: clave, pila: [nueva], i: 0 }
    }
    setEstado(siguiente)
  }

  const anterior = estado.i > 0 ? estado.pila[estado.i - 1].pathname : null
  return <ContextoDeHistoria.Provider value={{ anterior }}>{children}</ContextoDeHistoria.Provider>
}

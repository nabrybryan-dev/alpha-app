import { useEffect, useState } from 'react'
import { primerosPlanesPendientes } from '../../data/consola/primerosPlanes'
import { planesRenovadosPendientes } from '../../data/consola/planesRenovados'
import type { CapacidadesVigentes } from './useCapacidadesVigentes'

/** Cuenta de lo que espera aprobación, con la MISMA lectura que usan las bandejas. */
export interface PorAprobar {
  /** `null` = sin la capacidad: esa bandeja no se puede leer y no se cuenta. */
  primeros: number | null
  renovados: number | null
}

const ESPERANDO = new Set(['propuesto', 'espera_bryan'])

/**
 * Los primeros planes y los planes estratégicos renovados que esperan decisión, para la
 * cifra roja de «Por aprobar» en Equipo.
 *
 * Lee con las mismas funciones que `BandejaPrimerosPlanes` y `BandejaPlanesRenovados`, y
 * cuenta lo mismo que ellas cuentan (propuesto o espera de Bryan), para que la cifra y la
 * bandeja no discrepen. Sin la capacidad de una bandeja, esa cuenta es `null` —no cero—:
 * no poder leer no es lo mismo que no haber nada. Sin ninguna de las dos, `undefined`, y
 * la tarjeta no se pinta. Mientras llega la respuesta, también `undefined`.
 *
 * Las capacidades llegan de la pantalla (`useCapacidadesVigentes`), no del caché de sesión de
 * la consola: si le quitan la capacidad a mitad de sesión, la cuenta se retira (E-11).
 */
export function usePorAprobar({ cargando, tiene }: CapacidadesVigentes): PorAprobar | undefined {
  const lee1 = !cargando && tiene('aprobar_primer_plan')
  const lee2 = !cargando && tiene('aprobar_plan_estrategico')
  const [cuenta, setCuenta] = useState<{ clave: string; valor: PorAprobar } | undefined>()
  const clave = `${lee1}-${lee2}`

  useEffect(() => {
    if (!lee1 && !lee2) return
    let vivo = true
    const contar = <T extends { estado: string }>(lista: T[]) => lista.filter((p) => ESPERANDO.has(p.estado)).length
    Promise.all([
      lee1 ? primerosPlanesPendientes().then(contar) : Promise.resolve(null),
      lee2 ? planesRenovadosPendientes().then(contar) : Promise.resolve(null),
    ]).then(([primeros, renovados]) => {
      if (vivo) setCuenta({ clave: `${lee1}-${lee2}`, valor: { primeros, renovados } })
    })
    return () => {
      vivo = false
    }
  }, [lee1, lee2])

  if (!lee1 && !lee2) return undefined
  return cuenta?.clave === clave ? cuenta.valor : undefined
}

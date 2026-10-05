import { useCallback, useEffect, useState } from 'react'
import { primerosPlanesPendientes, type LecturaBandeja } from '../../data/consola/primerosPlanes'
import { planesRenovadosPendientes } from '../../data/consola/planesRenovados'
import type { CapacidadesVigentes } from './useCapacidadesVigentes'

/**
 * Lo que se sabe de UNA bandeja: su cuenta, o que su lectura falló (APP-F01 de la revisión
 * final de Codex, 28-sep: antes un error de red se contaba como 0 y la tarjeta decía «Nada
 * esperando tu firma»). `null` = sin la capacidad: esa bandeja no se lee y no se cuenta.
 */
export type CuentaBandeja = { ok: true; n: number } | { ok: false; error: string } | null

/** Cuenta de lo que espera aprobación, con la MISMA lectura que usan las bandejas. */
export interface PorAprobar {
  primeros: CuentaBandeja
  renovados: CuentaBandeja
  /** Vuelve a leer las bandejas (el botón «Reintentar» de un fallo). */
  reintentar: () => void
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
  const [intento, setIntento] = useState(0)
  const [cuenta, setCuenta] = useState<
    { clave: string; valor: { primeros: CuentaBandeja; renovados: CuentaBandeja } } | undefined
  >()
  // El intento va en la clave: al reintentar, la tarjeta vuelve a «cargando» en vez de seguir
  // enseñando el fallo viejo como si fuera la respuesta nueva.
  const clave = `${lee1}-${lee2}-${intento}`
  const reintentar = useCallback(() => setIntento((n) => n + 1), [])

  useEffect(() => {
    if (!lee1 && !lee2) return
    let vivo = true
    const contar = <T extends { estado: string }>(lectura: LecturaBandeja<T>): CuentaBandeja =>
      lectura.ok ? { ok: true, n: lectura.datos.filter((p) => ESPERANDO.has(p.estado)).length } : lectura
    Promise.all([
      lee1 ? primerosPlanesPendientes().then(contar) : Promise.resolve(null),
      lee2 ? planesRenovadosPendientes().then(contar) : Promise.resolve(null),
    ]).then(([primeros, renovados]) => {
      if (vivo) setCuenta({ clave: `${lee1}-${lee2}-${intento}`, valor: { primeros, renovados } })
    })
    return () => {
      vivo = false
    }
  }, [lee1, lee2, intento])

  if (!lee1 && !lee2) return undefined
  return cuenta?.clave === clave ? { ...cuenta.valor, reintentar } : undefined
}

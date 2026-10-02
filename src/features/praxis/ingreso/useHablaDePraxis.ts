import { useCallback, useEffect, useState } from 'react'
import { Voz } from '../motor/voz'

/**
 * Que Praxis diga un texto en voz alta, con el módulo de voz que ya existe (`motor/voz.ts`: speechSynthesis solo
 * tras un toque, solo voces del propio aparato). Siempre se muestra también el texto: si el aparato no tiene voz
 * en español, `decir` devuelve false y la pantalla sigue sola, leyendo.
 */
export function useHablaDePraxis() {
  const [activa, setActiva] = useState(true)

  const decir = useCallback((texto: string): boolean => {
    if (!activa) return false
    Voz.activa = true // se llama desde un efecto que sigue a un toque de la persona
    return Voz.decir(texto, () => {}, () => {})
  }, [activa])

  const callar = useCallback(() => { Voz.callar() }, [])

  const alternar = useCallback(() => {
    if (activa) Voz.callar()
    setActiva(!activa)
  }, [activa])

  useEffect(() => () => { Voz.callar() }, [])

  return { activa, decir, callar, alternar }
}

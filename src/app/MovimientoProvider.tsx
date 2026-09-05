import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ContextoDeMovimiento } from './movimientoContexto'
import {
  aplicarNivel,
  medirFluidez,
  nivelDeMovimiento,
  prefiereMenosMovimiento,
} from '../lib/movimientoAdaptativo'

/**
 * EL INTERRUPTOR DE MOVIMIENTO DE TODA LA APP, EN UN SOLO SITIO.
 *
 * Mide una vez qué tal va el aparato, escucha la preferencia del sistema, y deja
 * que cualquier pantalla declare que hay una serie en curso. Con esas tres cosas
 * escribe `data-movimiento` en `<html>` y `tokens.css` hace el resto.
 *
 * ## Por qué la medición va una sola vez y no en bucle
 *
 * Medir fluidez cuesta fluidez: son treinta fotogramas de trabajo extra. Hacerlo
 * en bucle para «adaptarse en vivo» tiene el problema de que la propia medición
 * empeora lo que mide, y encima el nivel podría oscilar —pleno, sobrio, pleno—
 * que se ve mucho peor que quedarse en el malo. Una vez, al arrancar, y ya.
 *
 * ## Por qué el retraso
 *
 * Los primeros fotogramas después de montar la app son los peores de la sesión:
 * se están hidratando componentes, resolviendo fuentes y pintando la primera
 * pantalla. Medir ahí diría que cualquier teléfono es malo. Se espera a que eso
 * pase; mientras tanto el nivel es `pleno`, que es el correcto por defecto —ver
 * la regla de `movimientoAdaptativo.ts`: no saber nunca degrada.
 */

/** Cuánto se espera antes de medir. Ver el porqué arriba. */
const ESPERA_ANTES_DE_MEDIR = 2500

export function MovimientoProvider({ children }: { children: ReactNode }) {
  const [reducido, setReducido] = useState(prefiereMenosMovimiento)
  const [fps, setFps] = useState<number | null>(null)
  const [enSerie, setEnSerie] = useState(false)

  // La preferencia puede cambiar mientras la app está abierta —el sistema tiene
  // un interruptor— así que se escucha, no se lee una vez.
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const consulta = matchMedia('(prefers-reduced-motion: reduce)')
    const alCambiar = () => setReducido(consulta.matches)
    consulta.addEventListener?.('change', alCambiar)
    return () => consulta.removeEventListener?.('change', alCambiar)
  }, [])

  useEffect(() => {
    let vivo = true
    const t = setTimeout(() => {
      void medirFluidez().then((v) => {
        // Si el componente ya no está, no se toca el estado: la medición dura
        // medio segundo y en ese rato se puede haber cerrado la sesión.
        if (vivo) setFps(v)
      })
    }, ESPERA_ANTES_DE_MEDIR)
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [])

  const nivel = nivelDeMovimiento({ reducido, fps, enSerie })

  useEffect(() => {
    aplicarNivel(nivel)
  }, [nivel])

  const declararSerie = useCallback((enCurso: boolean) => setEnSerie(enCurso), [])
  const valor = useMemo(() => ({ nivel, declararSerie }), [nivel, declararSerie])

  return <ContextoDeMovimiento.Provider value={valor}>{children}</ContextoDeMovimiento.Provider>
}

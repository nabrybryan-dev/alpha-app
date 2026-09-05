import { useEffect, useState } from 'react'
import { calcularRitmo, type RitmoSesion } from '../../../../domain/ritmoSesion'
import type { Sesion } from '../../../../domain/types'
import { leerTiempoCrono } from '../../CronometroSesion'

/**
 * EL RITMO DE LA SESIÓN, LEÍDO DEL MISMO CRONÓMETRO QUE SE VE EN LA PARED.
 *
 * Los rótulos del muro dicen cuánto va a durar la sesión, en qué bloque se está y cuántos
 * ejercicios quedan. Todo eso lo calcula `calcularRitmo()` en el dominio, y todo depende
 * del tiempo transcurrido — que no es un contador de este archivo: es el del cronómetro,
 * leído de donde lo guarda `CronometroSesion`.
 *
 * Es la misma lectura que hace el panel de ritmo de la pantalla de sesión, y a propósito.
 * Un segundo reloj para el salón daría dos duraciones distintas de la misma sesión en dos
 * pantallas de la misma app, y ninguna de las dos sería comprobable contra la otra.
 *
 * El tic es de un segundo, como el del cronómetro. Se lee del almacenamiento en vez de
 * recibirlo por prop porque el cronómetro se pausa y se reanuda tocándolo, y el estado de
 * esa pausa vive dentro de él: preguntarle al almacenamiento es preguntarle a él.
 *
 * Vive en su propio archivo y no junto a los rótulos porque un archivo que exporta un hook
 * y además componentes se lleva un aviso del linter, y la regla del repo es no dejar ni un
 * aviso más de los que había. Y se llama `useRitmoDelSalon` y no `usarRitmoDelSalon`
 * —el único nombre en inglés de por aquí— porque `react-hooks/rules-of-hooks` es ERROR en
 * este repo y reconoce los hooks por el prefijo `use`: con el nombre en castellano no ve un
 * hook, ve una función suelta llamando a `useState`, y bloquea el build.
 */
export function useRitmoDelSalon(sesion: Sesion | undefined): RitmoSesion | undefined {
  const sesionId = sesion?.id
  const [realSeg, setRealSeg] = useState(() => (sesionId ? leerTiempoCrono(sesionId) : 0))

  useEffect(() => {
    if (!sesionId) return
    // El estado se pone DENTRO del tic y nunca en el cuerpo del efecto: llamar a un
    // `setState` al montar es lo que la regla `react-hooks/set-state-in-effect` —que en
    // este repo es error, no aviso— existe para impedir. El valor de partida ya lo pone
    // el `useState` perezoso de arriba, que lee el mismo cronómetro.
    const id = window.setInterval(() => setRealSeg(leerTiempoCrono(sesionId)), 1000)
    return () => window.clearInterval(id)
  }, [sesionId])

  if (!sesion) return undefined
  return calcularRitmo(sesion, realSeg)
}

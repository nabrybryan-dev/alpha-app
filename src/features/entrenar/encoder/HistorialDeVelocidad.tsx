import { useMemo, useState } from 'react'
import { db } from '../../../data/dbInstance'
import { HistorialEncoder } from './HistorialEncoder'
import { ejerciciosConMedicion, tomasDeMicrociclos } from './historialDeMicrociclos'

/**
 * El historial de %PV de un asesorado, dentro de Progreso.
 *
 * ## Por qué no se pinta si no hay nada medido
 *
 * Hoy casi nadie graba. Una tarjeta vacía que dice «aún no hay datos» en una
 * pantalla que la persona abre cada semana es ruido permanente: ocupa sitio,
 * enseña un hueco y no se puede hacer nada al respecto desde aquí. Cuando haya
 * una serie medida aparece sola.
 *
 * ## El selector solo sale si hay más de un ejercicio
 *
 * Con uno, elegir no es una decisión: es un paso.
 */

export function HistorialDeVelocidad({ usuarioId }: { usuarioId: string }) {
  const microciclos = useMemo(() => db.microciclos.byUsuario(usuarioId), [usuarioId])
  const ejercicios = useMemo(() => ejerciciosConMedicion(microciclos), [microciclos])
  const [elegido, setElegido] = useState<string | null>(null)

  const ejercicio = elegido ?? ejercicios[0]
  const tomas = useMemo(
    () => (ejercicio ? tomasDeMicrociclos(microciclos, ejercicio) : []),
    [microciclos, ejercicio],
  )

  // Sin una sola serie medida no hay pantalla que enseñar, y tampoco un hueco.
  if (!ejercicio) return null

  return (
    <section>
      {ejercicios.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {ejercicios.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setElegido(n)}
              className={`press min-h-11 rounded-full px-3 text-[12.5px] ${
                n === ejercicio
                  ? 'border border-rojo bg-rojo/15 font-bold text-rojo'
                  : 'border border-linea text-tenue'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      <HistorialEncoder tomas={tomas} ejercicio={ejercicio} />
    </section>
  )
}

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
      {/* La `key` fuerza a React a SUSTITUIR el subarbol al cambiar de ejercicio.
          Sin ella, puntos, tendencia y rotulos se reemplazaban en el mismo
          fotograma sobre el mismo `<svg>`.
          Es reemplazo con desvanecido de entrada y NO un fundido cruzado, a
          proposito: dos lineas de tendencia superpuestas, aunque sean 160 ms,
          enseñarian una tendencia que no existe. */}
      {/* Se pide la keyframe con la duracion de aqui y no la clase `.area-aparece`
          tal cual: esa lleva 1 s con 0,35 de retraso, pensada para el trazo del
          grafico de evolucion. Aqui son 160 ms, que es lo que tarda un cambio de
          ficha en sentirse instantaneo. */}
      <div
        key={ejercicio}
        style={{ animation: 'area-aparece var(--dur-toque) var(--ease-salida) both' }}
      >
        <HistorialEncoder tomas={tomas} ejercicio={ejercicio} />
      </div>
    </section>
  )
}

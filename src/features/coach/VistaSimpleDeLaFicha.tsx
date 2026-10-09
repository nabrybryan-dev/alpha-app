import { Card } from '../../components/ui/Card'
import { db } from '../../data/dbInstance'

interface Props {
  usuarioId: string
  vistaSimple: boolean | undefined
}

/**
 * El interruptor de la vista sin salón 3D ni pestañas (8-oct-2026, primer caso
 * Karin Better).
 *
 * Mismo patrón que `SexoDeLaFicha`: dos botones, el que está pulsado es el que
 * vale, se guarda al tocar y sube por el mismo camino que el resto de la
 * ficha (`db.perfiles`, `subirPerfil`). No es un nivel de la persona — no dice
 * nada de su condición física — es solo cuánta interfaz necesita para llegar
 * a su rutina y a su comida.
 */
export function VistaSimpleDeLaFicha({ usuarioId, vistaSimple }: Props) {
  return (
    <Card>
      <p className="kicker">Vista de la app</p>
      <p className="mt-1 text-xs text-tenue">
        Entrenar sin el salón 3D ni el mando, y la comida en una sola pantalla sin
        pestañas. Para quien le cuesta interactuar con el cuarto 3D.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Vista de la app">
        <button
          type="button"
          aria-pressed={!vistaSimple}
          onClick={() => db.perfiles.guardarVistaSimple(usuarioId, undefined)}
          className={`press rounded-full border px-3.5 py-1.5 text-xs font-bold ${
            !vistaSimple ? 'border-rojo bg-rojo text-white' : 'border-linea bg-surface-2 text-texto'
          }`}
        >
          Normal (el salón)
        </button>
        <button
          type="button"
          aria-pressed={Boolean(vistaSimple)}
          onClick={() => db.perfiles.guardarVistaSimple(usuarioId, true)}
          className={`press rounded-full border px-3.5 py-1.5 text-xs font-bold ${
            vistaSimple ? 'border-rojo bg-rojo text-white' : 'border-linea bg-surface-2 text-texto'
          }`}
        >
          Vista simple
        </button>
      </div>
    </Card>
  )
}

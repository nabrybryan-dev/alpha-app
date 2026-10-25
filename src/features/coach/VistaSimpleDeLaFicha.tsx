import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { db } from '../../data/dbInstance'

interface Props {
  usuarioId: string
  vistaSimple: boolean | undefined
}

/**
 * «Vista de la app»: el interruptor de la vista sin salón 3D ni pestañas (8-oct-2026, primer
 * caso Karin Better; maqueta 7, paso 10).
 *
 * Antes eran dos botones («Normal (el salón)» / «Vista simple»). La maqueta lo dejó en un
 * interruptor: mismo dato (`perfil.vistaSimple`), mismo camino de guardado (`db.perfiles`,
 * `subirPerfil`) y solo el staff puede cambiarlo (trigger `proteger_perfil`). No es un nivel
 * de la persona —no dice nada de su condición física—: es cuánta interfaz necesita para
 * llegar a su rutina y a su comida.
 */
export function VistaSimpleDeLaFicha({ usuarioId, vistaSimple }: Props) {
  // El estado local hace que el interruptor responda en el acto; el dato que manda se guarda
  // en el mismo `db.perfiles` de siempre, y el resto de la ficha se refresca con `useDbVersion`.
  const [encendido, setEncendido] = useState(Boolean(vistaSimple))
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="kicker">Vista de la app</p>
          <p className="mt-1 text-xs text-tenue">
            Modo simple: entrenar sin el salón 3D ni el mando, y la comida en una sola pantalla sin
            pestañas. Para quien le cuesta interactuar con el cuarto 3D.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm font-bold text-texto">
          <span>Modo simple</span>
          <input
            type="checkbox"
            role="switch"
            checked={encendido}
            aria-label="Modo simple"
            onChange={(e) => {
              const nuevo = e.target.checked
              setEncendido(nuevo)
              db.perfiles.guardarVistaSimple(usuarioId, nuevo ? true : undefined)
            }}
            className="h-6 w-6 cursor-pointer accent-rojo"
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-tenue" aria-live="polite">
        {encendido
          ? 'La persona ve la versión simple: la lista de entrenar y la comida en una pantalla.'
          : 'La persona ve la versión de siempre: el salón y las pestañas.'}
      </p>
    </Card>
  )
}

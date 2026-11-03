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
  const real = Boolean(vistaSimple)
  // El cambio local solo vale mientras la prop siga siendo la misma con la que se pulsó. Si
  // cambia la persona (la ficha única reutiliza el componente) o el dato se corrige, manda la
  // prop: así no se queda el interruptor de la persona anterior ni se enseña un estado falso.
  const [intento, setIntento] = useState<{ usuarioId: string; real: boolean; valor: boolean } | null>(null)
  const [error, setError] = useState(false)
  const vigente =
    intento !== null && intento.usuarioId === usuarioId && intento.real === real ? intento : null
  const encendido = vigente ? vigente.valor : real

  const cambiar = (nuevo: boolean) => {
    setIntento({ usuarioId, real, valor: nuevo })
    setError(false)
    try {
      // El dato que manda se guarda en el mismo `db.perfiles` de siempre; el resto de la ficha
      // se refresca con `useDbVersion`.
      db.perfiles.guardarVistaSimple(usuarioId, nuevo ? true : undefined)
    } catch {
      // No se guardó: el interruptor vuelve al valor real y la pantalla lo dice.
      setIntento(null)
      setError(true)
    }
  }

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
            onChange={(e) => cambiar(e.target.checked)}
            className="h-6 w-6 cursor-pointer accent-rojo"
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-rojo">
          No se pudo guardar el modo simple. Sigue como estaba; vuelve a intentarlo.
        </p>
      )}
      <p className="mt-2 text-xs text-tenue" aria-live="polite">
        {encendido
          ? 'La persona ve la versión simple: la lista de entrenar y la comida en una pantalla.'
          : 'La persona ve la versión de siempre: el salón y las pestañas.'}
      </p>
    </Card>
  )
}
